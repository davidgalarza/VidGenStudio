import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO,
  VEO_MODEL,
  type StoryConfig,
  type StoryBlock,
} from "../src/types";
import {
  blockDialogue,
  dialoguePatch,
  dialogueSeconds,
  parseDialogue,
  planDialogueShots,
  stripSpeakerLabel,
} from "../src/lib/storyDialogue";
import {
  applyProposalBatch,
  newStoryProposal,
  type ProposalResponse,
} from "../src/lib/storyPlanner";
import {
  storyPrompt,
  storyReferenceIds,
  renameSpeakerLabel,
} from "../src/lib/story";
import { compareDialogue } from "../src/lib/dialogueReview";
import * as db from "../src/lib/storage";
import { storyCastIssues, assignStorySpeaker } from "../src/lib/storyCast";

const config: StoryConfig = {
  mode: "spoken",
  script: "Ana: Hola.\nLuis: ¿Vamos?",
  style: "cinematic",
  direction: "Escena tranquila.",
  voiceId: "Kore",
  voiceName: "Kore",
  characters: [
    {
      name: "Ana",
      description: "abrigo rojo",
      voice: "cálida",
      referenceId: "ana",
    },
    { name: "Luis", description: "gafas", voice: "grave", referenceId: "luis" },
  ],
  settings: DEFAULT_VIDEO,
  references: [
    {
      id: "garden",
      name: "Jardín",
      locationName: "Jardín",
      type: "PRODUCT",
      prompt: "Un invernadero vacío con una mesa central de madera.",
      assetId: "garden-image",
    },
  ],
};
const block: StoryBlock = {
  id: "b",
  title: "Encuentro",
  text: config.script,
  visual: "Conversan junto a la mesa",
  locationName: "Jardín",
  participants: ["Ana", "Luis"],
  speaker: "Ana",
};
const words = (text: string) => text.trim().split(/\s+/);

