import {
  normalizeStoryCast,
  storyCastIssues,
  findStoryCharacter,
  assignStorySpeaker,
} from "../src/lib/storyCast";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alignNarration,
  makeStory,
  splitText,
  storyPrompt,
  storyVideoDuration,
  storyReferenceIds,
  renameSpeakerLabel,
} from "../src/lib/story";
import {
  DEFAULT_VIDEO,
  VEO_MODEL,
  type StoryConfig,
  type Narration,
} from "../src/types";
import {
  createGeminiSpeech,
  pcmToWave,
  silenceCuts,
  speechIntervals,
} from "../src/lib/geminiSpeech";
import {
  newStoryProposal,
  applyProposalBatch,
  type ProposalResponse,
} from "../src/lib/storyPlanner";
import { planStoryVisuals } from "../src/lib/google";
import * as db from "../src/lib/storage";
import {
  makeSequenceItem,
  resolveTimeline,
  splitSequence,
} from "../src/lib/timeline";
const config: StoryConfig = {
  script: "Un pequeño paso permite comprender una idea nueva.",
  mode: "voiceover",
  style: "explainer",
  direction: "Laboratorio luminoso",
  characters: [],
  voiceId: "my-voice",
  voiceName: "Mi voz",
  settings: DEFAULT_VIDEO,
};
afterEach(() => vi.unstubAllGlobals());
function audioFor(text: string, duration: number): Narration {
  const characters = Array.from(text);
  return {
    id: "audio",
    project_id: "p",
    story_id: "s",
    block_id: "b",
    blob: new Blob(["audio"]),
    duration,
    alignment: {
      characters,
      character_start_times_seconds: characters.map(
        (_, i) => (i * (duration - 0.2)) / characters.length,
      ),
      character_end_times_seconds: characters.map(
        (_, i) => ((i + 1) * (duration - 0.2)) / characters.length,
      ),
    },
  };
}
describe("script coverage and exact narration timing", () => {
  it("preserves a long script word for word across bounded chunks, including paragraphs", () => {
    const script = Array.from(
      { length: 400 },
      (_, i) => `Párrafo ${i}: ¿Cómo funciona? Así se conserva cada palabra.\n`,
    )
      .join("")
      .trim();
    const story = makeStory({ ...config, script });
    expect(story.blocks.length).toBeGreaterThan(20);
    expect(story.blocks.map((b) => b.text).join("")).toBe(script);
    expect(story.blocks.every((b) => b.text.length <= 1200)).toBe(true);
    expect(splitText("🪐".repeat(2400), 1200).join("")).toBe("🪐".repeat(2400));
  });
  it("assigns speaker turns without speaking their labels and keeps each spoken clip within model limits", () => {
    const text =
      "Estamos explicando cómo la energía cambia de forma mientras el sistema se mueve y conserva todos sus elementos originales.";
    const story = makeStory({
      ...config,
      mode: "spoken",
      script: `Ana: ${text}\nLuis: Entiendo.\nAhora lo veo.`,
      characters: [
        { name: "Ana", description: "abrigo rojo", voice: "grave" },
        { name: "Luis", description: "gafas", voice: "suave" },
      ],
      settings: { ...DEFAULT_VIDEO, model: VEO_MODEL },
    });
    expect(
      story.blocks
        .filter((b) => b.speaker === "Ana")
        .map((b) => b.text)
        .join(""),
    ).toBe(text);
    expect(story.blocks.slice(-2).map((b) => b.speaker)).toEqual([
      "Luis",
      "Luis",
    ]);
    expect(
      story.blocks.every((b) => b.text.trim().split(/\s+/).length <= 13),
    ).toBe(true);
    expect(
      storyVideoDuration(7.5, { ...DEFAULT_VIDEO, model: VEO_MODEL }),
    ).toBe(8);
    expect(storyVideoDuration(2.1, DEFAULT_VIDEO)).toBe(3);
    const prompt = storyPrompt(story, {
      text: "Entiendo.",
      speaker: "Luis",
      visual: "Primer plano",
    });
    expect(prompt).toContain("Luis says exactly");
    expect(prompt).toContain('"Entiendo."');
    expect(prompt).toContain("Ana: appearance abrigo rojo; voice grave");
  });
  it("uses every second and every character, with contiguous cuts and no overlong video", () => {
    const text =
      "Una explicación detallada muestra primero los objetos, después su movimiento y finalmente el resultado. Nada del guion debe desaparecer.";
    const audio = audioFor(text, 34.7);
    const pieces = alignNarration(text, audio, 8);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces[0].start).toBe(0);
    expect(pieces.at(-1)?.end).toBe(audio.duration);
    pieces.forEach((p, i) => {
      expect(p.end - p.start).toBeLessThanOrEqual(8);
      if (i) expect(p.start).toBe(pieces[i - 1].end);
    });
  });
  it("rejects missing or corrupt timing instead of silently cutting the narration", () => {
    const audio = audioFor(config.script, 15);
    expect(() => alignNarration("different script", audio, 10)).toThrow(
      "tiempos válidos",
    );
    audio.alignment!.character_end_times_seconds[2] = NaN;
    expect(() => alignNarration(config.script, audio, 10)).toThrow(
      "sincronización",
    );
  });
});
describe("story persistence and editable montage", () => {
  it("atomically creates each block once, retains voice during regeneration and removes its audio with the project", async () => {
    const project = await db.createProject(
      "Historia",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    const story = makeStory(config);
    await db.createStory(project.id, story);
    const audio = {
      ...audioFor(config.script, 7),
      project_id: project.id,
      story_id: story.id,
      block_id: story.blocks[0].id,
    };
    await db.putNarration(audio);
    const storyScene = {
      storyId: story.id,
      blockId: story.blocks[0].id,
      text: config.script,
      visual: "Mesa",
      planned: true,
      audioId: audio.id,
      audioStart: 0,
      audioEnd: 7,
    };
    await db.createStoryScenes(project.id, story.id, story.blocks[0].id, [
      { story: storyScene, duration: 7 },
    ]);
    await db.createStoryScenes(project.id, story.id, story.blocks[0].id, [
      { story: storyScene, duration: 7 },
    ]);
    let work = await db.readWorkspace();
    const scene = work.scenes.find((s) => s.project_id === project.id)!;
    expect(work.scenes.filter((s) => s.project_id === project.id)).toHaveLength(
      1,
    );
    for (const id of ["first", "replacement"])
      await db.saveVersion(scene.id, {
        id,
        blob: new Blob([id]),
        prompt: "video",
        settings: DEFAULT_VIDEO,
        mode: "generate",
        duration: 5,
        created_at: "today",
      });
    work = await db.readWorkspace();
    const saved = work.projects.find((p) => p.id === project.id)!;
    const clips = resolveTimeline(
      saved.sequence_items!,
      work.scenes,
      {},
      work.narrations,
    );
    expect(await clips[0].blob?.text()).toBe("replacement");
    expect(clips[0].length).toBe(7); // Short visuals hold; narration must not be truncated.
    expect(clips[0].videoDuration).toBe(5);
    expect(clips[0].narration?.blob).toBeTruthy();
    expect(work.scenes.find((s) => s.id === scene.id)?.versions).toHaveLength(
      2,
    );
    const split = splitSequence(
      saved.sequence_items!,
      clips[0],
      3,
      "second-half",
    );
    const timeline = resolveTimeline(
      split.reverse(),
      work.scenes,
      {},
      work.narrations,
    );
    expect(timeline.map((c) => [c.in, c.out])).toEqual([
      [3, 7],
      [0, 3],
    ]);
    expect(timeline[0].narration?.offset).toBe(0);
    // An explicitly pinned original still resolves to its own version.
    const pinned = {
      ...makeSequenceItem(scene),
      follow_active: false,
      version_id: "first",
    };
    expect(await resolveTimeline([pinned], work.scenes)[0].blob?.text()).toBe(
      "first",
    );
    await db.deleteProject(project.id);
    expect(
      (await db.readWorkspace()).narrations.some(
        (n) => n.project_id === project.id,
      ),
    ).toBe(false);
  });
});
describe("provider contracts", () => {
  it("sends Gemini speech with a fixed voice, wraps PCM and measures its exact duration", async () => {
    const pcm = new Uint8Array(24000 * 2 * 2);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "audio",
                  data: btoa(String.fromCharCode(...pcm)),
                  mime_type: "audio/L16;codec=pcm;rate=24000",
                },
              ],
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await createGeminiSpeech(
      "google-secret",
      "Kore",
      "Hola.",
      "Voz cercana",
    );
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(options.headers["x-goog-api-key"]).toBe("google-secret");
    expect(options.headers["xi-api-key"]).toBeUndefined();
    expect(JSON.parse(options.body)).toMatchObject({
      model: "gemini-3.1-flash-tts-preview",
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: "Kore" }] },
    });
    expect(result.duration).toBe(2);
    expect(result.blob.size).toBe(pcm.length + 44);
    expect(result.blob.type).toBe("audio/wav");
    expect(result.text).toBe("Hola.");
    expect(result).not.toHaveProperty("alignment");
    const header = new DataView(await result.blob.arrayBuffer());
    expect(header.getUint32(24, true)).toBe(24000);
    expect(header.getUint32(40, true)).toBe(pcm.length);
  });
  it("does not retry paid voice requests and redacts the key in provider errors", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad secret-key" } }), {
        status: 401,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      createGeminiSpeech("secret-key", "Kore", "Hola"),
    ).rejects.toThrow("bad [clave]");
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(createGeminiSpeech("", "Kore", "Hola")).rejects.toThrow(
      "Conecta",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cuts only images at acoustic pauses, retaining all audio without invented word timestamps", () => {
    const spans = speechIntervals(26.4, 10, [8.3, 17.4]);
    expect(spans).toEqual([
      { start: 0, end: 8.3 },
      { start: 8.3, end: 17.4 },
      { start: 17.4, end: 26.4 },
    ]);
    const noPauses = speechIntervals(41.1, 8);
    expect(noPauses[0].start).toBe(0);
    expect(noPauses.at(-1)?.end).toBe(41.1);
    expect(
      noPauses.every(
        (s, i) =>
          s.end - s.start <= 8 && (i === 0 || s.start === noPauses[i - 1].end),
      ),
    ).toBe(true);
    expect(() => speechIntervals(1, 0.01)).toThrow();
    expect(() => pcmToWave(new Uint8Array(3))).toThrow();
    const pcm = new Uint8Array(24000 * 2 * 2),
      view = new DataView(pcm.buffer);
    for (let i = 0; i < 48000; i++)
      if (i < 12000 || i > 24000) view.setInt16(i * 2, 10000, true);
    expect(silenceCuts(pcm, 24000)[0]).toBeCloseTo(0.76, 1);
  });
  it("rejects a planner response that omits or replaces requested scenes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            steps: [
              {
                type: "model_output",
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      scenes: [
                        { id: "wrong", title: "Uno", visual: "Una mesa" },
                      ],
                    }),
                  },
                ],
              },
            ],
          }),
        ),
      ),
    );
    await expect(
      planStoryVisuals("test", "prompt", ["expected"]),
    ).rejects.toThrow("incompleto");
  });
});

