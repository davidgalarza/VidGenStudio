import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Project, Scene } from "../src/types";
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const reference = readFileSync(
  new URL("./fixtures/reference.png", import.meta.url),
).toString("base64");

async function init(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "dialogue-test-key"),
  );
  await page.goto("/");
  await page
    .locator(".home-page")
    .getByRole("button", { name: "Nuevo proyecto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear proyecto de historia", exact: true })
    .click();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("vid-gen-studio");
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(["projects", "scenes"]);
    const read = <T>(name: string) =>
      new Promise<T[]>((resolve) => {
        const r = tx.objectStore(name).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [projects, scenes] = await Promise.all([
      read<Project>("projects"),
      read<Scene>("scenes"),
    ]);
    db.close();
    return {
      projects,
      scenes: scenes.map((s) => ({
        ...s,
        versions: s.versions?.map((v) => ({ ...v, blob: undefined })),
      })),
    };
  });
}
async function capture(page: Page, name: string) {
  if (!process.env.DIALOGUE_CAPTURE) return;
  await page.screenshot({
    path: `artifacts/${name}-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `artifacts/${name}-mobile.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function mock(page: Page, monologue = false) {
  const calls = {
    video: 0,
    image: 0,
    review: 0,
    speech: 0,
    plan: 0,
    prompts: [] as string[],
  };
  await page.route("**/generativelanguage.googleapis.com/**", async (route) => {
    const body = route.request().postDataJSON();
    expect(route.request().headers()["x-goog-api-key"]).toBe(
      "dialogue-test-key",
    );
    if (body.model === "gemini-3.8-flash" && Array.isArray(body.input)) {
      calls.review++;
      expect(
        body.input.find((p: { type: string }) => p.type === "video")?.data,
      ).toBe(video);
      expect(JSON.stringify(body.input)).not.toContain("¿Vamos juntos?");
      return route.fulfill({
        json: {
          output_text: JSON.stringify({
            turns: [
              { speaker: "Ana", text: "Hola." },
              { speaker: "Luis", text: "¿Vamos?" },
            ],
            notes: "La segunda intervención podría estar incompleta.",
            uncertain: false,
          }),
        },
      });
    }
    if (body.model === "gemini-3.8-flash") {
      calls.plan++;
      const units = JSON.parse(body.input.split("SCRIPT_UNITS: ")[1]) as {
        id: number;
        text: string;
      }[];
      return route.fulfill({
        json: {
          output_text: JSON.stringify({
            mode: "spoken",
            style: "cinematic",
            direction:
              "Una conversación íntima en un invernadero al atardecer.",
            voice: "Kore",
            voiceDirection: "Natural",
            characters: [
              {
                name: "Ana",
                description: "Pelo rizado, abrigo rojo.",
                voice: "Cálida, español neutro.",
              },
              ...(monologue
                ? []
                : [
                    {
                      name: "Luis",
                      description: "Gafas redondas, camisa verde.",
                      voice: "Grave, español neutro.",
                    },
                  ]),
            ],
            references: [
              {
                name: "Ana",
                characterName: "Ana",
                locationName: "",
                type: "CHARACTER",
                prompt: "Retrato del personaje Ana con abrigo rojo.",
              },
              ...(monologue
                ? []
                : [
                    {
                      name: "Luis",
                      characterName: "Luis",
                      locationName: "",
                      type: "CHARACTER",
                      prompt: "Retrato de Luis con gafas redondas.",
                    },
                  ]),
              {
                name: "Invernadero",
                characterName: "",
                locationName: "Invernadero",
                type: "PRODUCT",
                prompt:
                  "Invernadero vacío de cristal, mesa central de madera, luz de atardecer por la izquierda, plantas en estantes.",
              },
            ],
            scenes: [
              {
                start: 0,
                end: units.at(-1)!.id,
                title: "El encuentro",
                visual:
                  "Los personajes conversan junto a una planta en la mesa del invernadero. Encuadre medio, cámara estable y luz lateral suave.",
                speaker: "Ana",
                participants: monologue ? ["Ana"] : ["Ana", "Luis"],
                locationName: "Invernadero",
                referenceNames: monologue
                  ? ["Ana", "Invernadero"]
                  : ["Ana", "Luis", "Invernadero"],
                shotMode: "auto",
                turns: units.map((u, i) => ({
                  start: u.id,
                  end: u.id,
                  speaker: monologue || i === 0 ? "Ana" : "Luis",
                  direction: i === 0 ? "Con curiosidad" : "Con una sonrisa",
                  action:
                    i === 0
                      ? "Mira hacia la puerta; Luis escucha en silencio."
                      : "Asiente mientras Ana espera su respuesta.",
                })),
              },
            ],
          }),
        },
      });
    }
    if (body.model === "gemini-3.1-flash-image") {
      calls.image++;
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
    if (body.model === "gemini-3.1-flash-tts-preview") {
      calls.speech++;
      throw new Error("A spoken story must not create TTS");
    }
    calls.video++;
    calls.prompts.push(JSON.stringify(body.input));
    return route.fulfill({
      json: {
        id: `dialogue-video-${calls.video}`,
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "video", data: video, mime_type: "video/mp4" }],
          },
        ],
      },
    });
  });
  return calls;
}

