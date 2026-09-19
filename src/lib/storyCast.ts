import type { Story, StoryBlock, StoryCharacter, StoryConfig } from "../types";

export const cleanCharacterName = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ");
const nameKey = (name: string) => cleanCharacterName(name).toLocaleLowerCase();
const accentKey = (name: string) =>
  nameKey(name).normalize("NFD").replace(/\p{M}/gu, "");

export function sourceSpeakerLabels(text: string): string[] {
  return text.split(/\n/).flatMap((line) => {
    const label = line.match(
      /^[ \t]*(?:[-–—][ \t]*)?(?:\*\*)?([^:\n–—]{1,60}?)(?:\*\*)?[ \t]*(?::|[–—]| -)/u,
    )?.[1];
    return label ? [cleanCharacterName(label.replace(/\*\*/g, ""))] : [];
  });
}
export function missingSourceSpeakers(
  script: string,
  source: string,
  characters: StoryCharacter[],
) {
  const labels = sourceSpeakerLabels(script);
  // A plain monologue can contain several colons. A recognized speaker must
  // establish the labelled format before other prefixes are treated as names.
  if (!labels.some((name) => findStoryCharacter(characters, name))) return [];
  return [
    ...new Set(
      sourceSpeakerLabels(source).filter(
        (name) => !findStoryCharacter(characters, name),
      ),
    ),
  ];
}
export function renameSourceSpeaker(text: string, from: string, to: string) {
  return text.replace(
    /^([ \t]*(?:[-–—][ \t]*)?(?:\*\*)?)([^:\n–—]{1,80}?)(\*{0,2}[ \t]*(?::|[–—]| -)(?:\*\*)?[ \t]*)/gmu,
    (whole, prefix, name, separator) =>
      nameKey(name.replace(/\*\*/g, "")) === nameKey(from)
        ? `${prefix}${to}${separator}`
        : whole,
  );
}

// Only resolve an unambiguous identity. Similar names must never silently change a speaker.
export function findStoryCharacter(
  characters: StoryCharacter[],
  name?: string,
) {
  if (!name?.trim()) return undefined;
  const matches = characters.filter((c) => nameKey(c.name) === nameKey(name));
  if (matches.length) return matches.length === 1 ? matches[0] : undefined;
  const unaccented = characters.filter(
    (c) => accentKey(c.name) === accentKey(name),
  );
  return unaccented.length === 1 ? unaccented[0] : undefined;
}
export function blockSpeaker(story: StoryConfig, block: StoryBlock) {
  if (block.speaker?.trim())
    return findStoryCharacter(story.characters, block.speaker);
  const label = block.text.trimStart().match(/^([^:\n]{1,60}):/u)?.[1];
  if (label) return findStoryCharacter(story.characters, label);
  return story.characters.length === 1 ? story.characters[0] : undefined;
}
export function normalizeStoryCast(story: Story): Story {
  const characters = story.characters.map((c) => ({
    ...c,
    name: cleanCharacterName(c.name),
  }));
  const config = { ...story, characters };
  return {
    ...config,
    blocks: story.blocks.map((b) => ({
      ...b,
      speaker: blockSpeaker(config, b)?.name || b.speaker,
      dialogue: b.dialogue?.map((t) => ({
        ...t,
        speaker: findStoryCharacter(characters, t.speaker)?.name || t.speaker,
      })),
      participants: b.participants?.map(
        (name) => findStoryCharacter(characters, name)?.name || name,
      ),
    })),
    references: story.references?.map((r) => ({
      ...r,
      characterName:
        findStoryCharacter(characters, r.characterName)?.name ||
        r.characterName,
    })),
  };
}
export interface StoryCastIssue {
  blockId: string;
  index: number;
  title: string;
  name: string;
  source: "speaker" | "label";
}
export function storyCastIssues(story: Story): StoryCastIssue[] {
  if (story.mode !== "spoken") return [];
  return story.blocks.flatMap((block, index) => {
    const common = {
      blockId: block.id,
      index,
      title: block.title || `Escena ${index + 1}`,
    };
    const issues: StoryCastIssue[] = [];
    for (const name of missingSourceSpeakers(
      story.script,
      block.text,
      story.characters,
    ))
      issues.push({ ...common, name, source: "label" });
    if (block.dialogue && block.dialogueSource === block.text) {
      for (const turn of block.dialogue) {
        if (
          !findStoryCharacter(story.characters, turn.speaker) &&
          !issues.some((i) => i.name === turn.speaker)
        )
          issues.push({ ...common, name: turn.speaker, source: "label" });
      }
      for (const name of block.participants || [])
        if (
          !findStoryCharacter(story.characters, name) &&
          !issues.some((i) => i.name === name)
        )
          issues.push({ ...common, name, source: "label" });
      return issues;
    }
    if (!blockSpeaker(story, block))
      issues.push({
        ...common,
        name:
          block.speaker?.trim() ||
          block.text.trimStart().match(/^([^:\n]{1,60}):/u)?.[1] ||
          "",
        source: "speaker",
      });
    // Match the dialogue parser: in a cast with several people, every labelled turn must exist.
    if (story.characters.length > 1)
      for (const line of block.text.split(/\n+/)) {
        const label = line.match(/^\s*([^:\n]{1,60}):\s*(.*)$/u)?.[1];
        if (
          label &&
          !findStoryCharacter(story.characters, label) &&
          !issues.some((i) => nameKey(i.name) === nameKey(label))
        )
          issues.push({ ...common, name: label.trim(), source: "label" });
      }
    return issues;
  });
}
export function castIssueMessage(issue: StoryCastIssue) {
  return `Escena ${issue.index + 1} · ${issue.title}: ${issue.name ? `«${issue.name}» no coincide con un personaje del reparto.` : "falta elegir quién habla."} Elige su personaje en Escenas.`;
}
export function assignStorySpeaker(
  story: Story,
  issues: StoryCastIssue[],
  name: string,
): Story {
  const character = findStoryCharacter(story.characters, name);
  if (!character) return story;
  return {
    ...story,
    blocks: story.blocks.map((b) => {
      const own = issues.filter((i) => i.blockId === b.id);
      if (!own.length) return b;
      const text = own.reduce(
        (text, issue) =>
          issue.name
            ? renameSourceSpeaker(text, issue.name, character.name)
            : text,
        b.text,
      );
      return {
        ...b,
        text,
        dialogueSource: b.dialogueSource === b.text ? text : b.dialogueSource,
        dialogue: b.dialogue?.map((turn) => ({
          ...turn,
          speaker: own.some((i) => nameKey(i.name) === nameKey(turn.speaker))
            ? character.name
            : turn.speaker,
        })),
        participants: b.participants?.map((participant) =>
          own.some((i) => nameKey(i.name) === nameKey(participant))
            ? character.name
            : participant,
        ),
        speaker: own.some((i) => i.source === "speaker")
          ? character.name
          : b.speaker,
      };
    }),
  };
}
