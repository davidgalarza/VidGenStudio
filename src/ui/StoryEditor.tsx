import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Film,
  ImagePlus,
  Layers,
  LoaderCircle,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import {
  OMNI_MODEL,
  VEO_MODEL,
  sceneBlob,
  activeVersion,
  type Project,
  type StoryConfig,
  type Scene,
  type Narration,
} from "../types";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import {
  getDefaults,
  getElevenLabsKey,
  setElevenLabsKey,
} from "../lib/settings";
import { listVoices, type ElevenVoice } from "../lib/elevenlabs";
import {
  makeStory,
  storyStyles,
  storyPrompt,
  maxStoryDuration,
  storyVideoDuration,
} from "../lib/story";
import { useBlobUrl } from "../lib/useBlobUrl";
import { createZip } from "../lib/archive";
import { downloadBlob } from "../lib/media";
import { Clip } from "./common";
import { ReferencePicker } from "./ReferencePicker";
import "./story.css";

function initialConfig(projectId: string): StoryConfig {
  try {
    const saved = sessionStorage.getItem(`vidgen-story-draft-${projectId}`);
    if (saved) return JSON.parse(saved);
  } catch {
    /* A draft can still be created when session storage is unavailable. */
  }
  return {
    script: "",
    mode: "voiceover",
    style: "realistic",
    direction: "",
    characters: [],
    voiceId: "",
    voiceName: "",
    settings: getDefaults(),
  };
}
function NarrationAudition({
  scene,
  audio,
}: {
  scene: Scene;
  audio: Narration;
}) {
  const url = useBlobUrl(audio.blob);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = scene.story?.audioStart || 0,
    end = scene.story?.audioEnd || audio.duration || 0;
  return (
    <div className="story-audition">
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime >= end) e.currentTarget.pause();
        }}
      />
      <button
        className="text-button"
        onClick={() => {
          const element = ref.current;
          if (!element) return;
          if (playing) element.pause();
          else {
            element.currentTime = start;
            void element
              .play()
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false));
          }
        }}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? "Pausar voz" : "Escuchar fragmento"}
      </button>
      <span>{(end - start).toFixed(1)} s de narración</span>
    </div>
  );
}
function StorySceneCard({
  scene,
  index,
  audio,
  config,
  workspace: w,
}: {
  scene: Scene;
  index: number;
  audio?: Narration;
  config: StoryConfig;
  workspace: WorkspaceController;
}) {
  const [visual, setVisual] = useState(scene.story!.visual);
  const [dialogue, setDialogue] = useState(scene.story!.text);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const busy =
    w.storyJob?.projectId === scene.project_id ||
    w.job?.sceneId === scene.id ||
    w.queue.some((q) => q.sceneId === scene.id);
  const ready = !!sceneBlob(scene);
  const dirty =
    visual !== scene.story!.visual || dialogue !== scene.story!.text;
  async function save() {
    if (
      !visual.trim() ||
      (config.mode === "spoken" && !dialogue.trim()) ||
      saving
    )
      return;
    setSaving(true);
    try {
      const spokenSeconds =
        Math.max(
          dialogue.trim().split(/\s+/).length / 2,
          dialogue.length / 11,
        ) + 1.5;
      if (
        config.mode === "spoken" &&
        spokenSeconds > maxStoryDuration(config.settings)
      )
        throw new Error(
          "Este diálogo es demasiado largo para una toma. Acórtalo para poder decirlo sin prisas.",
        );
      const story = {
        ...scene.story!,
        text: dialogue,
        visual: visual.trim(),
        planned: true,
      };
      await w.patch(scene.id, {
        story,
        prompt: storyPrompt(config, story),
        ...(config.mode === "spoken"
          ? {
              settings: {
                ...scene.settings!,
                duration: storyVideoDuration(spokenSeconds, config.settings),
              },
            }
          : {}),
      });
      setVisual(story.visual);
    } catch (e) {
      w.notify(
        e instanceof Error ? e.message : "No se pudo guardar la escena.",
        true,
      );
    } finally {
      setSaving(false);
    }
  }
  if (deleted) return null;
  const status =
    w.job?.sceneId === scene.id
      ? w.job.text
      : busy
        ? "En cola"
        : scene.error
          ? "Necesita atención"
          : ready
            ? activeVersion(scene)?.prompt !== scene.prompt
              ? "Cambios por generar"
              : "Vídeo listo"
            : scene.story!.planned
              ? "Lista para generar"
              : "Por preparar";
  return (
    <article className="story-scene" aria-label={`Escena ${index + 1}`}>
      <div className="story-scene-media">
        <Clip blob={sceneBlob(scene)} controls />
        <span className="story-shot-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        {!ready && (
          <span className="story-media-label">
            {scene.settings?.duration} s · {scene.settings?.aspectRatio}
          </span>
        )}
      </div>
      <div className="story-scene-content">
        <div className="story-scene-heading">
          <h3>{scene.title}</h3>
          <span className={`story-status ${ready ? "ready" : ""}`}>
            {busy && <LoaderCircle size={13} className="spin" />}
            {status}
          </span>
        </div>
        <div className="story-script-excerpt">
          <span>
            {config.mode === "spoken" ? scene.story!.speaker : "Voz en off"}
          </span>
          {config.mode === "spoken" ? (
            <textarea
              aria-label={`Diálogo de la escena ${index + 1}`}
              value={dialogue}
              disabled={busy}
              rows={2}
              onChange={(e) => setDialogue(e.target.value)}
            />
          ) : (
            <p>{scene.story!.text.trim() || "Pausa de la narración"}</p>
          )}
        </div>
        {audio && <NarrationAudition scene={scene} audio={audio} />}
        <label>
          Lo que se verá
          <textarea
            aria-label={`Imagen de la escena ${index + 1}`}
            value={visual}
            rows={3}
            disabled={busy}
            placeholder="Describe la acción, el encuadre y lo que debe verse en esta escena."
            onChange={(e) => setVisual(e.target.value)}
          />
        </label>
        {scene.error && <p className="inline-error">{scene.error}</p>}
        {(scene.versions?.length || 0) > 1 && (
          <label className="story-takes">
            Toma utilizada
            <select
              aria-label={`Toma de la escena ${index + 1}`}
              value={scene.active_version_id}
              disabled={busy}
              onChange={(e) =>
                void w.action(() =>
                  w.patch(scene.id, { active_version_id: e.target.value }),
                )
              }
            >
              {scene.versions?.map((v, i) => (
                <option key={v.id} value={v.id}>
                  Toma {i + 1}
                  {i === scene.versions!.length - 1 ? " · más reciente" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="story-scene-actions">
          {dirty ? (
            <button
              className="button compact"
              disabled={
                saving ||
                !visual.trim() ||
                (config.mode === "spoken" && !dialogue.trim()) ||
                busy
              }
              onClick={() => void save()}
            >
              <Save size={14} />
              Guardar cambios
            </button>
          ) : (
            <button
              className="button compact"
              disabled={busy || !scene.story!.planned}
              onClick={() =>
                void (scene.task?.remoteId
                  ? w.run([scene.id], "generate", undefined, true)
                  : w.runStory([scene.id]))
              }
            >
              {ready ? <RotateCcw size={14} /> : <Play size={14} />}
              {scene.task?.remoteId
                ? "Recuperar resultado"
                : ready
                  ? "Regenerar imagen"
                  : "Generar escena"}
            </button>
          )}
          {ready && (
            <span className="hint">
              {config.mode === "voiceover"
                ? "La voz se conserva al regenerar."
                : "Revisa que se escuche todo el texto."}
            </span>
          )}
          <button
            className="icon-button"
            aria-label={`Eliminar escena ${index + 1}`}
            disabled={busy}
            onClick={() =>
              void w.action(async () => {
                await db.deleteScene(scene.id);
                setDeleted(true);
              }, "Escena movida a la papelera. Puedes restaurarla desde Clips.")
            }
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function StoryEditor({
  project,
  workspace: w,
  onBack,
  onSequence,
  onSettings,
}: {
  project: Project;
  workspace: WorkspaceController;
  onBack: () => void;
  onSequence: () => void;
  onSettings: () => void;
}) {
  const [config, setConfig] = useState<StoryConfig>(
    () => project.story || initialConfig(project.id),
  );
  const [key, setKey] = useState(getElevenLabsKey);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [creating, setCreating] = useState(false);
  const [packaging, setPackaging] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState<number>();
  const story = project.story;
  const busy = w.storyJob?.projectId === project.id;
  const scenes = (story?.blocks.flatMap((b) => b.sceneIds || []) || []).flatMap(
    (id) => w.scenes.find((s) => s.id === id) || [],
  );
  const prepared =
    !!story &&
    story.blocks.every((b) => !!b.sceneIds) &&
    scenes.every((s) => s.story?.planned);
  const ready = scenes.filter((s) => sceneBlob(s)).length;
  const pending = scenes.filter(
    (s) =>
      s.story?.planned &&
      !sceneBlob(s) &&
      !s.task?.remoteId &&
      w.job?.sceneId !== s.id &&
      !w.queue.some((q) => q.sceneId === s.id),
  );
  const words = config.script.trim().split(/\s+/).filter(Boolean).length;
  const seconds = scenes.reduce(
    (sum, s) =>
      sum +
      (s.story?.audioId
        ? (s.story.audioEnd || 0) - (s.story.audioStart || 0)
        : s.settings?.duration || 0),
    0,
  );
  useEffect(() => {
    if (!story)
      try {
        sessionStorage.setItem(
          `vidgen-story-draft-${project.id}`,
          JSON.stringify(config),
        );
      } catch {
        /* Preserve the editor even when storage is full. */
      }
  }, [config, story, project.id]);
  async function connect() {
    setLoadingVoices(true);
    setError("");
    try {
      const result = await listVoices(key);
      setElevenLabsKey(key);
      setVoices(result);
      if (!config.voiceId && result[0])
        setConfig((c) => ({
          ...c,
          voiceId: result[0].voice_id,
          voiceName: result[0].name,
        }));
      if (!result.length)
        setError(
          "No hay voces disponibles. Añade una voz en tu cuenta de ElevenLabs o introduce su ID.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo conectar con ElevenLabs.",
      );
    } finally {
      setLoadingVoices(false);
    }
  }
  async function create() {
    if (creating || w.storyJob) return;
    setCreating(true);
    setError("");
    try {
      if (config.mode === "voiceover") {
        if (!key.trim())
          throw new Error(
            "Añade tu clave de ElevenLabs para generar la narración.",
          );
        setElevenLabsKey(key);
      }
      const next = makeStory(config);
      await db.createStory(project.id, next);
      await w.refresh();
      sessionStorage.removeItem(`vidgen-story-draft-${project.id}`);
      void w.prepareStory(project.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo crear la historia.",
      );
    } finally {
      setCreating(false);
    }
  }
  async function downloadMaterials() {
    if (!story || packaging) return;
    setPackaging(true);
    try {
      const audio = story.blocks.flatMap((b, i) =>
        w.narrations
          .filter((n) => n.block_id === b.id)
          .map((n) => ({
            id: n.id,
            name: `voz-${String(i + 1).padStart(3, "0")}.mp3`,
            blob: n.blob,
          })),
      );
      const manifest = {
        format: "vidgen-story-materials-v1",
        mode: story.mode,
        voice: story.voiceName,
        scenes: scenes.map((s) => ({
          title: s.title,
          text: s.story!.text,
          speaker: s.story!.speaker,
          visual: s.story!.visual,
          audio_file: audio.find((a) => a.id === s.story!.audioId)?.name,
          audio_start: s.story!.audioStart,
          audio_end: s.story!.audioEnd,
        })),
      };
      downloadBlob(
        await createZip([
          ...audio,
          {
            name: "guion.txt",
            blob: new Blob([story.script], {
              type: "text/plain;charset=utf-8",
            }),
          },
          {
            name: "escenas.json",
            blob: new Blob([JSON.stringify(manifest, null, 2)], {
              type: "application/json",
            }),
          },
        ]),
        "historia-materiales.zip",
      );
    } catch (e) {
      w.notify(
        e instanceof Error
          ? e.message
          : "No se pudieron descargar los materiales.",
        true,
      );
    } finally {
      setPackaging(false);
    }
  }
  return (
    <div className="story-editor">
      <header className="story-top">
        <div className="inline">
          <button
            className="icon-button"
            aria-label="Volver a los clips"
            onClick={onBack}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="eyebrow">{project.name}</span>
            <h1>Historia</h1>
          </div>
        </div>
        <button className="button" disabled={busy} onClick={onSequence}>
          <Layers size={16} />
          Abrir montaje
        </button>
      </header>
      <div className={`story-layout ${story ? "has-story" : ""}`}>
        <aside className="story-sidebar">
          <div className="story-intro">
            <BookOpen size={23} strokeWidth={1.5} />
            <h2>Tu guion, escena a escena.</h2>
            <p>La voz lleva el hilo. Tú decides cómo se cuenta cada parte.</p>
          </div>
          {story ? (
            <>
              <dl className="story-summary">
                <div>
                  <dt>Forma de narrar</dt>
                  <dd>
                    {story.mode === "voiceover"
                      ? `Voz en off · ${story.voiceName || story.voiceId}`
                      : "Personajes hablando"}
                  </dd>
                </div>
                <div>
                  <dt>Estilo visual</dt>
                  <dd>
                    {storyStyles.find((s) => s.id === story.style)?.label}
                  </dd>
                </div>
                <div>
                  <dt>Formato</dt>
                  <dd>
                    {story.settings.aspectRatio} · {story.settings.resolution}
                  </dd>
                </div>
                <div>
                  <dt>Montaje previsto</dt>
                  <dd>
                    {scenes.length} escenas ·{" "}
                    {Math.floor(Math.ceil(seconds) / 60)}:
                    {String(Math.ceil(seconds) % 60).padStart(2, "0")}{" "}
                    {story.mode === "spoken" && "aprox."}
                  </dd>
                </div>
              </dl>
              <details>
                <summary>Ver guion original</summary>
                <p className="story-original">{story.script}</p>
              </details>
              {!!story.characters.length && (
                <details>
                  <summary>Personajes y continuidad</summary>
                  {story.characters.map((c, i) => (
                    <p key={i}>
                      <strong>{c.name}</strong>
                      <br />
                      {c.description}
                      <br />
                      {c.voice}
                    </p>
                  ))}
                </details>
              )}
              <p className="hint">
                En el montaje puedes mover, recortar o quitar escenas. La voz en
                off viaja con cada fragmento.
              </p>
              {story.mode === "voiceover" && (
                <p className="hint">
                  La previsualización con voz y el vídeo completo están en
                  «Abrir montaje». Los clips de la biblioteca conservan su vídeo
                  original.
                </p>
              )}
              {story.mode === "spoken" && (
                <p className="hint">
                  Las voces generadas pueden variar entre tomas. Revisa el
                  diálogo; para una voz estable usa voz en off.
                </p>
              )}
              <button
                className="button compact"
                disabled={packaging || busy}
                onClick={() => void downloadMaterials()}
              >
                {packaging ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Save size={14} />
                )}
                {story.mode === "voiceover"
                  ? "Descargar voz y guion"
                  : "Descargar guion y plan"}
              </button>
              <button className="text-button" onClick={onSettings}>
                Ajustes de las conexiones <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <div className="story-steps">
                <p>
                  <strong>1</strong> Pega el guion y elige cómo contarlo.
                </p>
                <p>
                  <strong>2</strong> Revisa la voz y las escenas propuestas.
                </p>
                <p>
                  <strong>3</strong> Genera, ajusta y monta el resultado.
                </p>
              </div>
              <p className="hint">
                El guion se divide automáticamente según el límite de cada
                vídeo. Las generaciones usan tus cuentas de Google y, para voz
                en off, ElevenLabs.
              </p>
              <button className="text-button" onClick={onSettings}>
                Configurar conexiones <ArrowRight size={14} />
              </button>
            </>
          )}
        </aside>
        <div className="story-main">
          {!story ? (
            <>
              <section className="story-section">
                <div className="story-section-heading">
                  <h2>¿Cómo se escuchará la historia?</h2>
                </div>
                <div className="story-mode-options">
                  <button
                    className={config.mode === "voiceover" ? "selected" : ""}
                    aria-pressed={config.mode === "voiceover"}
                    onClick={() => setConfig({ ...config, mode: "voiceover" })}
                  >
                    <Mic size={21} />
                    <strong>Voz en off</strong>
                    <span>Una narración continua, acompañada de imágenes.</span>
                  </button>
                  <button
                    className={config.mode === "spoken" ? "selected" : ""}
                    aria-pressed={config.mode === "spoken"}
                    onClick={() =>
                      setConfig({
                        ...config,
                        mode: "spoken",
                        characters: config.characters.length
                          ? config.characters
                          : [
                              {
                                name: "Personaje",
                                description: "",
                                voice:
                                  "Español, tono cálido y natural, ritmo tranquilo.",
                              },
                            ],
                      })
                    }
                  >
                    <Users size={21} />
                    <strong>Personajes hablando</strong>
                    <span>
                      El diálogo y la voz se generan dentro del vídeo.
                    </span>
                  </button>
                </div>
              </section>
              <section className="story-section">
                <label className="story-script-label">
                  Guion completo
                  <textarea
                    className="story-script-input"
                    aria-label="Guion completo"
                    rows={9}
                    value={config.script}
                    onChange={(e) =>
                      setConfig({ ...config, script: e.target.value })
                    }
                    placeholder={
                      config.mode === "voiceover"
                        ? "Pega aquí exactamente lo que quieres que se escuche, de principio a fin…"
                        : "Escribe lo que dirán los personajes. Si hay varios, usa sus nombres:\nAna: Mira cómo cambia la luz.\nLuis: Es el comienzo de un nuevo día."
                    }
                  />
                </label>
                <div className="story-script-meta">
                  <span>{words} palabras</span>
                  <span>
                    {words
                      ? `≈ ${Math.max(1, Math.round(words / 2.2))} s de voz`
                      : "El texto se conserva sin resumir"}
                  </span>
                </div>
              </section>
              {config.mode === "voiceover" && (
                <section className="story-section">
                  <h2>Una voz para toda la historia</h2>
                  <div className="story-connection">
                    <label>
                      ElevenLabs API key
                      <input
                        type="password"
                        autoComplete="off"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Tu clave de ElevenLabs"
                      />
                    </label>
                    <button
                      className="button"
                      disabled={loadingVoices || !key.trim()}
                      onClick={() => void connect()}
                    >
                      {loadingVoices ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Mic size={15} />
                      )}
                      Cargar mis voces
                    </button>
                  </div>
                  <div className="field-row">
                    <label>
                      Voz
                      {voices.length ? (
                        <select
                          aria-label="Voz"
                          value={config.voiceId}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              voiceId: e.target.value,
                              voiceName:
                                voices.find(
                                  (v) => v.voice_id === e.target.value,
                                )?.name || "",
                            })
                          }
                        >
                          {config.voiceId &&
                            !voices.some(
                              (v) => v.voice_id === config.voiceId,
                            ) && (
                              <option value={config.voiceId}>
                                {config.voiceName || config.voiceId}
                              </option>
                            )}
                          {voices.map((v) => (
                            <option value={v.voice_id} key={v.voice_id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label="Voz"
                          value={config.voiceId}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              voiceId: e.target.value,
                              voiceName: "",
                            })
                          }
                          placeholder="Carga tus voces o pega un Voice ID"
                        />
                      )}
                    </label>
                  </div>
                  <p className="hint">
                    La misma voz y configuración en todo el guion. La clave se
                    guarda solo en este navegador y se envía a ElevenLabs.
                  </p>
                </section>
              )}
              <section className="story-section">
                <div className="field-row">
                  <label>
                    Estilo visual
                    <select
                      aria-label="Estilo visual"
                      value={config.style}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          style: e.target.value as StoryConfig["style"],
                        })
                      }
                    >
                      {storyStyles.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Formato
                    <select
                      aria-label="Formato de la historia"
                      value={config.settings.aspectRatio}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          settings: {
                            ...config.settings,
                            aspectRatio: e.target.value as "9:16" | "16:9",
                          },
                        })
                      }
                    >
                      <option value="9:16">Vertical · 9:16</option>
                      <option value="16:9">Horizontal · 16:9</option>
                    </select>
                  </label>
                </div>
                <label>
                  Dirección creativa <span className="hint">opcional</span>
                  <textarea
                    rows={2}
                    value={config.direction}
                    onChange={(e) =>
                      setConfig({ ...config, direction: e.target.value })
                    }
                    placeholder="Ambiente, época, tono, colores o cómo quieres explicar las ideas…"
                  />
                </label>
                <details>
                  <summary>Modelo y calidad</summary>
                  <div className="field-row">
                    <label>
                      Modelo
                      <select
                        aria-label="Modelo de la historia"
                        value={config.settings.model}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            settings: {
                              ...config.settings,
                              model: e.target.value as
                                typeof OMNI_MODEL | typeof VEO_MODEL,
                              resolution: "720p",
                            },
                          })
                        }
                      >
                        <option value={OMNI_MODEL}>Omni 1.1 Flash</option>
                        <option value={VEO_MODEL}>Veo 3.1</option>
                      </select>
                    </label>
                    <label>
                      Resolución
                      <select
                        aria-label="Resolución de la historia"
                        value={config.settings.resolution}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            settings: {
                              ...config.settings,
                              resolution: e.target
                                .value as StoryConfig["settings"]["resolution"],
                            },
                          })
                        }
                      >
                        {(config.settings.model === OMNI_MODEL
                          ? ["360p", "720p", "1080p", "4k"]
                          : ["720p", "1080p"]
                        ).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="hint">
                    La duración se ajusta automáticamente para cubrir cada parte
                    del guion.
                  </p>
                </details>
              </section>
              <section className="story-section">
                <div className="story-section-heading">
                  <h2>
                    {config.mode === "spoken"
                      ? "Personajes y voces"
                      : "Personajes recurrentes"}
                  </h2>
                  <span className="hint">
                    {config.mode === "voiceover"
                      ? "opcional"
                      : "La misma identidad en cada toma"}
                  </span>
                </div>
                {config.characters.map((c, i) => (
                  <div className="story-character" key={i}>
                    <div className="field-row">
                      <label>
                        Nombre
                        <input
                          aria-label={`Nombre del personaje ${i + 1}`}
                          value={c.name}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              characters: config.characters.map((p, n) =>
                                n === i ? { ...p, name: e.target.value } : p,
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`Eliminar personaje ${i + 1}`}
                        disabled={
                          config.mode === "spoken" &&
                          config.characters.length === 1
                        }
                        onClick={() =>
                          setConfig({
                            ...config,
                            characters: config.characters.filter(
                              (_, n) => n !== i,
                            ),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label>
                      Apariencia y vestuario
                      <input
                        value={c.description}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            characters: config.characters.map((p, n) =>
                              n === i
                                ? { ...p, description: e.target.value }
                                : p,
                            ),
                          })
                        }
                        placeholder="Rasgos que deben mantenerse en todas las escenas"
                      />
                    </label>
                    {config.mode === "spoken" && (
                      <label>
                        Cómo suena su voz
                        <input
                          value={c.voice}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              characters: config.characters.map((p, n) =>
                                n === i ? { ...p, voice: e.target.value } : p,
                              ),
                            })
                          }
                          placeholder="Idioma, acento, tono, timbre y ritmo"
                        />
                      </label>
                    )}
                    <button
                      className="button compact story-reference"
                      onClick={() => setReference(i)}
                    >
                      {c.referenceId ? (
                        <img
                          src={
                            w.assets.find((a) => a.id === c.referenceId)
                              ?.data_url
                          }
                          alt="Referencia del personaje"
                        />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                      {c.referenceId
                        ? "Cambiar referencia"
                        : "Elegir referencia visual"}
                    </button>
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      characters: [
                        ...config.characters,
                        {
                          name: `Personaje ${config.characters.length + 1}`,
                          description: "",
                          voice: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={15} />
                  Añadir personaje
                </button>
                {config.mode === "spoken" && (
                  <p className="hint">
                    Para varios personajes, escribe «Nombre: diálogo» al inicio
                    de cada intervención. Las descripciones ayudan a mantener
                    las voces; el modelo puede variarlas entre tomas. Para una
                    voz estable, elige voz en off.
                  </p>
                )}
              </section>
              {error && (
                <p role="alert" className="inline-error">
                  {error}
                </p>
              )}
              <footer className="story-create-footer">
                <p>
                  Preparar crea el plan
                  {config.mode === "voiceover"
                    ? " y la narración de ElevenLabs"
                    : " visual con Gemini"}
                  . Después podrás revisar las escenas antes de generar los
                  vídeos.
                </p>
                <button
                  className="button primary"
                  disabled={!config.script.trim() || creating || !!w.storyJob}
                  onClick={() => void create()}
                >
                  {creating ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  Preparar historia
                </button>
              </footer>
            </>
          ) : (
            <>
              <div className="story-board-heading">
                <div>
                  <h2>
                    {busy ? "Preparando tu historia" : "Escenas de la historia"}
                  </h2>
                  <p>
                    {ready} de {scenes.length} vídeos listos. Puedes cambiar
                    cada imagen por separado.
                  </p>
                </div>
                {prepared && (
                  <button
                    className="button primary"
                    disabled={!pending.length}
                    onClick={() => void w.runStory(pending.map((s) => s.id))}
                  >
                    <Play size={15} />
                    Generar vídeos{pending.length > 0 && ` · ${pending.length}`}
                  </button>
                )}
              </div>
              {busy && (
                <div className="story-progress" role="status">
                  <LoaderCircle size={18} className="spin" />
                  <div>
                    <strong>{w.storyJob!.text}</strong>
                    <p>
                      {w.storyJob!.stopping
                        ? "Se pausará al terminar la solicitud actual."
                        : "Puedes seguir trabajando. Mantén esta pestaña abierta."}
                    </p>
                  </div>
                  <button
                    className="button compact"
                    disabled={w.storyJob!.stopping}
                    onClick={w.pauseStory}
                  >
                    Pausar
                  </button>
                </div>
              )}
              {story.error && (
                <p className="inline-error" role="alert">
                  {story.error}
                </p>
              )}
              {!prepared && !busy && (
                <div className="story-progress">
                  <Film size={20} />
                  <div>
                    <strong>Hay partes por preparar</strong>
                    <p>Los audios y las escenas ya guardados se reutilizan.</p>
                  </div>
                  <button
                    className="button"
                    disabled={!!w.storyJob}
                    onClick={() => void w.prepareStory(project.id)}
                  >
                    Continuar preparación
                  </button>
                </div>
              )}
              {prepared && !busy && (
                <div className="story-ready-note">
                  <Check size={16} />
                  <p>
                    El guion está dividido y añadido al montaje. Genera los
                    vídeos y abre el montaje para verlos con su audio.
                  </p>
                </div>
              )}
              <div className="story-scenes">
                {scenes.map((scene, index) => (
                  <StorySceneCard
                    key={`${scene.id}:${scene.story?.planned}`}
                    scene={scene}
                    index={index}
                    config={story}
                    audio={w.narrations.find(
                      (a) => a.id === scene.story?.audioId,
                    )}
                    workspace={w}
                  />
                ))}
              </div>
              {!!scenes.length && (
                <button
                  className="button story-montage-link"
                  disabled={busy}
                  onClick={onSequence}
                >
                  <Layers size={16} />
                  Reordenar y recortar en el montaje <ArrowRight size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {reference !== undefined && (
        <ReferencePicker
          role="first"
          title="Referencia del personaje"
          description="Elige una imagen clara para mantener su apariencia entre escenas. Puedes subir una nueva o arrastrarla aquí."
          actionLabel="Usar para este personaje"
          assets={w.assets}
          selectedIds={
            config.characters[reference]?.referenceId
              ? [config.characters[reference].referenceId!]
              : []
          }
          onApply={async (ids) =>
            setConfig({
              ...config,
              characters: config.characters.map((c, i) =>
                i === reference ? { ...c, referenceId: ids[0] } : c,
              ),
            })
          }
          onRefresh={w.refresh}
          onClose={() => setReference(undefined)}
        />
      )}
    </div>
  );
}