test("free dialogue becomes editable shared scenes, reusable sets and individually regenerated takes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const calls = await mock(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await init(page);
  await page.getByLabel("Preferencia de narración").selectOption("spoken");
  await page
    .getByLabel("Guion completo", { exact: true })
    .fill("Ana: Hola.\nLuis: ¿Vamos?");
  await capture(page, "dialogue-entry");
  await page.locator(".story-style-trigger").click();
  const gallery = page.getByRole("dialog", {
    name: "Elige el estilo de tu historia",
  });
  await expect(gallery.locator(".story-style-option")).toHaveCount(12);
  await capture(page, "dialogue-styles");
  await gallery
    .getByRole("button", {
      name: "Acuarela Pigmentos y bordes suaves",
      exact: true,
    })
    .click();
  await expect(page.locator(".story-style-trigger")).toBeFocused();
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeEnabled();
  await expect(page.locator(".story-planned-scene")).toHaveCount(1);
  await expect(
    page.getByLabel("Texto de intervención 1 de la escena 1"),
  ).toHaveValue("Hola.");
  await expect(
    page.getByLabel("Texto de intervención 2 de la escena 1"),
  ).toHaveValue("¿Vamos?");
  await page.getByLabel("Texto de intervención 2 de la escena 1").fill("");
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Texto de intervención 2 de la escena 1"),
  ).toBeFocused();
  await page
    .getByLabel("Texto de intervención 2 de la escena 1")
    .fill("¿Vamos?");
  await expect(
    page.getByLabel("Tomas previstas de El encuentro"),
  ).toContainText("1 toma prevista");
  await page.getByLabel("Planos de El encuentro").selectOption("alternating");
  await expect(
    page.getByLabel("Tomas previstas de El encuentro"),
  ).toContainText("2 tomas previstas");
  await page.getByLabel("Planos de El encuentro").selectOption("shared");
  await expect(
    page.getByLabel("Tomas previstas de El encuentro"),
  ).toContainText("1 toma prevista");
  await capture(page, "dialogue-proposal");
  await page.getByRole("button", { name: "Dividir", exact: true }).click();
  await expect(page.locator(".story-planned-scene")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Unir con siguiente", exact: true })
    .click();
  await expect(page.locator(".story-planned-scene")).toHaveCount(1);
  await expect(
    page.getByLabel("Texto de intervención 2 de la escena 1"),
  ).toHaveValue("¿Vamos?");
  await page
    .getByRole("button", { name: "Personajes y referencias", exact: true })
    .click();
  await expect(page.getByLabel("Tipo de referencia Invernadero")).toHaveValue(
    "LOCATION",
  );
  await page
    .getByLabel("Nombre de referencia Invernadero")
    .fill("Jardín interior");
  await page.getByLabel("Nombre del personaje 1").fill("Alma");
  await capture(page, "dialogue-references");
  await page.getByLabel("Nombre del personaje 1").fill("Ana");
  await page.getByRole("button", { name: "Escenas 1", exact: true }).click();
  await expect(page.getByLabel("Lugar de El encuentro")).toHaveValue(
    "Jardín interior",
  );
  await expect(
    page.getByLabel("Interpretación de intervención 1 de la escena 1"),
  ).toHaveValue("Con curiosidad");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByLabel("Texto de intervención 2 de la escena 1"),
  ).toHaveValue("¿Vamos?");
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Vídeo listo",
    { timeout: 20000 },
  );
  await expect(page.locator(".story-production-group")).toHaveCount(1);
  let data = await stored(page);
  expect(data.projects[0].story!.script).toBe("Ana: Hola.\nLuis: ¿Vamos?");
  expect(data.projects[0].story!.style).toBe("watercolor");
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].story!.dialogue).toHaveLength(2);
  expect(data.scenes[0].reference_asset_ids).toHaveLength(3);
  expect(data.scenes[0].prompt).toContain("Jardín interior");
  expect(data.scenes[0].prompt).toContain("Specific action beats");
  expect(data.scenes[0].prompt).toContain("continuous shared composition");
  await page
    .getByLabel("Texto de intervención 2 de la toma 1")
    .fill("¿Vamos juntos?");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Cambios por generar",
  );
  await page
    .getByRole("button", { name: "Regenerar toma", exact: true })
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Vídeo listo",
    { timeout: 20000 },
  );
  data = await stored(page);
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].versions).toHaveLength(2);
  expect(data.scenes[0].versions?.[1].prompt).toContain("¿Vamos juntos?");
  await capture(page, "dialogue-production");
  await page
    .getByRole("button", { name: "Revisar diálogo", exact: true })
    .click();
  expect(calls.review).toBe(0);
  await page
    .getByRole("button", { name: "Analizar esta toma con Gemini", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Hay posibles diferencias que revisar" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar revisar diálogo", exact: true })
    .click();
  expect(calls.review).toBe(1);
  expect(calls.video).toBe(2);
  expect(calls.image).toBe(3);
  expect(calls.speech).toBe(0);
  await page
    .getByLabel("Quién habla en intervención 1 de la toma 1")
    .selectOption("Luis");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  const recast = await stored(page);
  expect(recast.scenes[0].story?.participants).toEqual(["Luis"]);
  expect(recast.scenes[0].reference_asset_ids).toHaveLength(2);
  const luis = recast.projects[0].story!.characters.find(
    (c) => c.name === "Luis",
  )!;
  expect(recast.scenes[0].reference_asset_ids?.[0]).toBe(luis.referenceId);
  expect(calls.video).toBe(2);
  const manualId = recast.scenes[0].reference_asset_ids![1];
  // Simulate an explicit reference choice from Materiales, which must override automation.
  await page.evaluate(
    async ({ id, assetId }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("vid-gen-studio");
        r.onsuccess = () => resolve(r.result);
      });
      const tx = db.transaction("scenes", "readwrite");
      const request = tx.objectStore("scenes").get(id);
      request.onsuccess = () =>
        tx
          .objectStore("scenes")
          .put({ ...request.result, reference_asset_ids: [assetId] });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { id: recast.scenes[0].id, assetId: manualId },
  );
  await page.reload();
  await page
    .getByLabel("Quién habla en intervención 1 de la toma 1")
    .selectOption("Ana");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  expect((await stored(page)).scenes[0].reference_asset_ids).toEqual([
    manualId,
  ]);
  expect(calls.video).toBe(2);
  expect(errors).toEqual([]);
});

test("a pasted monologue needs no character setup and style selection is keyboard accessible", async ({
  page,
}) => {
  const calls = await mock(page, true);
  await init(page);
  await page.getByLabel("Preferencia de narración").selectOption("spoken");
  await page
    .getByLabel("Guion completo", { exact: true })
    .fill("Hoy vamos a descubrir algo nuevo.");
  await page.getByLabel("Crear también las referencias visuales").uncheck();
  await page.locator(".story-style-trigger").focus();
  await page.keyboard.press("Enter");
  const anime = page.getByRole("button", {
    name: "Anime Líneas expresivas y fondos pintados",
    exact: true,
  });
  await anime.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".story-style-trigger")).toBeFocused();
  await expect(page.locator(".story-style-trigger")).toContainText("Anime");
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page.getByLabel("Texto de intervención 1 de la escena 1"),
  ).toHaveValue("Hoy vamos a descubrir algo nuevo.");
  await expect(
    page.getByLabel("Quién habla en intervención 1 de la escena 1"),
  ).toHaveValue("Ana");
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Vídeo listo",
    { timeout: 20000 },
  );
  expect(calls.image).toBe(0);
  expect(calls.speech).toBe(0);
  expect(calls.video).toBe(1);
});
