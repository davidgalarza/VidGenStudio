import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Project, Scene, Narration } from "../src/types";
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const narration = readFileSync(
  new URL("./fixtures/narration.mp3", import.meta.url),
).toString("base64");
const script =
  "La luz entra por la ventana y alcanza una pequeña planta. Sus hojas transforman esa energía en alimento. Ahora vemos las raíces absorber agua del suelo y llevarla hasta las hojas.";
async function init(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-google-key"),
  );
  await page.goto("/");
  await page
    .locator(".home-page")
    .getByRole("button", { name: "Nuevo proyecto", exact: true })
    .click();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = database.transaction(["projects", "scenes", "narrations"]);
    const get = <T>(name: string) =>
      new Promise<T[]>((resolve) => {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [projects, scenes, narrations] = await Promise.all([
      get<Project>("projects"),
      get<Scene>("scenes"),
      get<Narration>("narrations"),
    ]);
    database.close();
    return {
      projects,
      scenes: scenes
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          ...s,
          versions: s.versions?.map((v) => ({ ...v, blob: undefined })),
        })),
      narrations: narrations.map((a) => ({ ...a, blob: undefined })),
    };
  });
}
async function providers(page: Page, options: { failPlan?: boolean } = {}) {
  const calls = { speech: 0, plans: 0, video: 0, prompts: [] as string[] };
  await page.route("**/api.elevenlabs.io/**", async (route) => {
    expect(route.request().headers()["x-goog-api-key"]).toBeUndefined();
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { voices: [{ voice_id: "test-voice", name: "Voz de prueba" }] },
      });
    calls.speech++;
    const body = route.request().postDataJSON();
    const chars = Array.from(body.text as string);
    await route.fulfill({
      json: {
        audio_base64: narration,
        alignment: {
          characters: chars,
          character_start_times_seconds: chars.map(
            (_, i) => (i * 16.7) / chars.length,
          ),
          character_end_times_seconds: chars.map(
            (_, i) => ((i + 1) * 16.7) / chars.length,
          ),
        },
      },
    });
  });
  await page.route("**/generativelanguage.googleapis.com/**", async (route) => {
    expect(route.request().headers()["xi-api-key"]).toBeUndefined();
    const body = route.request().postDataJSON();
    if (body?.model === "gemini-3.8-flash") {
      calls.plans++;
      if (options.failPlan && calls.plans === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Planner unavailable for this test" } },
        });
      const scenes = JSON.parse(body.input.split("SCENES: ")[1]);
      return route.fulfill({
        json: {
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    scenes: scenes.map((s: { id: string }, i: number) => ({
                      id: s.id,
                      title: `Escena planeada ${i + 1}`,
                      visual: `La cámara muestra una planta. Un diagrama animado explica la transformación de la luz, paso ${i + 1}.`,
                    })),
                  }),
                },
              ],
            },
          ],
        },
      });
    }
    if (route.request().method() === "POST") {
      calls.video++;
      calls.prompts.push(
        typeof body.input === "string"
          ? body.input
          : JSON.stringify(body.input),
      );
      return route.fulfill({
        json: {
          id: `generated-${calls.video}`,
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "video", data: video, mime_type: "video/mp4" }],
            },
          ],
        },
      });
    }
    return route.fulfill({ json: { models: [] } });
  });
  return calls;
}
test("story voiceover covers script, resumes a failed plan without rebilling voice, regenerates one clip and exports synchronized narration", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = await providers(page, { failPlan: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByLabel("ElevenLabs API key", { exact: true })
    .fill("test-eleven-key");
  await page
    .getByRole("button", { name: "Cargar mis voces", exact: true })
    .click();
  await expect(page.getByLabel("Voz", { exact: true })).toHaveValue(
    "test-voice",
  );
  await page
    .getByLabel("Estilo visual", { exact: true })
    .selectOption("explainer");
  if (process.env.STORY_CAPTURE)
    await page.screenshot({
      path: "artifacts/story-setup-desktop.png",
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "Preparar historia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar preparación", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(calls.speech).toBe(1);
  let data = await stored(page);
  expect(data.narrations).toHaveLength(1);
  expect(data.scenes.map((s) => s.story!.text).join("")).toBe(script);
  // Reload and continue from persistent audio; no second speech POST.
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page
    .getByRole("button", { name: "Continuar preparación", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Generar vídeos/ }),
  ).toBeEnabled({ timeout: 15000 });
  expect(calls.speech).toBe(1);
  const cards = page.locator(".story-scene");
  await expect(cards).toHaveCount(2);
  if (process.env.STORY_CAPTURE) {
    await page.screenshot({
      path: "artifacts/story-board-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/story-board-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("button", { name: /^Generar vídeos/ }).click();
  await expect(cards.first().locator(".story-status")).toHaveText(
    "Vídeo listo",
    { timeout: 15000 },
  );
  await expect(cards.last().locator(".story-status")).toHaveText(
    "Vídeo listo",
    { timeout: 15000 },
  );
  const initialVideos = calls.video;
  await page
    .getByLabel("Imagen de la escena 1")
    .fill("Animación de las hojas absorbiendo luz amarilla.");
  await cards
    .first()
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await cards
    .first()
    .getByRole("button", { name: "Regenerar imagen", exact: true })
    .click();
  await expect.poll(() => calls.video).toBe(initialVideos + 1);
  await expect(cards.first().locator(".story-status")).toHaveText(
    "Vídeo listo",
  );
  data = await stored(page);
  expect(data.scenes).toHaveLength(2);
  expect(data.scenes[0].versions).toHaveLength(2);
  expect(calls.speech).toBe(1);
  expect(calls.prompts.every((p) => p.includes("NO spoken dialogue"))).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Abrir montaje", exact: true })
    .click();
  await expect(page.getByTestId("timeline-clip")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Reproducir secuencia", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Reproducir secuencia", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByTestId("sequence-narration")
        .evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(1.4);
  await expect(page.getByTestId("sequence-preview")).toHaveJSProperty(
    "muted",
    true,
  );
  await page
    .getByRole("button", { name: "Pausar secuencia", exact: true })
    .click();
  // Trim beyond the actual one-second generated fixture: held frames must retain the voice.
  await page
    .getByTestId("timeline-clip")
    .first()
    .locator(".sequence-item-content")
    .click();
  await page.getByLabel("Inicio del recorte", { exact: true }).fill("2");
  await page.getByLabel("Final del recorte", { exact: true }).fill("4");
  await page.locator(".sequence-header").click();
  await expect(
    page.getByLabel("Posición del montaje", { exact: true }),
  ).not.toContainText("00:00:00 / 00:00:00");
  const filePromise = page.waitForEvent("download", { timeout: 120000 });
  await page
    .getByRole("button", { name: "Exportar vídeo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const downloaded = await filePromise;
  const bytes = readFileSync((await downloaded.path())!);
  expect(bytes.length).toBeGreaterThan(10000);
  const exported = await page.evaluate(async (data) => {
    const blob = new Blob(
      [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
      { type: "video/mp4" },
    );
    const audio = new AudioContext();
    const buffer = await audio.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);
    const rms = Math.sqrt(
      samples.reduce((s, n) => s + n * n, 0) / samples.length,
    );
    await audio.close();
    return { duration: buffer.duration, rms };
  }, bytes.toString("base64"));
  const expected =
    2 + (data.scenes[1].story!.audioEnd! - data.scenes[1].story!.audioStart!);
  expect(exported.duration).toBeGreaterThan(expected - 0.15);
  expect(exported.duration).toBeLessThan(expected + 0.3);
  expect(exported.rms).toBeGreaterThan(0.04); // Not just an empty/silent audio track.
  expect(errors).toEqual([]);
});
test("spoken story assigns multiple characters, segments long dialogue and persists the original script", async ({
  page,
}) => {
  const calls = await providers(page);
  await init(page);
  await page.getByRole("button", { name: /Personajes hablando/ }).click();
  await page.getByLabel("Nombre del personaje 1").fill("Ana");
  await page
    .getByRole("button", { name: "Añadir personaje", exact: true })
    .click();
  await page.getByLabel("Nombre del personaje 2").fill("Luis");
  const script =
    "Ana: Hoy vamos a descubrir cómo cambia la luz durante el día y por qué ese cambio afecta a todas las plantas del jardín.\nLuis: Yo observaré sus hojas con mucha atención.";
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Preparar historia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Generar vídeos/ }),
  ).toBeEnabled();
  expect(calls.speech).toBe(0);
  const data = await stored(page);
  expect(data.scenes.length).toBeGreaterThanOrEqual(3);
  expect(data.projects[0].story!.script).toBe(script);
  expect(data.scenes[0].prompt).toContain("Ana says exactly");
  expect(data.scenes.at(-1)!.prompt).toContain("Luis says exactly");
  expect(data.scenes.every((s) => s.settings!.duration <= 10)).toBe(true);
  await page.getByRole("button", { name: /^Generar vídeos/ }).click();
  await expect(
    page.locator(".story-status").filter({ hasText: "Vídeo listo" }),
  ).toHaveCount(data.scenes.length);
  expect(calls.video).toBe(data.scenes.length);
});

test("migrates version-one projects and media without creating a default clip", async ({
  page,
}) => {
  await page.addInitScript(
    ({ video }) => {
      if (sessionStorage.getItem("legacy-seeded")) return;
      sessionStorage.setItem("legacy-seeded", "yes");
      const request = indexedDB.open("vid-gen-studio", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("scenes", { keyPath: "id" }).createIndex(
          "by-project",
          "project_id",
        );
        db.createObjectStore("assets", { keyPath: "id" });
        db.createObjectStore("usage_logs", { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["projects", "scenes"], "readwrite");
        tx.objectStore("projects").put({
          id: "legacy-project",
          name: "Proyecto anterior",
          created_at: "2026-01-01",
          sequence_ids: ["legacy-scene"],
        });
        tx.objectStore("scenes").put({
          id: "legacy-scene",
          project_id: "legacy-project",
          order: 0,
          title: "Vídeo anterior",
          prompt: "Una prueba anterior",
          status: "completed",
          video_blob: new Blob(
            [Uint8Array.from(atob(video), (c) => c.charCodeAt(0))],
            { type: "video/mp4" },
          ),
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        });
        tx.oncomplete = () => db.close();
      };
    },
    { video },
  );
  await page.route("**/generativelanguage.googleapis.com/**", (r) => r.abort());
  await page.goto("/#project/legacy-project");
  await expect(
    page.getByRole("button", {
      name: "Abrir clip: Vídeo anterior",
      exact: true,
    }),
  ).toBeVisible();
  const version = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open("vid-gen-studio");
        r.onsuccess = () => {
          resolve(r.result.version);
          r.result.close();
        };
      }),
  );
  expect(version).toBe(2);
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "",
  );
  const data = await stored(page);
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].id).toBe("legacy-scene");
  expect(data.narrations).toHaveLength(0);
});