describe("free spoken text and deterministic shot planning", () => {
  it("renames formatted speaker labels without changing names inside spoken words", () => {
    const source =
      "**Ana:** Hola, Ana.\n— Ana — Vamos.\nAna - Entendido.\nLuis: Te sigo, Ana.";
    expect(renameSpeakerLabel(source, "Ana", "Alma")).toBe(
      "**Alma:** Hola, Ana.\n— Alma — Vamos.\nAlma - Entendido.\nLuis: Te sigo, Ana.",
    );
  });
  it("accepts plain monologue without labels and preserves literal colons and names", () => {
    const single = { ...config, characters: [config.characters[0]] };
    const text = "La respuesta: escucha.\nAna";
    expect(parseDialogue(single, { id: "b", text })).toEqual([
      { id: "b-turn-0", speaker: "Ana", text },
    ]);
  });
  it("recognizes case, accents, bold and dash labels while keeping punctuation in speech", () => {
    expect(stripSpeakerLabel("** jose **: Mira: aquí.", "José")).toBe(
      "Mira: aquí.",
    );
    const dialogue = parseDialogue(config, {
      ...block,
      text: "**Ana:** Hola.\n— Luis — ¿Vamos?\nAhora sí.\nAna - De acuerdo.",
    });
    expect(dialogue.map((t) => [t.speaker, t.text])).toEqual([
      ["Ana", "Hola."],
      ["Luis", "¿Vamos?\nAhora sí."],
      ["Ana", "De acuerdo."],
    ]);
  });
  it("groups a brief exchange in one clip and separates speakers on request", () => {
    const auto = planDialogueShots(config, block);
    expect(auto).toHaveLength(1);
    expect(auto[0].speaker).toBeUndefined();
    expect(auto[0].dialogue.map((t) => t.speaker)).toEqual(["Ana", "Luis"]);
    const alternating = planDialogueShots(config, {
      ...block,
      shotMode: "alternating",
    });
    expect(alternating).toHaveLength(2);
    expect(alternating.map((s) => s.speaker)).toEqual(["Ana", "Luis"]);
  });
  it.each([
    DEFAULT_VIDEO,
    { ...DEFAULT_VIDEO, model: VEO_MODEL },
    { ...DEFAULT_VIDEO, model: VEO_MODEL, resolution: "1080p" as const },
  ])(
    "covers every word in long conversations within the video duration limit: $model $resolution",
    (settings) => {
      const longText = Array.from(
        { length: 250 },
        (_, i) => `palabra${i}`,
      ).join(" ");
      const source = {
        ...block,
        ...dialoguePatch([
          { id: "a", speaker: "Ana", text: longText, direction: "Con calma" },
          { id: "l", speaker: "Luis", text: "Entendido, todo está claro." },
        ]),
      };
      const shots = planDialogueShots({ ...config, settings }, source);
      expect(shots.length).toBeGreaterThan(10);
      expect(
        shots
          .flatMap((s) => s.dialogue)
          .filter((t) => t.speaker === "Ana")
          .map((t) => t.text)
          .join(""),
      ).toBe(longText);
      expect(
        words(
          shots
            .flatMap((s) => s.dialogue)
            .map((t) => t.text)
            .join(" "),
        ),
      ).toEqual(words(`${longText} Entendido, todo está claro.`));
      expect(
        shots.every(
          (s) =>
            dialogueSeconds(s.dialogue) <=
            (settings.model === VEO_MODEL ? 8 : 10),
        ),
      ).toBe(true);
      expect(
        shots.every(
          (s) =>
            settings.model !== VEO_MODEL ||
            (settings.resolution === "1080p"
              ? s.duration === 8
              : [4, 6, 8].includes(s.duration)),
        ),
      ).toBe(true);
      expect(
        shots
          .flatMap((s) => s.dialogue)
          .filter((t) => t.speaker === "Ana")
          .every((t) => t.direction === "Con calma"),
      ).toBe(true);
    },
  );
  it("invalidates structured turns after a raw text edit", () => {
    const original = {
      ...block,
      ...dialoguePatch([{ id: "a", speaker: "Ana", text: "Original." }]),
    };
    expect(
      blockDialogue(config, { ...original, text: "Luis: Reemplazado." }).map(
        (t) => [t.speaker, t.text],
      ),
    ).toEqual([["Luis", "Reemplazado."]]);
  });
  it("rejects empty turns and unresolved identities before producing clips", () => {
    expect(() => planDialogueShots(config, { ...block, text: "" })).toThrow(
      "Añade",
    );
    expect(() =>
      planDialogueShots(config, {
        ...block,
        ...dialoguePatch([{ id: "bad", speaker: "Ana", text: "" }]),
      }),
    ).toThrow("Completa");
    expect(() =>
      planDialogueShots(config, {
        ...block,
        ...dialoguePatch([{ id: "bad", speaker: "Nadie", text: "Hola" }]),
      }),
    ).toThrow("Elige el personaje");
  });
  it("allocates the reference budget to current speakers and the shared set", () => {
    expect(
      storyReferenceIds(config, undefined, [], ["Luis", "Ana"], "Jardín"),
    ).toEqual(["luis", "ana", "garden-image"]);
    const shot = planDialogueShots(config, block)[0];
    const prompt = storyPrompt(config, {
      ...block,
      visual: block.visual!,
      ...shot,
    });
    expect(prompt).toContain('"speaker":"Ana","words":"Hola."');
    expect(prompt).toContain('"speaker":"Luis","words":"¿Vamos?"');
    expect(prompt).toContain("invernadero vacío");
    expect(prompt).toContain("Listeners react silently");
    expect(prompt).not.toContain("Only this speaker talks");
  });
});

