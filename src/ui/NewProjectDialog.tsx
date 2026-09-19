import { ArrowRight, BookOpen, Film, LoaderCircle } from "lucide-react";
import type { ProjectKind } from "../types";
import { StudioDialog } from "./StudioDialog";

export function NewProjectDialog({
  creating,
  error,
  onCreate,
  onClose,
}: {
  creating: ProjectKind | null;
  error?: string;
  onCreate: (kind: ProjectKind) => void;
  onClose: () => void;
}) {
  return (
    <StudioDialog title="Nuevo proyecto" onClose={onClose} busy={!!creating}>
      <p className="hint">
        Elige cómo quieres trabajar. El proyecto empezará vacío.
      </p>
      <div className="project-kind-options">
        <button
          className="project-kind-option"
          disabled={!!creating}
          onClick={() => onCreate("clips")}
          aria-label="Crear proyecto de clips"
        >
          <Film size={23} />
          <span>
            <strong>Proyecto de clips</strong>
            <small>
              Genera tomas, edita y extiende vídeos. Descárgalos por separado o
              monta una secuencia.
            </small>
          </span>
          {creating === "clips" ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
        <button
          className="project-kind-option"
          disabled={!!creating}
          onClick={() => onCreate("story")}
          aria-label="Crear proyecto de historia"
        >
          <BookOpen size={23} />
          <span>
            <strong>Proyecto de historia</strong>
            <small>
              Empieza por un guion. Prepara personajes, voz y escenas; produce y
              monta la historia completa.
            </small>
          </span>
          {creating === "story" ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </StudioDialog>
  );
}
