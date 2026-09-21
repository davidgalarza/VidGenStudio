import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO,
  VEO_MODEL,
  type DialogueTurn,
  type StoryBlock,
  type StoryConfig,
} from "../src/types";
import {
  dialoguePatch,
  dialogueSeconds,
  planDialogueShots,
} from "../src/lib/storyDialogue";
import {
  applyProposalBatch,
  newStoryProposal,
  type ProposalResponse,
} from "../src/lib/storyPlanner";

const config: StoryConfig = {
  mode: "spoken",
  style: "realistic",
  script: "",
  direction: "Una demostración.",
  voiceId: "Kore",
  voiceName: "Kore",
  characters: ["Miguel", "Ana", "Luis"].map((name) => ({
    name,
    description: "",
    voice: "Natural",
  })),
  settings: DEFAULT_VIDEO,
};
const sentence =
  "El nuevo sistema mejora el agarre, mantiene el control del movimiento y permite soltar en todas las posiciones.";
const phrase = "y permite soltar en todas las posiciones";
const turn = (text: string): DialogueTurn => ({
  id: "t",
  speaker: "Miguel",
  text,
  direction: "Natural",
  action: "Muestra el objeto.",
});
const block = (turns: DialogueTurn[]): StoryBlock => ({
  id: "b",
  visual: "Miguel explica junto a la mesa.",
  ...dialoguePatch(turns),
});

describe("dialogue cuts follow phrasing within model duration limits", () => {
  it.each([
    DEFAULT_VIDEO,
    { ...DEFAULT_VIDEO, model: VEO_MODEL },
    { ...DEFAULT_VIDEO, model: VEO_MODEL, resolution: "1080p" as const },
  ])(
    "keeps a complete clause instead of stranding its final three words ($model/$resolution)",
    (settings) => {
      const shots = planDialogueShots(
        { ...config, settings },
        block([turn(sentence)]),
      );
      expect(shots).toHaveLength(2);
      expect(shots.some((s) => s.text.includes(phrase))).toBe(true);
      expect(
        shots.map((s) => s.dialogue.map((t) => t.text).join("")).join(""),
      ).toBe(sentence);
      expect(shots[0].text.trim()).toBe("El nuevo sistema mejora el agarre,");
      expect(
        shots.every(
          (s) =>
            dialogueSeconds(s.dialogue) <=
            (settings.model === VEO_MODEL ? 8 : 10),
        ),
      ).toBe(true);
      expect(
        shots
          .flatMap((s) => s.dialogue)
          .every(
            (t) =>
              t.direction === "Natural" && t.action === "Muestra el objeto.",
          ),
      ).toBe(true);
    },
  );
  it("keeps fitting speech in a single take without charging pauses for same-speaker metadata", () => {
    expect(planDialogueShots(config, block([turn(`${phrase}.`)]))).toHaveLength(
      1,
    );
    const fragments = [
      "Y",
      "permite",
      "soltar en",
      "todas las posiciones.",
    ].map((text, i) => ({ ...turn(text), id: `part-${i}` }));
    const shots = planDialogueShots(config, block(fragments));
    expect(shots).toHaveLength(1);
    expect(shots[0].dialogue.map((t) => t.text)).toEqual(
      fragments.map((t) => t.text),
    );
    expect(dialogueSeconds(fragments)).toBeCloseTo(
      dialogueSeconds([turn(fragments.map((t) => t.text).join(" "))]),
    );
  });
  it("uses sentence endings before an unfinished thought", () => {
    const text =
      "Primero ajusta la pieza con mucho cuidado. Luego permite soltar en todas las posiciones.";
    const shots = planDialogueShots(
      { ...config, settings: { ...DEFAULT_VIDEO, model: VEO_MODEL } },
      block([turn(text)]),
    );
    expect(shots).toHaveLength(2);
    expect(shots[0].text.trim()).toBe(
      "Primero ajusta la pieza con mucho cuidado.",
    );
    expect(shots[1].text.trim()).toBe(
      "Luego permite soltar en todas las posiciones.",
    );
  });
  it("balances unavoidable cuts in unpunctuated speech and preserves exact whitespace", () => {
    const text =
      "  " +
      Array.from(
        { length: 37 },
        (_, i) => `idea${i}${i % 5 === 0 ? "  " : " "}`,
      ).join("");
    const shots = planDialogueShots(config, block([turn(text)]));
    expect(shots.length).toBeGreaterThan(1);
    expect(shots.every((s) => s.text.trim().split(/\s+/).length >= 4)).toBe(
      true,
    );
    expect(
      shots
        .flatMap((s) => s.dialogue)
        .map((t) => t.text)
        .join(""),
    ).toBe(text);
  });
  it("respects alternating speakers and the automatic cast limit", () => {
    const turns = config.characters.map((c, i) => ({
      ...turn("Sí, adelante."),
      id: `t-${i}`,
      speaker: c.name,
    }));
    expect(
      planDialogueShots(config, { ...block(turns), shotMode: "shared" }),
    ).toHaveLength(1);
    const automatic = planDialogueShots(config, block(turns));
    expect(
      automatic.every(
        (s) => new Set(s.dialogue.map((t) => t.speaker)).size <= 2,
      ),
    ).toBe(true);
    expect(
      planDialogueShots(config, { ...block(turns), shotMode: "alternating" }),
    ).toHaveLength(3);
    expect(automatic.flatMap((s) => s.dialogue).map((t) => t.speaker)).toEqual(
      turns.map((t) => t.speaker),
    );
  });
});

