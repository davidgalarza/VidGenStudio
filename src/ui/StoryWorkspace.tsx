import { useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Film, Layers } from "lucide-react";
import type { Project } from "../types";
import type { WorkspaceController } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { StoryEditor } from "./StoryEditor";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { SequenceEditor } from "./SequenceEditor";

type View = "story" | "materials" | "sequence";

export function StoryWorkspace({
  project,
  workspace: w,
  settings,
  initialClipId,
  onProjects,
}: {
  project: Project;
  workspace: WorkspaceController;
  settings: (clipId?: string) => void;
  initialClipId?: string;
  onProjects: () => void;
}) {
  const [view, setView] = useState<View>(initialClipId ? "materials" : "story");
  const [visitedMaterials, setVisitedMaterials] = useState(!!initialClipId);
  const [sequenceReturn, setSequenceReturn] = useState<"story" | "materials">(
    "story",
  );
  const root = useRef<HTMLDivElement>(null);
  const changeView = (next: View) => {
    root.current
      ?.querySelectorAll<HTMLMediaElement>("video, audio")
      .forEach((media) => media.pause());
    if (next === "materials") setVisitedMaterials(true);
    setView(next);
  };
  const openSequence = (from: "story" | "materials") => {
    setSequenceReturn(from);
    changeView("sequence");
  };
  return (
    <div className="story-project" ref={root}>
      <div hidden={view === "sequence"}>
        <header className="story-project-header">
          <button className="text-button" onClick={onProjects}>
            <ArrowLeft size={15} /> Proyectos
          </button>
          <div className="project-title">
            <input
              aria-label="Nombre del proyecto"
              defaultValue={project.name}
              maxLength={80}
              onBlur={(e) => {
                if (e.target.value.trim())
                  void w.action(() =>
                    db.renameProject(project.id, e.target.value),
                  );
                else e.target.value = project.name;
              }}
            />
            <span>
              <BookOpen size={12} /> Proyecto de historia{" "}
              <span aria-hidden="true">·</span>
              <Check size={12} /> Guardado en este navegador
            </span>
          </div>
        </header>
        <nav
          className="story-project-nav"
          aria-label="Secciones de la historia"
        >
          <button
            aria-pressed={view === "story"}
            onClick={() => changeView("story")}
          >
            <BookOpen size={16} /> Guion y escenas
          </button>
          <button
            aria-pressed={view === "materials"}
            onClick={() => changeView("materials")}
          >
            <Film size={16} /> Materiales
          </button>
          <button
            disabled={w.storyJob?.projectId === project.id}
            onClick={() =>
              openSequence(view === "materials" ? "materials" : "story")
            }
          >
            <Layers size={16} /> Montaje
          </button>
        </nav>
      </div>
      {/* Keep editable drafts mounted when moving between story, media and montage. */}
      <div hidden={view !== "story"}>
        <StoryEditor
          project={project}
          workspace={w}
          onSequence={() => openSequence("story")}
          onSettings={() => settings()}
        />
      </div>
      {visitedMaterials && (
        <div hidden={view !== "materials"}>
          <ProjectWorkspace
            project={project}
            workspace={w}
            settings={settings}
            initialClipId={initialClipId}
            materials
            onSequence={() => openSequence("materials")}
          />
        </div>
      )}
      {view === "sequence" && (
        <SequenceEditor
          project={project}
          workspace={w}
          backLabel={
            sequenceReturn === "story"
              ? "Volver a la historia"
              : "Volver a materiales"
          }
          onBack={() => changeView(sequenceReturn)}
        />
      )}
    </div>
  );
}
