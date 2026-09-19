import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Maximize2,
  Minimize2,
  Repeat2,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  X,
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Film,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  Trash2,
  Undo2,
  Volume2,
} from "lucide-react";
import {
  sceneBlob,
  type AspectRatio,
  type Project,
  type Scene,
  type SequenceItem,
} from "../types";
import {
  clipAtTime,
  FRAME,
  makeSequenceItem,
  projectSequence,
  resolveTimeline,
  sourceKey,
  splitSequence,
  timecode,
  type TimelineClip,
} from "../lib/timeline";
import { saveMontage } from "../lib/storage";
import type { WorkspaceController } from "../lib/useWorkspace";
import { useBlobUrl } from "../lib/useBlobUrl";
import { Clip } from "./common";
import { VideoDownloadDialog, type VideoDownload } from "./VideoDownloadDialog";
import { SequenceFilmstrip } from "./SequenceFilmstrip";
import { StudioDialog } from "./StudioDialog";
import "./sequence.css";

type Edit = { items: SequenceItem[]; aspect: AspectRatio };
function SourceProbe({
  clip,
  onDuration,
}: {
  clip: TimelineClip;
  onDuration: (key: string, duration: number) => void;
}) {
  const url = useBlobUrl(clip.blob);
  return url ? (
    <video
      hidden
      src={url}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const duration = e.currentTarget.duration;
        if (Number.isFinite(duration) && duration > 0)
          onDuration(sourceKey(clip), duration);
      }}
    />
  ) : null;
}
function PreviewVideo({
  clip,
  active,
  playing,
  time,
  seekToken,
  onTime,
  onEnd,
  onError,
}: {
  clip: TimelineClip;
  active: boolean;
  playing: boolean;
  time: number;
  seekToken: number;
  onTime: (n: number) => void;
  onEnd: () => void;
  onError: () => void;
}) {
  const url = useBlobUrl(clip.blob);
  const audioUrl = useBlobUrl(clip.narration?.blob);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const latest = useRef({ time, onTime, onEnd, clip });
  useEffect(() => {
    latest.current = { time, onTime, onEnd, clip };
  });
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      if (!active) {
        video.pause();
        audioRef.current?.pause();
        return;
      }
      const c = latest.current.clip;
      const sourceTime = Math.max(c.in, c.in + latest.current.time - c.start);
      video.currentTime = Math.min(c.videoDuration - FRAME, sourceTime);
      video.muted = !!c.narration;
      video.volume = c.volume;
      const audio = audioRef.current;
      if (audio && c.narration) {
        audio.currentTime = c.narration.offset + sourceTime;
        audio.volume = c.volume;
        if (playing) void audio.play().catch(onError);
        else audio.pause();
      }
      if (playing && sourceTime < c.videoDuration)
        void video.play().catch(onError);
      else video.pause();
    };
    sync();
    video.addEventListener("loadedmetadata", sync);
    const audio = audioRef.current;
    audio?.addEventListener("loadedmetadata", sync);
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      audio?.removeEventListener("loadedmetadata", sync);
      audio?.pause();
      video.pause();
    };
  }, [
    active,
    playing,
    seekToken,
    url,
    clip.in,
    clip.out,
    clip.volume,
    audioUrl,
    onError,
  ]);
  useEffect(() => {
    if (!active || !playing) return;
    let frame = 0;
    const tick = () => {
      const video = ref.current,
        c = latest.current.clip;
      const audio = audioRef.current;
      if (video && !video.seeking) {
        const clock =
          c.narration && audio
            ? audio.currentTime - c.narration.offset
            : video.currentTime;
        const ended = c.narration && audio ? audio.ended : video.ended;
        if (ended || clock >= c.out - 0.012) {
          latest.current.onEnd();
          return;
        }
        if (
          c.narration &&
          audio &&
          !audio.paused &&
          clock < c.videoDuration - FRAME &&
          Math.abs(video.currentTime - clock) > 0.18
        )
          video.currentTime = clock;
        if (c.narration && audio ? !audio.paused : !video.paused)
          latest.current.onTime(c.start + Math.max(0, clock - c.in));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, seekToken, clip.in, clip.out]);
  return (
    <>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onError={active ? onError : undefined}
          data-testid={
            active ? "sequence-narration" : "sequence-narration-preload"
          }
        />
      )}
      <video
        ref={ref}
        src={url}
        hidden={!active}
        playsInline
        preload="auto"
        data-testid={active ? "sequence-preview" : "sequence-preload"}
        onError={active ? onError : undefined}
        onEnded={() => {
          if (active && playing && !clip.narration) onEnd();
        }}
      />
    </>
  );
}
export function SequenceEditor({
  project,
  workspace: w,
  onBack,
}: {
  project: Project;
  workspace: WorkspaceController;
  onBack: () => void;
}) {
  const scenes = w.scenes.filter(
    (s) => s.project_id === project.id && !s.deleted_at,
  );
  const [edit, setEdit] = useState<Edit>(() => ({
    items: projectSequence(project, scenes),
    aspect: project.sequence_aspect || "9:16",
  }));
  const root = useRef<HTMLElement>(null);
  const [focus, setFocus] = useState(false);
  const [panel, setPanel] = useState<"library" | "inspector">("library");
  const [loop, setLoop] = useState("");
  const [help, setHelp] = useState(false);
  const [audition, setAudition] = useState<Scene>();
  const [dropTarget, setDropTarget] = useState<string>();
  const volumeGesture = useRef<SequenceItem[] | null>(null);
  useEffect(() => {
    if (!focus) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const outside: { element: HTMLElement; inert: boolean }[] = [];
    let element: HTMLElement | null = root.current;
    while (element && element !== document.body) {
      for (const sibling of element.parentElement?.children || [])
        if (sibling !== element && sibling instanceof HTMLElement) {
          outside.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      element = element.parentElement;
    }
    return () => {
      document.body.style.overflow = before;
      outside.forEach((item) => {
        item.element.inert = item.inert;
      });
    };
  }, [focus]);
  const [draft, setDraft] = useState<SequenceItem[]>();
  const [past, setPast] = useState<Edit[]>([]),
    [future, setFuture] = useState<Edit[]>([]);
  const [selected, setSelected] = useState("");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false),
    [seekToken, setSeekToken] = useState(0);
  const [zoom, setZoom] = useState(72),
    [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState("Guardado"),
    [error, setError] = useState("");
  const [download, setDownload] = useState<VideoDownload>();
  const saveQueue = useRef(Promise.resolve()),
    revision = useRef(0);
  const saveFailed = useRef(false);
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    side: "in" | "out";
    x: number;
    clip: TimelineClip;
    original: SequenceItem[];
    next: SequenceItem[];
  } | null>(null);
  const clips = resolveTimeline(
    draft || edit.items,
    scenes,
    durations,
    w.narrations,
  );
  const tickStep =
    [1, 2, 5, 10, 15, 30, 60, 120, 300].find((step) => step * zoom >= 64) ||
    300;
  const total = clips.reduce((sum, c) => sum + c.length, 0);
  const time = Math.min(position, total);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const x = time * zoom;
    if (
      x < element.scrollLeft ||
      x > element.scrollLeft + element.clientWidth - 70
    )
      element.scrollLeft = Math.max(0, x - element.clientWidth / 3);
  }, [time, zoom]);
  const current = clipAtTime(clips, time),
    chosen = clips.find((c) => c.id === selected);
  const currentIndex = current ? clips.indexOf(current) : -1;
  const ready = scenes.filter((s) => sceneBlob(s));
  const probes = [
    ...new Map(
      [
        ...clips,
        ...resolveTimeline(
          ready.map((s) => makeSequenceItem(s, s.id)),
          scenes,
        ),
      ].map((c) => [sourceKey(c), c]),
    ).values(),
  ];
  const unresolved = clips.some((c) => !c.blob || !durations[sourceKey(c)]);
  function persist(next: Edit) {
    const rev = ++revision.current;
    setSaveState("Guardando…");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await saveMontage(project.id, next.items, next.aspect);
        await w.refresh();
        if (revision.current === rev) {
          saveFailed.current = false;
          setSaveState("Guardado");
        }
      })
      .catch(() => {
        if (revision.current === rev) {
          saveFailed.current = true;
          setSaveState("No se pudo guardar");
        }
      });
  }
  function commit(next: Edit) {
    if (JSON.stringify(next) === JSON.stringify(edit)) return;
    setPlaying(false);
    setPast([...past.slice(-49), edit]);
    setFuture([]);
    setEdit(next);
    setDraft(undefined);
    persist(next);
    setSeekToken((n) => n + 1);
  }
  function update(items: SequenceItem[]) {
    commit({ ...edit, items });
  }
  function seek(n: number) {
    setPosition(Math.max(0, Math.min(n, total)));
    setSeekToken((t) => t + 1);
    setError("");
  }
  function undo() {
    const next = past.at(-1);
    if (next) {
      setPlaying(false);
      setPast(past.slice(0, -1));
      setFuture([edit, ...future]);
      setEdit(next);
      persist(next);
      setSeekToken((n) => n + 1);
    }
  }
  function redo() {
    const next = future[0];
    if (next) {
      setPlaying(false);
      setPast([...past, edit]);
      setFuture(future.slice(1));
      setEdit(next);
      persist(next);
      setSeekToken((n) => n + 1);
    }
  }
  function add(scene: Scene, before?: string) {
    const item = makeSequenceItem(scene);
    const items = [...edit.items];
    const index = before ? items.findIndex((i) => i.id === before) : -1;
    items.splice(index < 0 ? items.length : index, 0, item);
    update(items);
    setSelected(item.id);
    setLoop("");
    setPanel("inspector");
  }
  function move(id: string, before?: string) {
    if (id === before) return;
    const item = edit.items.find((i) => i.id === id);
    if (!item) return;
    const items = edit.items.filter((i) => i.id !== id);
    const index = before ? items.findIndex((i) => i.id === before) : -1;
    items.splice(index < 0 ? items.length : index, 0, item);
    update(items);
  }
  function nudge(direction: number) {
    if (!chosen) return;
    const index = clips.indexOf(chosen),
      other = index + direction;
    if (other < 0 || other >= clips.length) return;
    const items = [...edit.items];
    [items[index], items[other]] = [items[other], items[index]];
    update(items);
  }
  function patch(id: string, values: Partial<SequenceItem>) {
    update(edit.items.map((i) => (i.id === id ? { ...i, ...values } : i)));
  }
  function duplicate() {
    if (!chosen) return;
    const id = crypto.randomUUID();
    update(
      edit.items.flatMap((i) => (i.id === chosen.id ? [i, { ...i, id }] : [i])),
    );
    setSelected(id);
    setLoop("");
  }
  function split() {
    if (current) update(splitSequence(edit.items, current, time));
  }
  function remove() {
    if (!chosen) return;
    const next =
      clips[clips.indexOf(chosen) + 1] || clips[clips.indexOf(chosen) - 1];
    update(edit.items.filter((i) => i.id !== chosen.id));
    setSelected(next?.id || "");
    if (loop === chosen.id) setLoop("");
  }
  function jumpCut(direction: number) {
    const points = [...clips.map((c) => c.start), total];
    seek(
      direction > 0
        ? (points.find((n) => n > time + FRAME / 2) ?? total)
        : (points.filter((n) => n < time - FRAME / 2).at(-1) ?? 0),
    );
  }
  function trimToCursor(side: "in" | "out") {
    if (!chosen || current?.id !== chosen.id) return;
    const value = chosen.in + time - chosen.start;
    if (value <= chosen.in + FRAME / 2 || value >= chosen.out - FRAME / 2)
      return;
    patch(chosen.id, { in: chosen.in, out: chosen.out, [side]: value });
    seek(
      side === "in" ? chosen.start : chosen.start + value - chosen.in - FRAME,
    );
  }
  function changeVolume(value: number) {
    if (!chosen) return;
    const items = edit.items.map((i) =>
      i.id === chosen.id ? { ...i, volume: value } : i,
    );
    if (volumeGesture.current) {
      volumeGesture.current = items;
      setDraft(items);
    } else update(items);
  }
  function finishVolume() {
    const items = volumeGesture.current;
    volumeGesture.current = null;
    setDraft(undefined);
    if (items) update(items);
  }
  function togglePlay() {
    if (!clips.length || unresolved) return;
    const repeated = clips.find((c) => c.id === loop);
    if (
      repeated &&
      (time < repeated.start ||
        time >= repeated.start + repeated.length - FRAME)
    )
      seek(repeated.start);
    else if (time >= total - FRAME) seek(0);
    setError("");
    setPlaying(!playing);
  }
  // Stable callbacks keep playback running when the global playhead updates.
  const handlers = useRef({ end: () => {}, fail: () => {} });
  useEffect(() => {
    handlers.current = {
      end: () => {
        if (current && loop === current.id) {
          seek(current.start);
          return;
        }
        const next = clips[currentIndex + 1];
        if (next) seek(next.start);
        else {
          setPosition(total);
          setPlaying(false);
        }
      },
      fail: () => {
        setPlaying(false);
        setError(
          "No se pudo reproducir este clip. Prueba de nuevo o retíralo del montaje.",
        );
      },
    };
  });
  const [onEnd] = useState(() => () => handlers.current.end());
  const [onError] = useState(() => () => handlers.current.fail());
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        setFocus(false);
        drag.current = null;
        volumeGesture.current = null;
        setDraft(undefined);
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest(
          "input,textarea,select,[contenteditable=true],dialog",
        ) ||
          (e.target.closest("button") &&
            !e.target.closest(".sequence-item-content")) ||
          document.querySelector("dialog[open]"))
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.metaKey || e.ctrlKey || e.altKey) return;
      else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if (e.key.toLowerCase() === "i") trimToCursor("in");
      else if (e.key.toLowerCase() === "o") trimToCursor("out");
      else if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        seek(
          time + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : FRAME),
        );
      } else if (e.key.toLowerCase() === "s") split();
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function trimStart(
    e: PointerEvent<HTMLButtonElement>,
    clip: TimelineClip,
    side: "in" | "out",
  ) {
    e.stopPropagation();
    e.preventDefault();
    setPlaying(false);
    setSelected(clip.id);
    setPanel("inspector");
    seek(side === "in" ? clip.start : clip.start + clip.length - FRAME);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: clip.id,
      side,
      x: e.clientX,
      clip,
      original: edit.items,
      next: edit.items,
    };
  }
  function trimMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.x) / zoom / FRAME) * FRAME;
    const value =
      d.side === "in"
        ? Math.max(0, Math.min(d.clip.out - FRAME, d.clip.in + delta))
        : Math.max(
            d.clip.in + FRAME,
            Math.min(d.clip.sourceDuration, d.clip.out + delta),
          );
    d.next = d.original.map((i) =>
      i.id === d.id
        ? { ...i, in: d.clip.in, out: d.clip.out, [d.side]: value }
        : i,
    );
    setDraft(d.next);
    const edge =
      d.side === "in" ? d.clip.start : d.clip.start + value - d.clip.in - FRAME;
    setPosition(Math.max(0, edge));
    setSeekToken((n) => n + 1);
  }
  function trimEnd() {
    const d = drag.current;
    drag.current = null;
    setDraft(undefined);
    if (d) update(d.next);
  }
  function scrub(e: PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - bounds.left) / zoom);
  }
  async function leave() {
    await saveQueue.current;
    if (saveFailed.current) {
      persist(edit);
      return;
    }
    onBack();
  }
  return (
    <section
      ref={root}
      className={`sequence-editor ${focus ? "sequence-focused" : ""}`}
      data-panel={panel}
      aria-label="Editor de secuencia"
      onDragEnd={() => setDropTarget(undefined)}
    >
      {probes.map((c) => (
        <SourceProbe
          key={sourceKey(c)}
          clip={c}
          onDuration={(key, duration) =>
            setDurations((prev) =>
              prev[key] === duration ? prev : { ...prev, [key]: duration },
            )
          }
        />
      ))}
      <header className="sequence-header">
        <button className="text-button" onClick={() => void leave()}>
          <ArrowLeft size={16} /> Todos los clips
        </button>
        <div>
          <h1>
            {project.name} <span>/ Secuencia</span>
          </h1>
          <small role="status">{saveState}</small>
          {saveState === "No se pudo guardar" && (
            <button className="text-button" onClick={() => persist(edit)}>
              Reintentar guardado
            </button>
          )}
        </div>
        <button
          className="icon-button"
          aria-label="Atajos del editor"
          title="Atajos del editor (?)"
          onClick={() => {
            setPlaying(false);
            setHelp(true);
          }}
        >
          <Keyboard size={18} />
        </button>
        <button
          className="icon-button"
          aria-label={focus ? "Salir de vista ampliada" : "Ampliar editor"}
          aria-pressed={focus}
          title={focus ? "Salir de vista ampliada (Esc)" : "Ampliar editor"}
          onClick={() => setFocus(!focus)}
        >
          {focus ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          className="button primary"
          disabled={!clips.length || unresolved}
          onClick={() => {
            setPlaying(false);
            setDownload({
              blobs: clips.map((c) => c.blob!),
              segments: clips.map((c) => ({
                start: c.in,
                end: c.out,
                volume: c.volume,
                narration: c.narration
                  ? { blob: c.narration.blob, start: c.narration.offset + c.in }
                  : undefined,
              })),
              aspect: edit.aspect,
              title: project.name,
              filename: `${project.name}-secuencia.mp4`,
            });
          }}
        >
          <Download size={16} /> Exportar vídeo
        </button>
      </header>
      <nav className="sequence-mobile-panels" aria-label="Paneles del montaje">
        <button
          aria-pressed={panel === "library"}
          onClick={() => setPanel("library")}
        >
          Clips del proyecto <span>{ready.length}</span>
        </button>
        <button
          aria-pressed={panel === "inspector"}
          onClick={() => setPanel("inspector")}
        >
          Ajustar toma
        </button>
      </nav>
      <div className="sequence-workbench">
        <aside className="sequence-library">
          <div className="sequence-panel-title">
            <h2>Clips del proyecto</h2>
            <span>{ready.length}</span>
          </div>
          <input
            type="search"
            aria-label="Buscar clips para el montaje"
            placeholder="Buscar clips…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="hint">Arrastra a la línea de tiempo o pulsa +.</p>
          <div className="sequence-source-list">
            {ready
              .filter((s) =>
                `${s.title} ${s.prompt}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <div
                  className="sequence-source"
                  key={s.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/sequence-source", s.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <button
                    className="sequence-audition"
                    aria-label={`Previsualizar ${s.title || "clip"}`}
                    onClick={() => {
                      setPlaying(false);
                      setAudition(s);
                    }}
                  >
                    <Clip blob={sceneBlob(s)} controls={false} />
                    <Play size={16} />
                  </button>
                  <div>
                    <strong>{s.title || `Clip ${s.order + 1}`}</strong>
                    <small>
                      {timecode(
                        durations[sourceKey(makeSequenceItem(s, s.id))] || 0,
                      )}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Añadir ${s.title || `Clip ${s.order + 1}`} al montaje`}
                    onClick={() => add(s)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))}
          </div>
          {!ready.length && (
            <p className="hint">
              Los vídeos terminados aparecerán aquí. Vuelve a tus clips para
              generar uno.
            </p>
          )}
        </aside>
        <main className="sequence-viewer">
          <div className="sequence-viewer-heading">
            <span>
              {current
                ? `Toma ${currentIndex + 1} de ${clips.length} · ${current.scene?.title || "Clip"}`
                : "Previsualización"}
            </span>
            <select
              aria-label="Formato del montaje"
              value={edit.aspect}
              onChange={(e) =>
                commit({ ...edit, aspect: e.target.value as AspectRatio })
              }
            >
              <option value="9:16">Vertical · 9:16</option>
              <option value="16:9">Horizontal · 16:9</option>
            </select>
          </div>
          <div className="sequence-preview-stage">
            <div
              className="sequence-preview-frame"
              style={{
                aspectRatio: edit.aspect.replace(":", "/"),
                width: `calc(var(--sequence-preview-height) * ${edit.aspect === "9:16" ? 9 / 16 : 16 / 9})`,
              }}
            >
              {current?.blob ? (
                clips
                  .slice(currentIndex, currentIndex + 2)
                  .map((c) => (
                    <PreviewVideo
                      key={c.id}
                      clip={c}
                      active={c.id === current.id}
                      playing={playing}
                      time={time}
                      seekToken={seekToken}
                      onTime={setPosition}
                      onEnd={onEnd}
                      onError={onError}
                    />
                  ))
              ) : (
                <div className="sequence-placeholder">
                  <Film size={32} />
                  <p>
                    {current
                      ? "Este clip aún no tiene un vídeo disponible."
                      : "Tu montaje empieza con un clip."}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="sequence-transport">
            <button
              className="icon-button"
              aria-label="Volver al inicio"
              disabled={!clips.length}
              onClick={() => seek(0)}
            >
              <SkipBack size={18} />
            </button>
            <button
              className="sequence-play"
              aria-label={playing ? "Pausar secuencia" : "Reproducir secuencia"}
              disabled={!clips.length || unresolved}
              onClick={togglePlay}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              className="icon-button"
              aria-label="Corte anterior"
              title="Corte anterior"
              disabled={!clips.length}
              onClick={() => jumpCut(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Corte siguiente"
              title="Corte siguiente"
              disabled={!clips.length}
              onClick={() => jumpCut(1)}
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Repetir toma seleccionada"
              aria-pressed={!!loop}
              title="Repetir toma seleccionada"
              disabled={!chosen}
              onClick={() => {
                setLoop(loop ? "" : chosen!.id);
                if (!loop) seek(chosen!.start);
              }}
            >
              <Repeat2 size={18} />
            </button>
            <output aria-label="Posición del montaje">
              {timecode(time)} <span>/ {timecode(total)}</span>
            </output>
          </div>
          <input
            className="sequence-seek"
            type="range"
            min={0}
            max={total || 1}
            step={FRAME}
            value={time}
            disabled={!clips.length}
            aria-label="Recorrer secuencia"
            onChange={(e) => seek(Number(e.target.value))}
          />
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </main>
        <aside className="sequence-inspector">
          <h2>
            {chosen
              ? chosen.scene?.title || "Clip seleccionado"
              : "Ajustes del clip"}
          </h2>
          {chosen ? (
            <>
              <p className="hint">Recorta la toma sin cambiar el original.</p>
              <div className="sequence-cursor-trim">
                <button
                  className="text-button"
                  disabled={
                    !chosen ||
                    current?.id !== chosen.id ||
                    time <= chosen.start + FRAME / 2 ||
                    time >= chosen.start + chosen.length - FRAME / 2
                  }
                  onClick={() => trimToCursor("in")}
                >
                  Empezar aquí <kbd>I</kbd>
                </button>
                <button
                  className="text-button"
                  disabled={
                    !chosen ||
                    current?.id !== chosen.id ||
                    time <= chosen.start + FRAME / 2 ||
                    time >= chosen.start + chosen.length - FRAME / 2
                  }
                  onClick={() => trimToCursor("out")}
                >
                  Terminar aquí <kbd>O</kbd>
                </button>
              </div>
              <div className="sequence-trim-fields">
                {(["in", "out"] as const).map((side) => (
                  <label key={`${chosen.id}-${side}-${chosen[side]}`}>
                    {side === "in" ? "Inicio (s)" : "Final (s)"}
                    <input
                      aria-label={
                        side === "in"
                          ? "Inicio del recorte"
                          : "Final del recorte"
                      }
                      type="number"
                      min={side === "in" ? 0 : chosen.in + FRAME}
                      max={
                        side === "in"
                          ? chosen.out - FRAME
                          : chosen.sourceDuration
                      }
                      step={FRAME}
                      defaultValue={Number(chosen[side].toFixed(3))}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (!e.target.value || !Number.isFinite(value)) {
                          e.target.value = chosen[side].toFixed(3);
                          return;
                        }
                        const clamped =
                          side === "in"
                            ? Math.max(0, Math.min(value, chosen.out - FRAME))
                            : Math.max(
                                chosen.in + FRAME,
                                Math.min(value, chosen.sourceDuration),
                              );
                        patch(chosen.id, {
                          in: chosen.in,
                          out: chosen.out,
                          [side]: clamped,
                        });
                        e.target.value = clamped.toFixed(3);
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="sequence-duration">
                {timecode(chosen.length)}{" "}
                <span>de {timecode(chosen.sourceDuration)}</span>
              </p>
              <button
                className="text-button"
                onClick={() => patch(chosen.id, { in: 0, out: undefined })}
              >
                Restablecer recorte
              </button>
              {chosen.narration && (
                <p className="hint">
                  Voz en off vinculada. Al recortar o mover este fragmento, su
                  narración lo acompaña. Si la toma es más corta, se mantiene el
                  último fotograma hasta terminar la voz.
                </p>
              )}
              <label className="sequence-volume">
                <span>
                  <Volume2 size={16} /> Audio{" "}
                  <strong>{Math.round(chosen.volume * 100)}%</strong>
                </span>
                <input
                  type="range"
                  aria-label="Volumen del clip"
                  min={0}
                  max={100}
                  value={chosen.volume * 100}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    volumeGesture.current = edit.items;
                  }}
                  onPointerUp={finishVolume}
                  onPointerCancel={finishVolume}
                  onBlur={finishVolume}
                  onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  patch(chosen.id, { volume: chosen.volume ? 0 : 1 })
                }
              >
                {chosen.volume ? "Silenciar clip" : "Activar audio"}
              </button>
              <div className="sequence-inspector-actions">
                <button
                  className="button"
                  disabled={clips.indexOf(chosen) === 0}
                  onClick={() => nudge(-1)}
                >
                  <ArrowLeft size={15} /> Antes
                </button>
                <button
                  className="button"
                  disabled={clips.indexOf(chosen) === clips.length - 1}
                  onClick={() => nudge(1)}
                >
                  Después <ArrowRight size={15} />
                </button>
                <button className="button" onClick={duplicate}>
                  <Copy size={15} /> Duplicar
                </button>
                <button className="button" onClick={remove}>
                  <Trash2 size={15} /> Quitar
                </button>
              </div>
            </>
          ) : (
            <p className="hint">
              Selecciona una toma en la línea de tiempo para ajustar sus
              recortes y su audio.
            </p>
          )}
        </aside>
      </div>
      <section className="sequence-timeline" aria-label="Línea de tiempo">
        <div className="sequence-timeline-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="Deshacer"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Rehacer"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
            <button
              className="button"
              disabled={
                !current ||
                time - current.start < FRAME ||
                current.start + current.length - time < FRAME
              }
              onClick={split}
            >
              <Scissors size={16} /> Dividir aquí
            </button>
          </div>
          <span className="sequence-montage-count">
            {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
            {timecode(total)}
          </span>
          <div className="sequence-zoom">
            <button
              className="text-button"
              disabled={!total}
              onClick={() =>
                setZoom(
                  Math.max(
                    4,
                    Math.min(
                      240,
                      ((scroll.current?.clientWidth || 800) - 80) / total,
                    ),
                  ),
                )
              }
            >
              Ajustar
            </button>
            <label>
              Zoom
              <input
                type="range"
                aria-label="Zoom de la línea de tiempo"
                min={4}
                max={240}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
        <div className="sequence-timeline-scroll" ref={scroll}>
          <div
            className="sequence-timeline-track"
            style={{ width: Math.max(600, total * zoom + 100) }}
          >
            <div
              className="sequence-ruler"
              role="slider"
              tabIndex={0}
              aria-label="Cursor de la línea de tiempo"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={time}
              aria-valuetext={timecode(time)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                scrub(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e);
              }}
              onKeyDown={(e) => {
                if (e.key === "Home") seek(0);
                if (e.key === "End") seek(total);
              }}
            >
              {Array.from(
                { length: Math.ceil(total / tickStep) + 1 },
                (_, i) => {
                  const second = i * tickStep;
                  return (
                    <span key={i} style={{ left: second * zoom }}>
                      {timecode(second).slice(0, 5)}
                    </span>
                  );
                },
              )}
            </div>
            <div
              className="sequence-lane"
              data-drop-end={dropTarget === "end"}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget("end");
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setDropTarget(undefined);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(undefined);
                const id = e.dataTransfer.getData("application/sequence-item"),
                  scene = scenes.find(
                    (s) =>
                      s.id ===
                      e.dataTransfer.getData("application/sequence-source"),
                  );
                if (id) move(id);
                else if (scene) add(scene);
              }}
            >
              {clips.map((c, index) => (
                <div
                  key={c.id}
                  className={`sequence-item ${selected === c.id ? "selected" : ""} ${current?.id === c.id ? "is-playing" : ""} ${dropTarget === c.id ? "drop-before" : ""} ${!c.blob ? "unavailable" : ""}`}
                  style={{ width: c.length * zoom }}
                  data-testid="timeline-clip"
                  data-clip-id={c.id}
                  draggable
                  onDragStart={(e) => {
                    if (drag.current) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData("application/sequence-item", c.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const bounds = e.currentTarget.getBoundingClientRect();
                    setDropTarget(
                      e.clientX > bounds.left + bounds.width / 2
                        ? clips[index + 1]?.id || "end"
                        : c.id,
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.dataTransfer.getData(
                        "application/sequence-item",
                      ),
                      scene = scenes.find(
                        (s) =>
                          s.id ===
                          e.dataTransfer.getData("application/sequence-source"),
                      );
                    const bounds = e.currentTarget.getBoundingClientRect();
                    const target =
                      e.clientX > bounds.left + bounds.width / 2
                        ? clips[index + 1]?.id
                        : c.id;
                    if (id) move(id, target);
                    else if (scene) add(scene, target);
                    setDropTarget(undefined);
                  }}
                >
                  <button
                    className="sequence-item-content"
                    aria-label={`Seleccionar toma ${index + 1}: ${c.scene?.title || "Clip"}`}
                    aria-pressed={selected === c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setPanel("inspector");
                      if (current?.id !== c.id) {
                        setPlaying(false);
                        seek(c.start);
                      }
                      if (loop && loop !== c.id) setLoop(c.id);
                    }}
                  >
                    <SequenceFilmstrip
                      blob={c.blob}
                      start={c.in}
                      end={c.out}
                      duration={c.sourceDuration}
                      width={c.length * zoom}
                    />
                    <span className="sequence-item-label">
                      <strong>
                        {index + 1}. {c.scene?.title || "Clip"}
                      </strong>
                      <small>
                        {timecode(c.length)}
                        {c.volume === 0
                          ? " · Sin audio"
                          : c.narration
                            ? " · Voz en off"
                            : ""}
                      </small>
                    </span>
                  </button>
                  {selected === c.id && (
                    <span className="sequence-trim-readout">
                      {timecode(c.in)} → {timecode(c.out)}
                    </span>
                  )}
                  {(["in", "out"] as const).map((side) => (
                    <button
                      key={side}
                      className={`sequence-trim-handle ${side}`}
                      aria-label={`Recortar ${side === "in" ? "inicio" : "final"} de toma ${index + 1}`}
                      onPointerDown={(e) => trimStart(e, c, side)}
                      onPointerMove={trimMove}
                      onPointerUp={trimEnd}
                      onPointerCancel={() => {
                        drag.current = null;
                        setDraft(undefined);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.stopPropagation();
                          e.preventDefault();
                          const value =
                            c[side] + (e.key === "ArrowRight" ? FRAME : -FRAME);
                          patch(c.id, {
                            in: c.in,
                            out: c.out,
                            [side]:
                              side === "in"
                                ? Math.max(0, Math.min(c.out - FRAME, value))
                                : Math.max(
                                    c.in + FRAME,
                                    Math.min(c.sourceDuration, value),
                                  ),
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              ))}
              {!clips.length && (
                <div className="sequence-drop-empty">
                  <Plus size={20} /> Añade clips para empezar tu montaje.
                </div>
              )}
            </div>
            {!!clips.length && (
              <div
                className="sequence-playhead"
                style={{ left: time * zoom }}
                aria-hidden="true"
              >
                <i />
              </div>
            )}
          </div>
        </div>
        <footer className="sequence-timeline-hint">
          <span>Arrastra para ordenar · Tira de los bordes para recortar</span>
          <span>Espacio: reproducir · ← →: un fotograma · S: dividir</span>
        </footer>
        {unresolved && !!clips.length && (
          <p className="hint">
            Un clip está pendiente de lectura o no tiene vídeo. Solo se pueden
            reproducir y exportar vídeos disponibles.
          </p>
        )}
      </section>
      {help && (
        <StudioDialog title="Atajos del editor" onClose={() => setHelp(false)}>
          <div className="sequence-shortcuts">
            {[
              ["Espacio", "Reproducir / pausar"],
              ["← / →", "Un fotograma"],
              ["Mayús + ← / →", "Un segundo"],
              ["I / O", "Empezar / terminar en el cursor"],
              ["S", "Dividir en el cursor"],
              ["⌘ / Ctrl + Z", "Deshacer"],
              ["⌘ / Ctrl + Mayús + Z", "Rehacer"],
              ["Suprimir", "Quitar la toma seleccionada"],
              ["Esc", "Salir de vista ampliada / cancelar recorte"],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="hint">
            Los atajos se aplican al montaje; al escribir en un campo puedes
            usar los controles habituales.
          </p>
        </StudioDialog>
      )}
      {audition && (
        <StudioDialog
          title={audition.title || "Previsualizar clip"}
          onClose={() => setAudition(undefined)}
        >
          <Clip
            className="sequence-source-preview"
            blob={sceneBlob(audition)}
          />
          <p className="hint">{audition.prompt}</p>
          <div className="sequence-audition-actions">
            <button className="button" onClick={() => setAudition(undefined)}>
              <X size={16} /> Cerrar
            </button>
            <button
              className="button primary"
              onClick={() => {
                add(audition);
                setAudition(undefined);
              }}
            >
              <Plus size={16} /> Añadir al montaje
            </button>
          </div>
        </StudioDialog>
      )}
      {download && (
        <VideoDownloadDialog
          video={download}
          onClose={() => setDownload(undefined)}
        />
      )}
    </section>
  );
}
