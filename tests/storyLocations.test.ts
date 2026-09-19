import { describe, expect, it } from "vitest";
import {
  applyProposalBatch,
  newStoryProposal,
  type ProposalResponse,
} from "../src/lib/storyPlanner";
import { storyPrompt, storyReferenceIds } from "../src/lib/story";
import type { Story, StoryMode, StoryReference } from "../src/types";

const apartment = "Apartamento de Miguel";
const visual =
  "Miguel conversa junto a un sofá azul. A la izquierda hay una ventana amplia y una mesa de madera.";
function proposal(story: Story, location = apartment): ProposalResponse {
  return {
    mode: story.mode,
    style: "realistic",
    direction: "Un diálogo cercano en casa.",
    voice: "Kore",
    voiceDirection: "Natural",
    references: [],
    characters: [
      { name: "Miguel", description: "Camisa verde", voice: "Cálida" },
    ],
    scenes: [
      {
        start: story.planning!.cursor,
        end: story.planning!.cursor,
        title: "En casa",
        visual,
        speaker: "Miguel",
        participants: story.mode === "spoken" ? ["Miguel"] : [],
        locationName: location,
        referenceNames: [location],
      },
    ],
  };
}
function set(name: string, locationName = name): StoryReference {
  return {
    id: `id:${name}`,
    name,
    locationName,
    type: "PRODUCT",
    prompt: "Escenario vacío con sofá azul.",
    assetId: `image:${name}`,
  };
}

describe("recoverable location metadata in story proposals", () => {
  it.each<StoryMode>(["spoken", "voiceover"])(
    "fills an omitted apartment reference without changing %s text or input",
    (mode) => {
      const story = newStoryProposal("Hola, qué bueno verte.", {
        mode,
        autoReferences: false,
      });
      const input = proposal(story);
      const before = structuredClone({ story, input });
      const result = applyProposalBatch(story, input, 1);
      expect(result.script).toBe(story.script);
      expect(result.blocks[0].text).toBe(story.script);
      expect(result.blocks[0].locationName).toBe(apartment);
      expect(result.references).toHaveLength(1);
      expect(result.references![0]).toMatchObject({
        name: apartment,
        locationName: apartment,
        type: "PRODUCT",
      });
      expect(result.references![0].prompt).toContain(visual);
      expect(result.references![0].prompt).toContain("sin personas");
      expect(result.references![0].assetId).toBeUndefined();
      expect(result.autoReferences).toBe(false);
      expect({ story, input }).toEqual(before);
      if (mode === "spoken")
        expect(result.blocks[0].dialogue?.[0].text).toBe(story.script);
    },
  );
  it("links a named set whose model response omitted locationName", () => {
    const story = newStoryProposal("Hola.", { mode: "spoken" });
    const input = proposal(story);
    input.references = [
      {
        name: apartment,
        type: "PRODUCT",
        prompt: "Un sofá amarillo junto a una ventana.",
      },
    ];
    const result = applyProposalBatch(story, input, 1);
    expect(result.references).toHaveLength(1);
    expect(result.references![0].locationName).toBe(apartment);
    expect(result.references![0].prompt).toBe(input.references[0].prompt);
  });
  it("canonicalizes whitespace, case and unambiguous accents without losing an existing image", () => {
    const story = newStoryProposal("Hola.", { mode: "spoken" });
    story.references = [set("Escenario del salón", "Salón de Miguel")];
    const input = proposal(story, "  SALON  DE   MIGUEL ");
    input.scenes[0].referenceNames = ["  escenario DEL SALON "];
    const result = applyProposalBatch(story, input, 1);
    expect(result.references).toEqual(story.references);
    expect(result.blocks[0].locationName).toBe("Salón de Miguel");
    expect(result.blocks[0].referenceNames).toEqual(["Escenario del salón"]);
    expect(
      storyReferenceIds(
        result,
        "Miguel",
        result.blocks[0].referenceNames,
        ["Miguel"],
        result.blocks[0].locationName,
      ),
    ).toEqual(["image:Escenario del salón"]);
    expect(storyPrompt(result, { ...result.blocks[0], visual })).toContain(
      "Escenario vacío con sofá azul.",
    );
  });
  it("reuses the same set and image when a later batch gives it a different reference label", () => {
    const source = newStoryProposal("Hola.\nAdelante.", { mode: "spoken" });
    const first = applyProposalBatch(source, proposal(source), 1);
    first.references![0].assetId = "saved-apartment";
    const snapshot = structuredClone(first);
    const input = proposal(first, "apartamento de MIGUEL");
    input.references = [
      {
        name: "Interior del apartamento",
        type: "PRODUCT",
        locationName: "apartamento de MIGUEL",
        prompt:
          "Una descripción que no debe reemplazar el escenario existente.",
      },
    ];
    input.scenes[0].referenceNames = ["Interior del apartamento"];
    const next = applyProposalBatch(first, input, 1);
    expect(next.references).toEqual(first.references);
    expect(next.blocks.map((b) => b.text).join("")).toBe(source.script);
    expect(next.blocks.map((b) => b.locationName)).toEqual([
      apartment,
      apartment,
    ]);
    expect(next.blocks[1].referenceNames).toEqual([apartment]);
    expect(next.blocks[0]).toEqual(first.blocks[0]);
    expect(first).toEqual(snapshot);
  });
  it("does not treat a character or a different room as the missing set", () => {
    const story = newStoryProposal("Hola.", { mode: "spoken" });
    story.references = [
      {
        ...set(apartment),
        type: "CHARACTER",
        characterName: "Miguel",
        locationName: undefined,
      },
      set("Cocina de Miguel"),
    ];
    const result = applyProposalBatch(story, proposal(story), 1);
    expect(result.references).toHaveLength(3);
    const room = result.references!.find((r) => r.locationName === apartment)!;
    expect(room.type).toBe("PRODUCT");
    expect(room.name).not.toBe(apartment);
    expect(result.blocks[0].referenceNames).toEqual([room.name]);
    expect(result.references![0]).toEqual(story.references[0]);
    expect(result.references![1]).toEqual(story.references[1]);
  });
  it("does not merge two distinctly named sets through an ambiguous accent match", () => {
    const story = newStoryProposal("Hola.", { mode: "spoken" });
    story.references = [set("Casa de José"), set("Casa de Josè")];
    const result = applyProposalBatch(
      story,
      proposal(story, "Casa de Jose"),
      1,
    );
    expect(result.references).toHaveLength(3);
    expect(result.blocks[0].locationName).toBe("Casa de Jose");
    expect(result.references!.slice(0, 2)).toEqual(story.references);
  });
  it("still rejects unrelated missing references and invalid script ranges atomically", () => {
    const story = newStoryProposal("Hola.", { mode: "spoken" });
    const input = proposal(story);
    input.scenes[0].referenceNames = ["Objeto no definido"];
    expect(() => applyProposalBatch(story, input, 1)).toThrow(
      "Objeto no definido",
    );
    input.scenes[0].referenceNames = [apartment];
    input.scenes[0].start = 1;
    expect(() => applyProposalBatch(story, input, 1)).toThrow("omitió");
    expect(story.references).toEqual([]);
    expect(story.blocks).toEqual([]);
    expect(story.planning!.cursor).toBe(0);
  });
});
