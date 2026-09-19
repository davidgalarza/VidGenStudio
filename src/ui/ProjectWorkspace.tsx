import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Trash2,
  Download,
  Film,
  Layers,
  LoaderCircle,
  Play,
  Plus,
  Search,
  X,
  RotateCcw,
  Star,
  CircleSlash,
  Columns2,
  BookOpen,
} from "lucide-react";
import {
  activeVersion,
  sceneBlob,
  sceneSettings,
  sequenceScenes,
  type Project,
  type Scene,
} from "../types";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { getDefaults } from "../lib/settings";
import { downloadBlob } from "../lib/media";
import { clipFilename } from "../lib/archive";
import { Clip, Empty, IconButton } from "./common";
import { SequenceEditor } from "./SequenceEditor";
import { Editor } from "./Editor";
import { isContentBlock } from "../lib/contentReview";
import { VideoDownloadDialog } from "./VideoDownloadDialog";
import { DownloadDialog } from "./DownloadDialog";
import { CompareDialog } from "./CompareDialog";
import { StoryEditor } from "./StoryEditor";

export function ProjectWorkspace({
  project,
  workspace: w,
  settings,
  initialClipId,
}: {
  project: Project;
  workspace: WorkspaceController;
  settings: (clipId?: string) => void;
  initialClipId?: string;
}) {
  const [view, setView] = useState<"clips" | "edit" | "sequence" | "story">(
    initialClipId ? "edit" : "clips",
  );
  const [editing, setEditing] = useState(initialClipId || "");
  const [selection, setSelection] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [downloadClip, setDownloadClip] = useState<Scene>();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [sort, setSort] = useState("recent");
  const [deleted, setDeleted] = useState<string>();
  const [creating, setCreating] = useState(false);
  const focusReturn = useRef<HTMLElement | null>(null);
  const scenes = w.scenes.filter((s) => s.project_id === project.id);
  const sequence = sequenceScenes(project, scenes);
  const selected = selection.flatMap(
    (id) => scenes.find((s) => s.id === id) || [],
  );
  const comparing = compareIds.flatMap(
    (id) => scenes.find((s) => s.id === id) || [],
  );
  const selectedReady = selected.filter((s) => sceneBlob(s));
  const trash = w.trash.filter((s) => s.project_id === project.id);
  const visible = (filter === "trash" ? trash : scenes).filter(
    (s) =>
      `${s.title || ""} ${s.prompt}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (filter === "discarded" ||
        filter === "trash" ||
        s.review !== "discarded") &&
      (filter === "all" ||
        filter === "trash" ||
        (filter === "favorites"
          ? s.review === "favorite"
          : filter === "discarded"
            ? s.review === "discarded"
            : filter === "attention"
              ? !!s.error || !!s.task?.remoteId
              : filter === "ready"
                ? !!sceneBlob(s)
                : !sceneBlob(s))),
  );
  visible.sort((a, b) =>
    sort === "name"
      ? (a.title || "").localeCompare(b.title || "", "es")
      : sort === "recent"
        ? b.updated_at.localeCompare(a.updated_at)
        : a.order - b.order,
  );
  const hiddenSelected = selected.filter(
    (s) => !visible.some((v) => v.id === s.id),
  ).length;
  const pending = (selected.length ? selected : scenes).filter(
    (s) =>
      s.review !== "discarded" &&
      !sceneBlob(s) &&
      s.prompt.trim() &&
      !s.task?.remoteId &&
      !w.queue.some((q) => q.sceneId === s.id) &&
      w.job?.sceneId !== s.id,
  );
  const openClip = (
    id: string,
    trigger = document.activeElement as HTMLElement | null,
  ) => {
    focusReturn.current = trigger;
    setEditing(id);
    setView("edit");
  };
  const add = async () => {
    if (creating) return;
    const trigger = document.activeElement as HTMLElement | null;
    setCreating(true);
    await w.action(async () => {
      const scene = await db.addScene(project.id, getDefaults());
      setFilter("all");
      setSearch("");
      openClip(scene.id, trigger);
    });
    setCreating(false);
  };
  const removeClip = (id: string) =>
    void w.action(async () => {
      await db.deleteScene(id);
      setDeleted(id);
      setSelection((items) => items.filter((item) => item !== id));
    });
  const addToSequence = () =>
    void w.action(async () => {
      await db.saveSequence(project.id, [
        ...new Set([
          ...sequence.map((s) => s.id),
          ...selected.map((s) => s.id),
        ]),
      ]);
      await w.refresh();
      setSelection([]);
      setView("sequence");
    });
  const review = (scene: Scene, next: Scene["review"]) =>
    void w.action(async () => {
      await w.patch(scene.id, { review: next });
      if (next === "discarded")
        setSelection((ids) => ids.filter((id) => id !== scene.id));
    });
  const reuse = (scene: Scene) => {
    const trigger = document.activeElement as HTMLElement | null;
    void w.action(async () => {
      const copy = await db.duplicateScene(scene.id);
      setFilter("all");
      setSearch("");
      openClip(copy.id, trigger);
    });
  };
  if (view === "sequence")
    return (
      <SequenceEditor
        key={project.id}
        project={project}
        workspace={w}
        onBack={() => setView("clips")}
      />
    );
  if (view === "story")
    return (
      <StoryEditor
        key={project.id}
        project={project}
        workspace={w}
        onBack={() => setView("clips")}
        onSequence={() => setView("sequence")}
        onSettings={() => settings()}
      />
    );
  return (
    <div className="project-clips">
      <div className="editor-top">
        <div className="project-title">
          <input
            aria-label="Nombre del proyecto"
            defaultValue={project.name}
            maxLength={80}
            onBlur={(e) => {
              if (e.target.value.trim())
                void w.action(() =>
                  db.renameProject(project.id, e.target.value),
                );
              else e.target.value = project.name;
            }}
          />
          <span>
            <Check size={12} /> Guardado en este navegador
          </span>
        </div>
        <div className="inline">
          <button className="button compact" onClick={() => setView("story")}>
            <BookOpen size={15} />
            Historia
          </button>
          <button
            className="button compact"
            disabled={
              !scenes.some((s) => sceneBlob(s) && s.review !== "discarded")
            }
            onClick={() => setDownloading(true)}
          >
            <Download size={15} /> Descargar clips
          </button>
          <button
            className="button compact"
            disabled={w.storyJob?.projectId === project.id}
            onClick={() => setView("sequence")}
          >
            <Layers size={15} />
            {sequence.length
              ? `Secuencia · ${project.sequence_items?.length ?? sequence.length}`
              : "Montar secuencia"}
          </button>
          <button
            className="button primary compact"
            disabled={creating}
            onClick={() => void add()}
          >
            <Plus size={15} /> Nuevo clip
          </button>
        </div>
      </div>
      <div className="clips-content">
        <header className="clips-heading">
          <div>
            <h1>
              Clips del proyecto <span className="count">{scenes.length}</span>
            </h1>
            <p>
              Genera, compara clips y descarga cada vídeo para seguir editando.
            </p>
          </div>
          <button
            className="button compact"
            disabled={!pending.length}
            onClick={() => void w.run(pending.map((s) => s.id))}
          >
            <Play size={14} />{" "}
            {selected.length ? "Generar seleccionados" : "Generar pendientes"}{" "}
            {pending.length > 0 && (
              <span className="count">{pending.length}</span>
            )}
          </button>
        </header>
        {deleted && trash.some((s) => s.id === deleted) && (
          <div className="undo-notice" role="status">
            <span>Clip movido a la papelera.</span>
            <button
              className="text-button"
              onClick={() =>
                void w.action(async () => {
                  await db.restoreScene(deleted);
                  setDeleted(undefined);
                })
              }
            >
              <RotateCcw size={14} /> Deshacer
            </button>
          </div>
        )}
        <div className="clips-filters">
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Buscar clips"
              placeholder="Buscar por nombre o prompt"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="clip-filter">
            Mostrar
            <select
              aria-label="Filtrar clips"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                if (["trash", "discarded"].includes(e.target.value))
                  setSelection([]);
              }}
            >
              <option value="all">Todos los clips</option>
              <option value="favorites">Favoritos</option>
              <option value="discarded">Descartados</option>
              <option value="ready">Con vídeo</option>
              <option value="drafts">Sin vídeo</option>
              <option value="attention">Por revisar</option>
              <option value="trash">Papelera ({trash.length})</option>
            </select>
          </label>
        </div>
        <label className="clip-sort">
          Ordenar
          <select
            aria-label="Ordenar clips"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="order">Orden de creación</option>
            <option value="recent">Modificados recientemente</option>
            <option value="name">Nombre A–Z</option>
          </select>
        </label>
        {filter !== "trash" && (
          <div
            className={`clip-selection-bar ${selected.length ? "has-selection" : ""}`}
            aria-label="Acciones de selección"
          >
            <label className="clip-check">
              <input
                type="checkbox"
                aria-label="Seleccionar clips visibles"
                ref={(element) => {
                  if (element)
                    element.indeterminate =
                      visible.some((s) => selection.includes(s.id)) &&
                      !visible.every((s) => selection.includes(s.id));
                }}
                checked={
                  visible.length > 0 &&
                  visible.every((s) => selection.includes(s.id))
                }
                disabled={!visible.length}
                onChange={(e) =>
                  setSelection(
                    e.target.checked
                      ? [
                          ...new Set([
                            ...selection,
                            ...visible.map((s) => s.id),
                          ]),
                        ]
                      : selection.filter(
                          (id) => !visible.some((s) => s.id === id),
                        ),
                  )
                }
              />
              {selected.length
                ? `${selected.length} seleccionados`
                : "Seleccionar"}
            </label>
            {selected.length > 0 && (
              <button className="text-button" onClick={() => setSelection([])}>
                Deseleccionar
              </button>
            )}
            {selected.length > 0 && (
              <div className="selection-actions">
                <button
                  className="button compact"
                  disabled={selectedReady.length !== 2 || selected.length !== 2}
                  onClick={() => setCompareIds(selectedReady.map((s) => s.id))}
                >
                  <Columns2 size={14} /> Comparar 2 clips
                </button>
                <button
                  className="button compact"
                  disabled={!selected.length}
                  onClick={addToSequence}
                >
                  <Layers size={14} /> Añadir a secuencia
                </button>
                <button
                  className="button compact"
                  disabled={!selectedReady.length}
                  onClick={() => setDownloading(true)}
                >
                  <Download size={14} />
                  {`Descargar seleccionados${selectedReady.length ? ` (${selectedReady.length})` : ""} · ZIP`}
                </button>
              </div>
            )}
          </div>
        )}
        {hiddenSelected > 0 && (
          <p className="selection-note">
            {hiddenSelected} seleccionados fuera de este filtro. Las acciones
            también los incluyen.
          </p>
        )}
        {filter === "trash" && (
          <p className="selection-note">
            Los clips conservan sus vídeos y versiones. Restáuralos para volver
            a usarlos.
          </p>
        )}
        {selected.length > selectedReady.length && (
          <p className="selection-note">
            El ZIP incluirá solo los {selectedReady.length} clips seleccionados
            que tienen vídeo.
          </p>
        )}
        {visible.length ? (
          <div className="clip-grid">
            {visible.map((scene) => {
              const version = activeVersion(scene),
                blob = sceneBlob(scene);
              const versionNumber = version
                ? (scene.versions?.findIndex((v) => v.id === version.id) ?? 0) +
                  1
                : 1;
              const references = [
                ...new Set(
                  [
                    scene.first_frame_asset_id,
                    scene.last_frame_asset_id,
                    ...(scene.reference_asset_ids || []),
                  ].filter(Boolean),
                ),
              ];
              return (
                <article
                  className={`project-clip ${selection.includes(scene.id) ? "is-checked" : ""}`}
                  key={scene.id}
                >
                  <div className="clip-media">
                    <button
                      className="clip-open"
                      aria-label={`Abrir clip: ${scene.title || "Sin título"}`}
                      disabled={!!scene.deleted_at}
                      onClick={() => openClip(scene.id)}
                    >
                      <Clip
                        blob={blob}
                        poster={
                          w.assets.find(
                            (a) => a.id === scene.first_frame_asset_id,
                          )?.data_url
                        }
                        controls={false}
                      />
                      <span className="clip-open-label">Abrir editor</span>
                    </button>
                    {!scene.deleted_at && (
                      <label className="clip-checkbox">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar clip: ${scene.title || "Sin título"}`}
                          checked={selection.includes(scene.id)}
                          onChange={(e) =>
                            setSelection(
                              e.target.checked
                                ? [...selection, scene.id]
                                : selection.filter((id) => id !== scene.id),
                            )
                          }
                        />
                      </label>
                    )}
                    {!scene.deleted_at && (
                      <button
                        className={`clip-favorite icon-button ${scene.review === "favorite" ? "is-favorite" : ""}`}
                        aria-label={`${scene.review === "favorite" ? "Quitar favorito" : "Marcar favorito"}: ${scene.title || "Clip"}`}
                        aria-pressed={scene.review === "favorite"}
                        onClick={() =>
                          review(
                            scene,
                            scene.review === "favorite"
                              ? undefined
                              : "favorite",
                          )
                        }
                      >
                        <Star
                          size={18}
                          fill={
                            scene.review === "favorite"
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    )}
                    {blob && (
                      <span className="clip-version">
                        {(scene.versions?.length || 0) > 1
                          ? `Resultado ${versionNumber} · `
                          : ""}
                        {version?.duration || sceneSettings(scene).duration} s
                      </span>
                    )}
                  </div>
                  <div className="clip-info">
                    <div className="clip-title">
                      <button
                        disabled={!!scene.deleted_at}
                        onClick={() => openClip(scene.id)}
                      >
                        {scene.title || "Clip sin título"}
                      </button>
                      <span
                        role="status"
                        className={
                          scene.error
                            ? "warning-text"
                            : blob
                              ? "success-text"
                              : "subtle"
                        }
                      >
                        {w.job?.sceneId === scene.id
                          ? "Generando…"
                          : w.queue.some((q) => q.sceneId === scene.id)
                            ? "En cola"
                            : scene.task?.remoteId
                              ? "Por recuperar"
                              : scene.error
                                ? "Revisar"
                                : blob
                                  ? "Listo"
                                  : "Borrador"}
                      </span>
                    </div>
                    {(w.job?.sceneId === scene.id ||
                      w.queue.some((q) => q.sceneId === scene.id)) && (
                      <div className="clip-generation" role="status">
                        {w.job?.sceneId === scene.id && (
                          <>
                            <strong>
                              <LoaderCircle size={14} className="spin" /> Clip{" "}
                              {w.job.index} de {w.job.total}
                            </strong>
                            <span>{w.job.text}</span>
                          </>
                        )}
                        {w.queue.some((q) => q.sceneId === scene.id) && (
                          <span>
                            {
                              w.queue.filter((q) => q.sceneId === scene.id)
                                .length
                            }{" "}
                            en espera{w.queuePaused ? " · Cola pausada" : ""}
                          </span>
                        )}
                        {w.queue.some((q) => q.sceneId === scene.id) && (
                          <button
                            className="text-button"
                            onClick={() => void w.cancelQueued(scene.id)}
                          >
                            Cancelar pendientes
                          </button>
                        )}
                      </div>
                    )}
                    {scene.origin && (
                      <div className="clip-origin">
                        <span>
                          {scene.origin.mode === "edit"
                            ? "Editado"
                            : scene.origin.mode === "extend"
                              ? "Extendido"
                              : "Nueva toma"}{" "}
                          · {scene.origin.title}
                        </span>
                        {!scene.deleted_at &&
                          scenes.some(
                            (s) => s.id === scene.origin!.sceneId,
                          ) && (
                            <button
                              className="text-button"
                              onClick={() => openClip(scene.origin!.sceneId)}
                            >
                              Ver origen
                            </button>
                          )}
                      </div>
                    )}
                    {!scene.deleted_at &&
                      !blob &&
                      !scene.task?.remoteId &&
                      scene.output_request &&
                      !scene.generation_queue?.length &&
                      w.job?.sceneId !== scene.id && (
                        <button
                          className="text-button recover-clip"
                          onClick={() =>
                            isContentBlock(scene.error)
                              ? openClip(scene.id)
                              : void w.retry(scene.id)
                          }
                        >
                          {isContentBlock(scene.error)
                            ? "Revisar escena"
                            : "Reintentar clip"}
                        </button>
                      )}
                    {scene.origin &&
                      blob &&
                      scenes.some(
                        (s) => s.id === scene.origin!.sceneId && sceneBlob(s),
                      ) && (
                        <button
                          className="text-button compare-origin"
                          onClick={() =>
                            setCompareIds([scene.origin!.sceneId, scene.id])
                          }
                        >
                          <Columns2 size={14} /> Comparar con origen
                        </button>
                      )}
                    <p className="clip-prompt">
                      {version?.prompt ||
                        scene.prompt ||
                        "Escribe un prompt para generar este clip."}
                    </p>
                    <div className="clip-details">
                      <span>
                        {references.length}{" "}
                        {references.length === 1 ? "referencia" : "referencias"}{" "}
                        {(scene.versions?.length || 0) > 1 &&
                          ` · ${scene.versions!.length} resultados anteriores`}
                      </span>
                      {scene.deleted_at ? (
                        <button
                          className="text-button"
                          onClick={() =>
                            void w.action(() => db.restoreScene(scene.id))
                          }
                        >
                          <RotateCcw size={15} /> Restaurar
                        </button>
                      ) : (
                        <div className="inline">
                          <IconButton
                            label={`${scene.review === "discarded" ? "Recuperar descartado" : "Descartar clip"}: ${scene.title || "Clip"}`}
                            disabled={
                              w.job?.sceneId === scene.id ||
                              w.queue.some((q) => q.sceneId === scene.id)
                            }
                            onClick={() =>
                              review(
                                scene,
                                scene.review === "discarded"
                                  ? undefined
                                  : "discarded",
                              )
                            }
                          >
                            <CircleSlash size={15} />
                          </IconButton>
                          <IconButton
                            label={`Crear otro parecido: ${scene.title || "Sin título"}`}
                            onClick={() => reuse(scene)}
                          >
                            <Copy size={15} />
                          </IconButton>
                          <IconButton
                            label={`Eliminar clip: ${scene.title || "Sin título"}`}
                            disabled={
                              w.job?.sceneId === scene.id ||
                              w.queue.some((q) => q.sceneId === scene.id)
                            }
                            onClick={() => removeClip(scene.id)}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                          <IconButton
                            label={`Descargar clip: ${scene.title || "Sin título"}`}
                            disabled={!blob}
                            onClick={() => setDownloadClip(scene)}
                          >
                            <Download size={16} />
                          </IconButton>
                        </div>
                      )}
                    </div>
                    {!scene.deleted_at &&
                      scene.task?.remoteId &&
                      w.job?.sceneId !== scene.id && (
                        <button
                          className="text-button recover-clip"
                          disabled={!!w.job}
                          onClick={() =>
                            void w.run([scene.id], "generate", undefined, true)
                          }
                        >
                          <RotateCcw size={14} /> Recuperar resultado
                        </button>
                      )}
                    {sequence.some((s) => s.id === scene.id) && (
                      <span className="clip-in-sequence">
                        <Film size={12} /> En la secuencia
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title={
              filter === "trash"
                ? "La papelera está vacía"
                : filter === "favorites"
                  ? "Aún no hay favoritos"
                  : filter === "discarded"
                    ? "No hay clips descartados"
                    : scenes.length
                      ? "No hay coincidencias"
                      : "Este proyecto aún no tiene clips"
            }
            action={
              !scenes.length && filter !== "trash" ? (
                <button
                  className="button"
                  disabled={creating}
                  onClick={() => void add()}
                >
                  <Plus size={16} /> Nuevo clip
                </button>
              ) : scenes.length &&
                (search || filter !== "all") &&
                filter !== "trash" ? (
                <button
                  className="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Limpiar filtros
                </button>
              ) : undefined
            }
          >
            {filter === "trash"
              ? "Aquí aparecerán los clips que elimines del proyecto."
              : filter === "favorites"
                ? "Marca la estrella de las tomas que quieras conservar a mano."
                : filter === "discarded"
                  ? "Los clips que descartes se ocultarán de la biblioteca. Puedes recuperarlos aquí sin perder sus vídeos."
                  : scenes.length
                    ? "Cambia la búsqueda o el filtro para ver otros clips."
                    : "Añade un clip y describe el vídeo que quieres generar."}
          </Empty>
        )}
      </div>
      {downloadClip && (
        <VideoDownloadDialog
          video={{
            blobs: [sceneBlob(downloadClip)!],
            filename: clipFilename(downloadClip),
            title: downloadClip.title || "Clip",
          }}
          onClose={() => setDownloadClip(undefined)}
        />
      )}
      {downloading && (
        <DownloadDialog
          scenes={scenes}
          selectedIds={selection}
          projectName={project.name}
          onClose={() => setDownloading(false)}
        />
      )}
      {comparing.length === 2 && (
        <CompareDialog
          clips={comparing as [Scene, Scene]}
          onClose={() => setCompareIds([])}
          markFavorite={(id, favorite) => {
            const scene = scenes.find((s) => s.id === id);
            if (scene) review(scene, favorite ? "favorite" : undefined);
          }}
        />
      )}
      {view === "edit" && scenes.some((s) => s.id === editing) && (
        <ClipDialog
          key={editing}
          scene={scenes.find((s) => s.id === editing)!}
          returnFocus={focusReturn}
          onClose={() => setView("clips")}
          workspace={w}
        >
          <Editor
            key={editing}
            project={project}
            workspace={w}
            settings={() => settings(editing)}
            initialSceneId={editing}
            clipOnly
            onGenerationQueued={() => {
              setFilter("all");
              setSearch("");
              setView("clips");
            }}
            openClip={(id) => openClip(id, focusReturn.current)}
            browseClips={() => setView("clips")}
          />
        </ClipDialog>
      )}
    </div>
  );
}

