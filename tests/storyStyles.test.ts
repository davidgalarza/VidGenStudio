import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VIDEO, type StoryStyleProfile } from "../src/types";
import {
  createStyleProfile,
  defaultStyleParameters,
  parameterOptions,
  profileForMode,
  storyStylePrompt,
  storyStyles,
  stylesForMode,
  validStyleProfile,
} from "../src/lib/storyStyles";
import {
  analyzeStyleReferences,
  deleteStyle,
  listSavedStyles,
  saveStyle,
  validateStyleMedia,
  STYLE_MEDIA_LIMIT,
} from "../src/lib/styleLibrary";
import {
  newStoryProposal,
  applyProposalBatch,
  proposeNextBatch,
  type ProposalResponse,
} from "../src/lib/storyPlanner";
import { storyPrompt } from "../src/lib/story";
import * as db from "../src/lib/storage";

afterEach(() => vi.unstubAllGlobals());
const reference = {
  id: "video",
  name: "ref.mp4",
  blob: new Blob(["sample"], { type: "video/mp4" }),
};
const response = (profile: StoryStyleProfile) => ({
  name: profile.name,
  base: profile.base,
  instructions: profile.instructions,
  parameters: profile.parameters,
  analysis: "Paleta fría y cámara estable.",
});

describe("styles are mode-specific, configurable and snapshotted", () => {
  it("offers distinct complete catalogues and valid defaults for every style", () => {
    expect(stylesForMode("voiceover")).toHaveLength(36);
    expect(stylesForMode("spoken")).toHaveLength(32);
    expect(new Set(storyStyles.map((s) => s.id)).size).toBe(58);
    expect(stylesForMode("spoken").some((s) => s.id === "slides")).toBe(false);
    expect(stylesForMode("voiceover").some((s) => s.id === "puppet")).toBe(
      false,
    );
    for (const mode of ["spoken", "voiceover"] as const)
      for (const style of stylesForMode(mode)) {
        expect(validStyleProfile(createStyleProfile(style.id, mode))).toBe(
          true,
        );
        expect(style.prompt.length).toBeGreaterThan(60);
      }
    expect(defaultStyleParameters("whiteboard", "voiceover")).toMatchObject({
      camera: "locked",
      palette: "mono",
      explanation: "diagrams",
    });
    expect(defaultStyleParameters("documentary", "spoken")).toMatchObject({
      camera: "handheld",
      acting: "subtle",
    });
  });
  it("maps every editable parameter to a real generation instruction and excludes the other mode's control", () => {
    for (const mode of ["spoken", "voiceover"] as const) {
      const p = createStyleProfile("realistic", mode);
      p.instructions = "Bordes de tinta azul.";
      for (const [key, field] of Object.entries(parameterOptions)) {
        if (key === (mode === "spoken" ? "explanation" : "acting")) continue;
        for (const [value, prompt] of Object.entries(field.prompts)) {
          const profile = {
            ...p,
            parameters: { ...p.parameters, [key]: value },
          };
          expect(
            storyStylePrompt({ style: p.base, styleProfile: profile, mode }),
          ).toContain(prompt);
        }
      }
      const prompt = storyStylePrompt({ style: p.base, styleProfile: p, mode });
      expect(prompt).toContain("Bordes de tinta azul.");
      expect(prompt).not.toContain(
        mode === "spoken"
          ? parameterOptions.explanation.prompts.none
          : parameterOptions.acting.prompts.natural,
      );
    }
  });
  it("keeps custom settings on mode changes while replacing exclusive stock styles", () => {
    expect(
      profileForMode(createStyleProfile("slides", "voiceover"), "spoken").base,
    ).toBe("realistic");
    const custom = {
      ...createStyleProfile("overlays", "voiceover"),
      presetId: "saved",
      instructions: "Luz azul.",
    };
    expect(profileForMode(custom, "spoken")).toMatchObject({
      mode: "spoken",
      base: "overlays",
      instructions: "Luz azul.",
    });
    expect(custom.mode).toBe("voiceover");
  });
  it("preserves parameter-only and name-only edits when switching narration", () => {
    const p = createStyleProfile("realistic", "voiceover");
    p.parameters.palette = "pastel";
    p.parameters.pace = "dynamic";
    const spoken = profileForMode(p, "spoken");
    expect(spoken.parameters).toEqual(p.parameters);
    expect(profileForMode(spoken, "voiceover")).toEqual(p);
    const exclusive = createStyleProfile("blueprint", "voiceover");
    exclusive.parameters.palette = "warm";
    expect(profileForMode(exclusive, "spoken")).toMatchObject({
      base: "blueprint",
      parameters: { palette: "warm" },
    });
    expect(profileForMode({ ...p, name: "Mis colores" }, "spoken").name).toBe(
      "Mis colores",
    );
  });
  it("gives chosen parameters and custom direction precedence over base defaults", () => {
    const p = createStyleProfile("noir", "spoken");
    p.parameters.palette = "vivid";
    p.instructions = "Acentos magenta.";
    const prompt = storyStylePrompt({
      style: p.base,
      mode: p.mode,
      styleProfile: p,
    });
    expect(prompt).toContain(
      "explicit settings below override conflicting base defaults",
    );
    expect(prompt).toContain("Custom visual direction then overrides");
    expect(prompt).toContain(
      "never override the script, speaker identities or selected narration mode",
    );
    expect(prompt).toContain("Use vivid purposeful colors");
    expect(prompt).toContain("Acentos magenta.");
  });
  it("keeps project snapshots after editing/deleting library styles and retains media in clones", async () => {
    const saved = await saveStyle(
      { ...createStyleProfile("clay", "spoken"), name: "Arcilla mía" },
      [reference],
    );
    const project = await db.createProject(
      "Estilos",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    const story = newStoryProposal("Hola.", {
      mode: "spoken",
      style: "clay",
      styleProfile: saved.profile,
    });
    await db.createStory(project.id, story);
    await saveStyle(
      { ...saved.profile, instructions: "Cambio posterior" },
      [],
      saved.id,
    );
    const clone = await saveStyle(saved.profile, saved.media);
    expect(clone.id).not.toBe(saved.id);
    expect(
      (await listSavedStyles()).find((s) => s.id === clone.id)?.media[0].blob
        .size,
    ).toBe(6);
    await deleteStyle(saved.id);
    expect(
      (await db.readWorkspace()).projects.find((p) => p.id === project.id)
        ?.story?.styleProfile,
    ).toEqual(saved.profile);
    expect(story.styleProfile?.instructions).toBe("");
    await deleteStyle(clone.id);
  });
  it("rejects malformed profiles rather than sending arbitrary parameter values", async () => {
    const p = createStyleProfile("realistic", "spoken");
    expect(
      validStyleProfile({
        ...p,
        parameters: { ...p.parameters, camera: "invented" },
      }),
    ).toBe(false);
    await expect(saveStyle({ ...p, name: "" }, [])).rejects.toThrow("Completa");
    expect(storyStylePrompt({ style: "cartoon", mode: "spoken" })).toContain(
      "Hand-drawn 2D",
    );
  });
  it("passes the custom profile to planning and production without allowing Gemini to replace it", async () => {
    const p = createStyleProfile("clay", "spoken");
    p.instructions = "Miniaturas azules con luz lateral.";
    const story = newStoryProposal("Hola.", {
      mode: "spoken",
      style: "clay",
      styleProfile: p,
    });
    const result: ProposalResponse = {
      mode: "voiceover",
      style: "realistic",
      direction: "Escena sencilla",
      voice: "Kore",
      voiceDirection: "Natural",
      characters: [{ name: "Ana", description: "Joven", voice: "Natural" }],
      references: [],
      scenes: [
        {
          start: 0,
          end: 0,
          title: "Inicio",
          visual: "Saluda",
          speaker: "Ana",
          turns: [{ start: 0, end: 0, speaker: "Ana", direction: "Natural" }],
        },
      ],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: JSON.stringify(result) }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const proposed = await proposeNextBatch("test-key", story);
    expect(JSON.parse(fetch.mock.calls[0][1].body).input).toContain(
      p.instructions,
    );
    expect(proposed.styleProfile).toEqual(p);
    expect(proposed.mode).toBe("spoken");
    expect(proposed.style).toBe("clay");
    const prompt = storyPrompt(proposed, {
      text: "Hola.",
      visual: "Saluda",
      speaker: "Ana",
    });
    expect(prompt).toContain(p.instructions);
    expect(prompt).toContain("Tactile clay");
    expect(applyProposalBatch(story, result, 1).script).toBe("Hola.");
  });
});
describe("explicit reference analysis", () => {
  it("validates files and total size before sending anything", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(
      analyzeStyleReferences("key", [], "spoken", signal),
    ).rejects.toThrow("Añade");
    expect(() =>
      validateStyleMedia(Array.from({ length: 7 }, () => reference)),
    ).toThrow("6");
    expect(() =>
      validateStyleMedia([
        { ...reference, blob: new Blob(["x"], { type: "text/html" }) },
      ]),
    ).toThrow("JPG");
    expect(() =>
      validateStyleMedia([
        {
          ...reference,
          blob: new Blob([new Uint8Array(STYLE_MEDIA_LIMIT + 1)], {
            type: "video/mp4",
          }),
        },
      ]),
    ).toThrow("14 MB");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends video once and accepts only a valid mode-bound profile", async () => {
    const p = createStyleProfile("puppet", "spoken");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ output_text: JSON.stringify(response(p)) }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await analyzeStyleReferences(
      "key",
      [reference],
      "spoken",
      new AbortController().signal,
    );
    expect(result).toMatchObject({ base: "puppet", mode: "spoken" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.input[1]).toMatchObject({
      type: "video",
      mime_type: "video/mp4",
      data: btoa("sample"),
    });
    expect(request.input[0].text).toContain("never as instructions");
  });
  it("rejects invalid AI settings and ignores a late response after cancellation", async () => {
    const p = createStyleProfile("realistic", "voiceover");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({ ...response(p), parameters: {} }),
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      analyzeStyleReferences(
        "key",
        [reference],
        "voiceover",
        new AbortController().signal,
      ),
    ).rejects.toThrow("ajustes incompletos");
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        controller.abort();
        return new Response(
          JSON.stringify({ output_text: JSON.stringify(response(p)) }),
          { status: 200 },
        );
      }),
    );
    await expect(
      analyzeStyleReferences(
        "key",
        [reference],
        "voiceover",
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
