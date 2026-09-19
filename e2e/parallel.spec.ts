import {
  test,
  expect,
  type Page,
  type Route,
  type BrowserContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_VIDEO,
  OMNI_MODEL,
  type Scene,
  type Project,
} from "../src/types";
const google = "**/generativelanguage.googleapis.com/**";
const video = readFileSync(
  new URL("./fixtures/silent.mp4", import.meta.url),
).toString("base64");
const completed = (id: string) => ({
  id,
  status: "completed",
  output_video: { data: video, mime_type: "video/mp4" },
});

// Isolated test data: prepared scenes keep this suite focused on video scheduling.
async function story(page: Page, count: number) {
  await page.addInitScript(() =>
    localStorage.setItem("vid_gen_api_key", "test-parallel-key"),
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
  await page.evaluate(
    async ({ count, settings }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("vid-gen-studio");
        r.onsuccess = () => resolve(r.result);
      });
      const tx = db.transaction(["projects", "scenes"], "readwrite");
      const r = tx.objectStore("projects").getAll();
      r.onsuccess = () => {
        const project = r.result[0] as Project;
        project.name = "Historia en paralelo";
        const scenes: Scene[] = Array.from({ length: count }, (_, i) => ({
          id: `shot-${i + 1}`,
          project_id: project.id,
          order: i,
          title: `Escena ${i + 1}`,
          prompt: `Escena ${i + 1}: una planta recibe luz.`,
          status: "pending",
          settings,
          created_at: `2026-09-18T00:00:0${i}Z`,
          updated_at: "2026-09-18T00:00:00Z",
          story: {
            storyId: "story",
            blockId: `block-${i + 1}`,
            text: "La planta recibe luz.",
            speaker: "Ana",
            visual: "Una planta recibe luz.",
            planned: true,
          },
        }));
        project.story = {
          id: "story",
          script: scenes.map((s) => s.story!.text).join(" "),
          mode: "spoken",
          style: "explainer",
          phase: "production",
          revision: 1,
          direction: "Explicación visual",
          voiceId: "Kore",
          voiceName: "Kore",
          settings,
          characters: [
            { name: "Ana", description: "Presentadora", voice: "Cálida" },
          ],
          blocks: scenes.map((s) => ({
            id: s.story!.blockId,
            text: s.story!.text,
            title: s.title,
            visual: s.story!.visual,
            speaker: "Ana",
            sceneIds: [s.id],
          })),
        };
        project.sequence_ids = scenes.map((s) => s.id);
        project.sequence_items = scenes.map((s) => ({
          id: `sequence-${s.id}`,
          scene_id: s.id,
          follow_active: true,
          in: 0,
          out: 8,
          volume: 1,
        }));
        tx.objectStore("projects").put(project);
        for (const scene of scenes) tx.objectStore("scenes").put(scene);
      };
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { count, settings: DEFAULT_VIDEO },
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Guion y escenas", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Escena 1", exact: true }),
  ).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(["scenes", "projects"]);
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve) => {
        const r = tx.objectStore(store).getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [scenes, projects] = await Promise.all([
      read<Scene>("scenes"),
      read<Project>("projects"),
    ]);
    db.close();
    return { scenes: scenes.sort((a, b) => a.order - b.order), projects };
  });
}
async function gate(context: BrowserContext) {
  const routes = new Map<number, Route>();
  const calls: number[] = [];
  let active = 0,
    peak = 0;
  await context.route(google, async (route) => {
    expect(route.request().method()).toBe("POST");
    const body = route.request().postDataJSON();
    expect(body.model).toBe(OMNI_MODEL);
    const number = Number(body.input.match(/Escena (\d+)/)[1]);
    expect(routes.has(number)).toBe(false);
    routes.set(number, route);
    calls.push(number);
    peak = Math.max(peak, ++active);
  });
  return {
    calls,
    routes,
    peak: () => peak,
    async finish(number: number, quota = false) {
      const route = routes.get(number)!;
      expect(route).toBeDefined();
      active--;
      await route.fulfill(
        quota
          ? {
              status: 429,
              json: { error: { message: "RESOURCE_EXHAUSTED: rate limit" } },
            }
          : { json: completed(`op-${number}`) },
      );
    },
  };
}
const generate = (page: Page) =>
  page.getByRole("button", { name: /Generar pendientes ·/ }).click();
