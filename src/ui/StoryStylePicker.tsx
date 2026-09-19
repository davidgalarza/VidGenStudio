import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ArrowLeft,
  Copy,
  Plus,
  Settings2,
  Sparkles,
  Upload,
  X,
  Trash2,
  Star,
  Columns3,
} from "lucide-react";
import type {
  StoryStyle,
  StoryMode,
  StoryStyleProfile,
  SavedStoryStyle,
  StyleMedia,
} from "../types";
import {
  storyStyles,
  stylesForMode,
  styleDescription,
  styleCategory,
  createStyleProfile,
  parameterOptions,
  defaultStyleParameters,
  validStyleProfile,
  type StyleParameterKey,
} from "../lib/storyStyles";
import {
  listSavedStyles,
  saveStyle,
  deleteStyle,
  analyzeStyleReferences,
  validateStyleMedia,
  STYLE_MEDIA_ACCEPT,
} from "../lib/styleLibrary";
import {
  browseStyles,
  matchesStyleSearch,
  readStyleFavorites,
  writeStyleFavorites,
  styleKey,
} from "../lib/styleBrowsing";
import { StyleInspection, type StyleChoice } from "./StyleInspection";
import { getApiKey } from "../lib/settings";
import { useBlobUrl } from "../lib/useBlobUrl";
import { StudioDialog } from "./StudioDialog";
import { StyleSample } from "./StyleSample";
export { StyleSample } from "./StyleSample";
function MediaPreview({ media }: { media: StyleMedia }) {
  const url = useBlobUrl(media.blob);
  return media.blob.type.startsWith("video/") ? (
    <video
      src={url}
      controls
      muted
      playsInline
      preload="metadata"
      aria-label={`Referencia ${media.name}`}
    />
  ) : (
    <img src={url} alt={media.name} />
  );
}
export function StoryStylePicker({
  value,
  profile,
  mode,
  onChange,
  disabled = false,
}: {
  value: StoryStyle;
  profile?: StoryStyleProfile;
  mode: StoryMode;
  onChange: (profile: StoryStyleProfile) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<StyleChoice>();
  const [comparison, setComparison] = useState<StyleChoice[]>([]);
  const [comparing, setComparing] = useState(false);
  const [favorites, setFavorites] = useState(readStyleFavorites);
  const [pending, setPending] = useState<
    StyleChoice & { analysis?: StoryStyleProfile }
  >();
  const [library, setLibrary] = useState<SavedStoryStyle[]>([]);
  const [scope, setScope] = useState("Todos");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<StoryStyleProfile>(() =>
    createStyleProfile(value, mode),
  );
  const [media, setMedia] = useState<StyleMedia[]>([]);
  const [analysis, setAnalysis] = useState<StoryStyleProfile>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [editorTab, setEditorTab] = useState("settings");
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const loadId = useRef(0);
  const selected = validStyleProfile(profile)
    ? profile
    : createStyleProfile(value, mode);
  const title = editing
    ? "Configura tu estilo"
    : comparing
      ? "Comparar estilos"
      : detail
        ? detail.profile.name
        : "Elige el estilo de tu historia";
  const modeLabel = mode === "spoken" ? "Personajes hablando" : "Voz en off";
  useEffect(() => () => abort.current?.abort(), []);
  async function refreshLibrary() {
    try {
      const entries = await listSavedStyles();
      setLibrary(entries);
      return entries;
    } catch {
      setError(
        "No se pudo abrir Mis estilos. Puedes seguir usando y ajustando la biblioteca incluida.",
      );
      return [];
    }
  }
  async function show(edit: boolean) {
    const requestId = ++loadId.current;
    setDetail(undefined);
    setComparing(false);
    setComparison((p) => p.filter((s) => s.profile.mode === mode));
    setScope("Todos");
    setQuery("");
    setEditorTab("settings");
    setError("");
    setNotice("");
    setAnalysis(undefined);
    setRemoveId("");
    setOpen(true);
    setEditing(edit);
    setDraft(structuredClone(selected));
    setMedia([]);
    const entries = await refreshLibrary();
    if (edit && loadId.current === requestId)
      setMedia(entries.find((s) => s.id === selected.presetId)?.media || []);
  }
  function editStyle(
    next: StoryStyleProfile,
    files: StyleMedia[] = [],
    clone = false,
  ) {
    loadId.current++;
    setEditorTab("settings");
    setDetail(undefined);
    setComparing(false);
    setDraft({
      ...structuredClone(next),
      mode,
      ...(clone
        ? { presetId: undefined, name: `${next.name.slice(0, 90)} · copia` }
        : {}),
    });
    setMedia(files);
    setEditing(true);
    setAnalysis(undefined);
    setError("");
    setNotice("");
  }
  function rememberDraft() {
    setPending({
      profile: structuredClone(draft),
      media: [...media],
      analysis,
    });
  }
  function close(discard = false) {
    if (editing && !discard) rememberDraft();
    if (discard) setPending(undefined);
    loadId.current++;
    abort.current?.abort();
    abort.current = null;
    setOpen(false);
    setBusy(false);
    setAnalysis(undefined);
  }
  function patch(patch: Partial<StoryStyleProfile>) {
    setDraft((p) => ({ ...p, ...patch }));
    setNotice("");
  }
  function addFiles(files: File[]) {
    if (busy) return;
    loadId.current++;
    const next = [
      ...media,
      ...files.map((blob) => ({
        id: crypto.randomUUID(),
        name: blob.name,
        blob,
      })),
    ];
    try {
      validateStyleMedia(next);
      setMedia(next);
      setError("");
      setAnalysis(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function analyze() {
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setError("");
    setAnalysis(undefined);
    setNotice("");
    try {
      const result = await analyzeStyleReferences(
        getApiKey(),
        media,
        mode,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setAnalysis(result);
        setEditorTab("settings");
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
      }
    }
  }
  async function save(copy: boolean) {
    setBusy(true);
    setError("");
    try {
      const record = await saveStyle(
        draft,
        media,
        copy ? undefined : draft.presetId,
      );
      setDraft(record.profile);
      setComparison((items) =>
        items.map((item) =>
          item.profile.presetId === record.id ? record : item,
        ),
      );
      await refreshLibrary();
      setNotice("Guardado en Mis estilos de este navegador.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await deleteStyle(id);
      setRemoveId("");
      setComparison((p) => p.filter((s) => s.profile.presetId !== id));
      const nextFavorites = favorites.filter((key) => key !== id);
      setFavorites(nextFavorites);
      writeStyleFavorites(nextFavorites);
      await refreshLibrary();
      setNotice(
        "Estilo eliminado de la biblioteca. Los proyectos que lo usan conservan sus ajustes.",
      );
    } catch {
      setError("No se pudo eliminar el estilo. Vuelve a intentarlo.");
    }
  }
  const keys: StyleParameterKey[] = [
    "pace",
    "camera",
    "lighting",
    "palette",
    "detail",
    mode === "spoken" ? "acting" : "explanation",
  ];
  function toggleFavorite(choice: StyleChoice) {
    const key = styleKey(choice.profile);
    const next = favorites.includes(key)
      ? favorites.filter((id) => id !== key)
      : [...favorites, key];
    setFavorites(next);
    if (!writeStyleFavorites(next))
      setError(
        "Puedes usar favoritos en esta sesión, pero el navegador no permitió guardarlos.",
      );
  }
  function toggleCompare(choice: StyleChoice) {
    const key = styleKey(choice.profile);
    const exists = comparison.some((c) => styleKey(c.profile) === key);
    const next = exists
      ? comparison.filter((c) => styleKey(c.profile) !== key)
      : [...comparison, choice].slice(0, 3);
    setComparison(next);
    if (next.length < 2) setComparing(false);
  }
  function useChoice(choice: StyleChoice) {
    onChange(structuredClone(choice.profile));
    close(true);
  }
  const filtered = browseStyles(mode)
    .filter(
      (s) =>
        (scope === "Todos" ||
          scope === "Favoritos" ||
          styleCategory(s.id) === scope) &&
        (scope !== "Favoritos" || favorites.includes(`builtin:${s.id}`)) &&
        matchesStyleSearch(s.id, query),
    )
    .map(
      (s) =>
        ({ profile: createStyleProfile(s.id, mode), media: [] }) as StyleChoice,
    );
  const saved = library.filter(
    (s) =>
      s.profile.mode === mode &&
      (scope !== "Favoritos" || favorites.includes(s.id)) &&
      matchesStyleSearch(
        s.profile.base,
        query,
        s.profile.name + " " + s.profile.instructions,
      ),
  );
  const choices: StyleChoice[] =
    scope === "Mis estilos"
      ? saved
      : scope === "Favoritos"
        ? [...saved, ...filtered]
        : filtered;
  return (
    <div className="story-style-control">
      <span className="field-caption">Estilo visual</span>
      <button
        className="story-style-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => void show(false)}
      >
        <StyleSample value={selected.base} />
        <span>
          <strong>{selected.name}</strong>
          <small>Cambiar estilo · {modeLabel.toLocaleLowerCase()}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      <button
        className="style-adjust-link"
        disabled={disabled}
        onClick={() => void show(true)}
      >
        <Settings2 size={14} /> Ajustar estilo <span>Ritmo, color y más</span>
      </button>
      {open && (
        <StudioDialog
          title={title}
          wide
          onClose={() => close()}
          viewKey={
            editing
              ? "editor"
              : comparing
                ? "compare"
                : detail
                  ? `detail:${styleKey(detail.profile)}`
                  : "gallery"
          }
          busy={busy && !abort.current}
        >
          {editing ? (
            <>
              <div className="style-editor-heading">
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => {
                    rememberDraft();
                    setEditing(false);
                    setAnalysis(undefined);
                    setError("");
                  }}
                >
                  <ArrowLeft size={15} /> Ver estilos
                </button>
                <span>{modeLabel} · ajustes para este proyecto</span>
              </div>
              <div
                className="style-editor-tabs"
                aria-label="Secciones del estilo"
              >
                <button
                  className="button"
                  aria-pressed={editorTab === "settings"}
                  onClick={() => setEditorTab("settings")}
                >
                  Ajustes
                </button>
                <button
                  className="button"
                  aria-pressed={editorTab === "references"}
                  onClick={() => setEditorTab("references")}
                >
                  Referencias {media.length > 0 && `(${media.length})`}
                </button>
              </div>
              <div className="style-editor-layout" data-mobile-tab={editorTab}>
                <aside className="style-editor-preview">
                  <StyleSample value={draft.base} />
                  <p className="hint">
                    Muestra del estilo base. Los ajustes se aplican al generar;
                    esta imagen no es una previsualización del resultado.
                  </p>
                  <section
                    className={`style-reference-drop ${dragging ? "is-dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!busy) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      addFiles(Array.from(e.dataTransfer.files));
                    }}
                    aria-label="Referencias para crear un estilo"
                  >
                    <h3>Inspírate en tus referencias</h3>
                    <p>
                      Imágenes para color y acabado. Vídeos para movimiento y
                      ritmo.
                    </p>
                    <input
                      ref={file}
                      type="file"
                      accept={STYLE_MEDIA_ACCEPT}
                      multiple
                      hidden
                      onChange={(e) => {
                        addFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                      }}
                      aria-label="Subir referencias de estilo"
                    />
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={15} /> Subir imágenes o vídeos
                    </button>
                    <small>
                      O arrástralos aquí. Hasta 6 archivos, 14 MB en total. Para
                      vídeo, usa un fragmento corto.
                    </small>
                    {media.length > 0 && (
                      <ul className="style-media-list">
                        {media.map((m) => (
                          <li key={m.id}>
                            <MediaPreview media={m} />
                            <div>
                              <span title={m.name}>{m.name}</span>
                              <button
                                className="icon-button"
                                disabled={busy}
                                aria-label={`Quitar ${m.name}`}
                                onClick={() => {
                                  setMedia((all) =>
                                    all.filter((f) => f.id !== m.id),
                                  );
                                  setAnalysis(undefined);
                                }}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="button"
                      disabled={busy || !media.length}
                      onClick={() => void analyze()}
                    >
                      <Sparkles size={15} />{" "}
                      {busy && abort.current
                        ? "Analizando referencias…"
                        : "Analizar con Gemini"}
                    </button>
                    <small>
                      El análisis envía estos archivos a Google y usa tu cuota.
                      Después revisas la propuesta. Las referencias no se añaden
                      automáticamente a los vídeos.
                    </small>
                    {busy && abort.current && (
                      <button
                        className="button small"
                        onClick={() => {
                          abort.current?.abort();
                          abort.current = null;
                          setBusy(false);
                        }}
                      >
                        Cancelar análisis
                      </button>
                    )}
                  </section>
                </aside>
                <div className="style-editor-fields">
                  {analysis && (
                    <section
                      className="style-analysis-result"
                      aria-label="Propuesta de estilo de Gemini"
                    >
                      <h3>{analysis.name}</h3>
                      <p>{analysis.analysis}</p>
                      <p>{analysis.instructions}</p>
                      <dl>
                        {keys.map((key) => (
                          <div key={key}>
                            <dt>{parameterOptions[key].label}</dt>
                            <dd>
                              {
                                (
                                  parameterOptions[key].options as Record<
                                    string,
                                    string
                                  >
                                )[analysis.parameters[key]]
                              }
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="inline">
                        <button
                          className="button primary"
                          onClick={() => {
                            setDraft({ ...analysis, presetId: draft.presetId });
                            setAnalysis(undefined);
                            setNotice(
                              "Análisis aplicado. Puedes ajustar cualquier parámetro antes de usarlo.",
                            );
                          }}
                        >
                          Aplicar análisis
                        </button>
                        <button
                          className="button"
                          onClick={() => setAnalysis(undefined)}
                        >
                          Descartar análisis
                        </button>
                      </div>
                    </section>
                  )}
                  <label>
                    Nombre del estilo
                    <input
                      aria-label="Nombre del estilo"
                      value={draft.name}
                      maxLength={100}
                      disabled={busy}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Estilo base
                    <select
                      aria-label="Estilo base"
                      value={draft.base}
                      disabled={busy}
                      onChange={(e) => {
                        const next = createStyleProfile(
                          e.target.value as StoryStyle,
                          mode,
                        );
                        patch({ base: next.base, parameters: next.parameters });
                      }}
                    >
                      {(stylesForMode(mode).some((s) => s.id === draft.base)
                        ? stylesForMode(mode)
                        : [
                            storyStyles.find((s) => s.id === draft.base)!,
                            ...stylesForMode(mode),
                          ]
                      ).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="style-parameter-heading">
                    <h3>Dale tu dirección</h3>
                    <button
                      className="style-adjust-link"
                      disabled={busy}
                      onClick={() =>
                        patch({
                          parameters: defaultStyleParameters(draft.base, mode),
                        })
                      }
                    >
                      Restablecer parámetros
                    </button>
                  </div>
                  <div className="style-parameter-grid">
                    {keys.map((key) => (
                      <label key={key}>
                        {parameterOptions[key].label}
                        <select
                          aria-label={parameterOptions[key].label}
                          value={draft.parameters[key]}
                          disabled={busy}
                          onChange={(e) =>
                            patch({
                              parameters: {
                                ...draft.parameters,
                                [key]: e.target.value,
                              },
                            })
                          }
                        >
                          {Object.entries(parameterOptions[key].options).map(
                            ([id, label]) => (
                              <option value={id} key={id}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                  <label>
                    Indicaciones del estilo{" "}
                    <span className="hint">Opcional</span>
                    <textarea
                      aria-label="Indicaciones del estilo"
                      rows={5}
                      maxLength={6000}
                      value={draft.instructions}
                      disabled={busy}
                      onChange={(e) => patch({ instructions: e.target.value })}
                      placeholder="Por ejemplo: fondos azul profundo, acentos ámbar y transiciones suaves; evita los movimientos bruscos."
                    />
                  </label>
                  <p className="hint">
                    Se aplican a las escenas, las referencias generadas y cada
                    vídeo. El guion y la voz se configuran por separado.
                  </p>
                  {draft.analysis && !analysis && (
                    <details>
                      <summary>Qué encontró Gemini en las referencias</summary>
                      <p className="hint">{draft.analysis}</p>
                    </details>
                  )}
                  <div className="style-library-save">
                    <h3>Reutilízalo en otras historias</h3>
                    <p className="hint">
                      Guarda una copia con sus referencias en este navegador.
                      Los proyectos anteriores conservan su propia
                      configuración.
                    </p>
                    <div className="inline">
                      <button
                        className="button"
                        disabled={busy || !validStyleProfile(draft)}
                        onClick={() => void save(!draft.presetId)}
                      >
                        {draft.presetId
                          ? "Actualizar estilo guardado"
                          : "Guardar en Mis estilos"}
                      </button>
                      {draft.presetId && (
                        <button
                          className="button"
                          disabled={busy || !validStyleProfile(draft)}
                          onClick={() => void save(true)}
                        >
                          <Copy size={14} /> Guardar como nuevo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {notice && (
                <p className="hint" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <footer className="style-editor-footer">
                <button
                  className="button"
                  disabled={busy && !abort.current}
                  onClick={() => close(true)}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={busy || !validStyleProfile(draft) || !!analysis}
                  onClick={() => {
                    onChange(structuredClone(draft));
                    close(true);
                  }}
                >
                  Usar estos ajustes
                </button>
              </footer>
            </>
          ) : comparing || detail ? (
            <StyleInspection
              choices={comparing ? comparison : [detail!]}
              comparing={comparing}
              onBack={() => {
                setComparing(false);
                setDetail(undefined);
              }}
              onUse={useChoice}
              onEdit={(c) => editStyle(c.profile, c.media)}
              onRemove={toggleCompare}
            />
          ) : (
            <>
              <div className="style-gallery-heading">
                <div>
                  <p>{modeLabel}</p>
                  <span className="hint">
                    {stylesForMode(mode).length} estilos listos para usar. Abre
                    una muestra para ver sus detalles.
                  </span>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    editStyle({
                      ...createStyleProfile("realistic", mode),
                      name: "Mi estilo",
                    })
                  }
                >
                  <Plus size={15} /> Crear estilo
                </button>
              </div>
              {pending && pending.profile.mode === mode && (
                <div className="style-pending">
                  <div>
                    <strong>{pending.profile.name}</strong>
                    <span>
                      Sin aplicar. Se conserva al cerrar este panel; se descarta
                      al recargar o salir de esta vista.
                    </span>
                  </div>
                  <button
                    className="button small"
                    onClick={() => {
                      editStyle(pending.profile, pending.media);
                      setAnalysis(pending.analysis);
                    }}
                  >
                    Continuar ajuste
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Descartar ajuste pendiente"
                    onClick={() => setPending(undefined)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <label className="style-search">
                Buscar estilo
                <input
                  type="search"
                  aria-label="Buscar estilo"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    mode === "voiceover"
                      ? "Prueba «mapas», «pizarra» o «producto 3D»"
                      : "Prueba «entrevista», «acuarela» o «3D»"
                  }
                />
              </label>
              <div className="style-filters" aria-label="Filtrar estilos">
                {[
                  "Todos",
                  "Realismo",
                  "Animación",
                  ...(mode === "voiceover" ? ["Explicación"] : []),
                  "Favoritos",
                  "Mis estilos",
                ].map((s) => (
                  <button
                    key={s}
                    className="button small"
                    aria-pressed={scope === s}
                    onClick={() => setScope(s)}
                  >
                    {s === "Favoritos" && <Star size={13} />} {s}
                  </button>
                ))}
              </div>
              <div className="style-result-summary">
                <span role="status">
                  {choices.length} {choices.length === 1 ? "estilo" : "estilos"}
                  {scope !== "Todos" ? ` · ${scope.toLocaleLowerCase()}` : ""}
                  {query ? ` para «${query}»` : ""}
                </span>
                {(query || scope !== "Todos") && (
                  <button
                    className="style-adjust-link"
                    onClick={() => {
                      setQuery("");
                      setScope("Todos");
                    }}
                  >
                    Ver todos
                  </button>
                )}
              </div>
              {notice && (
                <p className="hint" role="status">
                  {notice}
                </p>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {!choices.length && (
                <div className="style-empty">
                  <h3>
                    {query
                      ? "No hay coincidencias"
                      : scope === "Favoritos"
                        ? "Tus favoritos, a mano"
                        : "Tu biblioteca de estilos"}
                  </h3>
                  <p>
                    {query
                      ? "Busca por técnica, material o uso. También puedes volver a ver todos los estilos."
                      : scope === "Favoritos"
                        ? "Marca la estrella de un estilo para encontrarlo aquí en tus próximas historias."
                        : "Crea un estilo o clona uno de la biblioteca. Podrás reutilizar sus ajustes y referencias."}
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setQuery("");
                      setScope("Todos");
                    }}
                  >
                    Explorar estilos
                  </button>
                  {scope === "Mis estilos" && !query && (
                    <button
                      className="button"
                      onClick={() =>
                        editStyle({
                          ...createStyleProfile("realistic", mode),
                          name: "Mi estilo",
                        })
                      }
                    >
                      Crear mi primer estilo
                    </button>
                  )}
                </div>
              )}
              <div className="story-style-gallery">
                {choices.map((choice) => {
                  const p = choice.profile;
                  const key = styleKey(p);
                  const active = styleKey(selected) === key;
                  const favorite = favorites.includes(key);
                  const inComparison = comparison.some(
                    (c) => styleKey(c.profile) === key,
                  );
                  return (
                    <article className="style-library-item" key={key}>
                      <button
                        className={`story-style-option ${active ? "selected" : ""}`}
                        aria-pressed={active}
                        onClick={() => setDetail(choice)}
                      >
                        <StyleSample value={p.base} />
                        <span className="story-style-option-label">
                          <strong>{p.name}</strong>
                          {active && <Check size={15} />}
                        </span>
                        <small>
                          {p.presetId
                            ? "Ajustes personalizados"
                            : styleDescription(p.base)}
                        </small>
                      </button>
                      <div className="style-card-tools">
                        <button
                          className="style-adjust-link"
                          aria-label={`${p.presetId ? "Editar" : "Personalizar"} ${p.name}`}
                          onClick={() => editStyle(p, choice.media)}
                        >
                          <Settings2 size={14} />
                          {p.presetId ? "Editar" : "Personalizar"}
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${favorite ? "Quitar" : "Añadir"} ${p.name} ${favorite ? "de" : "a"} favoritos`}
                          aria-pressed={favorite}
                          title={
                            favorite
                              ? "Quitar de favoritos"
                              : "Guardar en favoritos"
                          }
                          onClick={() => toggleFavorite(choice)}
                        >
                          <Star
                            size={16}
                            fill={favorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${inComparison ? "Quitar" : "Comparar"} ${p.name}${inComparison ? " de la comparación" : ""}`}
                          aria-pressed={inComparison}
                          title={
                            inComparison
                              ? "Quitar de la comparación"
                              : comparison.length >= 3
                                ? "Compara hasta 3 estilos"
                                : "Añadir a la comparación"
                          }
                          disabled={!inComparison && comparison.length >= 3}
                          onClick={() => toggleCompare(choice)}
                        >
                          <Columns3 size={16} />
                        </button>
                      </div>
                      {p.presetId && (
                        <div className="style-saved-tools">
                          <button
                            className="style-adjust-link"
                            aria-label={`Clonar ${p.name}`}
                            onClick={() => editStyle(p, choice.media, true)}
                          >
                            <Copy size={14} /> Clonar
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Eliminar ${p.name}`}
                            onClick={() => setRemoveId(p.presetId!)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                      {p.presetId && removeId === p.presetId && (
                        <div className="style-remove-confirm">
                          <p>
                            ¿Eliminar de Mis estilos? Tus proyectos conservan
                            sus ajustes.
                          </p>
                          <button
                            className="button small"
                            onClick={() => void remove(p.presetId!)}
                          >
                            Eliminar estilo
                          </button>
                          <button
                            className="button small"
                            onClick={() => setRemoveId("")}
                          >
                            Conservar
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="hint style-gallery-note">
                Abre una muestra para ver sus detalles. Son ejemplos del acabado
                visual; tu guion define la historia.
              </p>
              {comparison.length > 0 && (
                <div className="style-comparison-tray">
                  <div className="style-comparison-selection">
                    {comparison.map((c) => (
                      <button
                        key={styleKey(c.profile)}
                        aria-label={`Quitar ${c.profile.name} de la comparación`}
                        title={`Quitar ${c.profile.name}`}
                        onClick={() => toggleCompare(c)}
                      >
                        <StyleSample value={c.profile.base} />
                        <span>{c.profile.name}</span>
                        <X size={13} />
                      </button>
                    ))}
                  </div>
                  <div className="style-comparison-controls">
                    <span>
                      {comparison.length}/3
                      {comparison.length === 1 ? " · Elige otro estilo" : ""}
                    </span>
                    <button
                      className="button primary"
                      disabled={comparison.length < 2}
                      onClick={() => setComparing(true)}
                    >
                      Comparar {comparison.length}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </StudioDialog>
      )}
    </div>
  );
}
