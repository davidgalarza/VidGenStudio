import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Project, Scene } from "../src/types";

const script =
  "El nuevo sistema mejora el agarre, mantiene el control del movimiento y permite soltar en todas las posiciones.";
const phrase = "y permite soltar en todas las posiciones";
const compact = (text: string) => text.replace(/\s+/gu, " ").trim();
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");

for (const fragmentedScenes of [false, true]) {
  test(`spoken production keeps a clause together despite fragmented model metadata (${fragmentedScenes})`, async ({
    page,
  }) => {
    let plans = 0,
      videos = 0;
    await page.addInitScript(() =>
      localStorage.setItem("vid_gen_api_key", "phrasing-test-key"),
    );
    await page.route(
      "**/generativelanguage.googleapis.com/**",
      async (route) => {
        const body = route.request().postDataJSON();
        if (body.model === "gemini-3.8-flash") {
          plans++;
          const units = JSON.parse(body.input.split("SCRIPT_UNITS: ")[1]) as {
            id: number;
            text: string;
          }[];
          expect(units.length).toBeGreaterThan(1);
          const turn = (id: number) => ({
            start: id,
            end: id,
            speaker: "Miguel",
            direction: "Con claridad",
            action: "Explica junto al objeto.",
          });
          const scene = (start: number, end: number) => ({
            start,
            end,
            title: "La demostración",
            visual: "Miguel explica junto a una mesa del taller.",
            speaker: "Miguel",
            participants: ["Miguel"],
            locationName: "Taller",
            referenceNames: [],
            shotMode: "auto",
            turns: units
              .filter((u) => u.id >= start && u.id <= end)
              .map((u) => turn(u.id)),
          });
          return route.fulfill({
            json: {
              output_text: JSON.stringify({
                mode: "spoken",
                style: "realistic",
                direction: "Una demostración tranquila.",
                voice: "Kore",
                voiceDirection: "Natural",
                characters: [
                  {
                    name: "Miguel",
                    description: "Camisa verde",
                    voice: "Cálida",
                  },
                ],
                references: [],
                scenes: fragmentedScenes
                  ? units.map((u) => scene(u.id, u.id))
                  : [scene(units[0].id, units.at(-1)!.id)],
              }),
            },
          });
        }
        expect(body.model).toBe("gemini-omni-1.1-flash");
        videos++;
        return route.fulfill({
          json: {
            id: `phrasing-video-${videos}`,
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
    await page.getByLabel("Preferencia de narración").selectOption("spoken");
    await page.getByLabel("Guion completo", { exact: true }).fill(script);
    await page.getByLabel("Crear también las referencias visuales").uncheck();
    await page
      .getByRole("button", { name: "Crear propuesta", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "Producir historia", exact: true })
        .first(),
    ).toBeEnabled();
    await expect(page.locator(".story-planned-scene")).toHaveCount(1);
    await expect(page.locator(".story-shot-plan li")).toHaveCount(2);
    const planned = await page
      .locator(".story-shot-plan li p")
      .allTextContents();
    expect(planned.some((text) => compact(text).includes(phrase))).toBe(true);
    expect(compact(planned.join(" "))).toBe(script);
    await page.reload();
    await expect(page.locator(".story-shot-plan li")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first()
      .click();
    await expect(page.locator(".story-status")).toHaveText(
      ["Vídeo listo", "Vídeo listo"],
      { timeout: 20000 },
    );
    const { projects, scenes } = await page.evaluate(async () => {
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
    expect(projects[0].story!.script).toBe(script);
    const ordered = projects[0].story!.blocks[0].sceneIds!.map((id) =>
      scenes.find((s) => s.id === id)!,
    );
    const spoken = ordered.map((s) =>
      compact(s.story!.dialogue!.map((t) => t.text).join(" ")),
    );
    expect(spoken.some((text) => text.includes(phrase))).toBe(true);
    expect(compact(spoken.join(" "))).toBe(script);
    expect(spoken).toEqual(planned.map(compact));
    expect(plans).toBe(1);
    expect(videos).toBe(2);
  });
}
