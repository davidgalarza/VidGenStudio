import { useState, type CSSProperties } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import type { StoryStyle } from "../types";
import { storyStyles } from "../lib/story";
import { StudioDialog } from "./StudioDialog";
import atlas from "../assets/story-styles.png";

const descriptions = [
  "Luz natural y texturas reales",
  "Luz y encuadres de cine",
  "Dibujo 2D expresivo",
  "Volumen y personajes estilizados",
  "Ideas que se entienden al verlas",
  "Diagramas y formas en movimiento",
  "Líneas expresivas y fondos pintados",
  "Miniaturas con textura artesanal",
  "Pigmentos y bordes suaves",
  "Capas de papel con profundidad",
  "Píxeles y movimiento retro",
  "Tinta, contraste y tramas",
];
export function StyleSample({ value }: { value: StoryStyle }) {
  const index = Math.max(
    0,
    storyStyles.findIndex((s) => s.id === value),
  );
  const style: CSSProperties = {
    backgroundImage: `url(${atlas})`,
    backgroundPosition: `${((index % 4) / 3) * 100}% ${(Math.floor(index / 4) / 2) * 100}%`,
  };
  return (
    <span className="story-style-sample" style={style} aria-hidden="true" />
  );
}
export function StoryStylePicker({
  value,
  onChange,
  automatic = false,
  disabled = false,
}: {
  value: StoryStyle | "";
  onChange: (value: StoryStyle | "") => void;
  automatic?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = storyStyles.find((s) => s.id === value);
  return (
    <div className="story-style-control">
      <span className="field-caption">Estilo visual</span>
      <button
        className="story-style-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {value ? (
          <StyleSample value={value} />
        ) : (
          <span className="story-style-auto">
            <Sparkles size={21} />
          </span>
        )}
        <span>
          <strong>{selected?.label || "Que Gemini lo proponga"}</strong>
          <small>
            {selected ? "Cambiar estilo" : "Explora 12 estilos visuales"}
          </small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <StudioDialog
          title="Elige el estilo de tu historia"
          wide
          onClose={() => setOpen(false)}
        >
          <p className="hint">
            La misma escena, interpretada de doce maneras. Son muestras
            visuales: tu guion define el contenido.
          </p>
          {automatic && (
            <button
              className="button story-style-auto-choice"
              aria-pressed={!value}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Sparkles size={16} />
              Que Gemini lo proponga{!value && <Check size={15} />}
            </button>
          )}
          <div className="story-style-gallery">
            {storyStyles.map((style, i) => (
              <button
                key={style.id}
                className={`story-style-option ${value === style.id ? "selected" : ""}`}
                aria-pressed={value === style.id}
                onClick={() => {
                  onChange(style.id);
                  setOpen(false);
                }}
              >
                <StyleSample value={style.id} />
                <span className="story-style-option-label">
                  <strong>{style.label}</strong>
                  {value === style.id && <Check size={15} />}
                </span>
                <small>{descriptions[i]}</small>
              </button>
            ))}
          </div>
        </StudioDialog>
      )}
    </div>
  );
}
