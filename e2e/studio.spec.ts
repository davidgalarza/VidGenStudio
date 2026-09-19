import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const clip = readFileSync(
  new URL("./fixtures/clip.mp4", import.meta.url),
).toString("base64");
const silent = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const google = "**/generativelanguage.googleapis.com/**";
async function createProject(page: Page, sceneCount = 1) {
  await page
    .locator(".home-page")
    .getByRole("button", { name: "Nuevo proyecto", exact: true })
    .click();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await expect(page.locator(".project-clip")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".editor-top")
    .getByRole("button", { name: "Nuevo clip", exact: true })
    .click();
  await page.getByLabel("Nombre de la escena").fill("Primera escena");
  for (let i = 0; i < sceneCount; i++) {
    if (i) {
      await page
        .getByRole("button", { name: "Cerrar editor de clip", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Nuevo clip", exact: true })
        .click();
      await expect(page.locator(".project-clip")).toHaveCount(i + 1);
    }
    await page
      .getByLabel("¿Qué ocurre en esta toma?")
      .fill(`Plano ${i + 1}: la cámara recorre un paisaje al amanecer.`);
    await page.getByLabel("Nombre de la escena").click();
  }
}

async function reopenReady(page: Page, title = "Primera escena") {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const card = page.locator(".project-clip").filter({
    has: page.getByRole("button", {
      name: `Abrir clip: ${title}`,
      exact: true,
    }),
  });
  await expect(card.locator(".clip-title [role=status]")).toHaveText("Listo", {
    timeout: 15000,
  });
  await page
    .getByRole("button", { name: `Abrir clip: ${title}`, exact: true })
    .click();
}

test("editor workflow: key, blank project, references, versions, persistence and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const bodies: Record<string, unknown>[] = [];
  await page.route(google, async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      bodies.push(req.postDataJSON());
      await route.fulfill({
        json: { id: `op-${bodies.length}`, status: "in_progress" },
      });
    } else if (req.url().includes("/interactions/"))
      await route.fulfill({
        json: {
          id: req.url().split("/").at(-1),
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "video", data: clip, mime_type: "video/mp4" }],
            },
          ],
        },
      });
    else await route.fulfill({ json: { models: [] } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Proyectos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Añadir API key", exact: true })
    .click();
  await page
    .getByLabel("Google API key", { exact: true })
    .fill("testing-no-real-api-key");
  await page
    .getByRole("button", { name: "Guardar clave", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comprobar conexión", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Google acepta la clave",
  );
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await createProject(page);
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Primera escena",
  );
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByLabel("Nombre del proyecto").fill("Secuencia de prueba");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.locator(".reference-details summary").click();
  await page
    .getByRole("button", { name: "Elegir fotograma inicial", exact: true })
    .click();
  await page
    .getByLabel("Subir imágenes de referencia", { exact: true })
    .setInputFiles("e2e/fixtures/reference.png");
  await expect(
    page.getByRole("button", { name: "Usar fotograma inicial", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Usar fotograma inicial", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Elegir fotograma final", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seleccionar reference.png", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usar fotograma final", exact: true })
    .click();

  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  expect(bodies[0]).toMatchObject({ model: "gemini-omni-1.1-flash" });
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("¿Qué quieres cambiar?")
    .fill("Una iluminación más cálida.");
  await page.getByRole("button", { name: "Crear clip editado" }).click();
  await reopenReady(page, "Primera escena · Edición 1");
  await expect(page.locator(".preview-meta")).toContainText("Clip listo", {
    timeout: 15000,
  });
  expect(bodies[1]).toMatchObject({ previous_interaction_id: "op-1" });
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await page
    .getByLabel("¿Cómo continúa la escena?")
    .fill("La cámara retrocede lentamente.");
  await page
    .getByRole("button", { name: "Crear clip extendido", exact: true })
    .click();
  await reopenReady(page, "Primera escena · Edición 1 · Extensión 1");
  await expect(page.locator(".preview-meta")).toContainText("Clip listo", {
    timeout: 15000,
  });
  expect(bodies[2]).toMatchObject({
    previous_interaction_id: "op-2",
    input: expect.stringContaining("Extend this video"),
  });
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".preview-frame video")
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue(
    "Secuencia de prueba",
  );
  await expect(page.locator(".versions")).toHaveCount(0);
  await expect(page.locator(".project-clip")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".preview-frame video")
        .evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(1);
  await page.screenshot({
    path: "artifacts/editor-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("button", { name: "Mis proyectos" }).click();
  await expect(
    page.getByRole("heading", { name: "Proyectos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/home-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("paused generations recover after reload without creating a second video", async ({
  page,
}) => {
  let posts = 0,
    ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.fulfill({
        json: { id: "recoverable", status: "in_progress" },
      });
    } else
      await route.fulfill({
        json: ready
          ? {
              id: "recoverable",
              status: "completed",
              steps: [
                {
                  type: "model_output",
                  content: [{ type: "video", data: clip }],
                },
              ],
            }
          : { id: "recoverable", status: "in_progress" },
      });
  });
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar resultado" }),
  ).toBeVisible();
  ready = true;
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Recuperar resultado" })
    .click();
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  expect(posts).toBe(1);
});

