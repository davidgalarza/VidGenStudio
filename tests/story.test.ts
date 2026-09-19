import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alignNarration,
  makeStory,
  splitText,
  storyPrompt,
  storyVideoDuration,
} from "../src/lib/story";
import {
  DEFAULT_VIDEO,
  VEO_MODEL,
  type StoryConfig,
  type Narration,
} from "../src/types";
import { createSpeech, listVoices } from "../src/lib/elevenlabs";
import { planStoryVisuals } from "../src/lib/google";
import * as db from "../src/lib/storage";
import {
  makeSequenceItem,
  resolveTimeline,
  splitSequence,
} from "../src/lib/timeline";
const config: StoryConfig = {
  script: "Un pequeño paso permite comprender una idea nueva.",
  mode: "voiceover",
  style: "explainer",
  direction: "Laboratorio luminoso",
  characters: [],
  voiceId: "my-voice",
  voiceName: "Mi voz",
  settings: DEFAULT_VIDEO,
};
afterEach(() => vi.unstubAllGlobals());
function audioFor(text: string, duration: number): Narration {
  const characters = Array.from(text);
  return {
    id: "audio",
    project_id: "p",
    story_id: "s",
    block_id: "b",
    blob: new Blob(["audio"]),
    duration,
    alignment: {
      characters,
      character_start_times_seconds: characters.map(
        (_, i) => (i * (duration - 0.2)) / characters.length,
      ),
      character_end_times_seconds: characters.map(
        (_, i) => ((i + 1) * (duration - 0.2)) / characters.length,
      ),
    },
  };
}
describe("script coverage and exact narration timing", () => {
  it("preserves a long script word for word across bounded chunks, including paragraphs", () => {
    const script = Array.from(
      { length: 400 },
      (_, i) => `Párrafo ${i}: ¿Cómo funciona? Así se conserva cada palabra.\n`,
    )
      .join("")
      .trim();
    const story = makeStory({ ...config, script });
    expect(story.blocks.length).toBeGreaterThan(20);
    expect(story.blocks.map((b) => b.text).join("")).toBe(script);
    expect(story.blocks.every((b) => b.text.length <= 1200)).toBe(true);
    expect(splitText("🪐".repeat(2400), 1200).join("")).toBe("🪐".repeat(2400));
  });
  it("assigns speaker turns without speaking their labels and keeps each spoken clip within model limits", () => {
    const text =
      "Estamos explicando cómo la energía cambia de forma mientras el sistema se mueve y conserva todos sus elementos originales.";
    const story = makeStory({
      ...config,
      mode: "spoken",
      script: `Ana: ${text}\nLuis: Entiendo.\nAhora lo veo.`,
      characters: [
        { name: "Ana", description: "abrigo rojo", voice: "grave" },
        { name: "Luis", description: "gafas", voice: "suave" },
      ],
      settings: { ...DEFAULT_VIDEO, model: VEO_MODEL },
    });
    expect(
      story.blocks
        .filter((b) => b.speaker === "Ana")
        .map((b) => b.text)
        .join(""),
    ).toBe(text);
    expect(story.blocks.slice(-2).map((b) => b.speaker)).toEqual([
      "Luis",
      "Luis",
    ]);
    expect(
      story.blocks.every((b) => b.text.trim().split(/\s+/).length <= 13),
    ).toBe(true);
    expect(
      storyVideoDuration(7.5, { ...DEFAULT_VIDEO, model: VEO_MODEL }),
    ).toBe(8);
    expect(storyVideoDuration(2.1, DEFAULT_VIDEO)).toBe(3);
    const prompt = storyPrompt(story, {
      text: "Entiendo.",
      speaker: "Luis",
      visual: "Primer plano",
    });
    expect(prompt).toContain("Luis says exactly");
    expect(prompt).toContain('"Entiendo."');
    expect(prompt).toContain("Ana: appearance abrigo rojo; voice grave");
  });
  it("uses every second and every character, with contiguous cuts and no overlong video", () => {
    const text =
      "Una explicación detallada muestra primero los objetos, después su movimiento y finalmente el resultado. Nada del guion debe desaparecer.";
    const audio = audioFor(text, 34.7);
    const pieces = alignNarration(text, audio, 8);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces[0].start).toBe(0);
    expect(pieces.at(-1)?.end).toBe(audio.duration);
    pieces.forEach((p, i) => {
      expect(p.end - p.start).toBeLessThanOrEqual(8);
      if (i) expect(p.start).toBe(pieces[i - 1].end);
    });
  });
  it("rejects missing or corrupt timing instead of silently cutting the narration", () => {
    const audio = audioFor(config.script, 15);
    expect(() => alignNarration("different script", audio, 10)).toThrow(
      "tiempos válidos",
    );
    audio.alignment!.character_end_times_seconds[2] = NaN;
    expect(() => alignNarration(config.script, audio, 10)).toThrow(
      "sincronización",
    );
  });
});
describe("story persistence and editable montage", () => {
  it("atomically creates each block once, retains voice during regeneration and removes its audio with the project", async () => {
    const project = await db.createProject("Historia", [], DEFAULT_VIDEO);
    const story = makeStory(config);
    await db.createStory(project.id, story);
    const audio = {
      ...audioFor(config.script, 7),
      project_id: project.id,
      story_id: story.id,
      block_id: story.blocks[0].id,
    };
    await db.putNarration(audio);
    const storyScene = {
      storyId: story.id,
      blockId: story.blocks[0].id,
      text: config.script,
      visual: "Mesa",
      planned: true,
      audioId: audio.id,
      audioStart: 0,
      audioEnd: 7,
    };
    await db.createStoryScenes(project.id, story.id, story.blocks[0].id, [
      { story: storyScene, duration: 7 },
    ]);
    await db.createStoryScenes(project.id, story.id, story.blocks[0].id, [
      { story: storyScene, duration: 7 },
    ]);
    let work = await db.readWorkspace();
    const scene = work.scenes.find((s) => s.project_id === project.id)!;
    expect(work.scenes.filter((s) => s.project_id === project.id)).toHaveLength(
      1,
    );
    for (const id of ["first", "replacement"])
      await db.saveVersion(scene.id, {
        id,
        blob: new Blob([id]),
        prompt: "video",
        settings: DEFAULT_VIDEO,
        mode: "generate",
        duration: 5,
        created_at: "today",
      });
    work = await db.readWorkspace();
    const saved = work.projects.find((p) => p.id === project.id)!;
    const clips = resolveTimeline(
      saved.sequence_items!,
      work.scenes,
      {},
      work.narrations,
    );
    expect(await clips[0].blob?.text()).toBe("replacement");
    expect(clips[0].length).toBe(7); // Short visuals hold; narration must not be truncated.
    expect(clips[0].videoDuration).toBe(5);
    expect(clips[0].narration?.blob).toBeTruthy();
    expect(work.scenes.find((s) => s.id === scene.id)?.versions).toHaveLength(
      2,
    );
    const split = splitSequence(
      saved.sequence_items!,
      clips[0],
      3,
      "second-half",
    );
    const timeline = resolveTimeline(
      split.reverse(),
      work.scenes,
      {},
      work.narrations,
    );
    expect(timeline.map((c) => [c.in, c.out])).toEqual([
      [3, 7],
      [0, 3],
    ]);
    expect(timeline[0].narration?.offset).toBe(0);
    // An explicitly pinned original still resolves to its own version.
    const pinned = {
      ...makeSequenceItem(scene),
      follow_active: false,
      version_id: "first",
    };
    expect(await resolveTimeline([pinned], work.scenes)[0].blob?.text()).toBe(
      "first",
    );
    await db.deleteProject(project.id);
    expect(
      (await db.readWorkspace()).narrations.some(
        (n) => n.project_id === project.id,
      ),
    ).toBe(false);
  });
});
describe("provider contracts", () => {
  it("sends the same voice settings and continuity context without sharing the Google key", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            audio_base64: btoa("audio"),
            alignment: audioFor("Hola.", 2).alignment,
          }),
          { headers: { "request-id": "speech-1" } },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await createSpeech("eleven-secret", "voice/id", "Hola.", {
      previousText: "Antes.",
      nextText: "Después.",
      previousRequestIds: ["1", "2", "3", "4"],
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice%2Fid/with-timestamps?output_format=mp3_44100_128",
    );
    expect(options.headers["xi-api-key"]).toBe("eleven-secret");
    expect(options.headers["x-goog-api-key"]).toBeUndefined();
    expect(JSON.parse(options.body)).toMatchObject({
      text: "Hola.",
      model_id: "eleven_multilingual_v2",
      previous_request_ids: ["2", "3", "4"],
    });
    expect(await result.blob.text()).toBe("audio");
    expect(result.requestId).toBe("speech-1");
  });
  it("does not retry paid voice requests and redacts the key in provider errors", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ detail: { message: "bad secret-key" } }),
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      createSpeech("secret-key", "voice", "Hola", {}),
    ).rejects.toThrow("bad [clave]");
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(listVoices("")).rejects.toThrow("Conecta");
  });
  it("rejects a planner response that omits or replaces requested scenes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              steps: [
                {
                  type: "model_output",
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        scenes: [
                          { id: "wrong", title: "Uno", visual: "Una mesa" },
                        ],
                      }),
                    },
                  ],
                },
              ],
            }),
          ),
        ),
    );
    await expect(
      planStoryVisuals("test", "prompt", ["expected"]),
    ).rejects.toThrow("incompleto");
  });
});
