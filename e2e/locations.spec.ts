import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { newStoryProposal } from "../src/lib/storyPlanner";
import type { Project, Scene } from "../src/types";

const apartment = "Apartamento de Miguel";
const script = "Hola, qué bueno verte.\nAdelante, pasa por aquí.";
const image = readFileSync(
  new URL("./fixtures/reference.png", import.meta.url),
).toString("base64");
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
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
    return { projects, scenes };
  });
}

for (const autoReferences of [true, false]) {
  test(`resumes a saved missing-location error, preserving script and reference preference (${autoReferences})`, async ({
    page,
  }) => {
    const calls = { plan: 0, image: 0, video: 0 };
    await page.addInitScript(() =>
      localStorage.setItem("vid_gen_api_key", "location-test-key"),
    );
    await page.route(
      "**/generativelanguage.googleapis.com/**",
      async (route) => {
        const body = route.request().postDataJSON();
        if (body.model === "gemini-3.8-flash") {
          calls.plan++;
          return route.fulfill({
            json: {
              output_text: JSON.stringify({
                mode: "spoken",
                style: "realistic",
                direction:
                  "Conversación tranquila en un apartamento con sofá azul.",
                voice: "Kore",
                voiceDirection: "Natural",
                characters: [
                  {
                    name: "Miguel",
                    description: "Camisa verde",
                    voice: "Cálida",
                  },
                ],
                // Deliberately omit the set that both scenes refer to, as in the reported failure.
                references: [
                  {
                    name: "Miguel",
                    type: "CHARACTER",
                    characterName: "Miguel",
                    locationName: "",
                    prompt: "Retrato de Miguel, camisa verde.",
                  },
                ],
                scenes: [0, 1].map((i) => ({
                  start: i,
                  end: i,
                  title: `Momento ${i + 1}`,
                  visual:
                    "Miguel habla junto al sofá azul, con una ventana a la izquierda.",
                  speaker: "Miguel",
                  participants: ["Miguel"],
                  locationName: i ? "apartamento de MIGUEL" : apartment,
                  referenceNames: ["Miguel", apartment],
                  shotMode: "auto",
                  turns: [
                    {
                      start: i,
                      end: i,
                      speaker: "Miguel",
                      direction: "Natural",
                      action: "Saluda con la mano.",
                    },
                  ],
                })),
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
                    { type: "image", data: image, mime_type: "image/png" },
                  ],
                },
              ],
            },
          });
        }
        expect(body.model).not.toBe("gemini-3.1-flash-tts-preview");
        calls.video++;
        return route.fulfill({
          json: {
            id: `location-video-${calls.video}`,
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [
                  { type: "video", data: video, mime_type: "video/mp4" },
                ],
              },
            ],
          },
        });
      },
    );
    await page.goto("/");
    await page
      .locator(".home-page")
      .getByRole("button", { name: "Nuevo proyecto", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Crear proyecto de historia", exact: true })
      .click();
    await expect(
      page.getByLabel("Guion completo", { exact: true }),
    ).toBeVisible();
    const failed = newStoryProposal(script, { mode: "spoken", autoReferences });
    failed.error = `Falta la referencia del lugar «${apartment}». El guion se conserva; reintenta la propuesta.`;
    await page.evaluate(async (story) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("vid-gen-studio");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const store = tx.objectStore("projects");
        const r = store.getAll();
        r.onsuccess = () => store.put({ ...r.result[0], story });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, failed);
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(apartment);
    await page
      .getByRole("button", { name: "Continuar propuesta", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "Producir historia", exact: true })
        .first(),
    ).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    let data = await stored(page);
    const story = data.projects[0].story!;
    expect(story.script).toBe(script);
    expect(story.blocks.map((b) => b.text).join("")).toBe(script);
    expect(story.blocks.map((b) => b.locationName)).toEqual([
      apartment,
      apartment,
    ]);
    expect(story.references).toHaveLength(2);
    expect(calls.plan).toBe(1);
    expect(calls.image).toBe(autoReferences ? 2 : 0);
    const set = story.references!.find((r) => r.locationName === apartment)!;
    expect(!!set.assetId).toBe(autoReferences);
    await page.reload();
    await page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first()
      .click();
    await expect(page.locator(".story-status")).toHaveText(
      ["Vídeo listo", "Vídeo listo"],
      { timeout: 20000 },
    );
    data = await stored(page);
    expect(calls).toEqual({ plan: 1, image: autoReferences ? 2 : 0, video: 2 });
    for (const scene of data.scenes) {
      expect(scene.story?.locationName).toBe(apartment);
      expect(scene.prompt).toContain("sofá azul");
      expect(scene.reference_asset_ids || []).toHaveLength(
        autoReferences ? 2 : 0,
      );
      if (autoReferences)
        expect(scene.reference_asset_ids).toContain(set.assetId);
    }
  });
}
