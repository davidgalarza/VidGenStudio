import { ArrowLeft, Check, Settings2, X } from "lucide-react";
import type { StoryStyleProfile, StyleMedia } from "../types";
import { parameterOptions, type StyleParameterKey } from "../lib/storyStyles";
import { styleKey, styleUse } from "../lib/styleBrowsing";
import { StyleSample } from "./StyleSample";

export interface StyleChoice {
  profile: StoryStyleProfile;
  media: StyleMedia[];
}
export function StyleInspection({
  choices,
  comparing,
  onBack,
  onUse,
  onEdit,
  onRemove,
}: {
  choices: StyleChoice[];
  comparing: boolean;
  onBack: () => void;
  onUse: (choice: StyleChoice) => void;
  onEdit: (choice: StyleChoice) => void;
  onRemove: (choice: StyleChoice) => void;
}) {
  return (
    <>
      <div className="style-inspection-heading">
        <button className="button small" onClick={onBack}>
          <ArrowLeft size={15} /> Ver estilos
        </button>
        <p>
          {comparing
            ? "Compara el acabado y los ajustes. Tu selección no cambia hasta que uses un estilo."
            : "Explora el acabado. Puedes usarlo tal cual o ajustar sus parámetros."}
        </p>
      </div>
      <div
        className={`style-inspection ${comparing ? "is-comparison" : "is-detail"}`}
      >
        {choices.map((choice) => {
          const p = choice.profile;
          const keys: StyleParameterKey[] = [
            "pace",
            "camera",
            "lighting",
            "palette",
            "detail",
            p.mode === "spoken" ? "acting" : "explanation",
          ];
          return (
            <article key={styleKey(p)}>
              <div className="style-inspection-image">
                <StyleSample value={p.base} />
                {comparing && (
                  <button
                    className="icon-button"
                    aria-label={`Quitar ${p.name} de la comparación`}
                    onClick={() => onRemove(choice)}
                  >
                    <X size={16} />
                  </button>
                )}
                <small>Muestra ilustrativa del estilo base</small>
              </div>
              <div className="style-inspection-info">
                <div>
                  <span className="field-caption">
                    {p.mode === "spoken" ? "Personajes hablando" : "Voz en off"}
                  </span>
                  <h3>{p.name}</h3>
                </div>
                <p className="style-use-case">{styleUse(p.base)}</p>
                <div className="style-inspection-actions">
                  <button
                    className="button primary"
                    onClick={() => onUse(choice)}
                  >
                    <Check size={15} /> Usar {p.name}
                  </button>
                  <button className="button" onClick={() => onEdit(choice)}>
                    <Settings2 size={15} /> Personalizar
                  </button>
                </div>
                <dl className="style-parameter-summary">
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
                          )[p.parameters[key]]
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
                {p.instructions && (
                  <details>
                    <summary>Dirección personalizada</summary>
                    <p className="style-custom-directions">{p.instructions}</p>
                  </details>
                )}
                {choice.media.length > 0 && (
                  <p className="hint">
                    {choice.media.length} referencias guardadas. Abre
                    Personalizar para verlas.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="hint style-gallery-note">
        Las imágenes muestran el acabado base. Los parámetros y tu guion se
        aplican al generar el vídeo.
      </p>
    </>
  );
}