function ClipDialog({
  children,
  scene,
  onClose,
  returnFocus,
  workspace: w,
}: {
  children: React.ReactNode;
  scene: Scene;
  returnFocus: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  workspace: WorkspaceController;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<"configure" | "preview">(
    sceneBlob(scene) ? "preview" : "configure",
  );
  const count = scene.versions?.length || 0;
  const [previousCount, setPreviousCount] = useState(count);
  if (count > previousCount) {
    setPreviousCount(count);
    setPanel("preview");
  }
  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      returnFocus.current || (document.activeElement as HTMLElement | null);
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialog}
      className={`clip-dialog panel-${panel}`}
      aria-labelledby="clip-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="clip-dialog-header">
        <div>
          <h2 id="clip-dialog-title">Generar y editar clip</h2>
          <p>Genera clips nuevos o transforma una toma.</p>
        </div>
        <IconButton label="Cerrar editor de clip" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      <div className="clip-panel-switch" aria-label="Vista del clip">
        <button
          aria-pressed={panel === "configure"}
          onClick={() => setPanel("configure")}
        >
          Configurar
        </button>
        <button
          aria-pressed={panel === "preview"}
          onClick={() => setPanel("preview")}
        >
          Vista previa{sceneBlob(scene) ? " · Lista" : ""}
        </button>
      </div>
      {w.recovery && (
        <div className="clip-dialog-notice" role="alert">
          El vídeo está listo, pero no se pudo guardar.{" "}
          <button
            className="button"
            onClick={() =>
              downloadBlob(w.recovery!.blob, "video-recuperado.mp4")
            }
          >
            Descargar ahora
          </button>
        </div>
      )}
      {w.notice?.error && w.notice.text !== scene.error && (
        <div className="clip-dialog-notice" role="alert">
          {w.notice.text}
        </div>
      )}
      <div className="clip-dialog-body">{children}</div>
      <div className="clip-dialog-footnote">
        {w.job
          ? "La generación continúa aunque cierres este editor."
          : "Los cambios se guardan automáticamente en el proyecto."}
      </div>
    </dialog>
  );
}
