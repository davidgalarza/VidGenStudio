import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browseStyles,
  matchesStyleSearch,
  readStyleFavorites,
  writeStyleFavorites,
  styleKey,
  styleUse,
} from "../src/lib/styleBrowsing";
import {
  createStyleProfile,
  storyStylePrompt,
  stylesForMode,
} from "../src/lib/storyStyles";

afterEach(() => vi.unstubAllGlobals());
describe("style discovery", () => {
  it("finds techniques and use cases without accents, with unordered search terms", () => {
    expect(matchesStyleSearch("oilpaint", "oleo")).toBe(true);
    expect(matchesStyleSearch("maps", "geografia ruta")).toBe(true);
    expect(matchesStyleSearch("productviz", "3D producto")).toBe(true);
    expect(matchesStyleSearch("chalkboard", "clase pizarra")).toBe(true);
    expect(matchesStyleSearch("realistic", " AZUL  ", "Mi estilo azul")).toBe(
      true,
    );
    expect(matchesStyleSearch("oilpaint", "oleo datos")).toBe(false);
  });
  it("orders each mode for its task without losing presets or changing production behavior", () => {
    expect(browseStyles("voiceover")[0].id).toBe("broll");
    expect(browseStyles("spoken")[0].id).toBe("realistic");
    for (const mode of ["voiceover", "spoken"] as const) {
      expect(new Set(browseStyles(mode).map((s) => s.id))).toEqual(
        new Set(stylesForMode(mode).map((s) => s.id)),
      );
      for (const s of browseStyles(mode)) {
        expect(styleUse(s.id).length).toBeGreaterThan(35);
        const profile = createStyleProfile(s.id, mode);
        expect(
          storyStylePrompt({ mode, style: s.id, styleProfile: profile }),
        ).toContain(s.prompt);
      }
    }
    expect(createStyleProfile("stage", "spoken").parameters.acting).toBe(
      "theatrical",
    );
    expect(createStyleProfile("topdown", "voiceover").parameters).toMatchObject(
      { camera: "locked", explanation: "visual" },
    );
  });
  it("persists favorites, tolerates corrupt storage and reports unavailable storage", () => {
    let value = '["builtin:maps",null,"builtin:maps",42]';
    vi.stubGlobal("localStorage", {
      getItem: () => value,
      setItem: (_: string, v: string) => {
        value = v;
      },
    });
    expect(readStyleFavorites()).toEqual(["builtin:maps"]);
    expect(writeStyleFavorites(["builtin:oilpaint", "saved-id"])).toBe(true);
    expect(readStyleFavorites()).toEqual(["builtin:oilpaint", "saved-id"]);
    value = "broken";
    expect(readStyleFavorites()).toEqual([]);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("disabled");
      },
      setItem: () => {
        throw Error("disabled");
      },
    });
    expect(readStyleFavorites()).toEqual([]);
    expect(writeStyleFavorites([])).toBe(false);
    expect(styleKey(createStyleProfile("maps", "voiceover"))).toBe(
      "builtin:maps",
    );
    expect(
      styleKey({
        ...createStyleProfile("maps", "voiceover"),
        presetId: "saved-id",
      }),
    ).toBe("saved-id");
  });
});
