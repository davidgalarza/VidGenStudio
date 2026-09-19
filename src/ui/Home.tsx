import { useState } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  Film,
  BookOpen,
  Clock3,
} from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import { sceneBlob, projectKind, type ProjectKind } from "../types";
import { Clip, Empty } from "./common";

export function Home({
  workspace: w,
  create,
  open,
}: {
  workspace: WorkspaceController;
  create: () => void;
  open: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ProjectKind | "all">("all");
  const projects = w.projects.filter(
    (p) =>
      p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (kind === "all" || projectKind(p) === kind),
  );
  return (
    <div className="page home-page">
      <header className="projects-header">
        <div>
          <h1>Proyectos</h1>
          <p>
            Clips para trabajar toma a toma. Historias para crear desde un
            guion.
          </p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={17} />
          Nuevo proyecto
        </button>
      </header>
      <section>
        <div className="section-heading projects-heading">
          <h2>
            Guardados <span className="count">{w.projects.length}</span>
          </h2>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Buscar proyectos"
              aria-label="Buscar proyectos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div
          className="project-type-filter"
          role="group"
          aria-label="Tipo de proyecto"
        >
          {(
            [
              ["all", "Todos"],
              ["clips", "Clips"],
              ["story", "Historias"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={kind === value ? "active" : ""}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}{" "}
              <span>
                {value === "all"
                  ? w.projects.length
                  : w.projects.filter((p) => projectKind(p) === value).length}
              </span>
            </button>
          ))}
        </div>
        {projects.length ? (
          <div className="project-list">
            {projects.map((project) => {
              const isStory = projectKind(project) === "story";
              const materials = w.scenes.filter(
                (s) => s.project_id === project.id,
              );
              const storyIds = new Set(
                project.story?.blocks.flatMap((b) => b.sceneIds || []),
              );
              const scenes = isStory
                ? materials.filter((s) => storyIds.has(s.id))
                : materials;
              const ready = scenes.filter((s) => sceneBlob(s));
              const storySummary =
                project.story?.phase === "planning"
                  ? "Preparando propuesta"
                  : project.story?.phase === "review"
                    ? `${project.story.blocks.length} escenas por revisar`
                    : !scenes.length
                      ? "Guion por preparar"
                      : `${scenes.length} escenas · ${ready.length} listas`;
              const first = scenes[0] || materials[0],
                poster = w.assets.find(
                  (a) => a.id === first?.first_frame_asset_id,
                )?.data_url;
              return (
                <button
                  className="project-row"
                  key={project.id}
                  onClick={() => open(project.id)}
                >
                  <Clip
                    blob={first ? sceneBlob(first) : undefined}
                    poster={poster}
                    controls={false}
                  />
                  <div className="project-name">
                    <strong>{project.name}</strong>
                    <small>
                      {isStory ? <BookOpen size={13} /> : <Film size={13} />}
                      <span className="project-type-label">
                        {isStory ? "Historia" : "Clips"}
                      </span>
                      <span>·</span>
                      {isStory
                        ? storySummary
                        : `${scenes.length} clips · ${ready.length} listos`}
                    </small>
                  </div>
                  <span className="project-date">
                    <Clock3 size={13} />
                    {new Intl.DateTimeFormat("es", {
                      day: "numeric",
                      month: "short",
                    }).format(
                      new Date(project.updated_at || project.created_at),
                    )}
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <Empty
            title={
              search
                ? "No hay coincidencias"
                : kind === "story"
                  ? "Todavía no hay historias"
                  : kind === "clips"
                    ? "Todavía no hay proyectos de clips"
                    : "Todavía no hay proyectos"
            }
          >
            {search
              ? "Prueba con otro nombre de proyecto."
              : "Pulsa Nuevo proyecto y elige cómo quieres trabajar."}
          </Empty>
        )}
      </section>
    </div>
  );
}
