import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { Story } from "../types";
import {
  assignStorySpeaker,
  storyCastIssues,
  type StoryCastIssue,
} from "../lib/storyCast";

function CastGroup({
  story,
  issues,
  disabled,
  onChange,
  onLocate,
}: {
  story: Story;
  issues: StoryCastIssue[];
  disabled: boolean;
  onChange: (story: Story) => void;
  onLocate: (id: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const scenes = [...new Map(issues.map((i) => [i.blockId, i])).values()];
  const name = issues[0].name;
  return (
    <div className="story-cast-fix-group">
      <div>
        <strong>
          {name
            ? `«${name}» no está asignado al reparto`
            : "Sin personaje asignado"}
        </strong>
        <p>
          {scenes.length === 1 ? "En la escena " : "En las escenas "}
          {scenes.slice(0, 6).map((issue, index) => (
            <span key={issue.blockId}>
              {index > 0 && ", "}
              <button
                className="text-button"
                onClick={() => onLocate(issue.blockId)}
                aria-label={`Ver escena ${issue.index + 1}`}
              >
                {issue.index + 1}
              </button>
            </span>
          ))}
          {scenes.length > 6 && ` y ${scenes.length - 6} más`}.
        </p>
      </div>
      <div className="story-cast-fix-controls">
        <select
          aria-label={`Personaje para ${name || "escenas sin asignar"}`}
          disabled={disabled}
          value={
            story.characters.some((c) => c.name === selected) ? selected : ""
          }
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Elegir personaje…</option>
          {story.characters.map((c, i) => (
            <option key={i} value={c.name}>
              {c.name || "Personaje sin nombre"}
            </option>
          ))}
        </select>
        <button
          className="button compact"
          disabled={
            disabled ||
            !story.characters.some((c) => c.name === selected && !!selected)
          }
          onClick={() => onChange(assignStorySpeaker(story, issues, selected))}
        >
          Asignar{" "}
          {scenes.length === 1
            ? "a esta escena"
            : `a las ${scenes.length} escenas`}
        </button>
      </div>
    </div>
  );
}
export function StoryCastReview({
  story,
  disabled,
  onlyIssues,
  onFilter,
  onChange,
  onLocate,
  onCast,
}: {
  story: Story;
  disabled: boolean;
  onlyIssues: boolean;
  onFilter: () => void;
  onChange: (story: Story) => void;
  onLocate: (id: string) => void;
  onCast: () => void;
}) {
  const issues = storyCastIssues(story);
  if (!issues.length) return null;
  const groups = new Map<string, StoryCastIssue[]>();
  for (const issue of issues) {
    const key = issue.name
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
    groups.set(key, [...(groups.get(key) || []), issue]);
  }
  const count = new Set(issues.map((i) => i.blockId)).size;
  return (
    <section className="story-cast-review" aria-label="Personajes por revisar">
      <div className="story-cast-review-heading">
        <div>
          <h3>
            <AlertCircle size={17} />
            {count === 1
              ? "Una escena necesita personaje"
              : `${count} escenas necesitan revisar su personaje`}
          </h3>
          <p>
            Corrige cada nombre una sola vez para todas las escenas indicadas.
            Tu guion y las demás escenas se conservan.
          </p>
        </div>
        <button className="text-button" onClick={onFilter}>
          {onlyIssues ? "Ver todas las escenas" : "Ver solo las pendientes"}
        </button>
      </div>
      {[...groups].map(([key, group]) => (
        <CastGroup
          key={key}
          story={story}
          issues={group}
          disabled={disabled}
          onChange={onChange}
          onLocate={onLocate}
        />
      ))}
      <button className="text-button" onClick={onCast}>
        Editar o añadir personajes al reparto
      </button>
    </section>
  );
}