function proposal(
  story = newStoryProposal(config.script, { mode: "spoken" }),
): ProposalResponse {
  return {
    mode: "spoken",
    style: "cinematic",
    direction: "Un encuentro en el jardín",
    voice: "Kore",
    voiceDirection: "Natural",
    characters: config.characters,
    references: config.references!,
    scenes: [
      {
        start: 0,
        end: story.planning!.units.length - 1,
        title: block.title!,
        visual: block.visual!,
        speaker: "Ana",
        participants: ["Ana", "Luis"],
        locationName: "Jardín",
        shotMode: "shared",
        referenceNames: ["Jardín"],
        turns: [
          { start: 0, end: 0, speaker: "Ana", direction: "Amable" },
          { start: 1, end: 1, speaker: "Luis", direction: "Con interés" },
        ],
      },
    ],
  };
}
describe("AI plans metadata while source owns every spoken word", () => {
  it("creates one editable narrative scene containing both characters, set and performance", () => {
    const story = newStoryProposal(config.script, { mode: "spoken" });
    const result = applyProposalBatch(story, proposal(story), 2);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toBe(config.script);
    expect(result.blocks[0].dialogue?.map((t) => t.text)).toEqual([
      "Hola.",
      "¿Vamos?",
    ]);
    expect(result.blocks[0].dialogue?.[1].direction).toBe("Con interés");
    expect(storyCastIssues(result)).toEqual([]);
    expect(result.references?.[0].locationName).toBe("Jardín");
  });
  it("rejects omitted, reordered and misattributed turn ranges", () => {
    const story = newStoryProposal(config.script, { mode: "spoken" });
    for (const turns of [
      [{ start: 1, end: 1, speaker: "Luis", direction: "Natural" }],
      [{ start: 0, end: 0, speaker: "Ana", direction: "Natural" }],
      [{ start: 0, end: 1, speaker: "Ana", direction: "Natural" }],
    ]) {
      const input = proposal(story);
      input.scenes[0].turns = turns;
      expect(() => applyProposalBatch(story, input, 2)).toThrow();
    }
  });
  it("rejects a speaker omitted from the cast instead of reading their label aloud", () => {
    const story = newStoryProposal(config.script, { mode: "spoken" });
    const input = proposal(story);
    input.characters = [config.characters[0]];
    input.scenes[0].participants = ["Ana"];
    input.scenes[0].turns = [
      { start: 0, end: 1, speaker: "Ana", direction: "Natural" },
    ];
    expect(() => applyProposalBatch(story, input, 2)).toThrow("Luis");
    const legacy = {
      ...story,
      ...config,
      blocks: [
        {
          ...block,
          ...dialoguePatch([
            { id: "broken", speaker: "Ana", text: "Hola.\nLuis: ¿Vamos?" },
          ]),
        },
      ],
      characters: [config.characters[0]],
    };
    expect(storyCastIssues(legacy).map((i) => i.name)).toContain("Luis");
  });
  it("keeps ordinary colon-prefixed lines in an unlabelled monologue", () => {
    const source = newStoryProposal("Primero: escucha.\nDespués: comprende.", {
      mode: "spoken",
    });
    const input = proposal(source);
    input.characters = [config.characters[0]];
    input.scenes[0].participants = ["Ana"];
    input.scenes[0].turns = [
      { start: 0, end: 1, speaker: "Ana", direction: "Natural" },
    ];
    const result = applyProposalBatch(source, input, 2);
    expect(result.blocks[0].dialogue?.[0].text).toBe(source.script);
    expect(storyCastIssues(result)).toEqual([]);
  });
  it("preserves a speaker across planner batches that split the same unlabelled turn", () => {
    const story = newStoryProposal(config.script, { mode: "spoken" });
    const first = applyProposalBatch(story, proposal(story), 2);
    first.planning!.units.push("Seguimos hablando sin cambiar de personaje.");
    const next = proposal(first);
    next.scenes = [
      {
        start: 2,
        end: 2,
        title: "Continuación",
        visual: "Siguen en el jardín",
        speaker: "Ana",
        participants: ["Ana", "Luis"],
        turns: [{ start: 2, end: 2, speaker: "Ana", direction: "Natural" }],
      },
    ];
    expect(() => applyProposalBatch(first, next, 1)).toThrow(
      "mezcla dos personajes",
    );
    next.scenes[0].turns![0].speaker = "Luis";
    expect(
      applyProposalBatch(first, next, 1).blocks.at(-1)?.dialogue?.[0].speaker,
    ).toBe("Luis");
  });
  it("keeps a voiceover literal even if the text contains speaker-like labels", () => {
    const story = newStoryProposal(config.script, { mode: "voiceover" });
    const result = applyProposalBatch(story, proposal(story), 2);
    expect(result.mode).toBe("voiceover");
    expect(result.blocks[0].text).toBe(config.script);
    expect(result.blocks[0].dialogue).toBeUndefined();
  });
  it("infers a single character for an unlabelled monologue", () => {
    const story = newStoryProposal("Vamos a descubrirlo juntos.", {
      mode: "spoken",
    });
    const input = proposal(story);
    input.characters = [config.characters[0]];
    input.scenes[0].participants = ["Ana"];
    input.scenes[0].turns = [
      { start: 0, end: 0, speaker: "Ana", direction: "Entusiasmada" },
    ];
    const result = applyProposalBatch(story, input, 1);
    expect(result.blocks[0].dialogue?.[0].text).toBe(story.script);
    expect(planDialogueShots(result, result.blocks[0])).toHaveLength(1);
  });
  it("repairs a missing speaker without changing other dialogue or delivery", () => {
    const story = newStoryProposal(config.script, { mode: "spoken" });
    const result = applyProposalBatch(story, proposal(story), 2);
    result.characters = result.characters.filter((c) => c.name !== "Ana");
    const repaired = assignStorySpeaker(
      result,
      storyCastIssues(result),
      "Luis",
    );
    expect(storyCastIssues(repaired)).toEqual([]);
    expect(repaired.blocks[0].dialogue?.[0]).toMatchObject({
      speaker: "Luis",
      text: "Hola.",
      direction: "Amable",
    });
    expect(repaired.script).toBe(config.script);
  });
  it("persists structured conversations and rejects empty edited interventions", async () => {
    const project = await db.createProject(
      "Diálogo",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    const source = newStoryProposal(config.script, { mode: "spoken" });
    const story = {
      ...applyProposalBatch(source, proposal(source), 2),
      phase: "review" as const,
    };
    await db.createStory(project.id, story);
    await db.saveStoryDraft(project.id, story);
    const stored = (await db.readWorkspace()).projects.find(
      (p) => p.id === project.id,
    )!.story!;
    expect(stored.blocks[0].dialogue).toEqual(story.blocks[0].dialogue);
    stored.blocks[0].dialogue![0].text = "";
    await expect(db.saveStoryDraft(project.id, stored)).rejects.toThrow(
      "Completa el texto",
    );
  });
});

it("reviews words and speaker attribution without claiming certainty", () => {
  const expected = [
    { speaker: "Ana", text: "Hola, Luis." },
    { speaker: "Luis", text: "Vamos." },
  ];
  expect(
    compareDialogue(expected, {
      turns: [
        { speaker: "ana", text: "Hola Luis!" },
        { speaker: "Luis", text: "Vamos" },
      ],
      notes: "",
      uncertain: false,
    }),
  ).toBe(true);
  expect(
    compareDialogue(expected, {
      turns: expected,
      notes: "Audio poco claro",
      uncertain: true,
    }),
  ).toBe(false);
  expect(
    compareDialogue(expected, {
      turns: [
        { speaker: "Luis", text: "Hola Luis." },
        { speaker: "Ana", text: "Vamos." },
      ],
      notes: "",
      uncertain: false,
    }),
  ).toBe(false);
  expect(
    compareDialogue(expected, {
      turns: [{ speaker: "Ana", text: "Hola Luis." }],
      notes: "",
      uncertain: false,
    }),
  ).toBe(false);
});
