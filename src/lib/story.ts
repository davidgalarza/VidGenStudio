import {
  cleanCharacterName,
  findStoryCharacter,
  renameSourceSpeaker,
} from "./storyCast";
import {
  OMNI_MODEL,
  type Story,
  type StoryBlock,
  type StoryConfig,
  type StoryScene,
  type Narration,
  type VideoSettings,
} from "../types";

export { storyStyles } from "./storyStyles";
import { storyStylePrompt } from "./storyStyles";
export const maxStoryDuration = (settings: VideoSettings) =>
  settings.model === OMNI_MODEL ? 10 : 8;
export function storyVideoDuration(seconds: number, settings: VideoSettings) {
  return settings.model === OMNI_MODEL
    ? Math.max(3, Math.min(10, Math.ceil(seconds)))
    : settings.resolution === "1080p"
      ? 8
      : [4, 6, 8].find((n) => n >= seconds) || 8;
}

// Slice the original string; no model is allowed to shorten or rewrite the script.
export function splitText(
  text: string,
  maxChars: number,
  maxWords = Infinity,
): string[] {
  const tokens = text.match(/\S+\s*/gu) || [];
  const parts: string[] = [];
  let current = "",
    words = 0;
  for (const token of tokens) {
    if (
      current &&
      (current.length + token.length > maxChars || words >= maxWords)
    ) {
      parts.push(current);
      current = "";
      words = 0;
    }
    // Very long tokens still have to respect the speech API request limit.
    if (token.length > maxChars) {
      if (current) {
        parts.push(current);
        current = "";
        words = 0;
      }
      const chars = Array.from(token);
      while (chars.length) parts.push(chars.splice(0, maxChars).join(""));
      continue;
    }
    current += token;
    words++;
    if (
      /[.!?。！？][”"')\]]?\s*$/u.test(token) &&
      (words >= maxWords / 2 || current.length >= maxChars / 2)
    ) {
      parts.push(current);
      current = "";
      words = 0;
    }
  }
  if (current) parts.push(current);
  return parts;
}
// Speaker labels are metadata. Renaming a cast member must not change spoken words.
export function renameSpeakerLabel(text: string, from: string, to: string) {
  return renameSourceSpeaker(text, from, to);
}
export function makeStory(config: StoryConfig): Story {
  if (!config.script.trim())
    throw new Error("Escribe el guion de tu historia.");
  if (config.mode === "voiceover" && !config.voiceId.trim())
    throw new Error("Elige una voz de Gemini TTS.");
  const names = config.characters.map((c) => cleanCharacterName(c.name));
  if (
    config.mode === "spoken" &&
    (!names.length ||
      names.some((n) => !n) ||
      new Set(names.map((name) => name.toLocaleLowerCase())).size !==
        names.length)
  )
    throw new Error("Cada personaje necesita un nombre diferente.");
  const blocks: StoryBlock[] = [];
  const add = (text: string, speaker?: string) => {
    const max = maxStoryDuration(config.settings);
    const parts =
      config.mode === "voiceover"
        ? splitText(text, 1200)
        : splitText(
            text,
            Math.floor((max - 1.5) * 11),
            Math.floor((max - 1.5) * 2),
          );
    for (const part of parts)
      if (part.trim())
        blocks.push({ id: crypto.randomUUID(), text: part, speaker });
  };
  if (config.mode === "voiceover") add(config.script.trim());
  else {
    let speaker = names[0];
    for (const line of config.script.trim().split(/\n+/)) {
      const match = line.match(/^\s*([^:\n]{1,60}):\s*(.*)$/u);
      const matchedName =
        match && findStoryCharacter(config.characters, match[1])?.name;
      if (match && matchedName) {
        speaker = cleanCharacterName(matchedName);
        add(match[2], speaker);
      } else {
        if (match && names.length > 1)
          throw new Error(
            `«${match[1].trim()}» no está en la lista de personajes. Añádelo o corrige su nombre en el guion.`,
          );
        add(line, speaker);
      }
    }
  }
  if (!blocks.length)
    throw new Error("El guion no contiene texto para narrar.");
  return {
    ...config,
    characters: config.characters.map((c) => ({
      ...c,
      name: cleanCharacterName(c.name),
    })),
    voiceId: config.voiceId.trim(),
    script: config.script.trim(),
    id: crypto.randomUUID(),
    blocks,
  };
}
export interface TimedText {
  text: string;
  start: number;
  end: number;
}
export function storyReferenceIds(
  story: StoryConfig,
  speaker?: string,
  names?: string[],
  participants?: string[],
  locationName?: string,
) {
  if (participants !== undefined || locationName) {
    const participantNames = participants?.length
      ? participants
      : speaker
        ? [speaker]
        : [];
    const set = locationName
      ? story.references?.find(
          (r) => r.locationName === locationName && r.assetId,
        )?.assetId
      : undefined;
    const characters = participantNames.flatMap(
      (name) =>
        story.characters.find((c) => c.name === name)?.referenceId || [],
    );
    const named = (names || []).flatMap(
      (name) => story.references?.find((r) => r.name === name)?.assetId || [],
    );
    const style = story.references?.find(
      (r) => r.type === "STYLE" && r.assetId,
    )?.assetId;
    return [
      ...new Set([
        ...characters.slice(0, set ? 2 : 3),
        ...(set ? [set] : []),
        ...named,
        ...(style ? [style] : []),
      ]),
    ].slice(0, 3);
  }
  if (names !== undefined)
    return [
      ...new Set(
        names.flatMap(
          (name) =>
            story.references?.find(
              (r) => r.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
            )?.assetId || [],
        ),
      ),
    ].slice(0, 3);
  const character = story.characters.find((c) => c.name === speaker);
  return [
    ...new Set(
      [
        character?.referenceId,
        ...(story.references || [])
          .filter((r) => r.type === "STYLE")
          .map((r) => r.assetId),
        ...story.characters.map((c) => c.referenceId),
        ...(story.references || []).map((r) => r.assetId),
      ].filter((id): id is string => !!id),
    ),
  ].slice(0, 3);
}
export function alignNarration(
  text: string,
  audio: Narration,
  max: number,
): TimedText[] {
  const a = audio.alignment,
    duration = audio.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0)
    throw new Error(
      "No se pudo medir la narración. El audio guardado se conserva.",
    );
  if (
    !a ||
    a.characters.join("") !== text ||
    a.characters.length !== a.character_start_times_seconds.length ||
    a.characters.length !== a.character_end_times_seconds.length
  )
    throw new Error(
      "El audio guardado no contiene tiempos válidos para el guion. El audio se conserva; no se vuelve a cobrar automáticamente.",
    );
  const ends = a.character_end_times_seconds;
  if (
    ends.some(
      (v, i) =>
        !Number.isFinite(v) ||
        v < 0 ||
        v > duration + 0.15 ||
        (i > 0 && v < ends[i - 1]),
    )
  )
    throw new Error("La sincronización del audio guardado no es válida.");
  const result: TimedText[] = [];
  let start = 0,
    char = 0;
  while (start < duration - 0.001) {
    let end = Math.min(duration, start + max - 0.08);
    let next = char;
    if (end < duration) {
      // Cut visuals on a word boundary when possible, keeping contiguous audio ranges.
      let boundary = -1;
      for (let i = char; i < ends.length && ends[i] <= end; i++) {
        if (/\s/u.test(a.characters[i]) && ends[i] > start + 2) boundary = i;
      }
      if (boundary >= 0) {
        next = boundary + 1;
        end = ends[boundary];
      } else while (next < ends.length && ends[next] <= end) next++;
    } else next = a.characters.length;
    result.push({ text: a.characters.slice(char, next).join(""), start, end });
    char = next;
    start = end;
  }
  return result;
}
export function storyPrompt(
  story: StoryConfig,
  scene: Pick<
    StoryScene,
    | "text"
    | "speaker"
    | "visual"
    | "dialogue"
    | "locationName"
    | "participants"
    | "shotMode"
  >,
  references = storyReferenceIds(
    story,
    scene.speaker,
    undefined,
    scene.participants,
    scene.locationName,
  ),
) {
  const style = storyStylePrompt(story);
  const relevant = new Set(
    scene.participants || scene.dialogue
      ? [
          ...(scene.participants || []),
          ...(scene.dialogue || []).map((t) => t.speaker),
          ...(scene.speaker ? [scene.speaker] : []),
        ]
      : [],
  );
  const cast = story.characters
    .filter((c) => !relevant.size || relevant.has(c.name))
    .map(
      (c) =>
        `${c.name}: appearance ${c.description || "keep the same appearance in every shot"}; voice ${c.voice || "natural, conversational, clear diction"}.`,
    )
    .join("\n");
  const describe = (id: string) =>
    story.references?.find((r) => r.assetId === id)?.name ||
    story.characters
      .filter((c) => c.referenceId === id)
      .map((c) => c.name)
      .join(" / ") ||
    "the visual identity to preserve";
  const guides =
    story.settings.model === OMNI_MODEL
      ? references
          .map((id, i) => `Reference image ${i + 1} depicts ${describe(id)}.`)
          .join(" ")
      : references[0]
        ? `Use the first frame as a visual guide for ${describe(references[0])}. Preserve its appearance.`
        : "";
  return [
    `Create one shot from a continuous story. ${style}`,
    story.direction && `Overall direction and continuity: ${story.direction}`,
    cast &&
      `Fixed character and voice bible. Never change identities, accents, pitch or timbre between shots:\n${cast}`,
    guides,
    scene.locationName &&
      `Set continuity: ${scene.locationName}. ${story.references?.find((r) => r.locationName === scene.locationName)?.prompt || "Preserve the same architecture, positions, furnishings and light."}`,
    scene.participants?.length &&
      `Visible participants: ${scene.participants.join(", ")}. Characters without a dialogue turn remain silent, listen and react naturally.`,
    `Visual action: ${scene.visual}`,
    scene.dialogue?.some((t) => t.action) &&
      `Specific action beats for THIS shot only, in dialogue order. These are silent visual directions, never spoken words: ${JSON.stringify(scene.dialogue.map((t) => ({ speaker: t.speaker, action: t.action || "Continue naturally" })))}. The wider scene description is context; do not replay actions belonging to other shots.`,
    story.mode === "spoken"
      ? scene.dialogue?.length
        ? `SPOKEN CONVERSATION, in this exact order, in the original language: ${JSON.stringify(scene.dialogue.map((t) => ({ speaker: t.speaker, words: t.text.trim(), delivery: t.direction || "Natural conversational delivery" })))}. Each character says ONLY their own words; never speak names, instructions or delivery notes. One voice at a time, no overlap. Consecutive entries from the same speaker continue naturally as one utterance; metadata boundaries are not a pause, cut or restart. Match each voice to its visible speaker and synchronize lips. Listeners react silently. Begin promptly, allow natural turn-taking, finish every word. No extra dialogue, narration, subtitles or title cards. ${scene.shotMode === "shared" ? "Keep the characters together in one continuous shared composition." : scene.shotMode === "alternating" ? "Focus on the current speaker, maintain eyelines and spatial continuity." : "Use a clear, stable composition that makes the conversation easy to follow."}`
        : `SPOKEN DIALOGUE: ${scene.speaker || story.characters[0]?.name || "The character"} says exactly the following, in its original language: ${JSON.stringify(scene.text.trim())}. Only this speaker talks in this shot. Natural lip sync, clearly audible speech, no additional dialogue or narration. Begin speaking promptly and finish every word before the end. Keep the same voice described above; do not rush. No subtitles or title cards.`
      : `This shot accompanies the following separate voiceover: ${JSON.stringify(scene.text.trim())}. Illustrate its meaning precisely. NO spoken dialogue, NO narration, NO music, NO text overlays. The voiceover will be added separately. Show the action throughout the shot, with no fade to black.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
