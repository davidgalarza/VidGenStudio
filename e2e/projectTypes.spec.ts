import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_VIDEO, type Project, type Scene } from "../src/types";

const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const google = "**/generativelanguage.googleapis.com/**";
async function openChooser(page: Page) {
  await page
    .locator(".home-page")
    .getByRole("button", { name: "Nuevo proyecto", exact: true })
    .click();
}
async function counts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(["projects", "scenes"]);
    const count = (store: string) =>
      new Promise<number>((resolve) => {
        const r = tx.objectStore(store).count();
        r.onsuccess = () => resolve(r.result);
      });
    const result = await Promise.all([count("projects"), count("scenes")]);
    db.close();
    return result;
  });
}
async function seedLegacy(page: Page, draftOnly = false) {
  await page.goto("/");
  await expect(page.locator(".home-page")).toBeVisible();
  await page.evaluate(
    async ({ video, settings, draftOnly }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("vid-gen-studio");
        r.onsuccess = () => resolve(r.result);
      });
      const blob = new Blob(
        [Uint8Array.from(atob(video), (c) => c.charCodeAt(0))],
        { type: "video/mp4" },
      );
      const scenes: Scene[] = [
        "Lista",
        "Fallida",
        "Pendiente",
        "Toma de apoyo",
      ].map((title, i) => ({
        id: `clip-${i}`,
        project_id: "legacy",
        order: i,
        title,
        prompt: "Una planta recibe luz.",
        settings,
        status: i === 1 ? "failed" : i === 2 ? "pending" : "completed",
        error: i === 1 ? "Error de conexión" : undefined,
        video_blob: i === 0 || i === 3 ? blob : undefined,
        created_at: "2026-09-18T00:00:00Z",
        updated_at: "2026-09-18T00:00:00Z",
        story:
          i < 3 && !draftOnly
            ? {
                storyId: "story",
                blockId: `block-${i}`,
                text: "La planta recibe luz.",
                visual: "Un primer plano de la planta.",
                speaker: "Ana",
                planned: true,
              }
            : undefined,
      }));
      const project: Project = {
        id: "legacy",
        name: "Proyecto anterior",
        created_at: "2026-09-18T00:00:00Z",
        sequence_ids: ["clip-0", "clip-3"],
        sequence_items: [
          { id: "item-0", scene_id: "clip-0", in: 0.2, out: 0.8, volume: 0.5 },
          { id: "item-3", scene_id: "clip-3", in: 0, out: 1, volume: 1 },
        ],
        story: draftOnly
          ? undefined
          : {
              id: "story",
              phase: "production",
              revision: 1,
              script: scenes
                .slice(0, 3)
                .map((s) => s.story!.text)
                .join(" "),
              mode: "spoken",
              style: "realistic",
              direction: "",
              voiceId: "Kore",
              voiceName: "Kore",
              settings,
              characters: [
                { name: "Ana", description: "Presentadora", voice: "Cálida" },
              ],
              blocks: scenes.slice(0, 3).map((s) => ({
                id: s.story!.blockId,
                title: s.title,
                text: s.story!.text,
                visual: s.story!.visual,
                speaker: "Ana",
                sceneIds: [s.id],
              })),
            },
      };
      const tx = db.transaction(["projects", "scenes", "assets"], "readwrite");
      tx.objectStore("projects").put(project);
      for (const s of scenes) tx.objectStore("scenes").put(s);
      tx.objectStore("assets").put({
        id: "reference",
        type: "element",
        file_name: "planta.png",
        data_url: "data:image/png;base64,iVBORw0KGgo=",
        created_at: "2026-09-18",
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      if (draftOnly)
        sessionStorage.setItem(
          "vidgen-story-draft-legacy",
          JSON.stringify({
            script: "Este guion todavía no tiene una propuesta.",
            mode: "spoken",
            style: "realistic",
            direction: "Luz natural",
            references: false,
          }),
        );
    },
    { video, settings: DEFAULT_VIDEO, draftOnly },
  );
  await page.goto("/#project/legacy");
  await page.reload();
}

