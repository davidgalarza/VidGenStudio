import { describe, expect, it } from "vitest";
import { resolveProjectKind } from "../src/lib/projectKind";
import * as db from "../src/lib/storage";
import { makeStory } from "../src/lib/story";
import { DEFAULT_VIDEO, type Project } from "../src/types";

const legacy: Project = {
  id: "legacy",
  name: "Anterior",
  created_at: "2026-01-01",
};
const story = makeStory({
  script: "Una planta recibe luz.",
  mode: "voiceover",
  style: "explainer",
  direction: "",
  characters: [],
  voiceId: "Kore",
  voiceName: "Kore",
  settings: DEFAULT_VIDEO,
});

describe("project workflow compatibility", () => {
  it("keeps clip projects separate and preserves access to legacy story drafts", () => {
    expect(resolveProjectKind(legacy)).toBe("clips");
    expect(resolveProjectKind({ ...legacy, story })).toBe("story");
    expect(
      resolveProjectKind(
        legacy,
        JSON.stringify({ script: "Un guion sin producir" }),
      ),
    ).toBe("story");
    expect(resolveProjectKind(legacy, '{"script":"  "}')).toBe("clips");
    expect(resolveProjectKind(legacy, "corrupt")).toBe("clips");
    expect(
      resolveProjectKind(
        { ...legacy, kind: "clips" },
        JSON.stringify({ script: "Un borrador antiguo" }),
      ),
    ).toBe("clips");
    expect(resolveProjectKind({ ...legacy, kind: "story" })).toBe("story");
  });
  it("starts either kind empty and rejects attaching a story to an explicit clip project", async () => {
    const clips = await db.createProject("Clips", [], DEFAULT_VIDEO);
    const narrative = await db.createProject(
      "Historia",
      [],
      DEFAULT_VIDEO,
      "story",
    );
    expect(clips.kind).toBe("clips");
    expect(narrative.kind).toBe("story");
    expect(
      (await db.readWorkspace()).scenes.filter((s) =>
        [clips.id, narrative.id].includes(s.project_id),
      ),
    ).toHaveLength(0);
    await expect(db.createStory(clips.id, story)).rejects.toThrow(
      "proyecto de clips",
    );
    await db.createStory(narrative.id, story);
    const projects = (await db.readWorkspace()).projects;
    expect(projects.find((p) => p.id === clips.id)?.story).toBeUndefined();
    expect(projects.find((p) => p.id === narrative.id)?.story?.script).toBe(
      story.script,
    );
  });
});