test("queue stops on quota failure and preserves waiting scenes", async ({
  page,
}) => {
  let posts = 0;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    posts++;
    return route.fulfill({
      status: 429,
      json: { error: { message: "Quota exceeded" } },
    });
  });
  await page.goto("/");
  await createProject(page, 3);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: /Generar pendientes/ }).click();
  await expect(
    page.locator(".project-clip").filter({ hasText: "Revisar" }),
  ).toHaveCount(1);
  expect(posts).toBe(1);
  await expect(
    page.locator(".project-clip").filter({ hasText: "En cola" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toContainText("cuota");
});

test("exports mixed silent/audio clips in a single playable MP4 using the local engine", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await createProject(page, 2);
  await page.evaluate(
    async ({ clip, silent }) => {
      // Seed two legacy-format records to cover migration and the actual export UI.
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("vid-gen-studio");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("scenes", "readwrite"),
          store = tx.objectStore("scenes");
        const request = store.getAll();
        request.onsuccess = () => {
          request.result
            .sort((a, b) => a.order - b.order)
            .forEach((scene, i) => {
              if (i > 1) store.delete(scene.id);
              else
                store.put({
                  ...scene,
                  status: "completed",
                  video_blob: new Blob(
                    [
                      Uint8Array.from(atob(i ? silent : clip), (c) =>
                        c.charCodeAt(0),
                      ),
                    ],
                    { type: "video/mp4" },
                  ),
                  video_url: "blob:expired-original-url",
                });
            });
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { clip, silent },
  );
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await page
    .getByRole("button", { name: "Añadir a secuencia", exact: true })
    .click();
  await expect(page.getByTestId("sequence-preview")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar vídeo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const download = await downloaded;
  const outputPath = await download.path();
  expect(outputPath).toBeTruthy();
  const encodedOutput = readFileSync(outputPath!).toString("base64");
  const result = await page.evaluate(async (data) => {
    const output = new Blob(
      [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
      { type: "video/mp4" },
    );
    const video = document.createElement("video");
    video.src = URL.createObjectURL(output);
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("MP4 inválido"));
    });
    return {
      size: output.size,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  }, encodedOutput);
  expect(result.size).toBeGreaterThan(1000);
  expect(result.duration).toBeGreaterThan(1.8);
  expect(result.width).toBe(720);
  expect(result.height).toBe(1280);
});

test("clip library downloads originals in ZIP and keeps an optional sequence after reload", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, 3);
  await page.evaluate(
    async ({ clip, silent }) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("vid-gen-studio");
        req.onsuccess = () => resolve(req.result);
      });
      await new Promise<void>((resolve) => {
        const tx = database.transaction("scenes", "readwrite");
        const req = tx.objectStore("scenes").getAll();
        req.onsuccess = () =>
          req.result
            .sort((a, b) => a.order - b.order)
            .forEach((scene, i) => {
              if (i < 2)
                tx.objectStore("scenes").put({
                  ...scene,
                  status: "completed",
                  video_blob: new Blob(
                    [
                      Uint8Array.from(atob(i ? silent : clip), (c) =>
                        c.charCodeAt(0),
                      ),
                    ],
                    { type: "video/mp4" },
                  ),
                });
            });
        tx.oncomplete = () => resolve();
      });
      database.close();
    },
    { clip, silent },
  );
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await expect(
    page.getByRole("heading", { name: /Clips del proyecto/ }),
  ).toBeVisible();
  await expect(page.locator(".project-clip")).toHaveCount(3);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await expect(page.locator(".selection-note")).toContainText("2 clips");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Descargar seleccionados/ }).click();
  await page
    .getByRole("button", { name: "Descargar 2 clips · ZIP", exact: true })
    .click();
  const zip = await downloaded;
  expect(zip.suggestedFilename()).toMatch(/-clips.zip$/);
  const bytes = readFileSync((await zip.path())!);
  const singleDownload = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Descargar clip: Primera escena",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const single = await singleDownload;
  expect(readFileSync((await single.path())!).toString("base64")).toBe(clip);

  // Verify stored ZIP local entries contain precisely the selected original media.
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18),
      nameSize = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + nameSize)
      .toString("utf8");
    const start = offset + 30 + nameSize + extra;
    entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  expect(
    [...entries.keys()].filter((name) => name.endsWith(".mp4")),
  ).toHaveLength(2);
  expect(
    [...entries.values()].some((data) => data.toString("base64") === clip),
  ).toBe(true);
  expect(
    [...entries.values()].some((data) => data.toString("base64") === silent),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Deseleccionar", exact: true })
    .click();
  await page.getByLabel("Filtrar clips").selectOption("ready");
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/clips-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/clips-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Añadir a secuencia", exact: true })
    .click();
  await expect(page.getByTestId("timeline-clip")).toHaveCount(2);
  await page
    .getByTestId("timeline-clip")
    .last()
    .locator(".sequence-item-content")
    .click();
  await page.getByRole("button", { name: "Antes", exact: true }).click();
  await expect(page.getByTestId("timeline-clip").first()).toContainText(
    "Escena 2",
  );
  await expect(page.locator(".sequence-header [role=status]")).toHaveText(
    "Guardado",
  );
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await expect(page.locator(".project-clip")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Secuencia · 2", exact: true })
    .click();
  await expect(page.getByTestId("timeline-clip").first()).toContainText(
    "Escena 2",
  );
  await page
    .getByTestId("timeline-clip")
    .first()
    .locator(".sequence-item-content")
    .click();
  await page.screenshot({
    path: "artifacts/sequence-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({
    path: "artifacts/sequence-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page
    .getByTestId("timeline-clip")
    .first()
    .locator(".sequence-item-content")
    .click();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect(page.getByTestId("timeline-clip")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Todos los clips", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(3);
});

test("new clips open a focused modal, save drafts and return focus to the library", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuevo clip", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Generar y editar clip" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".storyboard")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Exportar vídeo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Una nube cruza el cielo.");
  await page.getByLabel("Nombre de la escena").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nuevo clip", exact: true }),
  ).toBeFocused();
  await expect(
    page
      .locator(".project-clip")
      .filter({ hasText: "Una nube cruza el cielo." }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Abrir clip: Escena 2", exact: true })
    .click();
  await expect(page.getByLabel("¿Qué ocurre en esta toma?")).toHaveValue(
    "Una nube cruza el cielo.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    dialog.getByRole("button", { name: "Generar escena", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/clip-dialog-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    dialog.getByRole("button", { name: "Generar escena", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/clip-dialog-mobile.png",
    fullPage: true,
  });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "Cerrar editor de clip", exact: true }),
  ).toBeInViewport();
});