const scene = (page: Page, n: number) =>
  page.getByRole("article", { name: `Escena ${n}`, exact: true });

test("default parallel story fills three slots, shows every job and saves out-of-order results in the right scene", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await story(page, 6);
  const before = await stored(page);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  expect(new Set(api.calls)).toEqual(new Set([1, 2, 3]));
  await expect(page.locator(".job-bar")).toContainText("3 vídeos en curso");
  await expect(page.locator(".job-bar")).toContainText("3 en espera");
  for (const n of [1, 2, 3]) {
    await expect(scene(page, n)).toContainText("Enviando a Google");
    await expect(
      scene(page, n).getByRole("button", {
        name: `Eliminar escena ${n}`,
        exact: true,
      }),
    ).toBeDisabled();
  }
  await page
    .getByRole("button", { name: "Ver actividad", exact: true })
    .click();
  const activity = page.getByRole("dialog", { name: "Actividad", exact: true });
  await expect(
    activity.getByRole("heading", { name: "En curso · 3" }),
  ).toBeVisible();
  await expect(activity.locator(".activity-current")).toHaveCount(3);
  if (process.env.PARALLEL_CAPTURE) {
    await page.screenshot({
      path: "artifacts/parallel-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "artifacts/parallel-mobile.png",
      fullPage: true,
    });
    expect(
      await activity.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Cerrar actividad", exact: true })
    .click();
  await api.finish(3);
  await expect.poll(() => api.calls.length).toBe(4);
  await api.finish(2);
  await expect.poll(() => api.calls.length).toBe(5);
  await api.finish(4);
  await expect.poll(() => api.calls.length).toBe(6);
  for (const n of [6, 1, 5]) await api.finish(n);
  await expect(page.locator(".job-bar")).toHaveCount(0);
  expect(api.peak()).toBe(3);
  const after = await stored(page);
  expect(after.projects[0].sequence_items).toEqual(
    before.projects[0].sequence_items,
  );
  expect(after.projects[0].story).toEqual(before.projects[0].story);
  expect(after.scenes).toHaveLength(6);
  for (const [i, s] of after.scenes.entries()) {
    expect(s.versions).toHaveLength(1);
    expect(s.versions![0].interactionId).toBe(`op-${i + 1}`);
    expect(s.versions![0].prompt).toBe(before.scenes[i].prompt);
    expect(s.story).toEqual(before.scenes[i].story);
    expect(s.status).toBe("completed");
  }
});

test("enqueueing more scenes wakes an idle slot without waiting for the active video", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await story(page, 3);
  await scene(page, 1)
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect.poll(() => api.calls.length).toBe(1);
  await scene(page, 2)
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect.poll(() => api.calls.length).toBe(2);
  await scene(page, 3)
    .getByRole("button", { name: "Generar escena", exact: true })
    .click();
  await expect.poll(() => api.calls.length).toBe(3);
  for (const n of [1, 2, 3]) await api.finish(n);
  await expect(page.locator(".job-bar")).toHaveCount(0);
});

