import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  Download,
  Film,
  House,
  Images,
  KeyRound,
  Menu,
  Pause,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace } from "../lib/useWorkspace";
import * as db from "../lib/storage";
import { getApiKey, getDefaults } from "../lib/settings";
import { downloadBlob } from "../lib/media";
import { Home } from "./Home";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { StoryWorkspace } from "./StoryWorkspace";
import { NewProjectDialog } from "./NewProjectDialog";
import { projectKind, type ProjectKind } from "../types";
import { errorMessage } from "../lib/google";
import { Settings } from "./Settings";
import { QueueActivity } from "./QueueActivity";
import { Library } from "./Library";
import { Dismiss, IconButton } from "./common";

function currentRoute() {
  return window.location.hash.slice(1) || "home";
}
export function StudioApp() {
  const w = useWorkspace();
  const [route, setRoute] = useState(currentRoute);
  const [menu, setMenu] = useState(false);
  const [activity, setActivity] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState<ProjectKind | null>(
    null,
  );
  const [projectError, setProjectError] = useState("");
  const [settingsReturn, setSettingsReturn] = useState<{
    projectId: string;
    clipId?: string;
  }>();
  const [connected, setConnected] = useState(() => !!getApiKey());
  useEffect(() => {
    const change = () => setRoute(currentRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const navigate = (next: string) => {
    window.location.assign(`#${next}`);
    setRoute(next);
    setMenu(false);
  };
  const project = route.startsWith("project/")
    ? w.projects.find((p) => p.id === route.slice(8))
    : undefined;
  const open = (id: string) => {
    setSettingsReturn(undefined);
    navigate(`project/${id}`);
  };
  const create = () => {
    setProjectError("");
    setNewProject(true);
  };
  const createTypedProject = async (kind: ProjectKind) => {
    if (creatingProject) return;
    setCreatingProject(kind);
    setProjectError("");
    try {
      const project = await db.createProject(
        kind === "story" ? "Historia sin título" : "Proyecto sin título",
        [],
        getDefaults(),
        kind,
      );
      await w.refresh();
      setNewProject(false);
      open(project.id);
    } catch (e) {
      setProjectError(errorMessage(e));
    } finally {
      setCreatingProject(null);
    }
  };
  const nav = [
    { id: "home", text: "Mis proyectos", icon: House },
    { id: "assets", text: "Referencias", icon: Images },
    { id: "videos", text: "Mis vídeos", icon: Film },
  ];
  return (
    <div className="studio-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="Vidgen Studio, inicio"
        >
          <span className="brand-symbol">
            <Clapperboard size={21} />
          </span>
          <span>
            vidgen<span className="brand-secondary">studio</span>
          </span>
        </button>
        <div className="sidebar-close">
          <IconButton label="Cerrar menú" onClick={() => setMenu(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <button className="button primary new-project" onClick={() => create()}>
          <Plus size={17} />
          Nuevo proyecto
        </button>
        <nav aria-label="Navegación principal">
          {nav.map((item) => (
            <button
              key={item.id}
              className={route === item.id ? "active" : ""}
              aria-current={route === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={17} />
              {item.text}
              {item.id === "home" && <span>{w.projects.length}</span>}
            </button>
          ))}
        </nav>
        <div className="recent-projects">
          <div className="sidebar-label">Recientes</div>
          {w.projects.slice(0, 8).map((p) => (
            <button
              key={p.id}
              className={project?.id === p.id ? "active" : ""}
              onClick={() => open(p.id)}
              title={`${p.name} · ${projectKind(p) === "story" ? "Historia" : "Clips"}`}
            >
              {projectKind(p) === "story" ? (
                <BookOpen size={15} />
              ) : (
                <Film size={15} />
              )}
              <span>{p.name}</span>
            </button>
          ))}
          {!w.projects.length && <p>Tus proyectos aparecerán aquí.</p>}
        </div>
        <div className="sidebar-bottom">
          <button
            className={`connection ${connected ? "connected" : ""}`}
            onClick={() => navigate("settings")}
          >
            <span className="connection-dot" />
            <span>
              {connected ? "Clave guardada" : "Conecta tu API key"}
              <small>
                {connected ? "Google AI Studio" : "Para empezar a generar"}
              </small>
            </span>
            <ChevronRight size={14} />
          </button>
          <button
            className={`settings-nav ${route === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={17} />
            Ajustes
          </button>
          <a
            href="https://github.com/davidgalarza/VidGenStudio"
            target="_blank"
            rel="noreferrer"
          >
            Código abierto
            <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="inline">
            <span className="mobile-menu">
              <IconButton label="Abrir menú" onClick={() => setMenu(true)}>
                <Menu size={20} />
              </IconButton>
            </span>
            <span className="breadcrumb">
              Estudio
              <ChevronRight size={13} />
              <strong>
                {project
                  ? project.name
                  : route === "assets"
                    ? "Referencias"
                    : route === "videos"
                      ? "Mis vídeos"
                      : route === "settings"
                        ? "Ajustes"
                        : "Mis proyectos"}
              </strong>
            </span>
          </div>
          <div className="inline">
            {project && (
              <IconButton
                label="Eliminar proyecto"
                disabled={
                  !!w.jobs.length ||
                  w.queue.length > 0 ||
                  w.storyJob?.projectId === project.id
                }
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Eliminar «${project.name}» y todos sus vídeos locales?`,
                    )
                  )
                    void w.action(async () => {
                      await db.deleteProject(project.id);
                      navigate("home");
                    });
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            )}
            <button
              className="text-button api-status"
              onClick={() => navigate("settings")}
            >
              {connected ? <Check size={14} /> : <KeyRound size={14} />}
              {connected ? "API key guardada" : "Conectar Google"}
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {!connected && route !== "settings" && (
            <div className="connection-banner">
              <KeyRound size={16} />
              <span>
                Prepara tus escenas y conecta Google cuando quieras generar.
              </span>
              <button onClick={() => navigate("settings")}>
                Añadir API key
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {w.loading ? (
            <div
              className="loading-layout"
              aria-label="Cargando proyectos"
              aria-busy="true"
            >
              <div />
              <div />
              <div />
            </div>
          ) : (
            <>
              {route === "settings" && (
                <Settings
                  workspace={w}
                  onKeyChange={() => setConnected(!!getApiKey())}
                  returnLabel={
                    settingsReturn &&
                    !settingsReturn.clipId &&
                    w.projects.some(
                      (p) =>
                        p.id === settingsReturn.projectId &&
                        projectKind(p) === "story",
                    )
                      ? "Volver a la historia"
                      : "Volver al clip"
                  }
                  returnToClip={
                    settingsReturn
                      ? () => navigate(`project/${settingsReturn.projectId}`)
                      : undefined
                  }
                />
              )}
              <div hidden={route !== "assets"}>
                <Library workspace={w} open={open} />
              </div>
              {route === "videos" && (
                <Library key="videos" workspace={w} videos open={open} />
              )}
              {project && projectKind(project) === "clips" && (
                <ProjectWorkspace
                  key={project.id}
                  project={project}
                  workspace={w}
                  initialClipId={
                    settingsReturn?.projectId === project.id
                      ? settingsReturn.clipId
                      : undefined
                  }
                  settings={(clipId) => {
                    setSettingsReturn({ projectId: project.id, clipId });
                    navigate("settings");
                  }}
                />
              )}
              {project && projectKind(project) === "story" && (
                <StoryWorkspace
                  key={project.id}
                  project={project}
                  workspace={w}
                  initialClipId={
                    settingsReturn?.projectId === project.id
                      ? settingsReturn.clipId
                      : undefined
                  }
                  onProjects={() => navigate("home")}
                  settings={(clipId) => {
                    setSettingsReturn({ projectId: project.id, clipId });
                    navigate("settings");
                  }}
                />
              )}
              {(route === "home" ||
                (!project &&
                  !["settings", "assets", "videos"].includes(route))) && (
                <Home workspace={w} create={create} open={open} />
              )}
            </>
          )}
        </main>
        {w.storyJob && (
          <div className="story-background-job" role="status">
            <BookOpen size={16} />
            <span>{w.storyJob.text}</span>
            <button
              className="text-button"
              disabled={w.storyJob.stopping}
              onClick={w.pauseStory}
            >
              {w.storyJob.stopping ? "Pausando…" : "Pausar preparación"}
            </button>
          </div>
        )}
        {(w.jobs.length > 0 || w.queue.length > 0) && (
          <div className="job-bar" role="status">
            <span className="activity-dot" />
            <span>
              <strong>
                {w.jobs.length > 1
                  ? `${w.jobs.length} vídeos en curso${w.queuePaused ? " · Cola pausada" : ""}`
                  : w.jobs.length === 1
                    ? `${w.scenes.find((s) => s.id === w.jobs[0].sceneId)?.title || "Clip"} · ${w.jobs[0].text}`
                    : "Cola pausada"}
              </strong>
              <small>
                {w.queue.length} en espera · Hasta {w.parallelism} a la vez ·
                Mantén esta pestaña abierta
              </small>
            </span>
            <button className="text-button" onClick={() => setActivity(true)}>
              Ver actividad
            </button>
            {!w.jobs.length && w.queue.length > 0 ? (
              <button className="text-button" onClick={w.continueQueue}>
                Continuar cola
              </button>
            ) : (
              <IconButton
                label="Pausar seguimiento de la generación"
                onClick={w.pause}
              >
                <Pause size={16} />
              </IconButton>
            )}
          </div>
        )}
      </div>
      {newProject && (
        <NewProjectDialog
          creating={creatingProject}
          error={projectError}
          onCreate={(kind) => void createTypedProject(kind)}
          onClose={() => setNewProject(false)}
        />
      )}
      {activity && (
        <QueueActivity
          workspace={w}
          onClose={() => setActivity(false)}
          openProject={open}
        />
      )}
      {w.notice && (
        <div
          className={`toast ${w.notice.error ? "toast-error" : ""}`}
          role={w.notice.error ? "alert" : "status"}
        >
          <span>{w.notice.text}</span>
          <Dismiss onClick={() => w.setNotice(null)} />
        </div>
      )}
      {!!w.recoveries.length && (
        <div className="recovery-banner" role="alert">
          <span>
            {w.recoveries.length === 1
              ? "Hay un vídeo listo que no se pudo guardar."
              : `Hay ${w.recoveries.length} vídeos listos que no se pudieron guardar.`}{" "}
            Descárgalos antes de cerrar esta pestaña.
          </span>
          {w.recoveries.map(({ sceneId, version }, index) => (
            <button
              key={version.id}
              className="button primary"
              onClick={() =>
                downloadBlob(version.blob, `video-recuperado-${index + 1}.mp4`)
              }
            >
              <Download size={16} />
              Descargar{" "}
              {w.scenes.find((s) => s.id === sceneId)?.title ||
                `vídeo ${index + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
