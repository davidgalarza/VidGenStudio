import type { Story, StoryBlock, StoryCharacter, StoryConfig } from "../types";

export const cleanCharacterName = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ");
const nameKey = (name: string) => cleanCharacterName(name).toLocaleLowerCase();
const accentKey = (name: string) =>
  nameKey(name).normalize("NFD").replace(/\p{M}/gu, "");

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
      const text = b.text.replace(
        /(^|\n)([ \t]*)([^:\n]+)(:[ \t]*)/g,
        (whole, line, space, label, colon) =>
          own.some((i) => i.name && nameKey(i.name) === nameKey(label))
            ? `${line}${space}${character.name}${colon}`
            : whole,
      );
      return {
        ...b,
        text,
        speaker: own.some((i) => i.source === "speaker")
          ? character.name
          : b.speaker,
      };
    }),
  };
}