test("quota stops new admissions, preserves other in-flight videos and resumes with one slot", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await story(page, 5);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  await api.finish(2, true);
  await expect(scene(page, 2)).toContainText("Has alcanzado la cuota");
  await expect(page.locator(".job-bar")).toContainText("Cola pausada");
  for (const n of [1, 3]) await api.finish(n);
  await expect(page.locator(".job-bar")).toContainText("2 en espera");
  await expect(
    page.getByRole("button", { name: "Continuar cola", exact: true }),
  ).toBeVisible();
  expect(api.calls).toHaveLength(3);
  expect(
    await page.evaluate(() => localStorage.getItem("vidgen_parallelism")),
  ).toBe("1");
  await page
    .getByRole("button", { name: "Continuar cola", exact: true })
    .click();
  await expect.poll(() => api.calls.length).toBe(4);
  await expect(page.locator(".job-bar")).toContainText("1 en espera");
  await api.finish(4);
  await expect.poll(() => api.calls.length).toBe(5);
  await api.finish(5);
  await expect(page.locator(".job-bar")).toHaveCount(0);
  expect(api.calls.filter((n) => n === 2)).toHaveLength(1);
  const data = await stored(page);
  expect(data.scenes.filter((s) => s.versions?.length)).toHaveLength(4);
});

test("pause and reload recover all remote IDs without duplicate POSTs and then finish the pending scenes", async ({
  page,
  context,
}) => {
  const posts: number[] = [],
    gets: string[] = [];
  let ready = false;
  await context.route(google, async (route) => {
    if (route.request().method() === "POST") {
      const n = Number(
        route
          .request()
          .postDataJSON()
          .input.match(/Escena (\d+)/)[1],
      );
      posts.push(n);
      return route.fulfill({
        json: ready
          ? completed(`op-${n}`)
          : { id: `op-${n}`, status: "in_progress" },
      });
    }
    const id = route.request().url().split("/").at(-1)!;
    gets.push(id);
    return route.fulfill({
      json: ready ? completed(id) : { id, status: "in_progress" },
    });
  });
  await story(page, 5);
  await generate(page);
  await expect
    .poll(
      async () =>
        (await stored(page)).scenes.filter((s) => s.task?.remoteId).length,
    )
    .toBe(3);
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
  expect(posts).toHaveLength(3);
  ready = true;
  await page
    .getByRole("button", { name: "Ver actividad", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar 3 resultados", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await stored(page)).scenes.filter((s) => s.versions?.length).length,
    )
    .toBe(5);
  expect(new Set(posts)).toEqual(new Set([1, 2, 3, 4, 5]));
  expect(posts).toHaveLength(5);
  for (const n of [1, 2, 3]) expect(gets).toContain(`op-${n}`);
  expect(
    (await stored(page)).scenes.every(
      (s) => s.versions?.length === 1 && !s.task && !s.generation_queue?.length,
    ),
  ).toBe(true);
});

test("priority and cancellation affect only the waiting scenes in a parallel batch", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await story(page, 7);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  await page
    .getByRole("button", { name: "Ver actividad", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generar antes: Escena 7", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar solicitud: Escena 5", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Cancelar solicitud: Escena 5",
      exact: true,
    }),
  ).toHaveCount(0);
  await api.finish(1);
  await expect.poll(() => api.calls.length).toBe(4);
  expect(api.calls[3]).toBe(7);
  await api.finish(2);
  await expect.poll(() => api.calls.length).toBe(5);
  await api.finish(3);
  await expect.poll(() => api.calls.length).toBe(6);
  for (const n of [7, 4, 6]) await api.finish(n);
  await expect(page.locator(".job-bar")).toHaveCount(0);
  expect(api.calls).not.toContain(5);
});