test("settings returns to the draft, optional references stay compact and trash is recoverable", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, 2);
  await expect(page.locator(".reference-details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page
    .getByRole("button", { name: "Conectar Google para generar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ajustes del estudio" }),
  ).toBeVisible();
  await page.getByLabel("Google API key", { exact: true }).fill("test-key");
  await page
    .getByRole("button", { name: "Guardar clave", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al clip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue("Escena 2");
  await expect(page.getByLabel("¿Qué ocurre en esta toma?")).toContainText(
    "Plano 2",
  );
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page
    .getByLabel("Seleccionar clip: Primera escena", { exact: true })
    .check();
  await expect(
    page.getByLabel("Seleccionar clips visibles", { exact: true }),
  ).toHaveJSProperty("indeterminate", true);
  await page.getByLabel("Buscar clips", { exact: true }).fill("Escena 2");
  await expect(
    page.locator(".selection-note").filter({ hasText: "fuera de este filtro" }),
  ).toBeVisible();
  await page.getByLabel("Buscar clips", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Eliminar clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Eliminar clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page.getByLabel("Filtrar clips").selectOption("trash");
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "La papelera está vacía" }),
  ).toBeVisible();
  await page.getByLabel("Filtrar clips").selectOption("all");
  await expect(page.locator(".project-clip")).toHaveCount(2);
});

test("edit instructions persist and mobile switches between configuration and the finished video", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) =>
    route.fulfill({
      json: {
        id: "saved-video",
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "video", data: clip }] },
        ],
      },
    }),
  );
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await reopenReady(page);
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByLabel("¿Qué quieres cambiar?")
    .fill("Conservar el encuadre y cambiar la luz.");
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await page
    .getByLabel("¿Cómo continúa la escena?")
    .fill("La cámara se aleja despacio.");
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.getByLabel("¿Qué quieres cambiar?")).toHaveValue(
    "Conservar el encuadre y cambiar la luz.",
  );
  await page.getByRole("button", { name: "Extender", exact: true }).click();
  await expect(page.getByLabel("¿Cómo continúa la escena?")).toHaveValue(
    "La cámara se aleja despacio.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".preview-frame video")).toBeVisible();
  await page.screenshot({ path: "artifacts/ux-mobile-preview.png" });
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await expect(page.getByLabel("¿Cómo continúa la escena?")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Crear clip extendido", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/ux-mobile-configure.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/ux-desktop-clip.png" });
});

test("background queue accepts more clips, preserves snapshots and creates independent clips and edits from the selected take", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  let ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, async (route) => {
    if (route.request().method() === "POST") {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        json: { id: `batch-${bodies.length}`, status: "in_progress" },
      });
    } else
      await route.fulfill({
        json: ready
          ? {
              id: route.request().url().split("/").at(-1),
              status: "completed",
              steps: [
                {
                  type: "model_output",
                  content: [{ type: "video", data: clip }],
                },
              ],
            }
          : { status: "in_progress" },
      });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".clip-generation").first()).toContainText(
    "Clip 1 de 3",
  );
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await page.getByRole("button", { name: "Nuevo clip", exact: true }).click();
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Una montaña nevada.");
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".project-clip").last()).toContainText("En cola");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByLabel("¿Qué ocurre en esta toma?")
    .fill("Este borrador no modifica lo enviado.");
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/queue-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/queue-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  ready = true;
  await expect(page.locator(".job-bar")).toHaveCount(0, { timeout: 25000 });
  expect(bodies).toHaveLength(4);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[1]).toEqual(bodies[2]);
  await expect(page.locator(".project-clip")).toHaveCount(4);
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo", "Listo", "Listo"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.getByLabel("¿Qué quieres cambiar?").fill("Cambia la luz.");
  await page.getByLabel("Cantidad de clips").fill("2");
  await page
    .getByRole("button", { name: "Crear 2 clips editados", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".project-clip")).toHaveCount(6);
  await expect(
    page.locator(".project-clip").last().locator(".clip-title [role=status]"),
  ).toHaveText("Listo", { timeout: 20000 });
  expect(bodies[4]).toMatchObject({ previous_interaction_id: "batch-1" });
  expect(bodies[5]).toMatchObject({ previous_interaction_id: "batch-1" });
});

test("waiting clips survive pause and reload and can be cancelled without new paid requests", async ({
  page,
}) => {
  let posts = 0;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: { id: "waiting-batch", status: "in_progress" },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await expect(page.locator(".job-bar")).toContainText("Cola pausada");
  expect(posts).toBe(1);
  await page
    .getByRole("button", { name: "Cancelar pendientes", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Cancelar pendientes", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Cancelar pendientes", exact: true })
    .click();
  await expect(page.locator(".clip-generation")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await expect(page.locator(".job-bar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Recuperar resultado", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("recovering an interrupted batch resumes its remaining clips exactly once", async ({
  page,
}) => {
  let posts = 0,
    ready = false;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: ready
        ? {
            id: `resume-${posts}`,
            status: "completed",
            steps: [
              {
                type: "model_output",
                content: [{ type: "video", data: clip }],
              },
            ],
          }
        : { id: "resume-1", status: "in_progress" },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  ready = true;
  await page
    .getByRole("button", { name: "Recuperar resultado", exact: true })
    .click();
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo", "Listo"], { timeout: 15000 });
  await expect(page.locator(".job-bar")).toHaveCount(0);
  expect(posts).toBe(3);
});

test("failed edits retry into the same derived clip and keep their original input", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 2)
      return route.fulfill({
        status: 429,
        json: { error: { message: "Quota exceeded" } },
      });
    return route.fulfill({
      json: {
        id: `retry-${bodies.length}`,
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "video", data: clip }] },
        ],
      },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await reopenReady(page);
  await page.getByLabel("¿Qué quieres cambiar?").fill("Luz más cálida.");
  await page
    .getByRole("button", { name: "Crear clip editado", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await expect(page.locator(".project-clip").last()).toContainText("Revisar");
  await expect(page.locator(".project-clip").first()).toContainText("Listo");
  await page
    .getByRole("button", { name: "Reintentar clip", exact: true })
    .click();
  await expect(
    page.locator(".project-clip").last().locator(".clip-title [role=status]"),
  ).toHaveText("Listo");
  await expect(page.locator(".project-clip")).toHaveCount(2);
  expect(bodies[1]).toEqual(bodies[2]);
  expect(bodies[2]).toMatchObject({ previous_interaction_id: "retry-1" });
  await page
    .locator(".project-clip")
    .last()
    .getByRole("button", { name: "Ver origen", exact: true })
    .click();
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Primera escena",
  );
});

test("existing grouped results can be separated into independently downloadable clips", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page);
  await page.evaluate(async (data) => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("vid-gen-studio");
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = database.transaction("scenes", "readwrite");
      const req = tx.objectStore("scenes").getAll();
      req.onsuccess = () => {
        const scene = req.result[0];
        const versions = ["old-1", "old-2"].map((id) => ({
          id,
          prompt: "Paisaje",
          settings: scene.settings,
          mode: "generate",
          duration: 8,
          created_at: "today",
          blob: new Blob(
            [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
            { type: "video/mp4" },
          ),
        }));
        tx.objectStore("scenes").put({
          ...scene,
          versions,
          active_version_id: "old-2",
          status: "completed",
        });
      };
      tx.oncomplete = () => resolve();
    });
    database.close();
  }, clip);
  await page.reload();
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page.locator(".versions summary").click();
  await page
    .getByRole("button", { name: "Separar en clips", exact: true })
    .click();
  await expect(page.locator(".versions")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  await expect(
    page.locator(".project-clip .clip-title [role=status]"),
  ).toHaveText(["Listo", "Listo"]);
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: /Descargar seleccionados/ }),
  ).toBeEnabled();
});

