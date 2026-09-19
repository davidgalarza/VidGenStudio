import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createStyleProfile } from "../src/lib/storyStyles";
import type { Project, Scene } from "../src/types";
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const image = readFileSync(
  new URL("./fixtures/reference.png", import.meta.url),
).toString("base64");
async function init(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "style-test-key"),
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
async function capture(page: Page, name: string) {
  if (!process.env.STYLE_CAPTURE) return;
  const scrollTop = () =>
    page.locator(".studio-dialog-content").evaluateAll((nodes) =>
      nodes.forEach((node) => {
        node.scrollTop = 0;
      }),
    );
  await scrollTop();
  await page.screenshot({ path: `artifacts/${name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await scrollTop();
  await page.screenshot({ path: `artifacts/${name}-mobile.png` });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function mock(
  page: Page,
  options: { invalidAnalysis?: boolean; wait?: Promise<void> } = {},
) {
  const calls = {
    analysis: 0,
    plan: 0,
    images: 0,
    videos: 0,
    prompts: [] as string[],
  };
  await page.route("**/generativelanguage.googleapis.com/**", async (route) => {
    const body = route.request().postDataJSON();
    expect(route.request().headers()["x-goog-api-key"]).toBe("style-test-key");
    if (body.model === "gemini-3.8-flash" && Array.isArray(body.input)) {
      calls.analysis++;
      expect(body.input[0].text).toContain("STYLE_REFERENCE_ANALYSIS");
      expect(body.input.some((p: { type: string }) => p.type === "video")).toBe(
        true,
      );
      if (options.wait) await options.wait;
      const p = createStyleProfile("overlays", "voiceover");
      return route.fulfill({
        json: {
          output_text: JSON.stringify({
            ...p,
            name: "Botánica azul",
            instructions:
              "Paleta azul petróleo con flechas ámbar y transiciones suaves.",
            analysis:
              "Luz suave y paleta azul. El vídeo muestra movimiento suave; las imágenes fijan la textura.",
            parameters: options.invalidAnalysis
              ? {}
              : { ...p.parameters, palette: "cool", pace: "calm" },
          }),
        },
      });
    }
    if (body.model === "gemini-3.8-flash") {
      calls.plan++;
      calls.prompts.push(body.input);
      const units = JSON.parse(body.input.split("SCRIPT_UNITS: ")[1]) as {
        id: number;
        text: string;
      }[];
      return route.fulfill({
        json: {
          output_text: JSON.stringify({
            mode: "spoken",
            style: "realistic",
            direction: "Un saludo en una habitación sencilla.",
            voice: "Kore",
            voiceDirection: "Natural",
            characters: [
              {
                name: "Ana",
                description: "Joven con jersey azul.",
                voice: "Cercana",
              },
            ],
            references: [
              {
                name: "Ana",
                characterName: "Ana",
                locationName: "",
                type: "CHARACTER",
                prompt: "Retrato del personaje Ana.",
              },
            ],
            scenes: [
              {
                start: 0,
                end: units.at(-1)!.id,
                title: "Un saludo",
                visual: "Ana saluda con una sonrisa.",
                speaker: "Ana",
                participants: ["Ana"],
                referenceNames: ["Ana"],
                locationName: "",
                shotMode: "auto",
                turns: [
                  {
                    start: 0,
                    end: units.at(-1)!.id,
                    speaker: "Ana",
                    direction: "Natural",
                    action: "Saluda",
                  },
                ],
              },
            ],
          }),
        },
      });
    }
    calls.prompts.push(JSON.stringify(body.input));
    if (body.model === "gemini-3.1-flash-image") {
      calls.images++;
      return route.fulfill({
        json: {
          steps: [
            {
              type: "model_output",
              content: [{ type: "image", data: image, mime_type: "image/png" }],
            },
          ],
        },
      });
    }
    expect(body.model).toBe("gemini-omni-1.1-flash");
    calls.videos++;
    return route.fulfill({
      json: {
        id: `style-video-${calls.videos}`,
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
const gallery = (page: Page) =>
  page.getByRole("dialog", { name: "Elige el estilo de tu historia" });

test("explicit narration, distinct visual catalogues, useful defaults and cancellation", async ({
  page,
}) => {
  const calls = await mock(page);
  await init(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByLabel("Preferencia de narración")).toHaveValue(
    "voiceover",
  );
  await expect(
    page.getByText("Que Gemini lo proponga", { exact: true }),
  ).toHaveCount(0);
  await capture(page, "styles-entry");
  await page.locator(".story-style-trigger").click();
  await expect(gallery(page).locator(".story-style-option")).toHaveCount(24);
  await capture(page, "styles-voiceover");
  await page.getByRole("button", { name: "Explicación", exact: true }).click();
  await expect(
    gallery(page).getByRole("button", {
      name: "Diapositivas visuales Una idea por composición",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Personalizar Pizarra animada", { exact: true })
    .click();
  await expect(page.getByLabel("Movimiento de cámara")).toHaveValue("locked");
  await expect(page.getByLabel("Color", { exact: true })).toHaveValue("mono");
  await page.getByLabel("Color", { exact: true }).selectOption("vivid");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".story-style-trigger")).toContainText("Realista");
  await page.getByLabel("Preferencia de narración").selectOption("spoken");
  await page.locator(".story-style-trigger").click();
  await expect(gallery(page).locator(".story-style-option")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Explicación", exact: true }),
  ).toHaveCount(0);
  await capture(page, "styles-spoken");
  await page.getByLabel("Buscar estilo").fill("marionetas");
  await expect(gallery(page).locator(".story-style-option")).toHaveCount(1);
  await gallery(page).locator(".story-style-option").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".story-style-trigger")).toBeFocused();
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Marionetas",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Ajustar estilo/ }).click();
  await expect(
    page.getByLabel("Nombre del estilo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Referencias", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Subir imágenes o vídeos", exact: true }),
  ).toBeVisible();
  const transfer = await page.evaluateHandle((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "arrastrada.png", { type: "image/png" }));
    return dt;
  }, image);
  await page
    .locator(".style-reference-drop")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.locator(".style-media-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(
    page.getByLabel("Interpretación de los personajes"),
  ).toBeVisible();
  await page.getByLabel("Color", { exact: true }).selectOption("pastel");
  await page
    .getByRole("button", { name: "Usar estos ajustes", exact: true })
    .click();
  await page.getByLabel("Preferencia de narración").selectOption("voiceover");
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Marionetas",
  );
  await page.getByRole("button", { name: /^Ajustar estilo/ }).click();
  await expect(page.getByLabel("Color", { exact: true })).toHaveValue("pastel");
  await expect(page.getByLabel("Cómo acompaña la explicación")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(calls.analysis + calls.plan).toBe(0);
});

test("references produce a reviewable style; saved styles, clones and files survive reload", async ({
  page,
}) => {
  const calls = await mock(page);
  await init(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".story-style-trigger").click();
  await page
    .getByLabel("Personalizar Realista + gráficos", { exact: true })
    .click();
  await page
    .getByLabel("Nombre del estilo", { exact: true })
    .fill("Mi explicación");
  await page
    .getByLabel("Subir referencias de estilo")
    .setInputFiles(["e2e/fixtures/reference.png", "e2e/fixtures/silent.mp4"]);
  await expect(page.locator(".style-media-list li")).toHaveCount(2);
  expect(calls.analysis).toBe(0);
  await capture(page, "styles-custom");
  await page
    .getByRole("button", { name: "Analizar con Gemini", exact: true })
    .click();
  const proposal = page.getByRole("region", {
    name: "Propuesta de estilo de Gemini",
  });
  await expect(proposal).toBeVisible();
  await expect(
    page.getByLabel("Nombre del estilo", { exact: true }),
  ).toHaveValue("Mi explicación");
  await capture(page, "styles-analysis");
  await page
    .getByRole("button", { name: "Aplicar análisis", exact: true })
    .click();
  await expect(
    page.getByLabel("Nombre del estilo", { exact: true }),
  ).toHaveValue("Botánica azul");
  await expect(page.getByLabel("Color", { exact: true })).toHaveValue("cool");
  await page
    .getByRole("button", { name: "Guardar en Mis estilos", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardado");
  await page
    .getByRole("button", { name: "Usar estos ajustes", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Botánica azul",
  );
  await page
    .getByRole("button", {
      name: "Ajustar estilo Ritmo, color y más",
      exact: true,
    })
    .click();
  await expect(page.locator(".style-media-list li")).toHaveCount(2);
  await expect(page.getByLabel("Indicaciones del estilo")).toHaveValue(
    /flechas ámbar/,
  );
  await page.getByRole("button", { name: "Ver estilos", exact: true }).click();
  await page.getByRole("button", { name: "Mis estilos", exact: true }).click();
  await page.getByLabel("Clonar Botánica azul", { exact: true }).click();
  await page
    .getByLabel("Nombre del estilo", { exact: true })
    .fill("Botánica pastel");
  await page.getByLabel("Color", { exact: true }).selectOption("pastel");
  await page
    .getByRole("button", { name: "Guardar en Mis estilos", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardado");
  await page.getByRole("button", { name: "Ver estilos", exact: true }).click();
  await expect(gallery(page).locator(".story-style-option")).toHaveCount(2);
  await page.getByLabel("Eliminar Botánica azul", { exact: true }).click();
  await page
    .getByRole("button", { name: "Eliminar estilo", exact: true })
    .click();
  await expect(gallery(page).locator(".story-style-option")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Cerrar elige el estilo de tu historia",
      exact: true,
    })
    .click();
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Botánica azul",
  );
  await page.reload();
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Botánica azul",
  );
  expect(calls.analysis).toBe(1);
  expect(calls.plan + calls.images + calls.videos).toBe(0);
});

test("style settings reach planning, generated references and every video and stay editable", async ({
  page,
}) => {
  const calls = await mock(page);
  await init(page);
  await page.getByLabel("Preferencia de narración").selectOption("spoken");
  await page.locator(".story-style-trigger").click();
  await page.getByLabel("Personalizar Plastilina", { exact: true }).click();
  await page
    .getByLabel("Nombre del estilo", { exact: true })
    .fill("Arcilla azul");
  await page
    .getByLabel("Interpretación de los personajes")
    .selectOption("expressive");
  await page
    .getByLabel("Indicaciones del estilo")
    .fill("Miniaturas azules con luz lateral.");
  await page
    .getByRole("button", { name: "Usar estos ajustes", exact: true })
    .click();
  await page
    .getByLabel("Guion completo", { exact: true })
    .fill("Hola, qué bueno verte.");
  await page
    .getByRole("button", { name: "Crear propuesta", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Producir historia", exact: true })
      .first(),
  ).toBeEnabled();
  const before = (await stored(page)).projects[0].story!;
  expect(before.style).toBe("clay");
  expect(before.styleProfile?.name).toBe("Arcilla azul");
  await page.getByRole("button", { name: "Voz y estilo", exact: true }).click();
  await expect(page.locator(".story-style-trigger")).toContainText(
    "Arcilla azul",
  );
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.locator(".story-status").first()).toHaveText(
    "Vídeo listo",
    { timeout: 20000 },
  );
  expect(calls.plan).toBe(1);
  expect(calls.images).toBe(1);
  expect(calls.videos).toBe(1);
  expect(calls.prompts).toHaveLength(3);
  for (const prompt of calls.prompts) {
    expect(prompt).toContain("Miniaturas azules con luz lateral.");
    expect(prompt).toContain("Tactile clay");
  }
});

test("invalid files and malformed analysis preserve edits without extra requests", async ({
  page,
}) => {
  const calls = await mock(page, { invalidAnalysis: true });
  await init(page);
  await page
    .getByRole("button", {
      name: "Ajustar estilo Ritmo, color y más",
      exact: true,
    })
    .click();
  await page.getByLabel("Nombre del estilo", { exact: true }).fill("No perder");
  await page.getByLabel("Subir referencias de estilo").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("alert")).toContainText("JPG");
  expect(calls.analysis).toBe(0);
  await page
    .getByLabel("Subir referencias de estilo")
    .setInputFiles("e2e/fixtures/silent.mp4");
  await page
    .getByRole("button", { name: "Analizar con Gemini", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("ajustes incompletos");
  await expect(
    page.getByLabel("Nombre del estilo", { exact: true }),
  ).toHaveValue("No perder");
  await expect(page.locator(".style-media-list li")).toHaveCount(1);
  expect(calls.analysis).toBe(1);
});

test("closing an in-flight analysis aborts local work and ignores late output", async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = await mock(page, { wait });
  await init(page);
  await page
    .getByRole("button", {
      name: "Ajustar estilo Ritmo, color y más",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Subir referencias de estilo")
    .setInputFiles("e2e/fixtures/silent.mp4");
  await page
    .getByRole("button", { name: "Analizar con Gemini", exact: true })
    .click();
  await expect.poll(() => calls.analysis).toBe(1);
  await page
    .getByRole("button", { name: "Cerrar configura tu estilo", exact: true })
    .click();
  release();
  await page
    .getByRole("button", {
      name: "Ajustar estilo Ritmo, color y más",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Nombre del estilo", { exact: true }),
  ).toHaveValue("Realista");
  await expect(
    page.getByRole("region", { name: "Propuesta de estilo de Gemini" }),
  ).toHaveCount(0);
});
