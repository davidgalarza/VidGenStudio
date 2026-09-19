import type {
  DialogueTurn,
  StoryBlock,
  StoryConfig,
  StoryShotMode,
} from "../types";
import { cleanCharacterName, findStoryCharacter } from "./storyCast";

/** Strip only labels identifying a known speaker; never remove spoken words. */
export function stripSpeakerLabel(text: string, speaker: string) {
  const match = text.match(
    /^[ \t]*(?:[-–—][ \t]*)?(?:\*\*)?([^:\n–—]{1,80}?)(?:\*\*)?[ \t]*(?::|[–—]| -)(?:\*\*)?[ \t]*/u,
  );
  if (
    !match ||
    !findStoryCharacter(
      [{ name: speaker, description: "", voice: "" }],
      match[1].replace(/\*\*/g, ""),
    )
  )
    return text;
  return text.slice(match[0].length);
}
export function parseDialogue(
  config: StoryConfig,
  block: Pick<StoryBlock, "id" | "text" | "speaker">,
): DialogueTurn[] {
  return parseDialogueSource(config, block).turns;
}
/** Keep the final speaker even when the source ends with a heading, not speech. */
export function parseDialogueSource(
  config: StoryConfig,
  block: Pick<StoryBlock, "id" | "text" | "speaker">,
): { turns: DialogueTurn[]; speaker: string } {
  let speaker =
    findStoryCharacter(config.characters, block.speaker)?.name ||
    (config.characters.length === 1
      ? config.characters[0].name
      : block.speaker || "");
  const turns: DialogueTurn[] = [];
  for (const line of block.text.split(/\n/)) {
    const labelled = config.characters.find(
      (c) => stripSpeakerLabel(line, c.name) !== line,
    );
    const standalone = findStoryCharacter(
      config.characters,
      cleanCharacterName(line.replace(/\*\*/g, "")),
    );
    if (standalone && config.characters.length > 1) {
      speaker = standalone.name;
      continue;
    }
    if (labelled) speaker = labelled.name;
    const text = labelled ? stripSpeakerLabel(line, labelled.name) : line;
    if (!text.trim()) continue;
    const previous = turns.at(-1);
    if (previous && !labelled && previous.speaker === speaker)
      previous.text += `\n${text}`;
    else
      turns.push({
        id: `${block.id}-turn-${turns.length}`,
        speaker,
        text: text.trim(),
      });
  }
  return { turns, speaker };
}
export function blockDialogue(
  config: StoryConfig,
  block: StoryBlock,
): DialogueTurn[] {
  return block.dialogue && block.dialogueSource === block.text
    ? block.dialogue
    : parseDialogue(config, block);
}
export const dialogueText = (turns: DialogueTurn[]) =>
  turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
export function dialoguePatch(
  turns: DialogueTurn[],
): Pick<StoryBlock, "text" | "dialogueSource" | "dialogue" | "speaker"> {
  const text = dialogueText(turns);
  return {
    text,
    dialogueSource: text,
    dialogue: turns,
    speaker: turns[0]?.speaker,
  };
}
export const dialogueSeconds = (turns: DialogueTurn[]) =>
  1.2 +
  turns.reduce(
    (sum, t, i) =>
      sum +
      Math.max(
        t.text.trim().split(/\s+/).filter(Boolean).length / 2,
        t.text.length / 11,
      ) +
      (i ? 0.4 : 0),
    0,
  );
export interface DialogueShot {
  dialogue: DialogueTurn[];
  text: string;
  speaker?: string;
  duration: number;
  mode: StoryShotMode;
}
/** A deterministic partition owns coverage; the model cannot omit or rewrite dialogue. */
export function planDialogueShots(
  config: StoryConfig,
  block: StoryBlock,
): DialogueShot[] {
  const max = config.settings.model === "gemini-omni-1.1-flash" ? 10 : 8;
  const mode = block.shotMode || "auto";
  const turns = blockDialogue(config, block);
  if (!turns.length)
    throw new Error("Añade lo que se escuchará en esta escena.");
  const chunks: DialogueTurn[] = [];
  for (const turn of turns) {
    if (!turn.text.trim())
      throw new Error("Completa el texto de cada intervención.");
    if (!findStoryCharacter(config.characters, turn.speaker))
      throw new Error(
        `Elige el personaje de la intervención de «${turn.speaker || "Sin asignar"}».`,
      );
    let part = "";
    // Preserve even whitespace within a turn while splitting long monologues.
    for (const token of turn.text.match(/\S+\s*|\s+/g) || []) {
      if (part && dialogueSeconds([{ ...turn, text: part + token }]) > max) {
        chunks.push({ ...turn, id: `${turn.id}-${chunks.length}`, text: part });
        part = "";
      }
      if (dialogueSeconds([{ ...turn, text: token }]) > max)
        throw new Error(
          "Una palabra es demasiado larga para una toma. Revisa el texto de la intervención.",
        );
      part += token;
    }
    if (part)
      chunks.push({ ...turn, id: `${turn.id}-${chunks.length}`, text: part });
  }
  const groups: DialogueTurn[][] = [];
  for (const turn of chunks) {
    const previous = groups.at(-1);
    const speakers = new Set([
      ...(previous || []).map((t) => t.speaker),
      turn.speaker,
    ]);
    if (
      previous &&
      dialogueSeconds([...previous, turn]) <= max &&
      (mode !== "alternating" || speakers.size === 1) &&
      (mode !== "auto" || (speakers.size <= 2 && previous.length < 3))
    )
      previous.push(turn);
    else groups.push([turn]);
  }
  return groups.map((dialogue) => ({
    dialogue,
    text: dialogue.map((t) => t.text).join("\n"),
    speaker:
      new Set(dialogue.map((t) => t.speaker)).size === 1
        ? dialogue[0].speaker
        : undefined,
    duration:
      config.settings.model === "gemini-omni-1.1-flash"
        ? Math.max(3, Math.ceil(dialogueSeconds(dialogue)))
        : config.settings.resolution === "1080p"
          ? 8
          : [4, 6, 8].find((n) => n >= dialogueSeconds(dialogue)) || 8,
    mode,
  }));
}
