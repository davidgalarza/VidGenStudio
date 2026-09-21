import type { StoryBlock } from "../types";

// Local punctuation and clause cues guide cuts; spoken words remain untouched.
const closing = /[»”"')\]}]+$/u;
const cleanEnd = (text: string) => text.trimEnd().replace(closing, "");
export function endsSpokenSentence(text: string) {
  if (
    /\b(?:sr|sra|srta|dr|dra|ud|uds|prof|ing|lic|mr|mrs|ms|e\.g|i\.e)\.$/iu.test(
      cleanEnd(text),
    )
  )
    return false;
  return /[.!?…。！？]$/u.test(cleanEnd(text));
}
const word = (text: string) =>
  text.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const dependent = new Set([
  "a",
  "al",
  "ante",
  "bajo",
  "con",
  "contra",
  "de",
  "del",
  "desde",
  "durante",
  "en",
  "entre",
  "hacia",
  "hasta",
  "para",
  "por",
  "según",
  "sin",
  "sobre",
  "tras",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "mi",
  "mis",
  "tu",
  "tus",
  "su",
  "sus",
  "que",
  "y",
  "e",
  "o",
  "u",
  "ni",
  "pero",
  "porque",
  "como",
  "si",
  "se",
  "me",
  "te",
  "lo",
  "le",
  "les",
  "nos",
  "no",
]);
const connectors = new Set([
  "y",
  "pero",
  "aunque",
  "porque",
  "entonces",
  "además",
  "después",
  "luego",
  "mientras",
  "cuando",
  "and",
  "but",
  "although",
  "because",
  "then",
]);
export function spokenBoundaryCost(before: string, after: string) {
  if (endsSpokenSentence(before)) return 0;
  if (/\n\s*$/u.test(before)) return 8;
  if (/[;:—–]$/u.test(cleanEnd(before))) return 12;
  if (/[,，]$/u.test(cleanEnd(before))) return 20;
  if (dependent.has(word(before.trim().split(/\s+/u).at(-1) || ""))) return 320;
  if (connectors.has(word(after.trimStart().split(/\s+/u)[0] || ""))) return 45;
  return 180;
}

/** Repair only an automatic scene boundary inside one continuing utterance. */
export function joinUnfinishedDialogue(
  previous: StoryBlock,
  next: StoryBlock,
): StoryBlock | undefined {
  const last = previous.dialogue?.at(-1);
  const first = next.dialogue?.[0];
  if (
    !last ||
    !first ||
    last.speaker !== first.speaker ||
    previous.sceneIds?.length ||
    next.sceneIds?.length ||
    previous.dialogueSource !== previous.text ||
    next.dialogueSource !== next.text ||
    endsSpokenSentence(last.text) ||
    /\n\s*$/u.test(previous.text) ||
    // A new source speaker label is an intentional intervention boundary.
    /^\s*(?:[-–—]\s*)?(?:\*\*)?[^:\n]{1,60}:\s*/u.test(next.text) ||
    (previous.shotMode || "auto") !== (next.shotMode || "auto") ||
    (previous.locationName
      ? previous.locationName !== next.locationName
      : !!next.locationName || previous.visual !== next.visual) ||
    previous.text.length + next.text.length > 3000
  )
    return undefined;
  const text = previous.text + next.text;
  return {
    ...previous,
    text,
    dialogueSource: text,
    dialogue: [...previous.dialogue!, ...next.dialogue!],
    visual: [...new Set([previous.visual, next.visual].filter(Boolean))].join(
      "\n",
    ),
    participants: [
      ...new Set([
        ...(previous.participants || []),
        ...(next.participants || []),
      ]),
    ],
    referenceNames: [
      ...new Set([
        ...(previous.referenceNames || []),
        ...(next.referenceNames || []),
      ]),
    ].slice(0, 3),
  };
}