test("creation separates workflows, stays empty and filters projects without generating", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(google, (r) => {
    requests.push(r.request().url());
    return r.abort();
  });
  await page.goto("/");
  await openChooser(page);
  await expect(
    page.getByRole("dialog", { name: "Nuevo proyecto", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await counts(page)).toEqual([0, 0]);
  await openChooser(page);
  if (process.env.PROJECT_CAPTURE)
    await page.screenshot({
      path: "artifacts/project-types-chooser-desktop.png",
    });
  await page
    .getByRole("button", { name: "Crear proyecto de clips", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Clips del proyecto/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Historia", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".editor-top")
      .getByRole("button", { name: "Nuevo clip", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Montar secuencia", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".project-clip")).toHaveCount(0);
  await page.getByRole("button", { name: /^Mis proyectos/ }).click();
  await openChooser(page);
  await page
    .getByRole("button", { name: "Crear proyecto de historia", exact: true })
    .click();
  await expect(
    page.getByLabel("Guion completo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuevo clip", exact: true }),
  ).toHaveCount(0);
  expect(await counts(page)).toEqual([2, 0]);
  if (process.env.PROJECT_CAPTURE)
    await page.screenshot({
      path: "artifacts/project-types-story-desktop.png",
      fullPage: true,
    });
  await page
    .getByLabel("Guion completo", { exact: true })
    .fill("Un guion pendiente de revisar.");
  await page.getByRole("button", { name: "Materiales", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Vídeos de la historia/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guion y escenas", exact: true })
    .click();
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "Un guion pendiente de revisar.",
  );
  await page.reload();
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "Un guion pendiente de revisar.",
  );
  await page
    .locator(".story-editor")
    .getByRole("button", { name: "Conectar Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver a la historia", exact: true })
    .click();
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "Un guion pendiente de revisar.",
  );
  await page.getByRole("button", { name: "Materiales", exact: true }).click();
  await page
    .locator(".editor-top")
    .getByRole("button", { name: "Nuevo clip", exact: true })
    .click();
  await page.getByLabel("Nombre de la escena").fill("Apoyo independiente");
  await page
    .getByRole("button", { name: "Conectar Google para generar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al clip", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Nombre de la escena")).toHaveValue(
    "Apoyo independiente",
  );
  await page
    .getByRole("button", { name: "Cerrar editor de clip", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Vídeos de la historia/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  const filter = page.getByRole("group", { name: "Tipo de proyecto" });
  await filter
    .getByRole("button", { name: "Historias 1", exact: true })
    .click();
  await expect(page.locator(".project-row")).toHaveCount(1);
  await expect(page.locator(".project-row")).toContainText(
    "Historia sin título",
  );
  await filter.getByRole("button", { name: "Clips 1", exact: true }).click();
  await expect(page.locator(".project-row")).toHaveCount(1);
  await expect(page.locator(".project-row")).toContainText(
    "Proyecto sin título",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await openChooser(page);
  if (process.env.PROJECT_CAPTURE)
    await page.screenshot({
      path: "artifacts/project-types-chooser-mobile.png",
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(requests).toHaveLength(0);
});

test("legacy mixed projects keep all clips and the montage; story filters and navigation retain edits", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(google, (r) => {
    requests.push(r.request().url());
    return r.abort();
  });
  await seedLegacy(page);
  await expect(
    page.getByRole("heading", { name: "Tu historia en producción" }),
  ).toBeVisible();
  await page
    .getByLabel("Imagen de la escena 1")
    .fill("Un primer plano con iluminación cálida.");
  const filter = page.getByRole("group", { name: "Estado de las escenas" });
  await filter
    .getByRole("button", { name: "Por revisar 1", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("article", { name: "Escena 2", exact: true }),
  ).toBeVisible();
  await filter
    .getByRole("button", { name: "Pendientes 1", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Escena 3", exact: true }),
  ).toBeVisible();
  await filter.getByRole("button", { name: "Todas 3", exact: true }).click();
  await page.getByLabel("Buscar escenas de la historia").fill("inexistente");
  await expect(page.getByText("No hay escenas que coincidan.")).toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar todas las escenas", exact: true })
    .click();
  await expect(page.getByLabel("Imagen de la escena 1")).toHaveValue(
    "Un primer plano con iluminación cálida.",
  );
  if (process.env.PROJECT_CAPTURE)
    await page.screenshot({
      path: "artifacts/project-types-production-desktop.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: "Materiales", exact: true }).click();
  await expect(page.locator(".project-clip")).toHaveCount(4);
  await expect(
    page.getByRole("button", {
      name: "Abrir clip: Toma de apoyo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar clips", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Montaje", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Editor de secuencia" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver a materiales", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /^Vídeos de la historia/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Guion y escenas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir montaje", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver a la historia", exact: true })
    .click();
  await expect(page.getByLabel("Imagen de la escena 1")).toHaveValue(
    "Un primer plano con iluminación cálida.",
  );
  await page
    .getByRole("article", { name: "Escena 1", exact: true })
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page
      .getByRole("article", { name: "Escena 1", exact: true })
      .getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Imagen de la escena 1")).toHaveValue(
    "Un primer plano con iluminación cálida.",
  );
  const data = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(["projects", "scenes", "assets"]);
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve) => {
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [projects, scenes, assets] = await Promise.all([
      read<Project>("projects"),
      read<Scene>("scenes"),
      read<{ id: string }>("assets"),
    ]);
    db.close();
    return {
      projects,
      scenes: scenes.map((s) => ({ id: s.id, size: s.video_blob?.size || 0 })),
      assets,
    };
  });
  expect(data.projects).toHaveLength(1);
  expect(data.projects[0].sequence_items).toEqual([
    { id: "item-0", scene_id: "clip-0", in: 0.2, out: 0.8, volume: 0.5 },
    { id: "item-3", scene_id: "clip-3", in: 0, out: 1, volume: 1 },
  ]);
  expect(data.scenes).toHaveLength(4);
  expect(data.scenes.filter((s) => s.size > 0)).toHaveLength(2);
  expect(data.assets.map((a) => a.id)).toContain("reference");
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.PROJECT_CAPTURE)
    await page.screenshot({
      path: "artifacts/project-types-production-mobile.png",
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await filter.getByRole("button", { name: "Listas 1", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Escena 1", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
});

test("legacy script drafts still open in the story workflow with their existing clips", async ({
  page,
}) => {
  await page.route(google, (r) => r.abort());
  await seedLegacy(page, true);
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "Este guion todavía no tiene una propuesta.",
  );
  await page.getByRole("button", { name: "Materiales", exact: true }).click();
  await expect(page.locator(".project-clip")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Guion y escenas", exact: true })
    .click();
  await expect(page.getByLabel("Guion completo", { exact: true })).toHaveValue(
    "Este guion todavía no tiene una propuesta.",
  );
});

test("an incomplete proposal identifies and focuses the exact missing scene field", async ({
  page,
}) => {
  await page.route(google, (route) => route.abort());
  await seedLegacy(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("vid-gen-studio");
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction("projects", "readwrite");
    const store = tx.objectStore("projects");
    const project = await new Promise<Project>((resolve) => {
      const request = store.get("legacy");
      request.onsuccess = () => resolve(request.result);
    });
    project.story = {
      ...project.story!,
      phase: "review",
      blocks: project.story!.blocks.map((block, index) => ({
        ...block,
        sceneIds: undefined,
        text: index === 1 ? "" : block.text,
        visual: index === 0 ? "" : block.visual,
      })),
    };
    store.put(project);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Hay 2 escenas incompletas. Empieza por la escena 1: añade la descripción visual.",
  );
  const firstVisual = page.getByLabel("Visual de la escena 1");
  await expect(firstVisual).toBeFocused();
  await expect(firstVisual).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Añade lo que se verá en esta escena.", { exact: true }),
  ).toBeVisible();
  await firstVisual.fill("Una planta iluminada por el sol.");
  await page
    .getByRole("button", { name: "Producir historia", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "La escena 2 está incompleta. Añade el texto.",
  );
  await expect(
    page.getByLabel("Texto de intervención 1 de la escena 2"),
  ).toBeFocused();
});
