import {
  normalizeStoryCast,
  storyCastIssues,
  castIssueMessage,
} from "./storyCast";
import * as db from "./storage";
import { getApiKey } from "./settings";
import {
  createGeminiSpeech,
  speechIntervals,
  validVoice,
} from "./geminiSpeech";
import {
  alignNarration,
  maxStoryDuration,
  storyPrompt,
  storyStyles,
  storyVideoDuration,
} from "./story";
import {
  blobDataUrl,
  generateStoryReference,
  planStoryVisuals,
} from "./google";
import { proposeNextBatch } from "./storyPlanner";
import type { Asset, Narration, DialogueTurn } from "../types";
import { planDialogueShots } from "./storyDialogue";
export type StoryAction = "plan" | "references" | "produce";
async function readStory(projectId: string) {
  const work = await db.readWorkspace();
  const story = work.projects.find((p) => p.id === projectId)?.story;
  if (!story) throw new Error("Guarda el guion antes de preparar la historia.");
  return { work, story };
}
export async function prepareStory(
  projectId: string,
  progress: (text: string) => Promise<void>,
  stopped: () => boolean,
  action: StoryAction = "produce",
  referenceId?: string,
) {
  if (!getApiKey())
    throw new Error(
      "Conecta Google en Ajustes. La misma clave prepara el plan, las voces, las referencias y los vídeos.",
    );
  await db.setStoryError(projectId);
  let { story } = await readStory(projectId);
  if (action === "plan") {
    while (
      story.planning &&
      story.planning.cursor < story.planning.units.length
    ) {
      if (stopped()) return;
      await progress(
        `Leyendo el guion y diseñando escenas · ${story.planning.cursor} de ${story.planning.units.length} fragmentos`,
      );
      story = await db.saveStoryState(
        projectId,
        await proposeNextBatch(getApiKey(), story),
      );
      await progress(`${story.blocks.length} escenas propuestas`);
    }
    if (story.autoReferences)
      await prepareReferences(projectId, progress, stopped);
    if (!stopped()) {
      story = (await readStory(projectId)).story;
      await db.saveStoryState(projectId, { ...story, phase: "review" });
      await progress("Propuesta lista para revisar");
    }
    return;
  }
  if (action === "references") {
    await prepareReferences(projectId, progress, stopped, referenceId);
    return;
  }
  if (story.phase === "planning")
    throw new Error("Termina de preparar la propuesta antes de producir.");
  story = normalizeStoryCast(story);
  const castIssue = storyCastIssues(story).find(
    (i) => !story.blocks.find((b) => b.id === i.blockId)?.sceneIds,
  );
  if (castIssue) throw new Error(castIssueMessage(castIssue));
  if (story.phase === "review" || !story.phase)
    story = await db.saveStoryState(projectId, {
      ...story,
      phase: "production",
    });
  for (const [index, block] of story.blocks.entries()) {
    if (stopped()) return;
    if (block.sceneIds) continue;
    const { work } = await readStory(projectId);
    let audio: Narration | undefined;
    let pieces: {
      text: string;
      start: number;
      end: number;
      speaker?: string;
      dialogue?: DialogueTurn[];
    }[];
    if (story.mode === "voiceover") {
      await progress(
        `Creando voz con Gemini TTS · escena ${index + 1} de ${story.blocks.length}`,
      );
      const voice = validVoice(story.voiceId) ? story.voiceId : "Kore";
      const direction =
        story.voiceDirection || "Lectura natural y clara, ritmo tranquilo.";
      audio = work.narrations.find(
        (n) =>
          n.story_id === story.id &&
          n.block_id === block.id &&
          ((n.provider !== "gemini" &&
            (!n.alignment || n.alignment.characters.join("") === block.text)) ||
            (n.text === block.text &&
              n.voice === voice &&
              n.direction === direction)),
      );
      if (!audio) {
        const result = await createGeminiSpeech(
          getApiKey(),
          voice,
          block.text,
          direction,
        );
        audio = {
          ...result,
          id: crypto.randomUUID(),
          project_id: projectId,
          story_id: story.id,
          block_id: block.id,
        };
        await db.putNarration(audio);
      }
      if (!audio.duration) {
        const ctx = new AudioContext();
        try {
          audio = {
            ...audio,
            duration: (
              await ctx.decodeAudioData(await audio.blob.arrayBuffer())
            ).duration,
          };
        } finally {
          await ctx.close();
        }
        await db.putNarration(audio);
      }
      pieces = audio.alignment
        ? alignNarration(block.text, audio, maxStoryDuration(story.settings))
        : speechIntervals(
            audio.duration!,
            maxStoryDuration(story.settings),
            audio.cuts,
          ).map((span) => ({ ...span, text: block.text }));
    } else {
      pieces = planDialogueShots(story, block).map((shot) => ({
        text: shot.text,
        speaker: shot.speaker,
        dialogue: shot.dialogue,
        start: 0,
        end: shot.duration,
      }));
    }
    await db.createStoryScenes(
      projectId,
      story.id,
      block.id,
      pieces.map((piece, i) => ({
        duration: storyVideoDuration(piece.end - piece.start, story.settings),
        story: {
          storyId: story.id,
          blockId: block.id,
          text: piece.text,
          speaker: piece.dialogue
            ? piece.speaker
            : piece.speaker || block.speaker,
          dialogue: piece.dialogue,
          participants: piece.dialogue
            ? [
                ...new Set([
                  ...piece.dialogue.map((t) => t.speaker),
                  ...(block.participants || []),
                ]),
              ]
            : block.participants,
          locationName: block.locationName,
          shotMode: block.shotMode || "auto",
          visual: block.visual
            ? `${block.visual}${pieces.length > 1 ? `\nTramo ${i + 1} de ${pieces.length}: desarrolla este momento de la acción manteniendo continuidad con los demás tramos.` : ""}`
            : "",
          planned: !!block.visual,
          audioId: audio?.id,
          audioStart: audio ? piece.start : undefined,
          audioEnd: audio ? piece.end : undefined,
          part:
            pieces.length > 1
              ? { index: i + 1, total: pieces.length }
              : undefined,
        },
      })),
    );
    const updated = await db.readWorkspace();
    for (const scene of updated.scenes.filter(
      (s) => s.story?.blockId === block.id,
    ))
      if (scene.story?.planned)
        await db.patchScene(scene.id, {
          prompt: storyPrompt(
            story,
            scene.story,
            scene.reference_asset_ids?.length
              ? scene.reference_asset_ids
              : scene.first_frame_asset_id
                ? [scene.first_frame_asset_id]
                : [],
          ),
        });
    await progress(`Escena ${index + 1} preparada · voz y duración guardadas`);
  }
  // Existing projects created by the previous release can finish without ElevenLabs.
  const work = await db.readWorkspace();
  const pending = work.scenes.filter(
    (s) => s.story?.storyId === story.id && !s.story.planned,
  );
  for (let index = 0; index < pending.length; index += 8) {
    if (stopped()) return;
    const batch = pending.slice(index, index + 8);
    await progress(
      `Completando el plan visual · ${index + 1} de ${pending.length}`,
    );
    const plan = await planStoryVisuals(
      getApiKey(),
      `Planifica acciones visuales en español. Mantén este estilo: ${story.style}. Devuelve una escena por ID. SCENES: ${JSON.stringify(batch.map((s) => ({ id: s.id, text: s.story!.text })))}`,
      batch.map((s) => s.id),
    );
    for (const scene of batch) {
      const visual = plan.find((p) => p.id === scene.id)!;
      const next = { ...scene.story!, visual: visual.visual, planned: true };
      await db.patchScene(scene.id, {
        title: visual.title,
        story: next,
        prompt: storyPrompt(story, next),
      });
    }
  }
  if (!stopped()) {
    story = (await readStory(projectId)).story;
    await db.saveStoryState(projectId, { ...story, phase: "ready" });
    await progress(
      "Narración y escenas preparadas. Añadiendo vídeos a la cola…",
    );
  }
}
async function prepareReferences(
  projectId: string,
  progress: (text: string) => Promise<void>,
  stopped: () => boolean,
  onlyId?: string,
) {
  const initial = [
    ...((await readStory(projectId)).story.references || []),
  ].sort((a, b) => Number(b.type === "STYLE") - Number(a.type === "STYLE"));
  for (const [index, ref] of initial.entries()) {
    if (stopped()) return;
    if (onlyId ? ref.id !== onlyId : !!ref.assetId) continue;
    const { work, story } = await readStory(projectId);
    const current = story.references?.find((r) => r.id === ref.id);
    if (!current) continue;
    await progress(
      `Creando referencia con Nano Banana · ${ref.name} (${index + 1}/${initial.length})`,
    );
    const guides =
      story.references
        ?.filter((r) => r.id !== ref.id && r.type === "STYLE" && r.assetId)
        .flatMap((r) => work.assets.find((a) => a.id === r.assetId) || [])
        .slice(0, 2) || [];
    const image = await generateStoryReference(
      getApiKey(),
      `${storyStyles.find((s) => s.id === story.style)?.prompt}\nArt direction: ${story.direction}\n${current.prompt}\n${current.locationName ? `EMPTY SET for recurring location ${current.locationName}. Establish its architecture, materials, furniture placement, lighting and camera geography. No people. Show a clear wide view that can be reused from several camera angles.` : "Single reusable visual reference."} No lettering, watermarks, labels, or collage.`,
      guides,
    );
    const asset: Asset = {
      id: crypto.randomUUID(),
      type: ref.type,
      data_url: await blobDataUrl(image),
      file_name: `${ref.name}.${image.type.includes("jpeg") ? "jpg" : "png"}`,
      is_global: false,
      project_ids: [projectId],
      created_at: new Date().toISOString(),
    };
    await db.saveStoryReference(projectId, ref.id, asset);
    await progress(`Referencia guardada · ${ref.name}`);
  }
}