// Regression from exported story materials: a list of properties was split
// after "profunda," and its tail was packed with the start of the next sentence.
const weldingSentences = [
  "¿Por qué el E6010 es clave para soldar tuberías?",
  "Es un electrodo celulósico de penetración profunda, arco enérgico y escoria de rápida solidificación.",
  "Trabaja principalmente con corriente continua, electrodo positivo (DCEP), y permite soldar en todas las posiciones.",
];
describe("whole ideas are protected, not merely preferred", () => {
  it.each(["auto", "shared", "alternating"] as const)(
    "keeps each complete technical sentence in one take (%s), regardless of metadata fragmentation",
    (shotMode) => {
      const script = weldingSentences.join("\n");
      for (const fragments of [
        [script],
        weldingSentences,
        script.split(/(?<=,) /u),
        script.split(/ /u),
      ]) {
        const turns = fragments.map((text, i) => ({
          ...turn(text),
          id: `unit-${i}`,
        }));
        const input = { ...block(turns), shotMode };
        const original = structuredClone(input);
        const shots = planDialogueShots(config, input);
        expect(shots.map((s) => s.text.replace(/\s+/gu, " ").trim())).toEqual(
          weldingSentences,
        );
        expect(input).toEqual(original);
        expect(shots.every((s) => s.duration <= 10)).toBe(true);
        expect(
          shots
            .flatMap((s) => s.dialogue)
            .every(
              (t) =>
                t.speaker === "Miguel" && t.action === "Muestra el objeto.",
            ),
        ).toBe(true);
      }
    },
  );
  it.each([DEFAULT_VIDEO, { ...DEFAULT_VIDEO, model: VEO_MODEL }])(
    "isolates an overlong idea from neighbouring sentences without exceeding $model limits",
    (settings) => {
      const long =
        "Este mecanismo permite sujetar la pieza, comprobar el ángulo, mantener la posición, reducir las vibraciones, controlar el movimiento y terminar el trabajo sin desplazar el conjunto.";
      const before = "Primero observa la mesa.",
        after = "Después revisamos el resultado.";
      const text = `${before} ${long} ${after}`;
      const shots = planDialogueShots(
        { ...config, settings },
        block([turn(text)]),
      );
      expect(shots[0].text.trim()).toBe(before);
      expect(shots.at(-1)!.text.trim()).toBe(after);
      expect(
        shots
          .slice(1, -1)
          .map((s) => s.text)
          .join("")
          .trim(),
      ).toBe(long);
      expect(
        shots.every(
          (s) =>
            dialogueSeconds(s.dialogue) <=
            (settings.model === VEO_MODEL ? 8 : 10),
        ),
      ).toBe(true);
      expect(shots.map((s) => s.text).join("")).toBe(text);
    },
  );
  it("still groups complete brief ideas and ignores formatting in the speech estimate", () => {
    const source = "La pieza está lista. Ahora podemos continuar.";
    const shots = planDialogueShots(config, block([turn(source)]));
    expect(shots).toHaveLength(1);
    expect(shots[0].text).toBe(source);
    expect(
      dialogueSeconds([
        turn("  La pieza\n\n está lista.   Ahora podemos continuar.  "),
      ]),
    ).toBe(dialogueSeconds([turn(source)]));
  });
});

