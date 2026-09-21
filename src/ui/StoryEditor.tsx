import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Download,
  Film,
  ImagePlus,
  Layers,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  Scissors,
  Search,
} from "lucide-react";
import {
  OMNI_MODEL,
  VEO_MODEL,
  sceneBlob,
  activeVersion,
  type Project,
  type Story,
  type StoryConfig,
  type StoryMode,
  type StoryStyleProfile,
  type StoryBlock,
  type Scene,
  type Narration,
  type DialogueTurn,
} from "../types";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { newStoryProposal } from "../lib/storyPlanner";
import { getApiKey } from "../lib/settings";
import { geminiVoices } from "../lib/geminiSpeech";
import {
  storyStyles,
  storyPrompt,
  maxStoryDuration,
  storyVideoDuration,
  storyReferenceIds,
  renameSpeakerLabel,
} from "../lib/story";
import { useBlobUrl } from "../lib/useBlobUrl";
import { createZip } from "../lib/archive";
import { downloadBlob } from "../lib/media";
import { Clip } from "./common";
import { StoryCastReview } from "./StoryCastReview";
import { PromptReview } from "./PromptReview";
import {
  normalizeStoryCast,
  assignStorySpeaker,
  blockSpeaker,
  storyCastIssues,
  castIssueMessage,
} from "../lib/storyCast";
import { ReferencePicker } from "./ReferencePicker";
import { StoryStylePicker } from "./StoryStylePicker";
import {
  createStyleProfile,
  profileForMode,
  validStyleProfile,
} from "../lib/storyStyles";
import {
  DialogueEditor,
  SceneConversation,
  SceneStaging,
} from "./DialogueEditor";
import { DialogueReview } from "./DialogueReview";
import {
  blockDialogue,
  dialoguePatch,
  dialogueSeconds,
  planDialogueShots,
} from "../lib/storyDialogue";
import "./story.css";
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
  const [turns, setTurns] = useState(scene.story!.dialogue);
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const busy =
    w.storyJob?.projectId === scene.project_id ||
    !!w.jobFor(scene.id) ||
    w.queue.some((q) => q.sceneId === scene.id);
  const ready = !!sceneBlob(scene);
  const dirty =
    visual !== scene.story!.visual ||
    dialogue !== scene.story!.text ||
    JSON.stringify(turns) !== JSON.stringify(scene.story!.dialogue);
  async function save(nextVisual = visual, reviewed = false) {
    if (
      !nextVisual.trim() ||
      (config.mode === "spoken" &&
        (turns
          ? turns.some(
              (t) =>
                !t.text.trim() ||
                !config.characters.some((c) => c.name === t.speaker),
            )
          : !dialogue.trim())) ||
      saving
    )
      return false;
    setSaving(true);
    try {
      const spokenSeconds = dialogueSeconds(
        turns || [
          { id: scene.id, speaker: scene.story?.speaker || "", text: dialogue },
        ],
      );
      if (
        !reviewed &&
        config.mode === "spoken" &&
        spokenSeconds > maxStoryDuration(config.settings)
      )
        throw new Error(
          "Este diálogo es demasiado largo para una toma. Acórtalo para poder decirlo sin prisas.",
        );
      const story = {
        ...scene.story!,
        text: reviewed
          ? scene.story!.text
          : turns
            ? turns.map((t) => t.text).join("\n")
            : dialogue,
        dialogue: reviewed ? scene.story!.dialogue : turns,
        speaker: reviewed
          ? scene.story!.speaker
          : turns
            ? new Set(turns.map((t) => t.speaker)).size === 1
              ? turns[0].speaker
              : undefined
            : scene.story!.speaker,
        participants: reviewed
          ? scene.story!.participants
          : turns
            ? [
                ...new Set([
                  ...turns.map((t) => t.speaker),
                  ...(scene.story!.participants || []).filter(
                    (name) =>
                      !scene.story!.dialogue?.some((t) => t.speaker === name),
                  ),
                ]),
              ]
            : scene.story!.participants,
        visual: nextVisual.trim(),
        planned: true,
      };
      let referenceIds = scene.reference_asset_ids?.length
        ? scene.reference_asset_ids
        : scene.first_frame_asset_id
          ? [scene.first_frame_asset_id]
          : [];
      const automatic =
        scene.story!.autoReferenceIds !== undefined &&
        JSON.stringify(referenceIds) ===
          JSON.stringify(scene.story!.autoReferenceIds) &&
        JSON.stringify(turns?.map((t) => t.speaker)) !==
          JSON.stringify(scene.story!.dialogue?.map((t) => t.speaker));
      if (!reviewed && automatic) {
        referenceIds = storyReferenceIds(
          config,
          story.speaker,
          undefined,
          story.participants,
          story.locationName,
        ).slice(0, config.settings.model === OMNI_MODEL ? 3 : 1);
        story.autoReferenceIds = referenceIds;
      }
      const prompt = storyPrompt(config, story, referenceIds);
      await w.patch(scene.id, {
        story,
        ...(!reviewed && automatic
          ? {
              reference_asset_ids:
                config.settings.model === OMNI_MODEL ? referenceIds : [],
              first_frame_asset_id:
                config.settings.model !== OMNI_MODEL
                  ? referenceIds[0]
                  : undefined,
            }
          : {}),
        ...(reviewed
          ? {
              error: undefined,
              task: undefined,
              status: ready ? ("completed" as const) : ("pending" as const),
              ...(scene.output_request
                ? {
                    output_request: {
                      ...scene.output_request,
                      task: {
                        ...scene.output_request.task,
                        prompt,
                        remoteId: undefined,
                      },
                    },
                  }
                : {}),
            }
          : {}),
        prompt,
        ...(!reviewed && config.mode === "spoken"
          ? {
              settings: {
                ...scene.settings!,
                duration: storyVideoDuration(spokenSeconds, config.settings),
              },
            }
          : {}),
      });
      setVisual(story.visual);
      if (!reviewed) setDialogue(story.text);
      return true;
    } catch (e) {
      w.notify(
        e instanceof Error ? e.message : "No se pudo guardar la escena.",
        true,
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  if (deleted) return null;
  const status = w.jobFor(scene.id)
    ? w.jobFor(scene.id)!.text
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
    <article
      className={`story-scene ${turns ? "has-dialogue" : ""}`}
      aria-label={`Escena ${index + 1}`}
    >
      <div
        className="story-scene-media"
        style={
          turns
            ? { aspectRatio: scene.settings?.aspectRatio.replace(":", " / ") }
            : undefined
        }
      >
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
        <div
          className={
            turns ? "story-conversation-excerpt" : "story-script-excerpt"
          }
        >
          {!turns && (
            <span>
              {config.mode === "spoken" ? scene.story!.speaker : "Voz en off"}
            </span>
          )}
          {config.mode === "spoken" && turns ? (
            <DialogueEditor
              turns={turns}
              config={config}
              assets={w.assets}
              label={`la toma ${index + 1}`}
              disabled={busy}
              onChange={setTurns}
            />
          ) : config.mode === "spoken" ? (
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
        {scene.story!.part && config.mode === "voiceover" && (
          <p className="hint">
            Tramo {scene.story!.part.index} de {scene.story!.part.total} de la
            misma narración. El texto corresponde a la escena completa.
          </p>
        )}
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
        <PromptReview
          error={scene.error}
          disabled={busy || saving}
          input={{
            description: visual,
            lockedText: scene.story!.text,
            context: storyPrompt(
              config,
              { ...scene.story!, visual },
              scene.reference_asset_ids || [],
            ),
            referenceCount:
              (scene.reference_asset_ids?.length || 0) +
              Number(!!scene.first_frame_asset_id) +
              Number(!!scene.last_frame_asset_id),
          }}
          onApply={async (description) => {
            if (!(await save(description, true)))
              throw new Error(
                "No se pudo aplicar la descripción. Revisa los campos de la escena.",
              );
            w.notify(
              "Descripción aplicada. Pulsa Generar escena cuando quieras crear el vídeo.",
            );
          }}
        />
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
        {ready && config.mode === "spoken" && (
          <DialogueReview
            key={`${activeVersion(scene)?.id || scene.updated_at}:${scene.prompt}`}
            blob={sceneBlob(scene)!}
            turns={
              scene.story!.dialogue || [
                {
                  id: scene.id,
                  speaker:
                    scene.story!.speaker || config.characters[0]?.name || "",
                  text: scene.story!.text,
                },
              ]
            }
            config={config}
            disabled={busy || saving || dirty}
          />
        )}
        <div className="story-scene-actions">
          {dirty ? (
            <button
              className="button compact"
              disabled={
                saving ||
                !visual.trim() ||
                (config.mode === "spoken" &&
                  (turns
                    ? turns.some((t) => !t.text.trim())
                    : !dialogue.trim())) ||
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
                  ? config.mode === "spoken"
                    ? "Regenerar toma"
                    : "Regenerar imagen"
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

type StoryProps = { project: Project; workspace: WorkspaceController };
function ScriptEntry({
  project,
  workspace: w,
  onSettings,
}: StoryProps & { onSettings: () => void }) {
  const [initial] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem(`vidgen-story-draft-${project.id}`) || "{}",
      );
    } catch {
      return {};
    }
  });
  const [script, setScript] = useState<string>(initial.script || "");
  const [mode, setMode] = useState<StoryMode>(
    initial.mode === "spoken" ? "spoken" : "voiceover",
  );
  const [styleProfile, setStyleProfile] = useState<StoryStyleProfile>(() =>
    validStyleProfile(initial.styleProfile)
      ? initial.styleProfile
      : createStyleProfile(
          initial.style || "realistic",
          initial.mode === "spoken" ? "spoken" : "voiceover",
        ),
  );
  const style = styleProfile.base;
  const [direction, setDirection] = useState<string>(initial.direction || "");
  const [references, setReferences] = useState(initial.references !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `vidgen-story-draft-${project.id}`,
        JSON.stringify({
          script,
          mode,
          style,
          styleProfile,
          direction,
          references,
        }),
      );
    } catch {
      /* The input remains editable if storage is unavailable. */
    }
  }, [script, mode, style, styleProfile, direction, references, project.id]);
  async function propose() {
    if (busy || w.storyJob) return;
    setBusy(true);
    setError("");
    try {
      if (!getApiKey())
        throw new Error(
          "Conecta tu clave de Google para preparar la propuesta.",
        );
      await db.createStory(
        project.id,
        newStoryProposal(script, {
          mode,
          style,
          styleProfile,
          direction,
          autoReferences: references,
        }),
      );
      await w.refresh();
      sessionStorage.removeItem(`vidgen-story-draft-${project.id}`);
      void w.prepareStory(project.id, "plan");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo preparar la propuesta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="story-start">
      <div className="story-start-heading">
        <BookOpen size={26} strokeWidth={1.5} />
        <h2>Empieza por lo que quieres contar.</h2>
        <p>
          Pega lo que se escuchará. Gemini organiza la historia, los personajes,
          los lugares y las tomas. Todo queda editable antes de producir.
        </p>
      </div>
      <div className="story-entry-direction">
        <label>
          Cómo se escucha
          <select
            aria-label="Preferencia de narración"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as StoryMode;
              setMode(next);
              setStyleProfile((p) => profileForMode(p, next));
            }}
          >
            <option value="spoken">Personajes hablando</option>
            <option value="voiceover">Voz en off · Gemini TTS</option>
          </select>
          <small>
            {mode === "spoken"
              ? "Un personaje: pega sus palabras. Varios: indica quién dice cada parte."
              : mode === "voiceover"
                ? "Pega exactamente lo que leerá la voz. La IA crea las imágenes que lo acompañan."
                : "Pega un monólogo, una conversación o una narración; la IA propone cómo contarlo."}
          </small>
        </label>
        <StoryStylePicker
          value={style}
          profile={styleProfile}
          mode={mode}
          onChange={setStyleProfile}
        />
      </div>
      <label className="story-script-label">
        Guion completo
        <textarea
          className="story-script-input"
          aria-label="Guion completo"
          rows={10}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={
            mode === "spoken"
              ? "Pega un monólogo, sin más indicaciones.\n\nSi hay varios personajes:\nAna: ¿Qué hay detrás de esa puerta?\nLeo: Vamos a descubrirlo."
              : "Escribe o pega aquí lo que se escuchará en tu historia…"
          }
        />
      </label>
      <div className="story-script-meta">
        <span>
          {script.trim().split(/\s+/).filter(Boolean).length} palabras
        </span>
        <span>El guion se conserva, sin resumirlo</span>
      </div>
      <details className="story-preferences">
        <summary>
          <Settings2 size={15} />
          Dar indicaciones <span>opcional</span>
        </summary>
        <label>
          Lo que tienes en mente
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            rows={2}
            placeholder="Por ejemplo: una explicación visual para principiantes, con animación 2D y tono cercano."
          />
        </label>
      </details>
      <label className="story-reference-switch">
        <input
          type="checkbox"
          checked={references}
          onChange={(e) => setReferences(e.target.checked)}
        />
        <span>
          <strong>Crear también las referencias visuales</strong>
          <small>
            Nano Banana prepara personajes, escenarios y objetos para mantener
            su apariencia entre tomas. Podrás cambiarlos después.
          </small>
        </span>
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="story-start-actions">
        <p>
          Se usa tu clave de Google. Esta etapa consume texto
          {references ? " e imágenes" : ""}; la voz y los vídeos se producen
          después de tu revisión.
        </p>
        {getApiKey() ? (
          <button
            className="button primary"
            disabled={!script.trim() || busy || !!w.storyJob}
            onClick={() => void propose()}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Crear propuesta
          </button>
        ) : (
          <button className="button primary" onClick={onSettings}>
            Conectar Google <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
function ProposalEditor({ project, workspace: w }: StoryProps) {
  const original = project.story!;
  const cacheKey = `vidgen-story-review-${project.id}`;
  const [cached] = useState<Story | undefined>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(cacheKey) || "null",
      ) as Story | null;
      return value?.id === original.id ? value : undefined;
    } catch {
      return undefined;
    }
  });
  const [conflict, setConflict] = useState(
    cached && cached.revision !== original.revision ? cached : undefined,
  );
  const [draft, setDraft] = useState<Story>(
    normalizeStoryCast(
      cached && cached.revision === original.revision ? cached : original,
    ),
  );
  function recoverDraft() {
    if (!conflict) return;
    const exists = (id?: string) => !!id && w.assets.some((a) => a.id === id);
    setDraft(
      normalizeStoryCast({
        ...conflict,
        phase: original.phase,
        revision: original.revision,
        error: original.error,
        references: conflict.references?.map((r) => ({
          ...r,
          assetId: exists(r.assetId) ? r.assetId : undefined,
        })),
        characters: conflict.characters.map((c) => ({
          ...c,
          referenceId: exists(c.referenceId) ? c.referenceId : undefined,
        })),
        blocks: conflict.blocks.map((b) => ({
          ...b,
          referenceIds: b.referenceIds?.filter(exists),
        })),
      }),
    );
    setConflict(undefined);
  }
  const [tab, setTab] = useState<"scenes" | "references" | "direction">(
    "scenes",
  );
  const [onlyIssues, setOnlyIssues] = useState(false);
  const sceneNodes = useRef(new Map<string, HTMLElement>());
  const castIssues = storyCastIssues(draft);
  const issueIds = new Set(castIssues.map((issue) => issue.blockId));
  const contentIssues = draft.blocks.flatMap((block, index) => {
    const missingText =
      !block.text.trim() ||
      (draft.mode === "spoken" &&
        blockDialogue(draft, block).some((t) => !t.text.trim()));
    const missingVisual = !block.visual?.trim();
    return missingText || missingVisual
      ? [{ block, index, missingText, missingVisual }]
      : [];
  });
  function locateScene(id: string, pendingOnly = false) {
    setTab("scenes");
    setOnlyIssues(pendingOnly);
    requestAnimationFrame(() => {
      const node = sceneNodes.current.get(id);
      node?.scrollIntoView({ block: "center" });
      node
        ?.querySelector<HTMLSelectElement>(
          'select[aria-label^="Personaje de"], select',
        )
        ?.focus({ preventScroll: true });
    });
  }
  function locateContentIssue(issue: (typeof contentIssues)[number]) {
    setTab("scenes");
    setOnlyIssues(false);
    requestAnimationFrame(() => {
      const node = sceneNodes.current.get(issue.block.id);
      node?.scrollIntoView({ block: "center" });
      const invalid = node?.querySelector<HTMLTextAreaElement>(
        `[data-story-field="${issue.missingText ? "text" : "visual"}"][aria-invalid="true"]`,
      );
      (
        invalid ||
        node?.querySelector<HTMLTextAreaElement>(
          `[data-story-field="${issue.missingText ? "text" : "visual"}"]`,
        )
      )?.focus({ preventScroll: true });
    });
  }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<{
    kind: "reference" | "scene";
    id: string;
  }>();
  const busy = working || !!w.storyJob || !!conflict;
  const dirty =
    JSON.stringify({ ...draft, error: undefined }) !==
    JSON.stringify({ ...original, error: undefined });
  const update = (patch: Partial<Story>) => {
    setError("");
    setDraft((d) => ({ ...d, ...patch }));
  };
  useEffect(() => {
    if (conflict) return;
    try {
      if (!dirty) {
        sessionStorage.removeItem(cacheKey);
        return;
      }
      sessionStorage.setItem(cacheKey, JSON.stringify(draft));
    } catch {
      /* Explicit saving still writes IndexedDB. */
    }
  }, [cacheKey, draft, conflict, dirty]);
  async function saveThen(
    action?: "produce" | "references",
    referenceId?: string,
  ) {
    if (busy) return;
    setWorking(true);
    setError("");
    try {
      if (!draft.blocks.length) {
        setTab("scenes");
        setOnlyIssues(false);
        setError("Añade al menos una escena antes de guardar la propuesta.");
        return;
      }
      if (contentIssues.length) {
        const first = contentIssues[0];
        const missing =
          first.missingText && first.missingVisual
            ? "el texto y la descripción visual"
            : first.missingText
              ? "el texto"
              : "la descripción visual";
        setError(
          contentIssues.length === 1
            ? `La escena ${first.index + 1} está incompleta. Añade ${missing}.`
            : `Hay ${contentIssues.length} escenas incompletas. Empieza por la escena ${first.index + 1}: añade ${missing}.`,
        );
        locateContentIssue(first);
        return;
      }
      if (draft.mode === "spoken" && !draft.characters.length)
        throw new Error(
          "Añade al menos un personaje para el diálogo, o elige voz en off.",
        );
      if (castIssues.length) {
        setError(castIssueMessage(castIssues[0]));
        locateScene(castIssues[0].blockId, true);
        return;
      }
      await db.saveStoryDraft(project.id, draft);
      sessionStorage.removeItem(cacheKey);
      await w.refresh();
      if (action) void w.prepareStory(project.id, action, referenceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el plan.");
    } finally {
      setWorking(false);
    }
  }
  function blockPatch(id: string, changes: Partial<StoryBlock>) {
    update({
      blocks: draft.blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    });
  }
  function move(index: number, delta: number) {
    const blocks = [...draft.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    update({ blocks });
  }
  function split(block: StoryBlock) {
    if (draft.mode === "spoken") {
      const turns = blockDialogue(draft, block);
      let left: DialogueTurn[], right: DialogueTurn[];
      if (turns.length > 1) {
        const at = Math.ceil(turns.length / 2);
        left = turns.slice(0, at);
        right = turns.slice(at);
      } else {
        const turn = turns[0];
        if (!turn) return;
        const words = turn.text.match(/\S+\s*/g) || [];
        if (words.length < 2) return;
        const at = Math.ceil(words.length / 2);
        left = [{ ...turn, text: words.slice(0, at).join("") }];
        right = [
          { ...turn, id: crypto.randomUUID(), text: words.slice(at).join("") },
        ];
      }
      update({
        blocks: draft.blocks.flatMap((b) =>
          b.id === block.id
            ? [
                { ...b, ...dialoguePatch(left) },
                {
                  ...b,
                  id: crypto.randomUUID(),
                  title: `${b.title} · continuación`,
                  ...dialoguePatch(right),
                },
              ]
            : [b],
        ),
      });
      return;
    }
    const matches = [...block.text.matchAll(/\s+/g)].filter(
      (m) => m.index! > 0 && m.index! < block.text.length - 1,
    );
    if (!matches.length) return;
    const boundary = matches.reduce((best, m) =>
      Math.abs(m.index! - block.text.length / 2) <
      Math.abs(best.index! - block.text.length / 2)
        ? m
        : best,
    );
    const at = boundary.index! + boundary[0].length;
    update({
      blocks: draft.blocks.flatMap((b) =>
        b.id === block.id
          ? [
              { ...b, text: b.text.slice(0, at) },
              {
                ...b,
                id: crypto.randomUUID(),
                title: `${b.title} · continuación`,
                text: b.text.slice(at),
              },
            ]
          : [b],
      ),
    });
  }
  function combine(index: number) {
    const block = draft.blocks[index],
      next = draft.blocks[index + 1];
    if (!next) return;
    const joined = {
      ...block,
      ...(draft.mode === "spoken"
        ? dialoguePatch([
            ...blockDialogue(draft, block),
            ...blockDialogue(draft, next),
          ])
        : { text: `${block.text}\n${next.text}` }),
      visual: [...new Set([block.visual, next.visual].filter(Boolean))].join(
        "\n",
      ),
      participants: [
        ...new Set([
          ...(block.participants || []),
          ...(next.participants || []),
        ]),
      ],
      referenceNames: [
        ...new Set([
          ...(block.referenceNames || []),
          ...(next.referenceNames || []),
        ]),
      ].slice(0, 3),
    };
    update({
      blocks: draft.blocks.flatMap((b, i) =>
        i === index ? [joined] : i === index + 1 ? [] : [b],
      ),
    });
  }
  const plannedCount =
    draft.mode === "spoken"
      ? draft.blocks.reduce((sum, block) => {
          try {
            return sum + planDialogueShots(draft, block).length;
          } catch {
            return sum;
          }
        }, 0)
      : undefined;
  const selectedReference = draft.references?.find((r) => r.id === picker?.id);
  const selectedBlock = draft.blocks.find((b) => b.id === picker?.id);
  return (
    <div className="story-proposal">
      {conflict && (
        <div className="story-progress" role="alert">
          <div>
            <strong>Tu borrador tiene cambios sin guardar</strong>
            <p>
              El proyecto cambió desde que empezaste a editar. Recupera tu texto
              y tus decisiones o usa la versión guardada.
            </p>
          </div>
          <button className="button" onClick={recoverDraft}>
            Recuperar mi borrador
          </button>
          <button
            className="text-button"
            onClick={() => setConflict(undefined)}
          >
            Usar versión guardada
          </button>
        </div>
      )}
      <div className="story-proposal-heading">
        <div>
          <h2>Tu historia, lista para darle forma.</h2>
          <p>
            {draft.blocks.length}{" "}
            {draft.blocks.length === 1
              ? "escena propuesta"
              : "escenas propuestas"}
            .{" "}
            {castIssues.length
              ? "Revisa los personajes pendientes antes de producir."
              : "Revisa lo que quieras; puedes producirla tal como está."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !draft.blocks.length}
          onClick={() => void saveThen("produce")}
        >
          <Play size={16} />
          Producir historia
        </button>
      </div>
      <div className="story-review-summary">
        <span>
          {draft.mode === "voiceover"
            ? `Voz en off · ${draft.voiceId}`
            : `${draft.characters.length} ${draft.characters.length === 1 ? "personaje" : "personajes"}`}
        </span>
        <span>
          {draft.styleProfile?.name ||
            storyStyles.find((s) => s.id === draft.style)?.label}
        </span>
        <span>
          {draft.settings.aspectRatio} · {draft.settings.resolution}
        </span>
        {plannedCount !== undefined && (
          <span>
            {plannedCount}{" "}
            {plannedCount === 1 ? "toma prevista" : "tomas previstas"}
          </span>
        )}
        <span>
          {draft.references?.filter((r) => r.assetId).length || 0}{" "}
          {draft.references?.filter((r) => r.assetId).length === 1
            ? "referencia lista"
            : "referencias listas"}
        </span>
      </div>
      <nav className="story-tabs" aria-label="Editar propuesta">
        <button
          className={tab === "scenes" ? "selected" : ""}
          aria-current={tab === "scenes" ? "page" : undefined}
          onClick={() => setTab("scenes")}
        >
          Escenas <span>{draft.blocks.length}</span>
        </button>
        <button
          className={tab === "references" ? "selected" : ""}
          aria-current={tab === "references" ? "page" : undefined}
          onClick={() => setTab("references")}
        >
          Personajes y referencias
        </button>
        <button
          className={tab === "direction" ? "selected" : ""}
          aria-current={tab === "direction" ? "page" : undefined}
          onClick={() => setTab("direction")}
        >
          Voz y estilo
        </button>
        <span className="story-draft-status">
          {dirty ? "Borrador local" : "Guardado"}
        </span>
        {dirty && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void saveThen()}
          >
            <Save size={14} />
            Guardar cambios
          </button>
        )}
      </nav>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <StoryCastReview
        story={draft}
        disabled={busy}
        onlyIssues={onlyIssues}
        onChange={(next) => update(next)}
        onLocate={locateScene}
        onCast={() => setTab("references")}
        onFilter={() => {
          setTab("scenes");
          setOnlyIssues(!onlyIssues);
        }}
      />
      <fieldset disabled={busy} className="story-review-fields">
        {tab === "scenes" && (
          <div className="story-planned-scenes">
            {onlyIssues && (
              <div className="story-issue-filter">
                <span>
                  {issueIds.size
                    ? `Mostrando ${issueIds.size} de ${draft.blocks.length} escenas`
                    : "Todos los personajes están resueltos."}
                </span>
                <button
                  className="text-button"
                  onClick={() => setOnlyIssues(false)}
                >
                  Mostrar todas las escenas
                </button>
              </div>
            )}
            {draft.blocks.map((block, i) => {
              if (onlyIssues && !issueIds.has(block.id)) return null;
              const selectedSpeaker = blockSpeaker(draft, block);
              const blockIssue = castIssues.find(
                (issue) => issue.blockId === block.id,
              );
              const contentIssue = contentIssues.find(
                (issue) => issue.block.id === block.id,
              );
              const ids =
                block.referenceIds ??
                storyReferenceIds(
                  draft,
                  block.speaker,
                  block.referenceNames,
                  draft.mode === "spoken"
                    ? [
                        ...new Set([
                          ...(block.participants || []),
                          ...blockDialogue(draft, block).map((t) => t.speaker),
                        ]),
                      ]
                    : block.participants,
                  block.locationName,
                );
              const images = ids.flatMap(
                (id) => w.assets.find((a) => a.id === id) || [],
              );
              return (
                <article
                  className={`story-planned-scene ${blockIssue ? "needs-character" : ""} ${contentIssue ? "needs-content" : ""}`}
                  ref={(node) => {
                    if (node) sceneNodes.current.set(block.id, node);
                    else sceneNodes.current.delete(block.id);
                  }}
                  key={block.id}
                  aria-label={`Escena propuesta ${i + 1}`}
                >
                  <div className="story-plan-index">
                    {String(i + 1).padStart(2, "0")}
                    <div className="story-plan-order">
                      <button
                        className="icon-button"
                        aria-label={`Subir escena ${i + 1}`}
                        disabled={busy || onlyIssues || i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Bajar escena ${i + 1}`}
                        disabled={
                          busy || onlyIssues || i === draft.blocks.length - 1
                        }
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="story-plan-content">
                    <input
                      className="story-scene-title-input"
                      aria-label={`Título de la escena ${i + 1}`}
                      value={block.title || ""}
                      onChange={(e) =>
                        blockPatch(block.id, { title: e.target.value })
                      }
                    />
                    <div className="story-script-and-visual">
                      {draft.mode === "spoken" ? (
                        <SceneConversation
                          block={block}
                          config={draft}
                          assets={w.assets}
                          label={`la escena ${i + 1}`}
                          onChange={(patch) => blockPatch(block.id, patch)}
                        />
                      ) : (
                        <label>
                          Lo que se escuchará
                          <textarea
                            data-story-field="text"
                            aria-label={`Texto de la escena ${i + 1}`}
                            aria-invalid={
                              contentIssue?.missingText || undefined
                            }
                            aria-describedby={
                              contentIssue?.missingText
                                ? `story-content-error-${block.id}`
                                : undefined
                            }
                            rows={3}
                            value={block.text}
                            onChange={(e) =>
                              blockPatch(block.id, { text: e.target.value })
                            }
                          />
                        </label>
                      )}
                      <div className="story-visual-direction">
                        <label>
                          Lo que se verá
                          <textarea
                            data-story-field="visual"
                            aria-label={`Visual de la escena ${i + 1}`}
                            aria-invalid={
                              contentIssue?.missingVisual || undefined
                            }
                            aria-describedby={
                              contentIssue?.missingVisual
                                ? `story-content-error-${block.id}`
                                : undefined
                            }
                            rows={3}
                            value={block.visual || ""}
                            onChange={(e) =>
                              blockPatch(block.id, { visual: e.target.value })
                            }
                          />
                        </label>
                        <SceneStaging
                          block={block}
                          config={draft}
                          assets={w.assets}
                          onChange={(patch) => blockPatch(block.id, patch)}
                        />
                      </div>
                    </div>
                    <div className="story-plan-footer">
                      {draft.mode === "spoken" && blockIssue && (
                        <label>
                          Habla
                          <select
                            aria-label={`Personaje de la escena ${i + 1}`}
                            value={selectedSpeaker?.name || ""}
                            aria-invalid={!!blockIssue}
                            aria-describedby={
                              blockIssue
                                ? `story-cast-error-${block.id}`
                                : undefined
                            }
                            onChange={(e) =>
                              update(
                                assignStorySpeaker(
                                  draft,
                                  [
                                    ...castIssues.filter(
                                      (issue) => issue.blockId === block.id,
                                    ),
                                    {
                                      blockId: block.id,
                                      index: i,
                                      title: block.title || "",
                                      name:
                                        block.speaker ||
                                        selectedSpeaker?.name ||
                                        "",
                                      source: "speaker",
                                    },
                                  ],
                                  e.target.value,
                                ),
                              )
                            }
                          >
                            <option value="" disabled>
                              {block.speaker?.trim()
                                ? `Sin asignar · ${block.speaker}`
                                : "Elegir quién habla…"}
                            </option>
                            {draft.characters.map((c, index) => (
                              <option key={index} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        className="story-inline-references"
                        onClick={() =>
                          setPicker({ kind: "scene", id: block.id })
                        }
                      >
                        {images.map((a) => (
                          <img src={a.data_url} alt={a.file_name} key={a.id} />
                        ))}
                        {!images.length && <ImagePlus size={16} />}Referencias
                      </button>
                      {block.referenceIds !== undefined && (
                        <button
                          className="text-button"
                          onClick={() =>
                            blockPatch(block.id, { referenceIds: undefined })
                          }
                        >
                          Usar referencias automáticas
                        </button>
                      )}
                      <span className="hint">
                        ≈{" "}
                        {Math.max(
                          3,
                          Math.round(
                            block.text.trim().split(/\s+/).length / 2.2,
                          ),
                        )}{" "}
                        s de voz
                      </span>
                      <button
                        className="text-button"
                        disabled={!/\S\s+\S/.test(block.text)}
                        onClick={() => split(block)}
                      >
                        <Scissors size={14} />
                        Dividir
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Quitar escena propuesta ${i + 1}`}
                        onClick={() =>
                          update({
                            blocks: draft.blocks.filter(
                              (b) => b.id !== block.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                      {i < draft.blocks.length - 1 && (
                        <button
                          className="text-button"
                          onClick={() => combine(i)}
                        >
                          <Layers size={14} />
                          Unir con siguiente
                        </button>
                      )}
                    </div>
                    {blockIssue && (
                      <p
                        id={`story-cast-error-${block.id}`}
                        className="inline-error story-cast-inline-error"
                      >
                        {castIssueMessage(blockIssue)}
                      </p>
                    )}
                    {contentIssue && (
                      <p
                        id={`story-content-error-${block.id}`}
                        className="inline-error story-content-inline-error"
                      >
                        {contentIssue.missingText && contentIssue.missingVisual
                          ? "Añade lo que se escuchará y lo que se verá."
                          : contentIssue.missingText
                            ? "Añade lo que se escuchará en esta escena."
                            : "Añade lo que se verá en esta escena."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
            <button
              className="button"
              onClick={() =>
                update({
                  blocks: [
                    ...draft.blocks,
                    {
                      id: crypto.randomUUID(),
                      title: "Nueva escena",
                      text: "",
                      visual: "",
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Añadir escena
            </button>
          </div>
        )}
        {tab === "references" && (
          <>
            <div className="story-section-heading">
              <div>
                <h3>Identidades que se mantienen</h3>
                <p>
                  Gemini las detecta en el guion. Ajusta sus rasgos y su voz
                  antes de producir.
                </p>
              </div>
              <button
                className="button compact"
                onClick={() =>
                  update({
                    characters: [
                      ...draft.characters,
                      {
                        name: `Personaje ${draft.characters.length + 1}`,
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
            </div>
            <div className="story-cast-list">
              {draft.characters.map((c, i) => (
                <div className="story-character" key={i}>
                  {w.assets.find((a) => a.id === c.referenceId) && (
                    <img
                      className="story-character-portrait"
                      src={
                        w.assets.find((a) => a.id === c.referenceId)!.data_url
                      }
                      alt={`Referencia de ${c.name}`}
                    />
                  )}
                  <div className="field-row">
                    <label>
                      Nombre
                      <input
                        aria-label={`Nombre del personaje ${i + 1}`}
                        value={c.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          update({
                            characters: draft.characters.map((p, n) =>
                              n === i ? { ...p, name } : p,
                            ),
                            blocks: draft.blocks.map((b) => ({
                              ...b,
                              speaker: b.speaker === c.name ? name : b.speaker,
                              text: renameSpeakerLabel(b.text, c.name, name),
                              dialogueSource:
                                b.dialogueSource === b.text
                                  ? renameSpeakerLabel(b.text, c.name, name)
                                  : b.dialogueSource,
                              dialogue: b.dialogue?.map((t) =>
                                t.speaker === c.name
                                  ? { ...t, speaker: name }
                                  : t,
                              ),
                              participants: b.participants?.map((p) =>
                                p === c.name ? name : p,
                              ),
                            })),
                            references: draft.references?.map((r) =>
                              r.characterName === c.name
                                ? { ...r, characterName: name }
                                : r,
                            ),
                          });
                        }}
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label={`Eliminar personaje ${i + 1}`}
                      onClick={() =>
                        update({
                          characters: draft.characters.filter(
                            (_, n) => n !== i,
                          ),
                          // Keep the old assignment visible so it can be repaired, never silently replace it.
                          blocks: draft.blocks,
                          references: draft.references?.map((r) =>
                            r.characterName === c.name
                              ? { ...r, characterName: undefined }
                              : r,
                          ),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label>
                    Apariencia y vestuario
                    <textarea
                      rows={2}
                      value={c.description}
                      onChange={(e) =>
                        update({
                          characters: draft.characters.map((p, n) =>
                            n === i ? { ...p, description: e.target.value } : p,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Voz y forma de hablar
                    <input
                      value={c.voice}
                      onChange={(e) =>
                        update({
                          characters: draft.characters.map((p, n) =>
                            n === i ? { ...p, voice: e.target.value } : p,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            {!draft.characters.length && (
              <p className="hint">
                Esta propuesta se cuenta sin personajes recurrentes. Puedes
                añadirlos si los necesitas.
              </p>
            )}
            <div className="story-section-heading story-references-heading">
              <div>
                <h3>Biblioteca visual de la historia</h3>
                <p>
                  Personajes, lugares y objetos que se reutilizan en las tomas.
                  Un escenario mantiene la distribución, la luz y los elementos
                  del lugar.
                </p>
              </div>
              <button
                className="button compact"
                disabled={busy || !draft.references?.some((r) => !r.assetId)}
                onClick={() => void saveThen("references")}
              >
                <Sparkles size={15} />
                Crear referencias pendientes
              </button>
            </div>
            <div className="story-reference-grid">
              {draft.references?.map((ref) => {
                const asset = w.assets.find((a) => a.id === ref.assetId);
                return (
                  <article className="story-reference-card" key={ref.id}>
                    <span className="story-reference-kind">
                      {ref.locationName
                        ? "Escenario"
                        : ref.characterName
                          ? `Personaje · ${ref.characterName}`
                          : ref.type === "STYLE"
                            ? "Estilo"
                            : "Objeto"}
                    </span>
                    <button
                      className="story-reference-image"
                      aria-label={`Elegir imagen para ${ref.name}`}
                      onClick={() =>
                        setPicker({ kind: "reference", id: ref.id })
                      }
                    >
                      {asset ? (
                        <img src={asset.data_url} alt={ref.name} />
                      ) : (
                        <>
                          <ImagePlus size={25} />
                          <span>Elegir o subir imagen</span>
                        </>
                      )}
                    </button>
                    <input
                      aria-label={`Nombre de referencia ${ref.name}`}
                      value={ref.name}
                      onChange={(e) =>
                        update({
                          references: draft.references?.map((r) =>
                            r.id === ref.id
                              ? {
                                  ...r,
                                  name: e.target.value,
                                  locationName: r.locationName
                                    ? e.target.value
                                    : undefined,
                                }
                              : r,
                          ),
                          blocks: draft.blocks.map((b) => ({
                            ...b,
                            referenceNames: b.referenceNames?.map((name) =>
                              name === ref.name ? e.target.value : name,
                            ),
                            locationName:
                              ref.locationName &&
                              b.locationName === ref.locationName
                                ? e.target.value
                                : b.locationName,
                          })),
                        })
                      }
                    />
                    <label>
                      Representa
                      <select
                        aria-label={`Tipo de referencia ${ref.name}`}
                        value={
                          ref.locationName
                            ? "LOCATION"
                            : ref.characterName
                              ? `character:${ref.characterName}`
                              : ref.type
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          const characterName = value.startsWith("character:")
                            ? value.slice(10)
                            : undefined;
                          update({
                            references: draft.references?.map((r) =>
                              r.id === ref.id
                                ? {
                                    ...r,
                                    type: characterName
                                      ? "CHARACTER"
                                      : value === "LOCATION"
                                        ? "PRODUCT"
                                        : (value as "STYLE" | "PRODUCT"),
                                    characterName,
                                    locationName:
                                      value === "LOCATION"
                                        ? ref.name
                                        : undefined,
                                  }
                                : r,
                            ),
                            characters: draft.characters.map((c) =>
                              c.name === characterName
                                ? { ...c, referenceId: ref.assetId }
                                : c.name === ref.characterName
                                  ? { ...c, referenceId: undefined }
                                  : c,
                            ),
                            blocks: draft.blocks.map((b) => ({
                              ...b,
                              locationName:
                                ref.locationName &&
                                b.locationName === ref.locationName &&
                                value !== "LOCATION"
                                  ? undefined
                                  : b.locationName,
                            })),
                          });
                        }}
                      >
                        <option value="LOCATION">Escenario o lugar</option>
                        <option value="STYLE">Estilo visual</option>
                        <option value="PRODUCT">Objeto o elemento</option>
                        {draft.characters.map((c) => (
                          <option key={c.name} value={`character:${c.name}`}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Descripción para Nano Banana
                      <textarea
                        aria-label={`Descripción de referencia ${ref.name}`}
                        rows={3}
                        value={ref.prompt}
                        onChange={(e) =>
                          update({
                            references: draft.references?.map((r) =>
                              r.id === ref.id
                                ? { ...r, prompt: e.target.value }
                                : r,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="story-reference-actions">
                      <button
                        className="text-button"
                        onClick={() => void saveThen("references", ref.id)}
                      >
                        <Sparkles size={14} />
                        {asset ? "Regenerar imagen" : "Generar imagen"}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Quitar referencia ${ref.name}`}
                        onClick={() =>
                          update({
                            references: draft.references?.filter(
                              (r) => r.id !== ref.id,
                            ),
                            blocks: draft.blocks.map((b) => ({
                              ...b,
                              referenceIds: b.referenceIds?.filter(
                                (id) => id !== ref.assetId,
                              ),
                              referenceNames: b.referenceNames?.filter(
                                (name) => name !== ref.name,
                              ),
                              locationName:
                                ref.locationName &&
                                b.locationName === ref.locationName
                                  ? undefined
                                  : b.locationName,
                            })),
                            characters: draft.characters.map((c) =>
                              c.referenceId === ref.assetId
                                ? { ...c, referenceId: undefined }
                                : c,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <button
              className="button"
              onClick={() =>
                update({
                  references: [
                    ...(draft.references || []),
                    {
                      id: crypto.randomUUID(),
                      name: "Nueva referencia",
                      type: "STYLE",
                      prompt: "",
                    },
                  ],
                })
              }
            >
              <Plus size={15} />
              Añadir referencia
            </button>
            <button
              className="button"
              onClick={() => {
                const name = `Escenario ${(draft.references?.filter((r) => r.locationName).length || 0) + 1}`;
                update({
                  references: [
                    ...(draft.references || []),
                    {
                      id: crypto.randomUUID(),
                      name,
                      locationName: name,
                      type: "PRODUCT",
                      prompt: "",
                    },
                  ],
                });
              }}
            >
              <Plus size={15} />
              Añadir escenario
            </button>
          </>
        )}
        <div className="story-direction-panel" hidden={tab !== "direction"}>
          <div className="field-row">
            <label>
              Cómo se escucha
              <select
                aria-label="Modo de narración"
                value={draft.mode}
                onChange={(e) => {
                  const mode = e.target.value as StoryMode;
                  const styleProfile = profileForMode(
                    draft.styleProfile ||
                      createStyleProfile(draft.style, draft.mode),
                    mode,
                  );
                  update({ mode, style: styleProfile.base, styleProfile });
                }}
              >
                <option value="voiceover">Voz en off · Gemini TTS</option>
                <option value="spoken">Personajes hablando en el vídeo</option>
              </select>
            </label>
            <StoryStylePicker
              value={draft.style}
              profile={draft.styleProfile}
              mode={draft.mode}
              disabled={busy}
              onChange={(styleProfile) =>
                update({ style: styleProfile.base, styleProfile })
              }
            />
          </div>
          {draft.mode === "voiceover" ? (
            <>
              <label>
                Voz de Gemini
                <select
                  aria-label="Voz de Gemini"
                  value={draft.voiceId}
                  onChange={(e) =>
                    update({
                      voiceId: e.target.value,
                      voiceName: e.target.value,
                    })
                  }
                >
                  {geminiVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} · {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dirección de voz
                <textarea
                  aria-label="Dirección de voz"
                  rows={2}
                  value={draft.voiceDirection || ""}
                  onChange={(e) => update({ voiceDirection: e.target.value })}
                />
              </label>
              <p className="hint">
                La misma voz y dirección en toda la historia. Se usa tu clave de
                Google; no necesitas otra conexión.
              </p>
            </>
          ) : (
            <p className="hint">
              El vídeo genera las voces siguiendo la descripción de cada
              personaje y mantiene sus referencias visuales. Esto ayuda a la
              continuidad, pero no garantiza una voz idéntica entre vídeos.
              Revisa el resultado de cada toma.
            </p>
          )}
          <label>
            Dirección creativa
            <textarea
              aria-label="Dirección creativa"
              rows={4}
              value={draft.direction}
              onChange={(e) => update({ direction: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label>
              Formato
              <select
                aria-label="Formato de la historia"
                value={draft.settings.aspectRatio}
                onChange={(e) =>
                  update({
                    settings: {
                      ...draft.settings,
                      aspectRatio: e.target.value as "16:9" | "9:16",
                    },
                  })
                }
              >
                <option value="16:9">Horizontal · 16:9</option>
                <option value="9:16">Vertical · 9:16</option>
              </select>
            </label>
            <label>
              Modelo de vídeo
              <select
                aria-label="Modelo de la historia"
                value={draft.settings.model}
                onChange={(e) =>
                  update({
                    settings: {
                      ...draft.settings,
                      model: e.target.value as typeof OMNI_MODEL,
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
                value={draft.settings.resolution}
                onChange={(e) =>
                  update({
                    settings: {
                      ...draft.settings,
                      resolution: e.target
                        .value as StoryConfig["settings"]["resolution"],
                    },
                  })
                }
              >
                {(draft.settings.model === OMNI_MODEL
                  ? ["360p", "720p", "1080p", "4k"]
                  : ["720p", "1080p"]
                ).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Las duraciones se ajustan al audio real y al límite del modelo. Una
            escena larga puede necesitar varios clips.
          </p>
        </div>
      </fieldset>
      <footer className="story-review-footer">
        <p>
          {draft.mode === "spoken"
            ? "Producir guarda tus cambios y pone las tomas con diálogo en cola. Podrás revisar y regenerar cada una por separado."
            : "Producir guarda tus cambios, crea la narración y pone los vídeos en cola. Las tomas se podrán regenerar por separado."}
        </p>
        <button
          className="button primary"
          disabled={busy || !draft.blocks.length}
          onClick={() => void saveThen("produce")}
        >
          <Play size={16} />
          Producir historia
        </button>
      </footer>
      {picker && (
        <ReferencePicker
          role={
            picker.kind === "scene" && draft.settings.model === OMNI_MODEL
              ? "reference"
              : "first"
          }
          title={
            picker.kind === "scene"
              ? "Referencias de esta escena"
              : "Elegir imagen de referencia"
          }
          description="Elige una imagen guardada o sube una nueva. También puedes arrastrarla al selector."
          actionLabel="Usar selección"
          assets={w.assets}
          selectedIds={
            picker.kind === "scene"
              ? (selectedBlock?.referenceIds ??
                storyReferenceIds(
                  draft,
                  selectedBlock?.speaker,
                  selectedBlock?.referenceNames,
                  selectedBlock && draft.mode === "spoken"
                    ? [
                        ...new Set([
                          ...(selectedBlock.participants || []),
                          ...blockDialogue(draft, selectedBlock).map(
                            (t) => t.speaker,
                          ),
                        ]),
                      ]
                    : selectedBlock?.participants,
                  selectedBlock?.locationName,
                ).slice(0, draft.settings.model === OMNI_MODEL ? 3 : 1))
              : selectedReference?.assetId
                ? [selectedReference.assetId]
                : []
          }
          onApply={async (ids) => {
            if (picker.kind === "scene")
              blockPatch(picker.id, { referenceIds: ids });
            else
              update({
                references: draft.references?.map((r) =>
                  r.id === picker.id ? { ...r, assetId: ids[0] } : r,
                ),
                characters: draft.characters.map((c) =>
                  c.name === selectedReference?.characterName
                    ? { ...c, referenceId: ids[0] }
                    : c,
                ),
              });
          }}
          onRefresh={w.refresh}
          onClose={() => setPicker(undefined)}
        />
      )}
    </div>
  );
}
function ProductionBoard({
  project,
  workspace: w,
  onSequence,
}: StoryProps & { onSequence: () => void }) {
  const story = project.story!;
  const scenes = story.blocks
    .flatMap((b) => b.sceneIds || [])
    .flatMap((id) => w.scenes.find((s) => s.id === id) || []);
  const [pendingEdits, setPendingEdits] = useState<
    Record<string, { text: string; visual: string }>
  >({});
  const [savingPending, setSavingPending] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const activeIds = new Set([
    ...w.jobs.map((j) => j.sceneId),
    ...w.queue.map((q) => q.sceneId),
  ]);
  const status = (scene: Scene) =>
    activeIds.has(scene.id)
      ? "active"
      : scene.error || scene.task?.remoteId
        ? "attention"
        : sceneBlob(scene)
          ? "ready"
          : "pending";
  const visible = new Set(
    scenes
      .filter(
        (s) =>
          (filter === "all" || status(s) === filter) &&
          `${s.title || ""} ${s.story?.text || ""} ${s.story?.visual || ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      )
      .map((s) => s.id),
  );
  async function continueProduction() {
    if (savingPending || w.storyJob) return;
    setSavingPending(true);
    setPendingError("");
    try {
      const changes = story.blocks
        .filter((b) => !b.sceneIds && pendingEdits[b.id])
        .map((b) => ({ id: b.id, ...pendingEdits[b.id] }));
      if (changes.length)
        await db.savePendingStoryBlocks(
          project.id,
          story.revision || 0,
          changes,
        );
      await w.refresh();
      void w.prepareStory(project.id, "produce");
    } catch (e) {
      setPendingError(
        e instanceof Error
          ? e.message
          : "No se pudieron guardar las partes pendientes.",
      );
    } finally {
      setSavingPending(false);
    }
  }
  const busy = w.storyJob?.projectId === project.id;
  const prepared =
    story.blocks.every((b) => !!b.sceneIds) &&
    scenes.every((s) => s.story?.planned);
  const ready = scenes.filter((s) => sceneBlob(s)).length;
  const pending = scenes.filter(
    (s) =>
      s.story?.planned &&
      !sceneBlob(s) &&
      !s.task?.remoteId &&
      !w.jobFor(s.id) &&
      !w.queue.some((q) => q.sceneId === s.id),
  );
  async function downloadMaterials() {
    await w.action(async () => {
      const audio = story.blocks.flatMap((b, i) =>
        w.narrations
          .filter(
            (n) =>
              n.block_id === b.id &&
              scenes.some((scene) => scene.story?.audioId === n.id),
          )
          .map((n) => ({
            id: n.id,
            name: `voz-${String(i + 1).padStart(3, "0")}.${n.blob.type.includes("wav") ? "wav" : "mp3"}`,
            blob: n.blob,
          })),
      );
      const manifest = {
        format: "vidgen-story-materials-v2",
        mode: story.mode,
        voice: story.voiceId,
        scenes: scenes.map((s) => ({
          title: s.title,
          text: s.story!.text,
          dialogue: s.story!.dialogue,
          participants: s.story!.participants,
          location: s.story!.locationName,
          part: s.story!.part,
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
            name: "guion-original.txt",
            blob: new Blob([story.script], { type: "text/plain" }),
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
    });
  }
  return (
    <div className="story-production-board">
      <div className="story-board-heading">
        <div>
          <h2>Tu historia en producción</h2>
          <p>
            {ready} de {scenes.length} vídeos listos. Cada toma sigue siendo
            editable.
          </p>
        </div>
        <div className="inline">
          <button
            className="button compact"
            disabled={busy}
            onClick={() => void downloadMaterials()}
          >
            <Download size={15} />
            Voz y guion
          </button>
          <button
            className="button primary"
            onClick={onSequence}
            disabled={busy || !scenes.length}
          >
            <Layers size={16} />
            Abrir montaje
          </button>
        </div>
      </div>
      {!prepared && !busy && (
        <>
          <div className="story-progress">
            <Film size={20} />
            <div>
              <strong>Hay partes por preparar</strong>
              <p>La voz y las escenas ya guardadas se reutilizan.</p>
            </div>
            <button
              className="button"
              disabled={!!w.storyJob || savingPending}
              onClick={() => void continueProduction()}
            >
              Continuar producción
            </button>
          </div>
          {pendingError && (
            <p className="inline-error" role="alert">
              {pendingError}
            </p>
          )}
          {story.blocks.some((b) => !b.sceneIds) && (
            <details className="story-pending-editor">
              <summary>Editar partes pendientes</summary>
              <p className="hint">
                Puedes corregir lo que aún no se ha producido. Continuar
                producción guarda estos cambios; las escenas terminadas se
                conservan.
              </p>
              {story.blocks
                .filter((b) => !b.sceneIds)
                .map((b, i) => (
                  <div className="story-section" key={b.id}>
                    <h3>{b.title || `Parte ${i + 1}`}</h3>
                    <div className="story-script-and-visual">
                      <label>
                        Lo que se escuchará
                        <textarea
                          aria-label={`Texto pendiente ${i + 1}`}
                          rows={3}
                          value={pendingEdits[b.id]?.text ?? b.text}
                          onChange={(e) =>
                            setPendingEdits((current) => ({
                              ...current,
                              [b.id]: {
                                text: e.target.value,
                                visual: current[b.id]?.visual ?? b.visual ?? "",
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Lo que se verá
                        <textarea
                          aria-label={`Visual pendiente ${i + 1}`}
                          rows={3}
                          value={pendingEdits[b.id]?.visual ?? b.visual ?? ""}
                          onChange={(e) =>
                            setPendingEdits((current) => ({
                              ...current,
                              [b.id]: {
                                text: current[b.id]?.text ?? b.text,
                                visual: e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
            </details>
          )}
        </>
      )}
      {prepared && pending.length > 0 && (
        <button
          className="button story-pending-action"
          onClick={() => void w.runStory(pending.map((s) => s.id))}
        >
          <Play size={15} />
          Generar pendientes · {pending.length}
        </button>
      )}
      <p className="story-production-hint">
        {story.mode === "voiceover"
          ? "Gemini TTS narra el guion. El montaje combina imagen y voz; regenerar una toma conserva su narración."
          : "Revisa que cada personaje termine su diálogo y mantenga la voz entre tomas."}
      </p>
      {!!scenes.length && (
        <div className="story-scene-filters">
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Buscar escenas de la historia"
              placeholder="Buscar por nombre, guion o imagen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div
            className="project-type-filter"
            role="group"
            aria-label="Estado de las escenas"
          >
            {(
              [
                ["all", "Todas"],
                ["attention", "Por revisar"],
                ["pending", "Pendientes"],
                ["active", "En proceso"],
                ["ready", "Listas"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}{" "}
                <span>
                  {value === "all"
                    ? scenes.length
                    : scenes.filter((s) => status(s) === value).length}
                </span>
              </button>
            ))}
          </div>
          <p className="hint" role="status">
            {visible.size} de {scenes.length} escenas · En orden de guion
          </p>
          {!visible.size && (
            <div className="story-filter-empty">
              <p>No hay escenas que coincidan.</p>
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Mostrar todas las escenas
              </button>
            </div>
          )}
        </div>
      )}
      <div className="story-scenes">
        {story.blocks.map((block, blockIndex) => {
          const shots = scenes.filter((s) => s.story?.blockId === block.id);
          const location = story.references?.find(
            (r) => r.locationName && r.locationName === block.locationName,
          );
          const locationImage = w.assets.find(
            (a) => a.id === location?.assetId,
          );
          return (
            <section
              className="story-production-group"
              key={block.id}
              hidden={!shots.some((s) => visible.has(s.id))}
              aria-label={`Secuencia de ${block.title || `escena ${blockIndex + 1}`}`}
            >
              <header>
                {locationImage && (
                  <img src={locationImage.data_url} alt={block.locationName} />
                )}
                <div>
                  <span>
                    Escena {blockIndex + 1}
                    {block.locationName ? ` · ${block.locationName}` : ""}
                  </span>
                  <h3>{block.title}</h3>
                </div>
                <small>
                  {shots.filter((s) => sceneBlob(s)).length} de {shots.length}{" "}
                  tomas listas
                </small>
              </header>
              {shots.map((s) => (
                <div
                  key={`${s.id}:${s.story?.planned}`}
                  hidden={!visible.has(s.id)}
                >
                  <StorySceneCard
                    scene={s}
                    index={scenes.findIndex((scene) => scene.id === s.id)}
                    audio={w.narrations.find((a) => a.id === s.story?.audioId)}
                    config={story}
                    workspace={w}
                  />
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
export function StoryEditor({
  project,
  workspace: w,
  onSequence,
  onSettings,
}: StoryProps & {
  onSequence: () => void;
  onSettings: () => void;
}) {
  const story = project.story;
  const busy = w.storyJob?.projectId === project.id;
  const planning = story?.phase === "planning";
  return (
    <div className="story-editor">
      <header className="story-top">
        <h1 className="sr-only">Historia: {project.name}</h1>
        <ol className="story-workflow" aria-label="Etapas de la historia">
          <li
            className={!story ? "current" : "done"}
            aria-current={!story ? "step" : undefined}
          >
            Guion
          </li>
          <li
            aria-current={
              planning || story?.phase === "review" ? "step" : undefined
            }
            className={
              planning || story?.phase === "review"
                ? "current"
                : story
                  ? "done"
                  : ""
            }
          >
            Propuesta
          </li>
          <li
            aria-current={
              story && !planning && story.phase !== "review"
                ? "step"
                : undefined
            }
            className={
              story && !planning && story.phase !== "review" ? "current" : ""
            }
          >
            Producción
          </li>
        </ol>
      </header>
      <div className="story-workspace-content">
        {busy && (
          <div className="story-progress" role="status">
            <LoaderCircle size={18} className="spin" />
            <div>
              <strong>{w.storyJob!.text}</strong>
              <p>
                {w.storyJob!.stopping
                  ? "Se guardará la solicitud actual antes de pausar."
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
        {story?.error && (
          <p className="inline-error" role="alert">
            {story.error}
          </p>
        )}
        {!story ? (
          <ScriptEntry
            project={project}
            workspace={w}
            onSettings={onSettings}
          />
        ) : planning ? (
          <div className="story-planning">
            <Sparkles size={28} />
            <h2>Del guion a una propuesta completa.</h2>
            <p>
              Gemini organiza los momentos, decide qué mostrar y prepara una
              identidad visual que podrás editar.
            </p>
            <div className="story-planning-preview">
              {story.blocks.map((b, i) => (
                <div key={b.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <strong>{b.title}</strong>
                  <p>{b.text}</p>
                </div>
              ))}
            </div>
            {!busy && (
              <div className="inline">
                <button
                  className="button primary"
                  disabled={!!w.storyJob}
                  onClick={() => void w.prepareStory(project.id, "plan")}
                >
                  Continuar propuesta
                </button>
                {story.planning &&
                  story.planning.cursor === story.planning.units.length && (
                    <button
                      className="button"
                      onClick={() =>
                        void w.action(() =>
                          db.saveStoryState(project.id, {
                            ...story,
                            phase: "review",
                            error: undefined,
                          }),
                        )
                      }
                    >
                      Revisar sin más imágenes
                    </button>
                  )}
              </div>
            )}
          </div>
        ) : story.phase === "review" ? (
          <ProposalEditor
            key={`${story.id}:${story.revision}`}
            project={project}
            workspace={w}
          />
        ) : (
          <ProductionBoard
            project={project}
            workspace={w}
            onSequence={onSequence}
          />
        )}
      </div>
    </div>
  );
}
