import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { isContentBlock } from "../lib/contentReview";
import { getApiKey } from "../lib/settings";
import {
  reviewScene,
  type SceneReviewInput,
  type SceneRevision,
} from "../lib/sceneRevision";
import { StudioDialog } from "./StudioDialog";

/** A single explicit text request. Applying never starts a video generation. */
export function PromptReview({
  error,
  input,
  disabled,
  onApply,
}: {
  error?: string;
  input: SceneReviewInput;
  disabled?: boolean;
  onApply: (description: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SceneReviewInput>();
  const [result, setResult] = useState<SceneRevision>();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const stale = !!source && JSON.stringify(source) !== JSON.stringify(input);
  function close() {
    request.current?.abort();
    request.current = null;
    setOpen(false);
    setLoading(false);
  }
  async function propose() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setSource(input);
    setResult(undefined);
    setFailure("");
    setOpen(true);
    setLoading(true);
    try {
      const proposal = await reviewScene(getApiKey(), input, controller.signal);
      if (!controller.signal.aborted) setResult(proposal);
    } catch (e) {
      if (!controller.signal.aborted)
        setFailure(
          e instanceof DOMException && e.name === "TimeoutError"
            ? "La revisión tardó demasiado. La escena sigue sin cambios."
            : e instanceof Error
              ? e.message
              : "No se pudo revisar la escena. Tu descripción sigue guardada.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }
  if (!isContentBlock(error) && !open) return null;
  return (
    <div className="prompt-review">
      <button
        className="button compact"
        disabled={disabled || !input.description.trim()}
        onClick={() => void propose()}
      >
        <Sparkles size={15} /> Revisar descripción con Gemini
      </button>
      <span className="hint">Propone un ajuste antes de generar de nuevo.</span>
      {open && (
        <StudioDialog
          title="Revisar descripción"
          onClose={close}
          busy={applying}
        >
          <div className="prompt-review-body">
            <p className="hint">
              Gemini revisa el texto usando tu clave de Google. Esta revisión
              consume cuota de texto; todavía no genera vídeo.
            </p>
            {loading && (
              <p className="prompt-review-progress" role="status">
                <LoaderCircle size={18} className="spin" /> Preparando una
                propuesta para esta escena…
              </p>
            )}
            {source && (
              <details open={!loading}>
                <summary>Descripción actual</summary>
                <p className="prompt-review-original">{source.description}</p>
              </details>
            )}
            {result && (
              <>
                <div role="status">
                  <h3>
                    {result.kind === "manual"
                      ? "Necesita revisión manual"
                      : result.kind === "alternative"
                        ? "Alternativa: cambia parte de la escena"
                        : "Una descripción más clara"}
                  </h3>
                  <p className="prompt-review-explanation">
                    {result.explanation}
                  </p>
                </div>
                {result.kind !== "manual" && (
                  <label>
                    Descripción propuesta
                    <textarea
                      aria-label="Descripción propuesta"
                      readOnly
                      rows={6}
                      value={result.description}
                    />
                  </label>
                )}
                {input.lockedText && (
                  <p className="hint">
                    El guion, el diálogo y la narración se conservan. Solo se
                    aplicará la descripción visual.
                  </p>
                )}
              </>
            )}
            {!!source?.referenceCount && (
              <p className="hint">
                Hay {source.referenceCount}{" "}
                {source.referenceCount === 1
                  ? "referencia vinculada"
                  : "referencias vinculadas"}
                . Esta revisión no analiza ni modifica las imágenes. Revisa
                también su contenido.
              </p>
            )}
            {!loading && (
              <p className="hint">
                Google puede volver a rechazar la generación. Si la propuesta no
                encaja con tu idea, puedes descartarla y editar la escena.
              </p>
            )}
            {stale && (
              <p className="inline-error" role="alert">
                La escena cambió durante la revisión. Cierra esta propuesta y
                revisa la descripción actual.
              </p>
            )}
            {failure && (
              <p className="inline-error" role="alert">
                {failure}
              </p>
            )}
            <div className="prompt-review-actions">
              <button className="button" disabled={applying} onClick={close}>
                {loading ? "Cancelar revisión" : "Cerrar sin cambiar"}
              </button>
              {result && result.kind !== "manual" && (
                <button
                  className="button primary"
                  disabled={applying || disabled || stale}
                  onClick={async () => {
                    if (applying || stale || disabled) return;
                    setApplying(true);
                    setFailure("");
                    try {
                      await onApply(result.description);
                      close();
                    } catch (e) {
                      setFailure(
                        e instanceof Error
                          ? e.message
                          : "No se pudo guardar el ajuste.",
                      );
                    } finally {
                      setApplying(false);
                    }
                  }}
                >
                  {applying ? "Guardando…" : "Aplicar descripción"}
                </button>
              )}
            </div>
          </div>
        </StudioDialog>
      )}
    </div>
  );
}