async function seedReviewClips(page: Page) {
  await createProject(page, 2);
  await page.evaluate(async (data) => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("vid-gen-studio");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = database.transaction("scenes", "readwrite");
      const request = tx.objectStore("scenes").getAll();
      request.onsuccess = () => {
        const scenes = request.result.sort((a, b) => a.order - b.order);
        scenes.forEach((scene, i) =>
          tx.objectStore("scenes").put({
            ...scene,
            title: i ? "Editado" : "Original",
            origin: i
              ? { sceneId: scenes[0].id, title: "Original", mode: "edit" }
              : undefined,
            status: "completed",
            updated_at: `2026-01-0${i + 1}`,
            versions: [
              {
                id: `review-${i}`,
                blob: new Blob(
                  [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
                  { type: "video/mp4" },
                ),
                prompt: i ? "Luz cálida" : "Un paisaje al amanecer",
                settings: scene.settings,
                mode: i ? "edit" : "generate",
                duration: 8,
                interactionId: `source-${i}`,
                created_at: "today",
              },
            ],
            active_version_id: `review-${i}`,
          }),
        );
      };
      tx.oncomplete = () => resolve();
    });
    database.close();
  }, clip);
  await page.reload();
}

test("favorites and discarded persist and reuse opens a fresh draft with the original settings", async ({
  page,
}) => {
  let requests = 0;
  await page.route(google, (route) => {
    requests++;
    return route.abort();
  });
  await page.goto("/");
  await seedReviewClips(page);
  await expect(page.getByLabel("Ordenar clips")).toHaveValue("recent");
  await expect(page.locator(".project-clip").first()).toContainText("Editado");
  await page
    .getByRole("button", { name: "Marcar favorito: Original", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descartar clip: Editado", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page.reload();
  await page.getByLabel("Filtrar clips").selectOption("favorites");
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Quitar favorito: Original",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Filtrar clips").selectOption("discarded");
  await expect(page.locator(".project-clip")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Recuperar descartado: Editado", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(0);
  await page.getByLabel("Filtrar clips").selectOption("all");
  await page
    .getByRole("button", { name: "Crear otro parecido: Original", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("¿Qué ocurre en esta toma?")).toHaveValue(
    "Un paisaje al amanecer",
  );
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Original · parecido",
  );
  await expect(page.locator(".preview-frame video")).toHaveCount(0);
  expect(requests).toBe(0);
});

test("comparison synchronizes playback and seeking and lets a user keep a favorite", async ({
  page,
}) => {
  await page.goto("/");
  await seedReviewClips(page);
  await page.getByLabel("Seleccionar clip: Original", { exact: true }).check();
  await page.getByLabel("Seleccionar clip: Editado", { exact: true }).check();
  await page
    .getByRole("button", { name: "Comparar 2 clips", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Comparar clips" });
  await expect(
    dialog.getByRole("button", { name: "Reproducir ambos", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Reproducir ambos", exact: true })
    .click();
  await expect
    .poll(() =>
      dialog
        .locator("video")
        .evaluateAll((videos) =>
          videos.every((v) => (v as HTMLVideoElement).currentTime > 0),
        ),
    )
    .toBe(true);
  if (
    await dialog
      .getByRole("button", { name: "Pausar ambos", exact: true })
      .isVisible()
  )
    await dialog
      .getByRole("button", { name: "Pausar ambos", exact: true })
      .click();
  await dialog.getByRole("slider").fill("0.4");
  await expect
    .poll(() =>
      dialog
        .locator("video")
        .evaluateAll((videos) =>
          videos.every(
            (v) => Math.abs((v as HTMLVideoElement).currentTime - 0.4) < 0.03,
          ),
        ),
    )
    .toBe(true);
  await dialog.getByLabel("Audio", { exact: true }).selectOption("0");
  expect(
    await dialog
      .locator("video")
      .evaluateAll((videos) =>
        videos.map((v) => (v as HTMLVideoElement).muted),
      ),
  ).toEqual([false, true]);
  await dialog
    .getByRole("button", { name: "☆ Marcar favorito", exact: true })
    .first()
    .click();
  await expect(
    dialog.getByRole("button", { name: "★ Favorito", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/compare-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/compare-mobile.png" });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog
    .getByRole("button", { name: "Cerrar comparar clips", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Comparar 2 clips", exact: true }),
  ).toBeFocused();
});

test("download favorites previews safe custom filenames and exports only those originals", async ({
  page,
}) => {
  await page.goto("/");
  await seedReviewClips(page);
  await page
    .getByRole("button", { name: "Marcar favorito: Original", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar clips", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Descargar clips" });
  await expect(dialog.getByLabel("Qué descargar")).toHaveValue("favorites");
  await dialog.getByLabel("Nombres de archivo").selectOption("prefix");
  await dialog
    .getByLabel("Nombre común", { exact: true })
    .fill("Mi proyecto/video");
  await dialog.locator("summary").click();
  await expect(
    dialog.getByText("Mi proyecto-video-001.mp4", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/download-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/download-mobile.png" });
  const pending = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Descargar 1 clip · ZIP", exact: true })
    .click();
  const bytes = readFileSync((await (await pending).path())!);
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18),
      nameSize = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + nameSize)
      .toString("utf8");
    const start = offset + 30 + nameSize + extra;
    entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  expect([...entries.keys()]).toEqual([
    "Mi proyecto-video-001.mp4",
    "clips.json",
  ]);
  expect(entries.get("Mi proyecto-video-001.mp4")!.toString("base64")).toBe(
    clip,
  );
  expect(
    JSON.parse(entries.get("clips.json")!.toString("utf8"))[0],
  ).toMatchObject({
    favorite: true,
    prompt: "Un paisaje al amanecer",
    file: "Mi proyecto-video-001.mp4",
  });
});

test("activity prioritizes a pending clip and cancels a batch after reload without touching the active request", async ({
  page,
}) => {
  let posts = 0;
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: { id: "activity-active", status: "in_progress" },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.getByLabel("Cantidad de clips").fill("3");
  await page
    .getByRole("button", { name: "Generar 3 clips", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByRole("button", { name: "Ver actividad", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Actividad" });
  await dialog
    .getByRole("button", {
      name: "Generar antes: Primera escena · Toma 2",
      exact: true,
    })
    .click();
  await expect(dialog.locator("li").first()).toContainText("Toma 2");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/activity-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/activity-mobile.png" });
  await dialog
    .getByRole("button", { name: "Cerrar actividad", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Pausar seguimiento de la generación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Ver actividad", exact: true })
    .click();
  await expect(dialog.locator("li").first()).toContainText("Toma 2");
  await dialog
    .getByRole("button", { name: "Cancelar tanda · 2 pendientes", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Resultados por recuperar",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Cerrar actividad", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar resultado", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("visual references: upload, search, zoom, selection limits, cancel and persistence", async ({
  page,
}) => {
  await page.route(google, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await createProject(page);
  await page.locator(".reference-details summary").click();
  await expect(
    page.getByRole("button", { name: "Elegir fotograma final", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Elegir referencias", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Elegir referencias visuales",
    exact: true,
  });
  const png = readFileSync(
    new URL("./fixtures/reference.png", import.meta.url),
  ).toString("base64");
  const files = await page.evaluateHandle((data) => {
    const transfer = new DataTransfer();
    for (const name of [
      "Persona.png",
      "Objeto.png",
      "Estilo.png",
      "Paisaje.png",
    ]) {
      transfer.items.add(
        new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], name, {
          type: "image/png",
        }),
      );
    }
    return transfer;
  }, png);
  await picker
    .getByTestId("reference-dropzone")
    .dispatchEvent("drop", { dataTransfer: files });
  await expect(picker.locator(".reference-choice")).toHaveCount(4);
  await expect(picker.getByRole("status")).toContainText(
    "4 imágenes guardadas",
  );
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar Paisaje.png",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(picker.locator(".reference-picker-footer")).toContainText(
    "3 de 3 seleccionadas",
  );
  await page.screenshot({
    path: "artifacts/references-desktop.png",
    fullPage: true,
  });
  await picker
    .getByRole("button", { name: "Seleccionar Objeto.png", exact: true })
    .click();
  await picker.getByLabel("Buscar referencias").fill("paisaje");
  await expect(picker.locator(".reference-choice")).toHaveCount(1);
  await picker
    .getByRole("button", { name: "Ampliar Paisaje.png", exact: true })
    .click();
  await expect(picker.locator(".reference-large img")).toBeVisible();
  await picker
    .getByRole("button", { name: "Seleccionar esta imagen", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Usar referencias", exact: true })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator(".reference-guide-list > div")).toHaveCount(3);
  await expect(page.locator(".reference-guide-list")).toContainText(
    "Paisaje.png",
  );
  await expect(page.locator(".reference-guide-list")).not.toContainText(
    "Objeto.png",
  );
  await page
    .getByRole("button", { name: "Cambiar referencias", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Seleccionar Persona.png", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".reference-guide-list > div")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Cambiar referencias", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Elegir fotograma inicial", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seleccionar Objeto.png", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usar fotograma inicial", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Elegir fotograma final", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seleccionar Paisaje.png", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usar fotograma final", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Elegir fotograma final", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await expect(page.locator(".reference-guide-list > div")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Elegir fotograma inicial", exact: true }),
  ).toContainText("Objeto.png");
  await expect(
    page.getByRole("button", { name: "Elegir fotograma final", exact: true }),
  ).toContainText("Paisaje.png");
  await page
    .getByRole("button", { name: "Cambiar referencias", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/references-form-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Cambiar referencias", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/references-mobile.png",
    fullPage: true,
  });
  await expect(
    picker.getByRole("button", { name: "Usar referencias", exact: true }),
  ).toBeInViewport();
  await expect(picker).toHaveJSProperty(
    "scrollWidth",
    await picker.evaluate((el) => el.clientWidth),
  );
  await picker
    .getByRole("button", { name: "Ampliar Persona.png", exact: true })
    .click();
  await page.screenshot({
    path: "artifacts/references-zoom-mobile.png",
    fullPage: true,
  });
  await expect(
    picker.getByRole("button", { name: "Quitar de la selección", exact: true }),
  ).toBeInViewport();
  await picker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Quitar fotograma inicial", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Elegir fotograma final", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".reference-frames img")).toHaveCount(0);
  await files.dispose();
});

test("reference uploads reject broken images and preserve the current selection", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page);
  await page.locator(".reference-details summary").click();
  await page
    .getByRole("button", { name: "Elegir referencias", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Elegir referencias visuales",
    exact: true,
  });
  await picker.getByLabel("Subir imágenes de referencia").setInputFiles([
    {
      name: "Correcta.png",
      mimeType: "image/png",
      buffer: readFileSync(
        new URL("./fixtures/reference.png", import.meta.url),
      ),
    },
    {
      name: "Rota.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    },
    {
      name: "Texto.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    },
  ]);
  await expect(picker.getByRole("status")).toContainText(
    "No se puede abrir esta imagen",
  );
  await expect(picker.locator(".reference-choice")).toHaveCount(1);
  await expect(
    picker.getByRole("button", {
      name: "Seleccionar Correcta.png",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", { name: "Usar referencias", exact: true })
    .click();
  await expect(page.locator(".reference-guide-list")).toContainText(
    "Correcta.png",
  );
  await page
    .getByRole("button", { name: "Cambiar referencias", exact: true })
    .click();
  await picker
    .getByRole("button", { name: "Seleccionar Correcta.png", exact: true })
    .click();
  await picker.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".reference-guide-list")).toContainText(
    "Correcta.png",
  );
});

async function inspectVideoDownload(page: Page, bytes: Buffer) {
  return page.evaluate(async (data) => {
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], {
        type: "video/mp4",
      }),
    );
    const video = document.createElement("video") as HTMLVideoElement & {
      captureStream: () => MediaStream;
    };
    video.muted = true;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () =>
          reject(new Error("El vídeo no se puede reproducir"));
        video.src = url;
      });
      await video.play();
      const stream = video.captureStream();
      const result = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        audio: stream.getAudioTracks().length,
      };
      stream.getTracks().forEach((track) => track.stop());
      return result;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }, bytes.toString("base64"));
}

async function replaceReviewVideo(
  page: Page,
  data: string,
  title = "Original",
) {
  await page.evaluate(
    async ({ data, title }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const req = indexedDB.open("vid-gen-studio");
        req.onsuccess = () => resolve(req.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction("scenes", "readwrite"),
          store = tx.objectStore("scenes"),
          req = store.getAll();
        req.onsuccess = () => {
          const scene = req.result.find((s) => s.title === title);
          scene.versions[0].blob = new Blob(
            [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
            { type: "video/mp4" },
          );
          store.put(scene);
        };
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { data, title },
  );
  await page.reload();
}

test("downloads real 720p, 1080p and 4K files with audio and preserves the source", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route(google, (route) => route.abort());
  await page.goto("/");
  await seedReviewClips(page);
  let original = Buffer.from(clip, "base64");
  for (const [quality, width, height] of [
    ["720p", 720, 1280],
    ["1080p", 1080, 1920],
    ["4k", 2160, 3840],
  ] as const) {
    await page
      .getByRole("button", { name: "Descargar clip: Original", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Descargar vídeo",
      exact: true,
    });
    await dialog.getByLabel("Resolución de descarga").selectOption(quality);
    await expect(dialog.locator(".download-dimensions")).toContainText(
      `${width} × ${height}`,
    );
    if (quality === "1080p") {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: "artifacts/download-quality-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: "artifacts/download-quality-mobile.png" });
      await expect(
        dialog.getByRole("button", { name: "Descargar MP4", exact: true }),
      ).toBeInViewport();
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    const pending = page.waitForEvent("download", { timeout: 90000 });
    await dialog
      .getByRole("button", { name: "Descargar MP4", exact: true })
      .click();
    const file = await pending;
    expect(file.suggestedFilename()).toContain(`-${quality}.mp4`);
    const bytes = readFileSync((await file.path())!);
    const info = await inspectVideoDownload(page, bytes);
    expect(info).toMatchObject({ width, height, audio: 1 });
    expect(info.duration).toBeCloseTo(1, 1);
    if (quality === "720p") {
      original = bytes;
      await replaceReviewVideo(page, bytes.toString("base64"));
    }
  }
  await page
    .getByRole("button", { name: "Descargar clip: Original", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  expect(readFileSync((await (await pending).path())!)).toEqual(original);
});

test("cancels an active upscale and can restart the encoder", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await seedReviewClips(page);
  await page
    .getByRole("button", { name: "Descargar clip: Original", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Descargar vídeo",
    exact: true,
  });
  await dialog.getByLabel("Resolución de descarga").selectOption("4k");
  await dialog
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Preparando 2160 × 3840",
  );
  await dialog
    .getByRole("button", { name: "Cancelar preparación", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Preparación cancelada",
  );
  await expect(dialog.getByLabel("Resolución de descarga")).toBeEnabled();
  await dialog.getByLabel("Resolución de descarga").selectOption("1080p");
  const pending = page.waitForEvent("download", { timeout: 90000 });
  await dialog
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const bytes = readFileSync((await (await pending).path())!);
  expect(await inspectVideoDownload(page, bytes)).toMatchObject({
    width: 1080,
    height: 1920,
    audio: 1,
  });
});

test("scaled ZIPs keep silent clips silent and record export resolution separately", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await seedReviewClips(page);
  await replaceReviewVideo(page, silent, "Editado");
  await page
    .getByRole("button", { name: "Descargar clips", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Descargar clips",
    exact: true,
  });
  await dialog.getByLabel("Resolución de descarga").selectOption("1080p");
  const pending = page.waitForEvent("download", { timeout: 90000 });
  await dialog
    .getByRole("button", { name: "Descargar 2 clips · ZIP", exact: true })
    .click();
  const file = await pending,
    bytes = readFileSync((await file.path())!);
  expect(file.suggestedFilename()).toContain("-1080p.zip");
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18),
      nameSize = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const name = bytes
        .subarray(offset + 30, offset + 30 + nameSize)
        .toString("utf8"),
      start = offset + 30 + nameSize + extra;
    entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  const manifest = JSON.parse(entries.get("clips.json")!.toString());
  for (const item of manifest) {
    expect(item.settings.resolution).toBe("720p");
    expect(item.download).toMatchObject({
      resolution: "1080p",
      processing: "lanczos",
    });
    expect(item.file).toContain("-1080p.mp4");
    expect(
      await inspectVideoDownload(page, entries.get(item.file)!),
    ).toMatchObject({
      width: item.title === "Original" ? 1080 : 1920,
      height: item.title === "Original" ? 1920 : 1080,
      audio: item.title === "Original" ? 1 : 0,
    });
  }
});

test("reference generation sends a normalized copy and terminal failures permit an explicit retry", async ({
  page,
}) => {
  const inputs: { type: string; mime_type?: string; data?: string }[][] = [];
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-key"),
  );
  await page.route(google, (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      inputs.push(req.postDataJSON().input);
      return route.fulfill({
        json:
          inputs.length === 1
            ? {
                id: "failed-ref",
                status: "failed",
                errors: [{ message: "The file failed to be processed." }],
              }
            : {
                id: "retry-ref",
                status: "completed",
                output_video: { data: clip, mime_type: "video/mp4" },
              },
      });
    }
    return route.fulfill({
      status: 500,
      json: { error: { message: "Unexpected polling" } },
    });
  });
  await page.goto("/");
  await createProject(page);
  await page.locator(".reference-details summary").click();
  await page
    .getByRole("button", { name: "Elegir fotograma inicial", exact: true })
    .click();
  await page
    .getByLabel("Subir imágenes de referencia")
    .setInputFiles("e2e/fixtures/reference.png");
  await page
    .getByRole("button", { name: "Usar fotograma inicial", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar clip", exact: true }),
  ).toBeVisible();
  expect(inputs).toHaveLength(1);
  const image = inputs[0].find((part) => part.type === "image")!;
  expect(image.mime_type).toBe("image/jpeg");
  expect(Buffer.from(image.data!, "base64").subarray(0, 3)).toEqual(
    Buffer.from([255, 216, 255]),
  );
  await page
    .getByRole("button", { name: "Reintentar clip", exact: true })
    .click();
  await expect(page.locator(".clip-title [role=status]")).toHaveText("Listo");
  expect(inputs).toHaveLength(2);
  await page
    .getByRole("button", { name: "Abrir clip: Primera escena", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nuevo clip", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Elegir fotograma inicial", exact: true })
      .locator("img"),
  ).toHaveAttribute("src", /^data:image\/png;base64,/);
});

test("timeline trims, splits, reorders, previews cuts and exports the saved montage", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(google, (route) => route.abort());
  await page.goto("/");
  await seedReviewClips(page);
  await page.getByLabel("Ordenar clips").selectOption("order");
  await page.getByLabel("Seleccionar clips visibles", { exact: true }).check();
  await page
    .getByRole("button", { name: "Añadir a secuencia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reproducir secuencia", exact: true }),
  ).toBeEnabled();
  const cards = page.getByTestId("timeline-clip");
  await cards.first().locator(".sequence-item-content").click();
  await page.getByLabel("Inicio del recorte", { exact: true }).fill("0.25");
  await page.getByLabel("Final del recorte", { exact: true }).click();
  await page.getByLabel("Final del recorte", { exact: true }).fill("0.75");
  await page.getByRole("heading", { name: "Original", exact: true }).click();
  await expect(page.locator(".sequence-duration")).toContainText("00:00:12");
  await page
    .getByRole("button", { name: "Silenciar clip", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByTestId("sequence-preview")
        .evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(0.25, 1);
  // Split a trimmed clip at timeline .25 => source .50. Both halves retain mute.
  await page.getByLabel("Recorrer secuencia", { exact: true }).fill("0.25");
  await page.getByRole("button", { name: "Dividir aquí", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("Sin audio");
  await expect(cards.nth(1)).toContainText("Sin audio");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(cards).toHaveCount(3);
  await cards.last().dragTo(cards.first(), { targetPosition: { x: 2, y: 40 } });
  await expect(cards.first()).toContainText("Editado");
  await cards.last().locator(".sequence-item-content").click();
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(cards).toHaveCount(4);
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect(cards).toHaveCount(3);
  // Trim the first source by dragging its right handle: one second -> half a second.
  const handle = page.getByRole("button", {
    name: "Recortar final de toma 1",
    exact: true,
  });
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 36, bounds.y + 20, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(
    page.getByLabel("Final del recorte", { exact: true }),
  ).toHaveValue("0.5");
  await page.getByLabel("Formato del montaje").selectOption("16:9");
  const frame = (await page.locator(".sequence-preview-frame").boundingBox())!;
  expect(frame.width / frame.height).toBeCloseTo(16 / 9, 2);
  await page.getByLabel("Recorrer secuencia", { exact: true }).fill("0.625");
  await expect
    .poll(() =>
      page
        .getByTestId("sequence-preview")
        .evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeCloseTo(0.375, 1);
  await expect
    .poll(() =>
      page
        .getByTestId("sequence-preview")
        .evaluate((v: HTMLVideoElement) => v.volume),
    )
    .toBe(0);
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await cards.first().locator(".sequence-item-content").click();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Reproducir secuencia", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByLabel("Posición del montaje", { exact: true }),
  ).toContainText("00:01:00 / 00:01:00");
  await expect(page.locator(".sequence-header [role=status]")).toHaveText(
    "Guardado",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Secuencia · 3", exact: true })
    .click();
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("Editado");
  await expect(page.getByLabel("Formato del montaje")).toHaveValue("16:9");
  const downloaded = page.waitForEvent("download", { timeout: 90000 });
  await page
    .getByRole("button", { name: "Exportar vídeo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const file = await downloaded;
  const info = await inspectVideoDownload(
    page,
    readFileSync((await file.path())!),
  );
  expect(info.width).toBe(1280);
  expect(info.height).toBe(720);
  expect(info.duration).toBeGreaterThan(0.95);
  expect(info.duration).toBeLessThan(1.2);
  // A montage with just one trimmed take must still apply the cut and framing.
  for (let i = 0; i < 2; i++) {
    await cards.last().locator(".sequence-item-content").click();
    await page.getByRole("button", { name: "Quitar", exact: true }).click();
  }
  await expect(cards).toHaveCount(1);
  await page
    .getByRole("button", { name: "Añadir Original al montaje", exact: true })
    .click();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(cards).toHaveCount(1);
  const singleDownloaded = page.waitForEvent("download", { timeout: 90000 });
  await page
    .getByRole("button", { name: "Exportar vídeo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descargar MP4", exact: true })
    .click();
  const singleFile = await singleDownloaded;
  const singleInfo = await inspectVideoDownload(
    page,
    readFileSync((await singleFile.path())!),
  );
  expect(singleInfo.width).toBe(1280);
  expect(singleInfo.height).toBe(720);
  expect(singleInfo.duration).toBeGreaterThan(0.45);
  expect(singleInfo.duration).toBeLessThan(0.7);
  await page
    .getByRole("button", { name: "Todos los clips", exact: true })
    .click();
  await expect(page.locator(".project-clip")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("refined montage: focus, audition, cursor trims, loop and single-step audio undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(google, (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await seedReviewClips(page);
  await page
    .getByRole("button", { name: "Montar secuencia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Previsualizar Original", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("video")).toBeVisible();
  await page
    .getByRole("button", { name: "Añadir al montaje", exact: true })
    .click();
  await expect(page.getByTestId("timeline-clip")).toHaveCount(1);
  await expect(page.locator(".sequence-filmstrip img")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Ampliar editor", exact: true })
    .click();
  await expect(page.locator(".sequence-editor")).toHaveClass(
    /sequence-focused/,
  );
  await page.getByLabel("Zoom de la línea de tiempo").fill("240");
  await expect(page.locator(".sequence-filmstrip img")).toHaveCount(4);
  await expect(page.locator(".sequence-lane video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Atajos del editor", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Un fotograma");
  await page.keyboard.press("Escape");
  await expect(page.locator(".sequence-editor")).toHaveClass(
    /sequence-focused/,
  );
  await page.getByLabel("Recorrer secuencia", { exact: true }).fill("0.25");
  await page
    .getByRole("button", { name: "Empezar aquí I", exact: true })
    .click();
  await expect(
    page.getByLabel("Inicio del recorte", { exact: true }),
  ).toHaveValue("0.25");
  await page.getByLabel("Recorrer secuencia", { exact: true }).fill("0.5");
  await page
    .getByRole("button", { name: "Terminar aquí O", exact: true })
    .click();
  await expect(
    page.getByLabel("Final del recorte", { exact: true }),
  ).toHaveValue("0.75");
  const volume = page.getByLabel("Volumen del clip", { exact: true });
  const bounds = (await volume.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width - 8,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.3,
    bounds.y + bounds.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(Number(await volume.inputValue())).toBeLessThan(50);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(volume).toHaveValue("100");
  await expect(
    page.getByLabel("Final del recorte", { exact: true }),
  ).toHaveValue("0.75");
  await page
    .getByRole("button", { name: "Repetir toma seleccionada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reproducir secuencia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pausar secuencia", exact: true }),
  ).toBeVisible();
  // Observe more than two full loops without relying on a fixed sleep.
  let wraps = 0,
    last = -1;
  await expect
    .poll(
      async () => {
        const value = Number(
          await page
            .getByLabel("Recorrer secuencia", { exact: true })
            .inputValue(),
        );
        if (last > value) wraps++;
        last = value;
        return wraps;
      },
      { intervals: [70], timeout: 7000 },
    )
    .toBeGreaterThanOrEqual(2);
  await page
    .getByRole("button", { name: "Pausar secuencia", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Repetir toma seleccionada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Añadir Editado al montaje", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al inicio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Corte siguiente", exact: true })
    .click();
  await expect(
    page.getByLabel("Recorrer secuencia", { exact: true }),
  ).toHaveValue("0.5");
  await page
    .getByRole("button", { name: "Corte anterior", exact: true })
    .click();
  await expect(
    page.getByLabel("Recorrer secuencia", { exact: true }),
  ).toHaveValue("0");
  await expect
    .poll(() =>
      page
        .getByTestId("sequence-preview")
        .evaluate((v: HTMLVideoElement) => !v.seeking && v.readyState >= 2),
    )
    .toBe(true);
  const viewer = (await page.locator(".sequence-viewer").boundingBox())!;
  const heading = (await page
    .locator(".sequence-viewer-heading")
    .boundingBox())!;
  const slider = (await page.locator(".sequence-seek").boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(viewer.y);
  expect(slider.y + slider.height).toBeLessThanOrEqual(
    viewer.y + viewer.height,
  );
  expect(
    await page
      .locator(".sequence-filmstrip img")
      .first()
      .evaluate((img) => img.getBoundingClientRect().width),
  ).toBeGreaterThan(10);
  await page.screenshot({
    path: "artifacts/sequence-refined-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".sequence-editor")).not.toHaveClass(
    /sequence-focused/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/sequence-refined-mobile.png",
    fullPage: true,
  });
  const timeline = (await page.locator(".sequence-timeline").boundingBox())!;
  const inspector = (await page.locator(".sequence-inspector").boundingBox())!;
  expect(timeline.y).toBeLessThan(inspector.y);
  await page
    .getByRole("button", { name: "Clips del proyecto 2", exact: true })
    .click();
  await expect(page.locator(".sequence-library")).toBeVisible();
  await expect(page.locator(".sequence-inspector")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