function proposal(start: number, textLocation = "Taller"): ProposalResponse {
  return {
    mode: "spoken",
    style: "realistic",
    direction: "Demostración en el taller.",
    voice: "Kore",
    voiceDirection: "Natural",
    characters: config.characters,
    references: [],
    scenes: [
      {
        start,
        end: start,
        title: "Demostración",
        visual: "Miguel explica junto a la mesa.",
        speaker: "Miguel",
        participants: ["Miguel"],
        locationName: textLocation,
        referenceNames: [],
        turns: [
          {
            start,
            end: start,
            speaker: "Miguel",
            direction: "Natural",
            action: "Explica el mecanismo.",
          },
        ],
      },
    ],
  };
}
describe("planner unit boundaries do not become artificial scene cuts", () => {
  it.each([false, true])(
    "joins an unfinished same-speaker sentence, including across batches (%s)",
    (acrossBatches) => {
      const story = newStoryProposal(phrase + ".", { mode: "spoken" });
      story.planning!.units = ["y permite soltar en ", "todas las posiciones."];
      let result;
      if (acrossBatches) {
        const first = applyProposalBatch(story, proposal(0), 1);
        const snapshot = structuredClone(first);
        result = applyProposalBatch(first, proposal(1), 1);
        expect(first).toEqual(snapshot);
      } else {
        result = applyProposalBatch(
          story,
          {
            ...proposal(0),
            scenes: [...proposal(0).scenes, ...proposal(1).scenes],
          },
          2,
        );
      }
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].text).toBe(story.script);
      expect(result.blocks[0].dialogue?.map((t) => t.text).join(" ")).toBe(
        story.script,
      );
      expect(planDialogueShots(result, result.blocks[0])).toHaveLength(1);
      expect(result.references).toHaveLength(1);
    },
  );
  it.each([
    "sentence",
    "paragraph",
    "location",
    "generated",
    "speaker",
    "mode",
  ])("keeps intentional scene boundaries (%s)", (boundary) => {
    const story = newStoryProposal("Primera parte y la siguiente.", {
      mode: "spoken",
    });
    story.planning!.units = [
      boundary === "sentence"
        ? "Primera parte. "
        : boundary === "paragraph"
          ? "Primera parte\n"
          : "Primera parte ",
      "y la siguiente.",
    ];
    const first = applyProposalBatch(story, proposal(0), 1);
    if (boundary === "generated") first.blocks[0].sceneIds = ["existing-video"];
    const next = proposal(1, boundary === "location" ? "Jardín" : "Taller");
    if (boundary === "speaker") {
      next.scenes[0].turns![0].speaker = "Ana";
      first.planning!.units[1] = "Ana: y la siguiente.";
    }
    if (boundary === "mode") next.scenes[0].shotMode = "alternating";
    const result = applyProposalBatch(first, next, 1);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks.map((b) => b.text).join("")).toBe(
      first.planning!.units.join(""),
    );
  });
});