const proposal: ProposalResponse = {
  mode: "voiceover",
  style: "explainer",
  direction: "Ilustración clara",
  voice: "Kore",
  voiceDirection: "Voz cercana",
  characters: [
    { name: "Ana", description: "Camisa verde", voice: "Tranquila" },
  ],
  references: [
    {
      name: "Ana",
      type: "CHARACTER",
      characterName: "Ana",
      prompt: "Retrato de Ana",
    },
  ],
  scenes: [],
};
describe("editable Gemini proposals", () => {
  it("selects only planned scene references and renames speaker labels without touching words", () => {
    expect(
      storyReferenceIds(
        {
          ...config,
          references: [
            {
              id: "1",
              name: "Bosque",
              type: "STYLE",
              prompt: "",
              assetId: "forest",
            },
            {
              id: "2",
              name: "Casa",
              type: "STYLE",
              prompt: "",
              assetId: "house",
            },
          ],
        },
        undefined,
        ["Bosque"],
      ),
    ).toEqual(["forest"]);
    expect(storyReferenceIds(config, undefined, [])).toEqual([]);
    expect(
      renameSpeakerLabel(
        "Ana: Hola, Luis.\nLuis: Hola Ana.\nAna: Vamos.",
        "Ana",
        "María",
      ),
    ).toBe("María: Hola, Luis.\nLuis: Hola Ana.\nMaría: Vamos.");
  });
  it("preserves every script character across batches, honors preferences and adds later characters", () => {
    const script =
      "Ana: Hola, esta es nuestra historia.\n\nLuis: Un segundo personaje entra después. "
        .repeat(80)
        .trim();
    let story = newStoryProposal(script, { mode: "spoken", style: "cartoon" });
    while (story.planning!.cursor < story.planning!.units.length) {
      const cursor = story.planning!.cursor,
        count = Math.min(30, story.planning!.units.length - cursor);
      story = applyProposalBatch(
        story,
        {
          ...proposal,
          characters: cursor
            ? [{ name: "Luis", description: "", voice: "" }]
            : proposal.characters,
          scenes: Array.from({ length: count }, (_, i) => ({
            start: cursor + i,
            end: cursor + i,
            title: `Momento ${i}`,
            visual: "Acción visual",
            speaker: "",
          })),
        },
        count,
      );
    }
    expect(story.blocks.map((b) => b.text).join("")).toBe(script);
    expect(story.mode).toBe("spoken");
    expect(story.style).toBe("cartoon");
    expect(story.characters.map((c) => c.name)).toEqual(["Ana", "Luis"]);
    expect(story.references).toHaveLength(1);
  });
  it("rejects missing, reordered, duplicated and incomplete ranges without changing saved script", () => {
    const story = newStoryProposal(
      "Uno dos tres cuatro cinco seis siete ocho nueve diez once doce. Otro momento para seguir.",
    );
    const count = story.planning!.units.length;
    const scene = {
      start: 0,
      end: count - 1,
      title: "Una idea",
      visual: "Un dibujo",
      speaker: "",
    };
    expect(() =>
      applyProposalBatch(
        story,
        { ...proposal, scenes: [{ ...scene, start: 1 }] },
        count,
      ),
    ).toThrow("omitió");
    expect(() =>
      applyProposalBatch(story, { ...proposal, scenes: [scene, scene] }, count),
    ).toThrow("omitió");
    expect(() =>
      applyProposalBatch(
        story,
        { ...proposal, scenes: [{ ...scene, end: count - 2 }] },
        count,
      ),
    ).toThrow("cubre");
    expect(story.blocks).toHaveLength(0);
  });
  it("saves review edits with conflict protection, replaces linked references and clears deleted images", async () => {
    const project = await db.createProject(
      "Propuesta",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    let story = newStoryProposal("Un guion breve.");
    story = applyProposalBatch(
      story,
      {
        ...proposal,
        scenes: [
          {
            start: 0,
            end: 0,
            title: "Inicio",
            visual: "Una planta",
            speaker: "",
          },
        ],
      },
      1,
    );
    story.phase = "review";
    await db.createStory(project.id, story);
    const saved = await db.saveStoryDraft(project.id, story);
    await expect(db.saveStoryDraft(project.id, story)).rejects.toThrow(
      "otra vista",
    );
    await db.saveStoryReference(project.id, saved.references![0].id, {
      id: "ref-test",
      type: "CHARACTER",
      data_url: "data:image/png;base64,YQ==",
      file_name: "Ana.png",
      is_global: false,
      project_ids: [project.id],
      created_at: "today",
    });
    let work = await db.readWorkspace();
    expect(
      work.projects.find((p) => p.id === project.id)?.story?.characters[0]
        .referenceId,
    ).toBe("ref-test");
    await db.deleteAsset("ref-test");
    work = await db.readWorkspace();
    expect(
      work.projects.find((p) => p.id === project.id)?.story?.references?.[0]
        .assetId,
    ).toBeUndefined();
    await db.deleteProject(project.id);
  });
});

describe("story cast identity and actionable validation", () => {
  const cast = [
    { name: "Ana María", description: "", voice: "" },
    { name: "Luis", description: "", voice: "" },
  ];
  function proposed(speakers: string[]) {
    const story = makeStory({
      ...config,
      characters: cast,
      script: "Hola.",
      mode: "spoken",
    });
    return {
      ...story,
      phase: "review" as const,
      blocks: speakers.map((speaker, i) => ({
        id: `block-${i}`,
        title: `Momento ${i + 1}`,
        speaker,
        text: "Hola, hoy aprendemos juntos.",
        visual: "Una planta",
      })),
    };
  }
  it("canonicalizes case, unicode and spaces, accepts a unique missing accent and preserves words", () => {
    const story = proposed([" ANA   MARÍA ", "ana maria", "LUIS"]);
    const normalized = normalizeStoryCast(story);
    expect(normalized.blocks.map((b) => b.speaker)).toEqual([
      "Ana María",
      "Ana María",
      "Luis",
    ]);
    expect(storyCastIssues(normalized)).toEqual([]);
    expect(normalized.blocks.map((b) => b.text)).toEqual(
      story.blocks.map((b) => b.text),
    );
    expect(
      makeStory({ ...story, script: "ana maria: Hola.", mode: "spoken" })
        .blocks[0].speaker,
    ).toBe("Ana María");
    expect(
      findStoryCharacter(
        [
          { name: "José", description: "", voice: "" },
          { name: "Jòsé", description: "", voice: "" },
        ],
        "Jose",
      ),
    ).toBeUndefined();
  });
  it("does not silently choose the first character for an unknown or unassigned speaker", () => {
    const story = proposed(["Ana María", "Narrador", "", "Luisa"]);
    const normalized = normalizeStoryCast(story);
    expect(normalized.blocks[1].speaker).toBe("Narrador");
    expect(storyCastIssues(normalized).map((i) => [i.index, i.name])).toEqual([
      [1, "Narrador"],
      [2, ""],
      [3, "Luisa"],
    ]);
  });
  it("repairs a name across all affected scenes while preserving other speakers and the original script", () => {
    const story = proposed(["Narrador", "Luis", "Narrador"]);
    story.blocks[0].text = "Narrador: Hola, Luis.";
    const repaired = assignStorySpeaker(
      story,
      storyCastIssues(story),
      "Ana María",
    );
    expect(repaired.blocks.map((b) => b.speaker)).toEqual([
      "Ana María",
      "Luis",
      "Ana María",
    ]);
    expect(repaired.blocks[0].text).toBe("Ana María: Hola, Luis.");
    expect(repaired.blocks[1]).toEqual(story.blocks[1]);
    expect(repaired.script).toBe(story.script);
    expect(storyCastIssues(repaired)).toEqual([]);
  });
  it("names the exact scene and unknown person on save, then persists canonical identities", async () => {
    const project = await db.createProject(
      "Reparto",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    const story = proposed(["ana maria", "Narrador"]);
    await db.createStory(project.id, story);
    await expect(db.saveStoryDraft(project.id, story)).rejects.toThrow(
      "Escena 2 · Momento 2: «Narrador»",
    );
    const fixed = assignStorySpeaker(story, storyCastIssues(story), "Luis");
    const saved = await db.saveStoryDraft(project.id, fixed);
    expect(saved.blocks.map((b) => b.speaker)).toEqual(["Ana María", "Luis"]);
    await db.deleteProject(project.id);
  });
});