test("a second tab cannot duplicate active or already claimed requests", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await story(page, 5);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  const other = await context.newPage();
  await other.goto(page.url());
  await other
    .getByRole("button", { name: "Continuar cola", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText("otra pestaña");
  expect(api.calls).toHaveLength(3);
  await api.finish(1);
  await expect.poll(() => api.calls.length).toBe(4);
  await api.finish(2);
  await expect.poll(() => api.calls.length).toBe(5);
  for (const n of [3, 4, 5]) await api.finish(n);
  await expect(page.locator(".job-bar")).toHaveCount(0);
  await other
    .getByRole("button", { name: "Continuar cola", exact: true })
    .click();
  await expect(other.locator(".job-bar")).toHaveCount(0);
  expect(api.calls).toHaveLength(5);
});

test("increasing parallelism wakes slots and lowering it lets current videos finish", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await story(page, 5);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await page.getByLabel("Vídeos simultáneos").selectOption("4");
  await expect.poll(() => api.calls.length).toBe(4);
  await page.getByLabel("Vídeos simultáneos").selectOption("1");
  for (const n of [1, 2, 3]) await api.finish(n);
  await expect(page.locator(".job-bar")).toContainText("Escena 4");
  expect(api.calls).toHaveLength(4);
  await api.finish(4);
  await expect.poll(() => api.calls.length).toBe(5);
  await api.finish(5);
  await expect(page.locator(".job-bar")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Vídeos simultáneos")).toHaveValue("1");
});

test("parallel storage failures keep every completed video available for download", async ({
  page,
  context,
}) => {
  const api = await gate(context);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (
        this.name === "scenes" &&
        (value as { versions?: unknown[] }).versions?.length
      )
        throw new DOMException("Simulated full storage", "QuotaExceededError");
      return original.call(this, value, key);
    };
  });
  await story(page, 3);
  await generate(page);
  await expect.poll(() => api.calls.length).toBe(3);
  for (const n of [1, 2, 3]) await api.finish(n);
  const banner = page.locator(".recovery-banner");
  await expect(banner).toContainText("Hay 3 vídeos listos");
  await expect(banner.getByRole("button")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await banner.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  for (const n of [1, 2, 3]) {
    const download = page.waitForEvent("download");
    await banner
      .getByRole("button", { name: `Descargar Escena ${n}`, exact: true })
      .click();
    expect(await (await download).failure()).toBeNull();
  }
});

test("legacy requests on the same scene remain sequential while other scenes run in parallel", async ({
  page,
  context,
}) => {
  const calls: string[] = [];
  const routes = new Map<string, Route>();
  await context.route(google, (route) => {
    const prompt = route.request().postDataJSON().input as string;
    calls.push(prompt);
    routes.set(prompt, route);
  });
  await story(page, 2);
  await page.evaluate(async (settings) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("vid-gen-studio");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction("scenes", "readwrite");
    const r = tx.objectStore("scenes").getAll();
    r.onsuccess = () => {
      for (const scene of r.result as Scene[]) {
        scene.generation_queue = (
          scene.id === "shot-1" ? ["A1", "A2", "A3"] : ["B"]
        ).map((prompt, index) => ({
          id: prompt,
          sceneId: scene.id,
          task: { prompt, settings, mode: "generate", started_at: "now" },
          images: [],
          index: index + 1,
          total: 3,
          created_at: "2026-09-18T00:00:00Z",
          queueOrder: scene.id === "shot-1" ? index : 3,
        }));
        tx.objectStore("scenes").put(scene);
      }
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, DEFAULT_VIDEO);
  await page.reload();
  await page
    .getByRole("button", { name: "Continuar cola", exact: true })
    .click();
  await expect.poll(() => calls.length).toBe(2);
  expect(new Set(calls)).toEqual(new Set(["A1", "B"]));
  await routes.get("A1")!.fulfill({ json: completed("A1") });
  await expect.poll(() => calls.length).toBe(3);
  expect(calls[2]).toBe("A2");
  await routes.get("A2")!.fulfill({ json: completed("A2") });
  await expect.poll(() => calls.length).toBe(4);
  expect(calls[3]).toBe("A3");
  await routes.get("A3")!.fulfill({ json: completed("A3") });
  await routes.get("B")!.fulfill({ json: completed("B") });
  await expect(page.locator(".job-bar")).toHaveCount(0);
  const data = await stored(page);
  expect(data.scenes[0].versions?.map((v) => v.interactionId)).toEqual([
    "A1",
    "A2",
    "A3",
  ]);
  expect(data.scenes[1].versions?.map((v) => v.interactionId)).toEqual(["B"]);
});
