import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_VIDEO } from "../src/types";
import type { Project, Scene, Narration } from "../src/types";
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const reference = readFileSync(
  new URL("./fixtures/reference.png", import.meta.url),
).toString("base64");
function pcmTone(seconds: number) {
  const pcm = Buffer.alloc(Math.round(24000 * 2 * seconds));
  for (let i = 0; i < pcm.length / 2; i++)
    pcm.writeInt16LE(
      Math.round(Math.sin((i / 24000) * Math.PI * 2 * 440) * 9000),
      i * 2,
    );
  return pcm.toString("base64");
}
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
async function providers(
  page: Page,
  options: {
    failPlan?: boolean;
    failReference?: boolean;
    failSpeech?: number;
    spoken?: boolean;
    split?: boolean;
    holdSpeech?: Promise<void>;
  } = {},
) {
  const calls = {
    speech: 0,
    plans: 0,
    images: 0,
    video: 0,
    prompts: [] as string[],
  };
  await page.route("**/api.elevenlabs.io/**", () => {
    throw new Error("No obsolete voice provider should receive a request");
  });
  await page.route("**/generativelanguage.googleapis.com/**", async (route) => {
    expect(route.request().headers()["xi-api-key"]).toBeUndefined();
    expect(route.request().headers()["x-goog-api-key"]).toBe("test-google-key");
    const body = route.request().postDataJSON();
    if (body?.model === "gemini-3.8-flash") {
      calls.plans++;
      if (options.failPlan && calls.plans === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Planner unavailable for this test" } },
        });
      const units: { id: number; text: string }[] = JSON.parse(
        body.input.split("SCRIPT_UNITS: ")[1],
      );
      const scenes =
        options.spoken || options.split
          ? units.map((u) => ({
              start: u.id,
              end: u.id,
              title: `Momento ${u.id + 1}`,
              visual:
                "La cámara muestra una planta. Un diagrama explica la transformación de la luz.",
              speaker: options.spoken
                ? u.text.includes("Luis:")
                  ? "Luis"
                  : "Ana"
                : "",
            }))
          : [
              {
                start: units[0].id,
                end: units.at(-1)!.id,
                title: "La energía de las plantas",
                visual:
                  "Un diagrama animado muestra cómo las hojas absorben luz.",
                speaker: "",
              },
            ];
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
                    mode: options.spoken ? "spoken" : "voiceover",
                    style: "explainer",
                    direction:
                      "Ilustración didáctica, colores verdes y luz suave.",
                    voice: "Kore",
                    voiceDirection:
                      "Español latinoamericano, tono cálido y explicativo.",
                    characters: options.spoken
                      ? [
                          {
                            name: "Ana",
                            description: "Joven con camisa roja",
                            voice: "Cálida, acento neutro",
                          },
                          {
                            name: "Luis",
                            description: "Gafas y pelo oscuro",
                            voice: "Grave, acento neutro",
                          },
                        ]
                      : [],
                    references: [
                      {
                        name: "Mundo vegetal",
                        type: "STYLE",
                        characterName: "",
                        prompt:
                          "Ilustración didáctica de una planta verde, una sola vista, sin letras.",
                      },
                    ],
                    scenes,
                  }),
                },
              ],
            },
          ],
        },
      });
    }
    if (body?.model === "gemini-3.1-flash-image") {
      calls.images++;
      if (options.failReference && calls.images === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Image unavailable for this test" } },
        });
      return route.fulfill({
        json: {
          steps: [
            {
              type: "model_output",
              content: [
                { type: "image", data: reference, mime_type: "image/png" },
              ],
            },
          ],
        },
      });
    }
    if (body?.model === "gemini-3.1-flash-tts-preview") {
      calls.speech++;
      if (calls.speech === options.failSpeech)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Speech unavailable for this test" } },
        });
      expect(body.generation_config.speech_config).toEqual([{ voice: "Kore" }]);
      if (calls.speech === 1 && options.holdSpeech) await options.holdSpeech;
      return route.fulfill({
        json: {
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "audio",
                  data: pcmTone(options.split ? 2 : 12.5),
                  mime_type: "audio/L16;codec=pcm;rate=24000",
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
  if (process.env.STORY_CAPTURE)
    await page.screenshot({
      path: "artifacts/story-script-desktop.png",
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar propuesta", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(calls.speech).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page
    .getByRole("button", { name: "Continuar propuesta", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeEnabled();
  expect(calls.speech).toBe(0);
  expect(calls.video).toBe(0);
  expect(calls.images).toBe(1);
  let data = await stored(page);
  expect(data.projects[0].story?.blocks.map((b) => b.text).join("")).toBe(
    script,
  );
  expect(data.scenes).toHaveLength(0);
  await page
    .getByLabel("Visual de la escena 1")
    .fill("Un primer plano muestra cómo la hoja convierte la luz en energía.");
  // Unsaved review edits survive refresh, and no media production occurs yet.
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByLabel("Visual de la escena 1")).toHaveValue(
    "Un primer plano muestra cómo la hoja convierte la luz en energía.",
  );
  if (process.env.STORY_CAPTURE) {
    await page.screenshot({
      path: "artifacts/story-proposal-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Personajes y referencias", exact: true })
      .click();
    await page.screenshot({
      path: "artifacts/story-references-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/story-references-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: /^Escenas/ }).click();
    await page.screenshot({
      path: "artifacts/story-proposal-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  const cards = page.locator(".story-scene");
  await expect(cards).toHaveCount(2);
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
  expect(data.narrations[0].duration).toBe(12.5);
  expect(data.narrations[0]).not.toHaveProperty("alignment");
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
test("spoken story infers characters, keeps labels out of dialogue and generates without TTS", async ({
  page,
}) => {
  const calls = await providers(page, { spoken: true });
  await init(page);
  const script =
    "Ana: Hoy vamos a descubrir cómo cambia la luz durante el día y por qué ese cambio afecta a todas las plantas del jardín.\nLuis: Yo observaré sus hojas con mucha atención.";
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Personajes y referencias", exact: true })
    .click();
  await expect(page.getByLabel("Nombre del personaje 1")).toHaveValue("Ana");
  await expect(page.getByLabel("Nombre del personaje 2")).toHaveValue("Luis");
  expect(calls.speech).toBe(0);
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Vídeo listo",
    { timeout: 15000 },
  );
  const data = await stored(page);
  expect(data.scenes.length).toBeGreaterThanOrEqual(3);
  expect(data.projects[0].story!.script).toBe(script);
  expect(data.scenes[0].prompt).toContain("Ana says exactly");
  expect(data.scenes.at(-1)!.prompt).toContain("Luis says exactly");
  expect(data.scenes.every((s) => !/^(Ana|Luis):/.test(s.story!.text))).toBe(
    true,
  );
  expect(data.scenes.every((s) => s.settings!.duration <= 10)).toBe(true);
  await expect(
    page.locator(".story-status").filter({ hasText: "Vídeo listo" }),
  ).toHaveCount(data.scenes.length);
  expect(calls.video).toBe(data.scenes.length);
  expect(calls.speech).toBe(0);
});
test("pauses production after the current audio, then resumes after reload without recreating saved voices", async ({
  page,
}) => {
  let release!: () => void;
  const holdSpeech = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = await providers(page, { split: true, holdSpeech });
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect.poll(() => calls.speech).toBe(1);
  await page
    .locator(".story-progress")
    .getByRole("button", { name: "Pausar", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("button", { name: "Continuar producción", exact: true }),
  ).toBeEnabled();
  expect(calls.speech).toBe(1);
  expect(calls.video).toBe(0);
  let data = await stored(page);
  expect(data.narrations).toHaveLength(1);
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page
    .getByRole("button", { name: "Continuar producción", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar producción", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await stored(page)).narrations.length)
    .toBe(data.projects[0].story!.blocks.length);
  data = await stored(page);
  await expect(
    page.locator(".story-status").filter({ hasText: "Vídeo listo" }),
  ).toHaveCount(data.projects[0].story!.blocks.length);
  expect(calls.speech).toBe(data.projects[0].story!.blocks.length);
});
test("failed references can continue without replanning, and edits can split and reorder the preserved text", async ({
  page,
}) => {
  const calls = await providers(page, { failReference: true });
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar propuesta", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continuar propuesta", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeEnabled();
  expect(calls.plans).toBe(1);
  expect(calls.images).toBe(2);
  await page.getByRole("button", { name: "Dividir", exact: true }).click();
  await expect(page.locator(".story-planned-scene")).toHaveCount(2);
  const first = await page.getByLabel("Texto de la escena 1").inputValue();
  const second = await page.getByLabel("Texto de la escena 2").inputValue();
  expect(first + second).toBe(script);
  await page
    .getByRole("button", { name: "Bajar escena 1", exact: true })
    .click();
  await expect(page.getByLabel("Texto de la escena 1")).toHaveValue(second);
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  const data = await stored(page);
  expect(data.projects[0].story!.blocks.map((b) => b.text).join("")).toBe(
    second + first,
  );
  expect(data.projects[0].story!.script).toBe(script);
  expect(calls.video).toBe(0);
});

test("initial guidance survives leaving the script and a review conflict offers draft recovery", async ({
  page,
}) => {
  await providers(page);
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page.locator(".story-preferences summary").click();
  await page.getByLabel("Preferencia de narración").selectOption("voiceover");
  await page.getByLabel("Preferencia de estilo").selectOption("cartoon");
  await page
    .getByLabel("Lo que tienes en mente")
    .fill("Explicación para niños, colores planos");
  await page.getByLabel("Crear también las referencias visuales").uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.locator(".story-preferences summary").click();
  await expect(page.getByLabel("Preferencia de estilo")).toHaveValue("cartoon");
  await expect(page.getByLabel("Lo que tienes en mente")).toHaveValue(
    "Explicación para niños, colores planos",
  );
  await expect(
    page.getByLabel("Crear también las referencias visuales"),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await page
    .getByLabel("Texto de la escena 1")
    .fill("Mi versión editada permanece aunque cambie el proyecto.");
  // Simulate another view saving the project while this tab has uncommitted review edits.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = database.transaction("projects", "readwrite");
    const request = tx.objectStore("projects").getAll();
    request.onsuccess = () => {
      const project = request.result[0];
      project.story.revision++;
      tx.objectStore("projects").put(project);
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    database.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Recuperar mi borrador", exact: true })
    .click();
  await expect(page.getByLabel("Texto de la escena 1")).toHaveValue(
    "Mi versión editada permanece aunque cambie el proyecto.",
  );
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  expect((await stored(page)).projects[0].story!.blocks[0].text).toBe(
    "Mi versión editada permanece aunque cambie el proyecto.",
  );
});
test("a first speech failure returns to editable review before retrying", async ({
  page,
}) => {
  const calls = await providers(page, { failSpeech: 1 });
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".story-workspace-content").getByRole("alert"),
  ).toContainText("Speech unavailable");
  await page
    .getByLabel("Texto de la escena 1")
    .fill("El texto corregido se puede volver a producir.");
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".story-status").filter({ hasText: "Vídeo listo" }),
  ).toHaveCount(2);
  expect(calls.speech).toBe(2);
  expect((await stored(page)).narrations[0].text).toBe(
    "El texto corregido se puede volver a producir.",
  );
});
test("partly produced stories allow correcting only pending text and retain finished narration", async ({
  page,
}) => {
  const calls = await providers(page, { split: true, failSpeech: 2 });
  await init(page);
  await page.getByLabel("Guion completo", { exact: true }).fill(script);
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar producción", exact: true }),
  ).toBeEnabled();
  const initial = await stored(page);
  expect(initial.narrations).toHaveLength(1);
  await page.getByText("Editar partes pendientes", { exact: true }).click();
  await page
    .getByLabel("Texto pendiente 1")
    .fill("Este texto se corrigió antes de crear su narración.");
  await page
    .getByRole("button", { name: "Continuar producción", exact: true })
    .click();
  await expect(
    page.locator(".story-status").filter({ hasText: "Vídeo listo" }),
  ).toHaveCount(initial.projects[0].story!.blocks.length);
  const data = await stored(page);
  expect(
    data.narrations.find((n) => n.id === initial.narrations[0].id),
  ).toBeTruthy();
  expect(
    data.narrations.some(
      (n) => n.text === "Este texto se corrigió antes de crear su narración.",
    ),
  ).toBe(true);
  expect(calls.speech).toBe(initial.projects[0].story!.blocks.length + 1);
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

test("a long story identifies hidden speaker mismatches and repairs the affected scenes together", async ({
  page,
}) => {
  const calls = await providers(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await init(page);
  await page.evaluate(async (settings) => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = database.transaction("projects", "readwrite");
    const request = tx.objectStore("projects").getAll();
    request.onsuccess = () => {
      const project = request.result[0];
      project.story = {
        id: "speaker-story",
        revision: 0,
        phase: "review",
        mode: "spoken",
        style: "explainer",
        direction: "Explicación visual",
        script: "El guion original se conserva.",
        voiceId: "Kore",
        voiceName: "Kore",
        settings,
        characters: [
          { name: "Ana", description: "Camisa verde", voice: "Cálida" },
          { name: "Luis", description: "Camisa azul", voice: "Grave" },
        ],
        references: [],
        blocks: Array.from({ length: 40 }, (_, i) => ({
          id: `beat-${i}`,
          title: `Momento ${i + 1}`,
          text: "La luz permite que las plantas crezcan.",
          visual: "Una planta recibe luz",
          speaker: [4, 20, 38].includes(i) ? "Narrador" : " ANA ",
        })),
      };
      tx.objectStore("projects").put(project);
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    database.close();
  }, DEFAULT_VIDEO);
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  const review = page.getByRole("region", { name: "Personajes por revisar" });
  await expect(review).toContainText(
    "3 escenas necesitan revisar su personaje",
  );
  await expect(
    page.getByLabel("Personaje de la escena 1", { exact: true }),
  ).toHaveValue("Ana");
  await expect(
    page.getByLabel("Personaje de la escena 5", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Personaje de la escena 5", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Voz y estilo", exact: true }).click();
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.locator(".story-planned-scene")).toHaveCount(3);
  await expect(page.locator(".story-proposal > .inline-error")).toContainText(
    "Escena 5 · Momento 5",
  );
  expect(calls.video).toBe(0);
  expect(calls.speech).toBe(0);
  await review
    .getByRole("button", { name: "Ver escena 39", exact: true })
    .click();
  await expect(
    page.getByLabel("Personaje de la escena 39", { exact: true }),
  ).toBeFocused();
  await expect(page.locator(".story-planned-scene")).toHaveCount(40);
  await review
    .getByRole("button", { name: "Ver solo las pendientes", exact: true })
    .click();
  if (process.env.CAST_CAPTURE) {
    await page.screenshot({
      path: "artifacts/story-cast-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/story-cast-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await review
    .getByLabel("Personaje para Narrador", { exact: true })
    .selectOption("Ana");
  await review
    .getByRole("button", { name: "Asignar a las 3 escenas", exact: true })
    .click();
  await expect(review).toHaveCount(0);
  await expect(
    page.getByText("Todos los personajes están resueltos.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar todas las escenas", exact: true })
    .click();
  await expect(
    page.getByLabel("Personaje de la escena 39", { exact: true }),
  ).toHaveValue("Ana");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  const data = await stored(page);
  expect(data.projects[0].story!.blocks.every((b) => b.speaker === "Ana")).toBe(
    true,
  );
  expect(data.projects[0].story!.script).toBe("El guion original se conserva.");
  expect(data.scenes).toHaveLength(0);
  expect(calls.plans).toBe(0);
  expect(calls.video).toBe(0);
});
