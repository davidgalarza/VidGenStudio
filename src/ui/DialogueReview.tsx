import { useEffect, useRef, useState } from "react";
import { AudioLines, LoaderCircle } from "lucide-react";
import type { DialogueTurn, StoryConfig } from "../types";
import {
  compareDialogue,
  reviewDialogue,
  type DialogueCheck,
} from "../lib/dialogueReview";
import { getApiKey } from "../lib/settings";
import { StudioDialog } from "./StudioDialog";

export function DialogueReview({
  blob,
  turns,
  config,
  disabled,
}: {
  blob: Blob;
  turns: DialogueTurn[];
  config: StoryConfig;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DialogueCheck>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function close() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setOpen(false);
  }
  async function check() {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const response = await reviewDialogue(
        getApiKey(),
        blob,
        config.characters,
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(response);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "No se pudo revisar el diálogo.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="story-dialogue-review">
      <button
        className="text-button"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <AudioLines size={15} />
        Revisar diálogo
      </button>
      {result && (
        <small className="hint">
          {compareDialogue(turns, result)
            ? "La transcripción coincide"
            : "Hay posibles diferencias"}
        </small>
      )}
      {open && (
        <StudioDialog title="Revisar diálogo" onClose={close}>
          <div className="story-review-comparison">
            <p className="hint">
              Gemini escucha esta toma y compara la transcripción con tu texto.
              Usa tu clave y consume cuota de análisis de vídeo. La revisión
              puede equivocarse: confirma el resultado escuchándolo.
            </p>
            <div>
              <strong>Lo previsto</strong>
              <p>{turns.map((t) => `${t.speaker}: ${t.text}`).join("\n")}</p>
            </div>
            {busy && (
              <p role="status">
                <LoaderCircle size={16} className="spin" /> Escuchando la toma…
              </p>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {result && (
              <>
                <strong role="status">
                  {compareDialogue(turns, result)
                    ? "La transcripción coincide con tu texto"
                    : "Hay posibles diferencias que revisar"}
                </strong>
                <div>
                  <span>Lo que Gemini ha escuchado</span>
                  <p>
                    {result.turns
                      .map((t) => `${t.speaker}: ${t.text}`)
                      .join("\n") || "No se detectó diálogo."}
                  </p>
                </div>
                {result.notes && <p>{result.notes}</p>}
                <p className="hint">
                  Puedes cerrar, escuchar el vídeo y ajustar o regenerar solo
                  esta toma.
                </p>
              </>
            )}
            <button
              className="button primary"
              disabled={busy || disabled}
              onClick={() => void check()}
            >
              <AudioLines size={16} />
              {result
                ? "Volver a revisar con Gemini"
                : "Analizar esta toma con Gemini"}
            </button>
          </div>
        </StudioDialog>
      )}
    </div>
  );
}
