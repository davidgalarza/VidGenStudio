import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Film,
  Frame,
  History,
  LoaderCircle,
  Play,
  RotateCcw,
  Trash2,
  WandSparkles,
} from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { getApiKey } from "../lib/settings";
import { VideoDownloadDialog, type VideoDownload } from "./VideoDownloadDialog";
import {
  activeVersion,
  sceneBlob,
  sceneSettings,
  sequenceScenes,
  OMNI_MODEL,
  type Asset,
  type GenerationMode,
  type Project,
  type Scene,
} from "../types";
import { VideoReferences } from "./VideoReferences";
import { PromptReview } from "./PromptReview";
import { storyPrompt } from "../lib/story";
import { AddButton, Clip, Empty, IconButton, VideoControls } from "./common";

export function Editor({
  project,
  workspace: w,
  settings,
  initialSceneId = "",
  sequenceMode = false,
  browseClips,
  clipOnly = false,
  onGenerationQueued,
  openClip,
}: {
  project: Project;
  workspace: WorkspaceController;
  settings: () => void;
  initialSceneId?: string;
  sequenceMode?: boolean;
  browseClips: () => void;
  clipOnly?: boolean;
  onGenerationQueued?: () => void;
  openClip?: (id: string) => void;
}) {
  const allScenes = w.scenes.filter((s) => s.project_id === project.id);
  const scenes = sequenceMode ? sequenceScenes(project, allScenes) : allScenes;
  const [selectedId, setSelectedId] = useState(
    initialSceneId || scenes[0]?.id || "",
  );
  const [safe, setSafe] = useState(false);
  const [download, setDownload] = useState<VideoDownload>();
  const scene = scenes.find((s) => s.id === selectedId) || scenes[0];
  const ready = scenes.filter((s) => sceneBlob(s));
  const pending = scenes.filter(
    (s) =>
      !sceneBlob(s) &&
      s.prompt.trim() &&
      !s.task?.remoteId &&
      !w.queue.some((q) => q.sceneId === s.id) &&
      !w.jobFor(s.id),
  );
  const version = scene ? activeVersion(scene) : undefined;
  const config = scene ? version?.settings || sceneSettings(scene) : undefined;
  const total = scenes.reduce(
    (sum, s) => sum + (activeVersion(s)?.duration || sceneSettings(s).duration),
    0,
  );
  const busy = w.jobs.length > 0;
  const add = () =>
    w.action(async () => {
      const added = await db.addScene(
        project.id,
        scene
          ? sceneSettings(scene)
          : {
              model: OMNI_MODEL,
              aspectRatio: "9:16",
              resolution: "720p",
              duration: 8,
            },
      );
      setSelectedId(added.id);
    });
  const move = (offset: number) => {
    if (!scene) return;
    const ids = scenes.map((s) => s.id),
      from = ids.indexOf(scene.id),
      to = from + offset;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void w.action(() => db.saveSequence(project.id, ids));
  };
  const exportVideo = async () => {
    if (!ready.length) return;
    if (
      ready.length < scenes.length &&
      !window.confirm(
        `Hay ${scenes.length - ready.length} escenas sin vídeo. ¿Exportar solo las ${ready.length} escenas listas?`,
      )
    )
      return;
    setDownload({
      blobs: ready.map((s) => sceneBlob(s)!),
      filename: `${project.name}.mp4`,
      title: project.name,
      aspect:
        activeVersion(ready[0])?.settings.aspectRatio ||
        sceneSettings(ready[0]).aspectRatio,
    });
  };
  return (
    <div className="editor">
      {!clipOnly && (
        <div className="editor-top">
          <div className="project-title">
            <input
              key={project.id}
              defaultValue={project.name}
              aria-label="Nombre del proyecto"
              maxLength={80}
              onBlur={(e) => {
                if (!e.target.value.trim()) e.target.value = project.name;
                else
                  void w.action(() =>
                    db.renameProject(project.id, e.target.value),
                  );
              }}
            />
            <span>
              <Check size={12} />
              Guardado en este navegador
            </span>
          </div>
          <div className="inline">
            <button
              className="button compact"
              disabled={!pending.length}
              onClick={() => void w.run(pending.map((s) => s.id))}
            >
              <Play size={14} />
              Generar pendientes
              {pending.length > 0 && (
                <span className="count">{pending.length}</span>
              )}
            </button>
            {sequenceMode && (
              <button
                className="button primary compact"
                disabled={!ready.length || busy}
                onClick={() => void exportVideo()}
              >
                <Download size={15} />
                <span>Exportar vídeo</span>
              </button>
            )}
          </div>
        </div>
      )}
      {scene ? (
        <div className="editor-body">
          <div className="preview-column">
            <div className="preview-heading">
              <span>
                <Film size={14} />
                Vista previa{" "}
                <span className="subtle">
                  / {scene.title || `Escena ${scene.order + 1}`}
                </span>
              </span>
              <button
                className={`text-button ${safe ? "selected-text" : ""}`}
                onClick={() => setSafe(!safe)}
                aria-pressed={safe}
              >
                <Frame size={15} />
                Zona segura
              </button>
            </div>
            <div className="stage">
              <div
                className={`preview-frame ${config?.aspectRatio === "16:9" ? "landscape" : "portrait"}`}
              >
                {sceneBlob(scene) ? (
                  <Clip blob={sceneBlob(scene)} />
                ) : w.assets.find(
                    (a) => a.id === scene.first_frame_asset_id,
                  ) ? (
                  <img
                    src={
                      w.assets.find((a) => a.id === scene.first_frame_asset_id)!
                        .data_url
                    }
                    alt="Fotograma inicial"
                  />
                ) : (
                  <div className="preview-empty">
                    <div className="frame-corners">
                      <Film size={28} strokeWidth={1.2} />
                    </div>
                    <strong>
                      Aquí empieza
                      <br />
                      tu próxima escena.
                    </strong>
                    <p>Describe la toma y dale vida.</p>
                    <span>
                      {sceneSettings(scene).aspectRatio} ·{" "}
                      {sceneSettings(scene).duration} s
                    </span>
                  </div>
                )}
                {safe && (
                  <div className="safe-zone">
                    <span>Mantén aquí lo importante</span>
                  </div>
                )}
                {!!w.jobFor(scene.id) && (
                  <div className="render-overlay">
                    <LoaderCircle className="spin" size={24} />
                    <strong>{w.jobFor(scene.id)!.text}</strong>
                    <span>Puedes seguir revisando tus escenas.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="preview-meta">
              <span>
                {version
                  ? scene.versions!.length > 1
                    ? `Resultado ${scene.versions!.findIndex((v) => v.id === version.id) + 1}`
                    : "Clip listo"
                  : sceneBlob(scene)
                    ? "Vídeo original"
                    : "Sin generar"}
                <i />
                {config?.resolution}
                <i />
                {version?.duration || config?.duration} s
              </span>
              <button
                className="text-button"
                disabled={!sceneBlob(scene)}
                onClick={() =>
                  setDownload({
                    blobs: [sceneBlob(scene)!],
                    filename: `${project.name}-${scene.title || scene.order + 1}.mp4`,
                    title: scene.title || "Clip",
                  })
                }
              >
                <Download size={14} />
                Descargar clip
              </button>
            </div>
            {!clipOnly && (
              <div className="storyboard">
                <div className="section-heading">
                  <div>
                    <h2>
                      {sequenceMode ? "Tu secuencia" : "Clips del proyecto"}{" "}
                      <span className="count">{scenes.length}</span>
                    </h2>
                    <span>
                      {sequenceMode ? `${total} s` : `${scenes.length} clips`}{" "}
                      {sequenceMode
                        ? ready.length < scenes.length
                          ? "previstos"
                          : "de secuencia"
                        : ""}{" "}
                      · {ready.length} escenas listas
                    </span>
                  </div>
                  <AddButton
                    onClick={sequenceMode ? browseClips : () => void add()}
                  >
                    {sequenceMode ? "Elegir clips" : "Añadir escena"}
                  </AddButton>
                </div>
                <div className="scene-strip" aria-label="Escenas del proyecto">
                  {scenes.map((s, i) => (
                    <button
                      key={s.id}
                      className={`scene-card ${scene.id === s.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(s.id)}
                      aria-pressed={scene.id === s.id}
                    >
                      <div className="scene-thumb">
                        {sceneBlob(s) ? (
                          <Clip blob={sceneBlob(s)} controls={false} />
                        ) : w.assets.find(
                            (a) => a.id === s.first_frame_asset_id,
                          ) ? (
                          <img
                            src={
                              w.assets.find(
                                (a) => a.id === s.first_frame_asset_id,
                              )!.data_url
                            }
                            alt=""
                          />
                        ) : (
                          <span className="scene-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        )}
                        <span className="scene-duration">
                          {activeVersion(s)?.duration ||
                            sceneSettings(s).duration}
                          s
                        </span>
                        {!!w.jobFor(s.id) && (
                          <LoaderCircle
                            className="spin scene-processing"
                            size={18}
                          />
                        )}
                      </div>
                      <div className="scene-caption">
                        <strong>{s.title || `Escena ${i + 1}`}</strong>
                        <small
                          className={
                            s.error
                              ? "warning-text"
                              : sceneBlob(s)
                                ? "success-text"
                                : ""
                          }
                        >
                          {s.error
                            ? "Revisar"
                            : sceneBlob(s)
                              ? "Lista"
                              : "Borrador"}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="scene-actions">
                  <span>
                    Escena {scenes.indexOf(scene) + 1} de {scenes.length}
                  </span>
                  <div className="inline">
                    {sequenceMode && (
                      <>
                        <IconButton
                          label="Mover escena a la izquierda"
                          disabled={busy || scenes[0].id === scene.id}
                          onClick={() => move(-1)}
                        >
                          <ArrowLeft size={15} />
                        </IconButton>
                        <IconButton
                          label="Mover escena a la derecha"
                          disabled={busy || scenes.at(-1)?.id === scene.id}
                          onClick={() => move(1)}
                        >
                          <ArrowRight size={15} />
                        </IconButton>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void w.action(() =>
                              db.saveSequence(
                                project.id,
                                scenes
                                  .filter((s) => s.id !== scene.id)
                                  .map((s) => s.id),
                              ),
                            )
                          }
                        >
                          Quitar de secuencia
                        </button>
                      </>
                    )}
                    <IconButton
                      label="Duplicar escena"
                      disabled={busy}
                      onClick={() =>
                        void w.action(async () => {
                          const copy = await db.duplicateScene(scene.id);
                          if (sequenceMode)
                            await db.saveSequence(project.id, [
                              ...scenes.map((s) => s.id),
                              copy.id,
                            ]);
                          setSelectedId(copy.id);
                        })
                      }
                    >
                      <Copy size={15} />
                    </IconButton>
                    <IconButton
                      label="Eliminar escena"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Mover este clip a la papelera? Podrás restaurarlo desde el proyecto.",
                          )
                        )
                          void w.action(() => db.deleteScene(scene.id));
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Inspector
            key={scene.id}
            scene={scene}
            assets={w.assets}
            workspace={w}
            openSettings={settings}
            onGenerationQueued={onGenerationQueued || browseClips}
            openClip={openClip}
          />
        </div>
      ) : (
        <Empty
          title={
            sequenceMode
              ? "Elige los clips de tu secuencia"
              : "La primera escena está por escribir"
          }
          action={
            <AddButton onClick={sequenceMode ? browseClips : () => void add()}>
              {sequenceMode ? "Elegir clips" : "Añadir escena"}
            </AddButton>
          }
        >
          {sequenceMode
            ? "Selecciona clips en el proyecto y pulsa Añadir a secuencia. Podrás ordenarlos aquí y exportar un vídeo unido."
            : "Añade una escena para empezar a editar tu vídeo."}
        </Empty>
      )}
      {download && (
        <VideoDownloadDialog
          video={download}
          onClose={() => setDownload(undefined)}
        />
      )}
    </div>
  );
}

function Inspector({
  scene,
  assets,
  workspace: w,
  openSettings,
  onGenerationQueued,
  openClip,
}: {
  scene: Scene;
  assets: Asset[];
  workspace: WorkspaceController;
  openSettings: () => void;
  onGenerationQueued?: () => void;
  openClip?: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState(scene.prompt);
  const [title, setTitle] = useState(
    scene.title || `Escena ${scene.order + 1}`,
  );
  const [mode, setMode] = useState<GenerationMode>(
    scene.error && scene.output_request
      ? scene.output_request.task.mode
      : activeVersion(scene)?.interactionId
        ? "edit"
        : scene.output_request?.task.mode || "generate",
  );
  const [editPrompt, setEditPrompt] = useState(scene.edit_prompt || "");
  const [extendPrompt, setExtendPrompt] = useState(scene.extend_prompt || "");
  const instruction = mode === "extend" ? extendPrompt : editPrompt;
  const storyConfig = w.projects.find((p) => p.id === scene.project_id)?.story;
  const reviewStory = mode === "generate" && scene.story && storyConfig;
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const awaiting =
    !sceneBlob(scene) &&
    (!!w.jobFor(scene.id) || !!scene.generation_queue?.length);
  const retryable =
    !!scene.output_request &&
    !sceneBlob(scene) &&
    !awaiting &&
    !scene.task?.remoteId;
  const version = activeVersion(scene),
    config = sceneSettings(scene),
    busy =
      submitting ||
      (awaiting && scene.output_request?.task.mode !== "generate") ||
      retryable;
  const baseDuration =
    version?.duration || scene.output_request?.task.previousDuration || 0;
  const editable =
    !!version?.interactionId && version.settings.model === OMNI_MODEL;
  const save = (patch: Partial<Scene>) => {
    setSaveState("saving");
    void w
      .patch(scene.id, patch)
      .then(() => setSaveState("saved"))
      .catch((e) => {
        setSaveState("error");
        w.notify(e.message, true);
      });
  };
  const currentJob = !!w.jobFor(scene.id);
  const needsRecovery = !!scene.task?.remoteId && !currentJob;
  const generate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await w.patch(scene.id, { prompt, title });
      if (await w.run([scene.id], mode, instruction, false, count))
        onGenerationQueued?.();
    } catch (e) {
      w.notify(
        e instanceof Error ? e.message : "No se pudo guardar el prompt.",
        true,
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <aside className="inspector" aria-label="Configurar escena">
      <div className="inspector-heading">
        <span>Configurar clip</span>
        <WandSparkles size={16} />
      </div>
      <div className="inspector-content">
        {scene.origin && (
          <div className="clip-base">
            <span>
              {scene.origin.mode === "edit"
                ? "Edición"
                : scene.origin.mode === "extend"
                  ? "Extensión"
                  : "Nueva toma"}{" "}
              de «{scene.origin.title}»
            </span>
            {openClip &&
              w.scenes.some((s) => s.id === scene.origin!.sceneId) && (
                <button
                  className="text-button"
                  onClick={() => openClip(scene.origin!.sceneId)}
                >
                  Ver clip de origen
                </button>
              )}
          </div>
        )}
        <label>
          <span>
            Nombre de la escena{" "}
            <span className="save-indicator" role="status">
              {saveState === "saving"
                ? "Guardando…"
                : saveState === "error"
                  ? "No guardado"
                  : "Guardado"}
            </span>
          </span>
          <input
            value={title}
            maxLength={60}
            disabled={busy}
            onChange={(e) => {
              setTitle(e.target.value);
              save({ title: e.target.value });
            }}
          />
        </label>
        <div className="segmented" aria-label="Modo de generación">
          {(["generate", "edit", "extend"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              disabled={
                busy ||
                (m !== "generate" &&
                  (!editable || (m === "extend" && version!.duration > 30)))
              }
              title={
                m !== "generate" && !editable
                  ? "Genera un vídeo con Omni para activar esta opción"
                  : undefined
              }
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "generate"
                ? version
                  ? "Nuevo clip"
                  : "Crear"
                : m === "edit"
                  ? "Editar"
                  : "Extender"}
            </button>
          ))}
        </div>
        {mode !== "generate" && version && (
          <div className="clip-base">
            <strong>Vídeo base: {title}</strong>
            <span>
              {mode === "edit"
                ? `${version.duration} s · Cada resultado aplica los cambios a esta toma.`
                : `${version.duration} s + 10 s → ${version.duration + 10} s. El nuevo clip incluye el vídeo completo.${count > 1 ? " Todos parten de esta misma toma." : ""}`}
            </span>
          </div>
        )}
        <label>
          {mode === "generate"
            ? "¿Qué ocurre en esta toma?"
            : mode === "edit"
              ? "¿Qué quieres cambiar?"
              : "¿Cómo continúa la escena?"}
          <textarea
            className="prompt-input"
            rows={7}
            value={mode === "generate" ? prompt : instruction}
            disabled={busy}
            placeholder={
              mode === "generate"
                ? "Sujeto, acción, cámara, luz y sonido. Cuanto más clara sea la idea, mejor."
                : mode === "edit"
                  ? "Cambia la luz por un atardecer. Mantén todo lo demás igual."
                  : "La cámara retrocede y revela el paisaje. Continúa la música."
            }
            onChange={(e) => {
              if (mode === "generate") {
                setPrompt(e.target.value);
                save({ prompt: e.target.value });
              } else if (mode === "edit") {
                setEditPrompt(e.target.value);
                save({ edit_prompt: e.target.value });
              } else {
                setExtendPrompt(e.target.value);
                save({ extend_prompt: e.target.value });
              }
            }}
            onKeyDown={(e) => {
              if (
                (e.ctrlKey || e.metaKey) &&
                e.key === "Enter" &&
                !busy &&
                (mode === "generate" ? prompt : instruction).trim() &&
                !needsRecovery
              ) {
                e.preventDefault();
                void generate();
              }
            }}
          />
        </label>
        {mode === "generate" ? (
          <>
            <p className="prompt-info">
              {prompt.length.toLocaleString("es")} caracteres{" "}
              <span>⌘ / Ctrl + Enter para generar</span>
            </p>
            <VideoControls
              value={config}
              disabled={busy}
              onChange={(settings) =>
                save({
                  settings,
                  ...(settings.model !== OMNI_MODEL
                    ? { reference_asset_ids: [] }
                    : {}),
                })
              }
            />
            <VideoReferences
              scene={scene}
              assets={assets}
              disabled={busy}
              onRefresh={w.refresh}
              onChange={async (patch) => {
                setSaveState("saving");
                try {
                  await w.patch(scene.id, patch);
                  setSaveState("saved");
                } catch (e) {
                  setSaveState("error");
                  throw e;
                }
              }}
            />
          </>
        ) : (
          <p className="hint">
            {mode === "edit"
              ? "Crea un clip independiente con los cambios. El vídeo base se conserva."
              : `Crea un clip de ${baseDuration + 10} s: incluye los ${baseDuration} s originales y 10 s de continuación. Máximo 40 s.`}
          </p>
        )}
        {(scene.versions?.length || 0) > 1 && (
          <details className="versions">
            <summary>
              <History size={15} />
              Resultados anteriores{" "}
              <span className="count">{scene.versions!.length}</span>
              <ChevronDown size={14} />
            </summary>
            <p className="hint">
              Estos resultados se guardaron juntos con el flujo anterior. Puedes
              convertirlos en clips independientes.
            </p>
            <button
              className="button full"
              disabled={w.jobs.length > 0 || !!scene.generation_queue?.length}
              onClick={() =>
                void w.action(
                  () => db.separateVersions(scene.id),
                  "Resultados separados en clips.",
                )
              }
            >
              Separar en clips
            </button>
            <div>
              {scene.versions!.map((v, i) => (
                <button
                  key={v.id}
                  className={v.id === version?.id ? "selected-version" : ""}
                  disabled={busy}
                  onClick={() => save({ active_version_id: v.id })}
                >
                  <span>
                    V{i + 1}
                    <small>
                      {v.mode === "edit"
                        ? "Edición"
                        : v.mode === "extend"
                          ? "Extensión"
                          : "Generación"}{" "}
                      · {v.duration}s
                    </small>
                  </span>
                  <span>
                    {v.id === version?.id ? <Check size={15} /> : "Usar"}
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="generate-footer">
        {!needsRecovery && !awaiting && !retryable && (
          <label className="version-count">
            <span>Cantidad de clips</span>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={Number.isNaN(count) ? "" : count}
              disabled={submitting}
              onChange={(e) => setCount(e.target.valueAsNumber)}
            />
          </label>
        )}
        {scene.error && (
          <div className="inline-error" role="alert">
            {scene.error}
          </div>
        )}
        <PromptReview
          error={
            scene.output_request && scene.output_request.task.mode !== mode
              ? undefined
              : scene.error
          }
          disabled={
            submitting ||
            awaiting ||
            currentJob ||
            !!scene.generation_queue?.length ||
            w.storyJob?.projectId === scene.project_id ||
            saveState === "saving"
          }
          input={{
            description: reviewStory
              ? scene.story!.visual
              : mode === "generate"
                ? prompt
                : instruction,
            lockedText: reviewStory ? scene.story!.text : undefined,
            context: reviewStory
              ? prompt
              : mode === "generate"
                ? undefined
                : `Operación: ${mode}. Descripción del vídeo base (no editable): ${scene.prompt}`,
            referenceCount:
              scene.output_request?.images.length ??
              (scene.reference_asset_ids?.length || 0) +
                Number(!!scene.first_frame_asset_id) +
                Number(!!scene.last_frame_asset_id),
          }}
          onApply={async (description) => {
            const story = reviewStory
              ? { ...scene.story!, visual: description }
              : undefined;
            const nextPrompt = story
              ? storyPrompt(
                  storyConfig!,
                  story,
                  scene.reference_asset_ids?.length
                    ? scene.reference_asset_ids
                    : scene.first_frame_asset_id
                      ? [scene.first_frame_asset_id]
                      : [],
                )
              : description;
            const changes: Partial<Scene> = {
              ...(mode === "generate"
                ? { prompt: nextPrompt }
                : mode === "edit"
                  ? { edit_prompt: nextPrompt }
                  : { extend_prompt: nextPrompt }),
              ...(story ? { story } : {}),
              ...(scene.output_request
                ? {
                    output_request: {
                      ...scene.output_request,
                      task: {
                        ...scene.output_request.task,
                        prompt: nextPrompt,
                        remoteId: undefined,
                      },
                    },
                  }
                : {}),
              error: undefined,
              task: undefined,
              status: sceneBlob(scene) ? "completed" : "pending",
            };
            await w.patch(scene.id, changes);
            if (mode === "generate") setPrompt(nextPrompt);
            else if (mode === "edit") setEditPrompt(nextPrompt);
            else setExtendPrompt(nextPrompt);
            setSaveState("saved");
            w.notify(
              "Descripción aplicada. Ya puedes generar con los cambios.",
            );
          }}
        />
        {!getApiKey() ? (
          <button className="button primary full" onClick={openSettings}>
            Conectar Google para generar
          </button>
        ) : awaiting ? (
          <button className="button primary full" onClick={onGenerationQueued}>
            Ver progreso en la biblioteca
          </button>
        ) : needsRecovery ? (
          <>
            <button
              className="button primary full"
              disabled={w.jobs.length > 0}
              onClick={async () => {
                if (await w.run([scene.id], "generate", undefined, true))
                  onGenerationQueued?.();
              }}
            >
              <RotateCcw size={16} />
              Recuperar resultado
            </button>
            <button
              className="text-button"
              disabled={w.jobs.length > 0}
              onClick={() => {
                if (
                  window.confirm(
                    "Google puede seguir procesando esta solicitud. ¿Dejar de recuperarla y permitir una nueva generación?",
                  )
                )
                  save({
                    task: undefined,
                    status: sceneBlob(scene) ? "completed" : "pending",
                    error: undefined,
                  });
              }}
            >
              Descartar seguimiento
            </button>
          </>
        ) : retryable ? (
          <button
            className="button primary full"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              if (await w.retry(scene.id)) onGenerationQueued?.();
              setSubmitting(false);
            }}
          >
            {scene.error ? "Reintentar clip" : "Generar con cambios"}
          </button>
        ) : (
          <button
            className="button primary full"
            disabled={
              submitting ||
              !Number.isInteger(count) ||
              count < 1 ||
              count > 20 ||
              !(mode === "generate" ? prompt : instruction).trim()
            }
            onClick={() => void generate()}
          >
            <WandSparkles size={17} />
            {submitting
              ? "Añadiendo…"
              : count > 1
                ? mode === "edit"
                  ? `Crear ${count} clips editados`
                  : mode === "extend"
                    ? `Crear ${count} clips extendidos`
                    : `Generar ${count} clips`
                : mode === "edit"
                  ? "Crear clip editado"
                  : mode === "extend"
                    ? "Crear clip extendido"
                    : version
                      ? "Generar nuevo clip"
                      : "Generar escena"}
            <span className="key-hint" aria-hidden="true">
              ⌘ ↵
            </span>
          </button>
        )}
        <small>
          {retryable
            ? "Se reintentará la solicitud guardada con sus mismos ajustes."
            : awaiting
              ? "Este clip se está preparando en segundo plano."
              : needsRecovery
                ? "Recuperar consulta la solicitud existente."
                : `${count || 1} ${(count || 1) === 1 ? "solicitud" : "solicitudes"} a Google. Cada resultado aparecerá como un clip independiente.`}{" "}
          {version
            ? "El clip original se conserva."
            : "Puedes seguir trabajando mientras avanza la cola."}
        </small>
        <button className="text-button" onClick={openSettings}>
          Configurar mi API key
        </button>
      </div>
    </aside>
  );
}
