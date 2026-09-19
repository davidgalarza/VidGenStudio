import { ArrowDown, ArrowUp, Plus, Trash2, Users } from "lucide-react";
import type { Asset, DialogueTurn, StoryBlock, StoryConfig } from "../types";
import {
  blockDialogue,
  dialoguePatch,
  planDialogueShots,
} from "../lib/storyDialogue";

export function DialogueEditor({
  turns,
  config,
  assets,
  onChange,
  label,
  disabled = false,
}: {
  turns: DialogueTurn[];
  config: StoryConfig;
  assets: Asset[];
  onChange: (turns: DialogueTurn[]) => void;
  label: string;
  disabled?: boolean;
}) {
  function patch(index: number, changes: Partial<DialogueTurn>) {
    onChange(turns.map((t, i) => (i === index ? { ...t, ...changes } : t)));
  }
  function move(index: number, delta: number) {
    const next = [...turns];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  return (
    <div
      className="story-dialogue"
      role="group"
      aria-label={`Conversación de ${label}`}
    >
      <div className="story-dialogue-heading">
        <Users size={15} />
        <strong>Lo que se escuchará</strong>
        <span>
          {turns.length}{" "}
          {turns.length === 1 ? "intervención" : "intervenciones"}
        </span>
      </div>
      {turns.map((turn, i) => {
        const character = config.characters.find(
          (c) => c.name === turn.speaker,
        );
        const image = assets.find((a) => a.id === character?.referenceId);
        return (
          <div className="story-dialogue-turn" key={turn.id}>
            <div className="story-dialogue-speaker">
              {image ? (
                <img src={image.data_url} alt="" />
              ) : (
                <span className="story-character-initial" aria-hidden="true">
                  {turn.speaker.slice(0, 1) || "?"}
                </span>
              )}
              <select
                aria-label={`Quién habla en intervención ${i + 1} de ${label}`}
                value={character?.name || ""}
                disabled={disabled}
                aria-invalid={!character || undefined}
                onChange={(e) => patch(i, { speaker: e.target.value })}
              >
                {!character && (
                  <option value="" disabled>
                    {turn.speaker || "Elige personaje"}
                  </option>
                )}
                {config.characters.map((c, index) => (
                  <option value={c.name} key={index}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="story-dialogue-order">
                <button
                  className="icon-button"
                  aria-label={`Subir intervención ${i + 1} de ${label}`}
                  disabled={disabled || !i}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Bajar intervención ${i + 1} de ${label}`}
                  disabled={disabled || i === turns.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Eliminar intervención ${i + 1} de ${label}`}
                  disabled={disabled || turns.length === 1}
                  onClick={() => onChange(turns.filter((_, n) => n !== i))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <textarea
              data-story-field="text"
              aria-label={`Texto de intervención ${i + 1} de ${label}`}
              aria-invalid={!turn.text.trim() || undefined}
              value={turn.text}
              disabled={disabled}
              rows={2}
              placeholder="Las palabras que dice este personaje…"
              onChange={(e) => patch(i, { text: e.target.value })}
            />
            <input
              className="story-delivery"
              aria-label={`Interpretación de intervención ${i + 1} de ${label}`}
              value={turn.direction || ""}
              disabled={disabled}
              placeholder="Interpretación opcional: con curiosidad, una pausa…"
              onChange={(e) => patch(i, { direction: e.target.value })}
            />
            <details className="story-turn-action">
              <summary>
                Acción y movimiento
                {turn.action ? " · definidos" : " · opcional"}
              </summary>
              <textarea
                aria-label={`Acción de intervención ${i + 1} de ${label}`}
                rows={2}
                value={turn.action || ""}
                disabled={disabled}
                placeholder="Qué hace mientras habla y cómo reaccionan los demás…"
                onChange={(e) => patch(i, { action: e.target.value })}
              />
            </details>
          </div>
        );
      })}
      <button
        className="text-button"
        disabled={disabled || !config.characters.length}
        onClick={() =>
          onChange([
            ...turns,
            {
              id: crypto.randomUUID(),
              speaker:
                config.characters.find((c) => c.name !== turns.at(-1)?.speaker)
                  ?.name ||
                config.characters[0]?.name ||
                "",
              text: "",
            },
          ])
        }
      >
        <Plus size={14} />
        Añadir intervención
      </button>
    </div>
  );
}

export function SceneStaging({
  block,
  config,
  assets,
  onChange,
}: {
  block: StoryBlock;
  config: StoryConfig;
  assets: Asset[];
  onChange: (patch: Partial<StoryBlock>) => void;
}) {
  const turns = blockDialogue(config, block);
  const speakers =
    config.mode === "spoken" ? [...new Set(turns.map((t) => t.speaker))] : [];
  const present = [...new Set([...(block.participants || []), ...speakers])];
  const location = config.references?.find(
    (r) => r.locationName && r.locationName === block.locationName,
  );
  const locationImage = assets.find((a) => a.id === location?.assetId);
  let shots: ReturnType<typeof planDialogueShots> = [],
    error = "";
  if (config.mode === "spoken") {
    try {
      shots = planDialogueShots(config, block);
    } catch (e) {
      error = e instanceof Error ? e.message : "Revisa la conversación.";
    }
  }
  return (
    <div className="story-staging">
      <div className="field-row">
        <label>
          Lugar de la escena
          <select
            aria-label={`Lugar de ${block.title || "la escena"}`}
            value={block.locationName || ""}
            onChange={(e) =>
              onChange({ locationName: e.target.value || undefined })
            }
          >
            <option value="">Según la descripción visual</option>
            {config.references
              ?.filter((r) => r.locationName)
              .map((r) => (
                <option key={r.id} value={r.locationName}>
                  {r.locationName}
                </option>
              ))}
          </select>
        </label>
        {config.mode === "spoken" && (
          <label>
            Cómo se filma
            <select
              aria-label={`Planos de ${block.title || "la escena"}`}
              value={block.shotMode || "auto"}
              onChange={(e) =>
                onChange({ shotMode: e.target.value as StoryBlock["shotMode"] })
              }
            >
              <option value="auto">Automático · agrupar diálogos breves</option>
              <option value="shared">
                Plano compartido · mantenerlos juntos
              </option>
              <option value="alternating">
                Alternar · un hablante por toma
              </option>
            </select>
          </label>
        )}
      </div>
      {location && (
        <div className="story-location-strip">
          {locationImage && (
            <img src={locationImage.data_url} alt={location.locationName} />
          )}
          <span>
            <strong>{location.locationName}</strong>
            <small>
              {locationImage
                ? "Referencia compartida entre las tomas"
                : "La descripción del lugar guía todas las tomas"}
            </small>
          </span>
        </div>
      )}
      {config.characters.length > 0 && (
        <details className="story-cast-presence">
          <summary>
            En escena ·{" "}
            {present.length ? present.join(", ") : "sin personajes asignados"}
          </summary>
          <p className="hint">
            Quien habla aparece automáticamente. Añade a quienes escuchan o
            reaccionan en silencio.
          </p>
          <div className="story-participant-options">
            {config.characters.map((c, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={present.includes(c.name)}
                  disabled={
                    speakers.includes(c.name) && config.mode === "spoken"
                  }
                  onChange={(e) =>
                    onChange({
                      participants: e.target.checked
                        ? [...present, c.name]
                        : present.filter((p) => p !== c.name),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </details>
      )}
      {config.mode === "spoken" && (
        <div
          className="story-shot-plan"
          aria-label={`Tomas previstas de ${block.title || "la escena"}`}
        >
          <div>
            <strong>
              {shots.length}{" "}
              {shots.length === 1 ? "toma prevista" : "tomas previstas"}
            </strong>
            <span>
              El texto se reparte sin resumirlo. La duración es orientativa.
            </span>
          </div>
          {error ? (
            <p className="inline-error">{error}</p>
          ) : (
            <ol>
              {shots.map((s, i) => (
                <li key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>
                      {[...new Set(s.dialogue.map((t) => t.speaker))].join(
                        " + ",
                      )}
                    </strong>
                    <p>{s.text.trim()}</p>
                  </div>
                  <small>{s.duration} s</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export function SceneConversation({
  block,
  config,
  assets,
  label,
  onChange,
}: {
  block: StoryBlock;
  config: StoryConfig;
  assets: Asset[];
  label: string;
  onChange: (patch: Partial<StoryBlock>) => void;
}) {
  const turns = blockDialogue(config, block);
  return (
    <div>
      <DialogueEditor
        turns={
          turns.length
            ? turns
            : [
                {
                  id: `${block.id}-empty`,
                  speaker: config.characters[0]?.name || "",
                  text: "",
                },
              ]
        }
        config={config}
        assets={assets}
        label={label}
        onChange={(next) => onChange(dialoguePatch(next))}
      />
      <details className="story-raw-dialogue">
        <summary>Editar como texto</summary>
        <p className="hint">
          Puedes pegar otra conversación usando «Nombre: texto». Las
          indicaciones de interpretación se editan arriba.
        </p>
        <textarea
          data-story-field="text"
          aria-label={`Texto de ${label}`}
          value={block.text}
          rows={4}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </details>
    </div>
  );
}
