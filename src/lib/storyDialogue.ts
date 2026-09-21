import type {
  DialogueTurn,
  StoryBlock,
  StoryConfig,
  StoryShotMode,
} from "../types";
import { spokenBoundaryCost, endsSpokenSentence } from "./dialoguePhrasing";
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
      (i && turns[i - 1].speaker !== t.speaker ? 0.4 : 0),
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
  const tokens: { text: string; turn: number }[] = [];
  const turnFits = turns.map((turn, index) => {
    const previous = turns[index - 1],
      next = turns[index + 1];
    const continuation =
      (previous?.speaker === turn.speaker &&
        !endsSpokenSentence(previous.text)) ||
      (next?.speaker === turn.speaker && !endsSpokenSentence(turn.text));
    return !continuation && dialogueSeconds([turn]) <= max;
  });
  for (const [index, turn] of turns.entries()) {
    if (!turn.text.trim())
      throw new Error("Completa el texto de cada intervención.");
    if (!findStoryCharacter(config.characters, turn.speaker))
      throw new Error(
        `Elige el personaje de la intervención de «${turn.speaker || "Sin asignar"}».`,
      );
    for (const text of turn.text.match(/\s*\S+\s*/gu) || []) {
      if (dialogueSeconds([{ ...turn, text }]) > max)
        throw new Error(
          "Una palabra es demasiado larga para una toma. Revisa el texto de la intervención.",
        );
      tokens.push({ text, turn: index });
    }
  }
  // Optimize the whole passage instead of filling a clip and stranding its last words.
  // Lookahead is bounded by the model's duration, so long scripts remain linear in practice.
  const costs = new Array<number>(tokens.length + 1).fill(Infinity);
  const ends = new Array<number>(tokens.length);
  costs[tokens.length] = 0;
  for (let start = tokens.length - 1; start >= 0; start--) {
    const dialogue: DialogueTurn[] = [];
    let speakerChanges = 0;
    const speakers = new Set<string>();
    for (let end = start; end < tokens.length; end++) {
      const token = tokens[end];
      const source = turns[token.turn];
      const previous = dialogue.at(-1);
      if (previous && tokens[end - 1].turn === token.turn)
        previous.text += token.text;
      else {
        if (previous && previous.speaker !== source.speaker) speakerChanges++;
        dialogue.push({ ...source, text: token.text });
      }
      speakers.add(source.speaker);
      const duration = dialogueSeconds(dialogue);
      if (
        duration > max ||
        (mode === "alternating" && speakers.size > 1) ||
        (mode === "auto" && (speakers.size > 2 || speakerChanges > 2))
      )
        break;
      const next = tokens[end + 1];
      const sameSpeaker = next && source.speaker === turns[next.turn].speaker;
      let boundary = sameSpeaker
        ? spokenBoundaryCost(token.text, next.text)
        : 0;
      // An utterance that fits by itself should not be chopped just to fill another clip.
      if (next?.turn === token.turn && turnFits[token.turn]) boundary += 250;
      const continued =
        start > 0 &&
        turns[tokens[start - 1].turn].speaker ===
          turns[tokens[start].turn].speaker &&
        !endsSpokenSentence(tokens[start - 1].text);
      const tinyFragment =
        end - start + 1 < 4 &&
        (continued || (sameSpeaker && !endsSpokenSentence(token.text)));
      const cost =
        100 +
        boundary +
        (tinyFragment ? 180 : 0) +
        12 * ((max - duration) / max) ** 2 +
        costs[end + 1];
      if (cost < costs[start]) {
        costs[start] = cost;
        ends[start] = end + 1;
      }
    }
  }
  const groups: DialogueTurn[][] = [];
  for (let start = 0; start < tokens.length;) {
    const end = ends[start];
    const dialogue: DialogueTurn[] = [];
    for (let i = start; i < end; i++) {
      const token = tokens[i];
      const previous = dialogue.at(-1);
      if (previous && tokens[i - 1].turn === token.turn)
        previous.text += token.text;
      else
        dialogue.push({
          ...turns[token.turn],
          id: `${turns[token.turn].id}-${i}`,
          text: token.text,
        });
    }
    groups.push(dialogue);
    start = end;
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
