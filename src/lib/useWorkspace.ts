import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "./storage";
import {
  prepareStory as prepareStoryContent,
  type StoryAction,
} from "./storyService";
import { getApiKey, getParallelism, saveParallelism } from "./settings";
import {
  buildOmniPayload,
  buildVeoPayload,
  errorMessage,
  generateVideo,
  TerminalGenerationError,
  GoogleRateLimitError,
  type ReferenceImage,
} from "./google";
import {
  activeVersion,
  OMNI_MODEL,
  sceneSettings,
  sceneBlob,
  type GenerationMode,
  type GenerationTask,
  type Scene,
  type ClipVersion,
  type QueuedGeneration,
} from "../types";

type Workspace = Awaited<ReturnType<typeof db.readWorkspace>>;
interface GenerationJob {
  sceneId: string;
  text: string;
  index: number;
  total: number;
}
function stableMedia(scene: Scene, previous?: Scene): Scene {
  if (!previous) return scene;
  return {
    ...scene,
    video_blob: previous.video_blob || scene.video_blob,
    versions: scene.versions?.map((version) => ({
      ...version,
      blob:
        previous.versions?.find((v) => v.id === version.id)?.blob ||
        version.blob,
    })),
  };
}
export function useWorkspace() {
  const [data, setData] = useState<Workspace>({
    projects: [],
    scenes: [],
    trash: [],
    assets: [],
    usage: [],
    narrations: [],
  });
  const [storyJob, setStoryJob] = useState<{
    projectId: string;
    text: string;
    stopping?: boolean;
  } | null>(null);
  const storyRunning = useRef(false);
  const storyStop = useRef(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [recoveries, setRecoveries] = useState<
    { sceneId: string; version: ClipVersion }[]
  >([]);
  const [parallelism, setParallelismState] = useState(getParallelism);
  const parallelismRef = useRef(parallelism);
  const draining = useRef(false);
  const wake = useRef<(() => void) | null>(null);
  const queueRef = useRef<QueuedGeneration[]>([]);
  const activeRequests = useRef(new Map<string, AbortController>());
  const [queue, setQueue] = useState<QueuedGeneration[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const paused = useRef(false);
  const admission = useRef<Promise<unknown>>(Promise.resolve());
  const publishQueue = () => setQueue([...queueRef.current]);
  function wakeScheduler() {
    const resolve = wake.current;
    wake.current = null;
    resolve?.();
  }
  function setParallelism(value: number) {
    try {
      saveParallelism(value);
      parallelismRef.current = value;
      setParallelismState(value);
      wakeScheduler();
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const refresh = useCallback(async () => {
    const value = await db.readWorkspace();
    setData((current) => ({
      ...value,
      scenes: value.scenes.map((scene) =>
        stableMedia(
          scene,
          current.scenes.find((s) => s.id === scene.id),
        ),
      ),
      narrations: value.narrations.map((n) => ({
        ...n,
        blob: current.narrations.find((p) => p.id === n.id)?.blob || n.blob,
      })),
    }));
    return value;
  }, []);
  useEffect(() => {
    let mounted = true;
    try {
      localStorage.removeItem("vidgen_elevenlabs_key");
    } catch {
      /* The retired provider's credential is no longer needed. */
    }
    const blocked = () =>
      notify(
        "Cierra las otras pestañas de Vidgen Studio para actualizar el almacenamiento. Tus proyectos se conservarán.",
        true,
      );
    const reload = () =>
      notify(
        "El almacenamiento se actualizó desde otra pestaña. Recarga esta página para continuar.",
        true,
      );
    window.addEventListener("vidgen-storage-blocked", blocked);
    window.addEventListener("vidgen-storage-reload", reload);
    if (db.storageIsBlocked()) blocked();
    void db
      .readWorkspace()
      .then((value) => {
        if (mounted) {
          setData(value);
          const pending = value.scenes
            .flatMap((s) => s.generation_queue || [])
            .sort(
              (a, b) =>
                Number(!!b.resume) - Number(!!a.resume) ||
                (a.queueOrder ?? Number.MAX_SAFE_INTEGER) -
                  (b.queueOrder ?? Number.MAX_SAFE_INTEGER) ||
                a.created_at.localeCompare(b.created_at),
            );
          queueRef.current = pending;
          setQueue(pending);
          paused.current = pending.length > 0;
          setQueuePaused(pending.length > 0);
        }
      })
      .catch((e) =>
        notify(
          `No se pudo abrir el almacenamiento local. ${errorMessage(e)}`,
          true,
        ),
      )
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      window.removeEventListener("vidgen-storage-blocked", blocked);
      window.removeEventListener("vidgen-storage-reload", reload);
    };
  }, [notify]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!jobs.length && !storyJob && !recoveries.length) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [jobs.length, storyJob, recoveries.length]);
  useEffect(
    () => () => {
      paused.current = true;
      for (const ctrl of activeRequests.current.values()) ctrl.abort();
      wakeScheduler();
    },
    [],
  );
  const action = useCallback(
    async (fn: () => Promise<unknown>, message?: string) => {
      try {
        await fn();
        await refresh();
        if (message) notify(message);
      } catch (e) {
        notify(errorMessage(e), true);
      }
    },
    [refresh, notify],
  );
  const patch = useCallback(async (id: string, changes: Partial<Scene>) => {
    const scene = await db.patchScene(id, changes);
    setData((current) => ({
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === id ? stableMedia(scene, s) : s,
      ),
    }));
    return scene;
  }, []);
  function run(
    ids: string[],
    mode: GenerationMode = "generate",
    instruction?: string,
    resume = false,
    count = 1,
    retry = false,
    replaceStory = false,
  ): Promise<boolean> {
    const enqueue = async () => {
      try {
        if (!getApiKey())
          throw new Error(
            "Conecta tu clave de Google en Ajustes antes de generar.",
          );
        if (!Number.isInteger(count) || count < 1 || count > 20)
          throw new Error("Elige entre 1 y 20 clips por solicitud.");
        const current = await db.readWorkspace();
        const items: QueuedGeneration[] = [];
        const batchId = crypto.randomUUID();
        for (const id of new Set(ids)) {
          const scene = current.scenes.find((s) => s.id === id);
          if (!scene) throw new Error("El clip ya no está disponible.");
          if (
            replaceStory &&
            (!scene.story?.planned ||
              count !== 1 ||
              scene.generation_queue?.length ||
              activeRequests.current.has(id))
          )
            throw new Error(
              "Esta escena no está preparada o ya se está generando.",
            );
          if (
            resume &&
            (activeRequests.current.has(id) ||
              queueRef.current.some((q) => q.sceneId === id && q.resume))
          )
            throw new Error("Este resultado ya se está recuperando.");
          if (resume && !scene.task?.remoteId)
            throw new Error("No hay un identificador que recuperar.");
          if (
            !resume &&
            scene.task?.remoteId &&
            !activeRequests.current.has(id)
          )
            throw new Error(
              "Recupera el resultado pendiente de este clip antes de generar de nuevo.",
            );
          if (
            retry &&
            (!scene.output_request ||
              sceneBlob(scene) ||
              scene.generation_queue?.length ||
              activeRequests.current.has(id))
          )
            throw new Error(
              "Este clip no tiene una solicitud fallida que reintentar.",
            );
          const selected = activeVersion(scene);
          const task: GenerationTask = resume
            ? scene.task!
            : retry
              ? { ...scene.output_request!.task, remoteId: undefined }
              : {
                  prompt:
                    mode === "generate" ? scene.prompt : instruction || "",
                  settings:
                    mode === "generate"
                      ? sceneSettings(scene)
                      : selected?.settings || sceneSettings(scene),
                  mode,
                  previousInteractionId:
                    mode === "generate" ? undefined : selected?.interactionId,
                  previousDuration: selected?.duration,
                  started_at: new Date().toISOString(),
                };
          const images: ReferenceImage[] = retry
            ? scene.output_request!.images
            : [];
          if (mode === "generate" && !resume && !retry) {
            const roles = [
              [scene.first_frame_asset_id, "first"],
              [scene.last_frame_asset_id, "last"],
              ...(scene.reference_asset_ids || []).map((id) => [
                id,
                "reference",
              ]),
            ] as [string | undefined, ReferenceImage["role"]][];
            for (const [assetId, role] of roles) {
              if (!assetId) continue;
              const match = current.assets
                .find((a) => a.id === assetId)
                ?.data_url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
              if (!match)
                throw new Error(
                  "Falta una referencia válida. Selecciónala de nuevo antes de generar.",
                );
              images.push({ mimeType: match[1], data: match[2], role });
            }
          }
          if (!resume)
            (task.settings.model === OMNI_MODEL
              ? buildOmniPayload
              : buildVeoPayload)(task, images);
          const total = resume ? 1 : count;
          for (let index = 1; index <= total; index++)
            items.push({
              id: crypto.randomUUID(),
              batchId,
              sceneId: id,
              task: { ...task },
              images,
              index,
              total,
              created_at: new Date().toISOString(),
              resume,
            });
        }
        if (!items.length) return false;
        let outputs = items;
        if (resume || retry || replaceStory) await db.enqueueGenerations(items);
        else outputs = await db.enqueueClipOutputs(items);
        queueRef.current = resume
          ? [...outputs, ...queueRef.current]
          : [...queueRef.current, ...outputs];
        publishQueue();
        await refresh();
        setNotice(null);
        if (
          resume ||
          (retry &&
            !queueRef.current.some((q) => !outputs.some((o) => o.id === q.id)))
        ) {
          paused.current = false;
          setQueuePaused(false);
        }
        if (!paused.current) void drain();
        return true;
      } catch (e) {
        notify(errorMessage(e), true);
        return false;
      }
    };
    const accepted = admission.current.then(enqueue);
    admission.current = accepted;
    return accepted;
  }
  async function drain() {
    if (draining.current) {
      wakeScheduler();
      return;
    }
    if (paused.current || !queueRef.current.length) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      notify("Conecta Google para continuar la cola.", true);
      return;
    }
    draining.current = true;
    async function processItem(item: QueuedGeneration, ctrl: AbortController) {
      const id = item.sceneId;
      let task: GenerationTask = item.task;
      try {
        const scene = await db.getScene(id);
        if (!scene || scene.deleted_at) {
          queueRef.current = queueRef.current.filter((q) => q.id !== item.id);
          publishQueue();
          return;
        }
        if (!item.resume && scene.task?.remoteId)
          throw new Error(
            "Recupera el resultado pendiente antes de continuar este clip.",
          );
        // A pause before claiming leaves this entry in the persistent queue.
        if (ctrl.signal.aborted) return;
        const claimed = await db.startQueuedGeneration(item);
        queueRef.current = queueRef.current.filter((q) => q.id !== item.id);
        publishQueue();
        if (!claimed) return;
        await refresh();
        const result = await generateVideo({
          apiKey,
          task,
          images: item.images,
          signal: ctrl.signal,
          onProgress: (text) =>
            setJobs((current) =>
              current.map((j) => (j.sceneId === id ? { ...j, text } : j)),
            ),
          onRemoteId: async (remoteId) => {
            task = { ...task, remoteId };
            await patch(id, { task });
          },
        });
        const version: ClipVersion = {
          id: crypto.randomUUID(),
          blob: result.blob,
          prompt: task.prompt,
          settings: task.settings,
          mode: task.mode,
          interactionId: result.interactionId,
          duration:
            task.mode === "extend"
              ? (task.previousDuration || 0) + 10
              : task.mode === "edit"
                ? task.previousDuration || task.settings.duration
                : task.settings.duration,
          created_at: new Date().toISOString(),
        };
        try {
          await db.saveVersion(id, version);
        } catch {
          // Parallel completions must never overwrite another unsaved result.
          setRecoveries((current) => [...current, { sceneId: id, version }]);
          throw new Error(
            "El vídeo se generó, pero no cabe en el almacenamiento local. Descárgalo desde el aviso antes de cerrar la pestaña.",
          );
        }
        await refresh();
      } catch (e) {
        // Stop admissions immediately, before awaiting storage. Other requests
        // already sent keep running and retain their own results/remote IDs.
        paused.current = true;
        setQueuePaused(true);
        if (e instanceof GoogleRateLimitError) {
          parallelismRef.current = 1;
          setParallelismState(1);
          try {
            saveParallelism(1);
          } catch {
            /* Keep the reduction for this session. */
          }
        }
        const message = errorMessage(e);
        await patch(id, {
          status:
            e instanceof TerminalGenerationError
              ? "failed"
              : ctrl.signal.aborted || task.remoteId
                ? "paused"
                : "failed",
          ...(e instanceof TerminalGenerationError ? { task: undefined } : {}),
          error: message,
        }).catch(() => undefined);
        notify(
          e instanceof GoogleRateLimitError
            ? `${message} La cola está pausada; al continuar se enviará un vídeo a la vez.`
            : message,
          true,
        );
      } finally {
        activeRequests.current.delete(id);
        setJobs((current) => current.filter((j) => j.sceneId !== id));
        wakeScheduler();
      }
    }
    async function processQueue() {
      while (true) {
        // Register before async admissions/claims so a new item, preference
        // change or completion cannot get lost between scheduling passes.
        const changed = new Promise<void>((resolve) => {
          wake.current = resolve;
        });
        await admission.current;
        while (
          !paused.current &&
          activeRequests.current.size < parallelismRef.current
        ) {
          // Requests for the same scene stay serial, including legacy queues.
          const item = queueRef.current.find(
            (q) => !activeRequests.current.has(q.sceneId),
          );
          if (!item) break;
          const ctrl = new AbortController();
          activeRequests.current.set(item.sceneId, ctrl);
          setJobs((current) => [
            ...current,
            {
              sceneId: item.sceneId,
              text: item.resume
                ? "Recuperando resultado…"
                : "Preparando generación…",
              index: item.index,
              total: item.total,
            },
          ]);
          void processItem(item, ctrl);
        }
        if (!activeRequests.current.size) break;
        await changed;
      }
    }
    try {
      if (navigator.locks)
        await navigator.locks.request(
          "vidgen-generation",
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error("Ya hay una generación activa en otra pestaña.");
            await processQueue();
          },
        );
      else await processQueue();
    } catch (e) {
      paused.current = true;
      setQueuePaused(true);
      notify(errorMessage(e), true);
    } finally {
      draining.current = false;
      wake.current = null;
      // Covers an enqueue arriving while the cross-tab lock is being released.
      if (!paused.current && queueRef.current.length) void drain();
    }
  }
  function manageQueue(cancelIds: string[] = [], prioritizeId?: string) {
    const update = async () => {
      const cancelled = new Set(cancelIds);
      const remaining = queueRef.current.filter((q) => !cancelled.has(q.id));
      const ordered = prioritizeId
        ? [
            ...remaining.filter((q) => q.id === prioritizeId),
            ...remaining.filter((q) => q.id !== prioritizeId),
          ]
        : remaining;
      await db.updateQueuedOrder(
        ordered.map((q) => q.id),
        cancelIds,
      );
      const rank = new Map(ordered.map((q, index) => [q.id, index]));
      queueRef.current = queueRef.current
        .filter((q) => !cancelled.has(q.id))
        .map((q) => ({ ...q, queueOrder: rank.get(q.id) ?? q.queueOrder }))
        .sort(
          (a, b) =>
            (a.queueOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.queueOrder ?? Number.MAX_SAFE_INTEGER),
        );
      publishQueue();
      await refresh();
      wakeScheduler();
    };
    const result = admission.current
      .then(update)
      .catch((e) => notify(errorMessage(e), true));
    admission.current = result;
    return result;
  }
  async function prepareStory(
    projectId: string,
    action: StoryAction = "produce",
    referenceId?: string,
  ) {
    if (storyRunning.current) return;
    storyRunning.current = true;
    storyStop.current = false;
    setStoryJob({ projectId, text: "Preparando historia…" });
    const process = async () => {
      await prepareStoryContent(
        projectId,
        async (text) => {
          setStoryJob({ projectId, text, stopping: storyStop.current });
          await refresh();
        },
        () => storyStop.current,
        action,
        referenceId,
      );
    };
    try {
      if (navigator.locks)
        await navigator.locks.request(
          `vidgen-story-${projectId}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error(
                "Esta historia se está preparando en otra pestaña.",
              );
            await process();
          },
        );
      else await process();
      if (action === "produce" && !storyStop.current) {
        const latest = await db.readWorkspace();
        const story = latest.projects.find((p) => p.id === projectId)?.story;
        const ids = latest.scenes
          .filter(
            (s) =>
              s.story?.storyId === story?.id &&
              s.story?.planned &&
              !sceneBlob(s) &&
              !s.task?.remoteId &&
              !s.generation_queue?.length &&
              !activeRequests.current.has(s.id),
          )
          .map((s) => s.id);
        if (
          ids.length &&
          !(await run(ids, "generate", undefined, false, 1, false, true))
        )
          return;
      }
      notify(
        storyStop.current
          ? "Preparación pausada. Lo que ya se creó está guardado."
          : action === "plan"
            ? "Propuesta lista. Puedes editarla antes de producir."
            : action === "references"
              ? "Referencias guardadas."
              : "Escenas preparadas y vídeos añadidos a la cola.",
      );
    } catch (e) {
      const message = errorMessage(e);
      await db.setStoryError(projectId, message).catch(() => {});
      if (action === "produce") {
        const latest = (await db.readWorkspace()).projects.find(
          (p) => p.id === projectId,
        )?.story;
        if (
          latest?.phase === "production" &&
          latest.blocks.every((b) => !b.sceneIds)
        )
          await db
            .saveStoryState(projectId, { ...latest, phase: "review" })
            .catch(() => {});
      }
      notify(message, true);
    } finally {
      try {
        await refresh();
      } finally {
        storyRunning.current = false;
        setStoryJob(null);
      }
    }
  }
  function pauseStory() {
    storyStop.current = true;
    setStoryJob((job) => (job ? { ...job, stopping: true } : job));
  }
  return {
    ...data,
    loading,
    storyJob,
    prepareStory,
    pauseStory,
    runStory: (ids: string[]) =>
      run(ids, "generate", undefined, false, 1, false, true),
    notice,
    setNotice,
    jobs,
    jobFor: (sceneId: string) => jobs.find((j) => j.sceneId === sceneId),
    parallelism,
    setParallelism,
    prioritize: (id: string) => manageQueue([], id),
    cancelRequests: (ids: string[]) => manageQueue(ids),
    queue,
    queuePaused,
    recoveries,
    refresh,
    notify,
    action,
    patch,
    run,
    retry: (sceneId: string) =>
      run([sceneId], "generate", undefined, false, 1, true),
    pause: () => {
      paused.current = true;
      setQueuePaused(true);
      for (const ctrl of activeRequests.current.values()) ctrl.abort();
      wakeScheduler();
    },
    continueQueue: () => {
      paused.current = false;
      setQueuePaused(false);
      void drain();
    },
    cancelQueued: (sceneId: string) =>
      manageQueue(
        queueRef.current.filter((q) => q.sceneId === sceneId).map((q) => q.id),
      ),
  };
}
export type WorkspaceController = ReturnType<typeof useWorkspace>;
