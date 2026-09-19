import { ArrowUp, LoaderCircle, X } from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import { StudioDialog } from "./StudioDialog";
export function QueueActivity({
  workspace: w,
  onClose,
  openProject,
}: {
  workspace: WorkspaceController;
  onClose: () => void;
  openProject: (id: string) => void;
}) {
  const recoverable = w.scenes.filter(
    (s) =>
      s.task?.remoteId &&
      !w.jobFor(s.id) &&
      !w.queue.some((q) => q.sceneId === s.id && q.resume),
  );
  return (
    <StudioDialog title="Actividad" onClose={onClose}>
      <p className="hint">
        Hasta {w.parallelism}{" "}
        {w.parallelism === 1 ? "vídeo a la vez" : "vídeos a la vez"}. Puedes
        cerrar este panel y seguir trabajando. El orden de las escenas se
        conserva aunque terminen en otro orden.
      </p>
      {!!w.jobs.length && <h3>En curso · {w.jobs.length}</h3>}
      {w.jobs.map((job) => (
        <div key={job.sceneId} className="activity-current" role="status">
          <LoaderCircle size={18} className="spin" />
          <div>
            <strong>
              {w.scenes.find((s) => s.id === job.sceneId)?.title ||
                "Clip en curso"}
            </strong>
            <p>{job.text}</p>
            <small>
              {
                w.projects.find(
                  (p) =>
                    p.id ===
                    w.scenes.find((s) => s.id === job.sceneId)?.project_id,
                )?.name
              }
            </small>
          </div>
        </div>
      ))}
      {w.queuePaused && !!w.queue.length && (
        <div className="activity-current">
          <div>
            <strong>Creación pausada</strong>
            <p>
              {w.jobs.length
                ? "Los vídeos activos conservan su progreso. No se envían más solicitudes."
                : "Lo pendiente está guardado. Continúa cuando estés listo."}
            </p>
          </div>
          <button
            className="button"
            disabled={!!w.jobs.length}
            onClick={w.continueQueue}
          >
            Continuar
          </button>
        </div>
      )}
      <h3>
        {w.queue.length
          ? `A continuación · ${w.queue.length}`
          : w.jobs.length
            ? "No hay más clips esperando"
            : recoverable.length
              ? "No hay solicitudes pendientes de envío"
              : "Todo al día"}
      </h3>
      <ol className="activity-list">
        {w.queue.map((item, index) => {
          const scene = w.scenes.find((s) => s.id === item.sceneId);
          const batch = w.queue.filter(
            (q) => q.batchId && q.batchId === item.batchId,
          );
          const first =
            item.batchId &&
            w.queue.findIndex((q) => q.batchId === item.batchId) === index;
          return (
            <li key={item.id}>
              <span className="activity-number">{index + 1}</span>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    if (scene) {
                      onClose();
                      openProject(scene.project_id);
                    }
                  }}
                >
                  {scene?.title || "Clip"}
                </button>
                <small>
                  {w.projects.find((p) => p.id === scene?.project_id)?.name}
                </small>
                {first && batch.length > 1 && (
                  <button
                    className="text-button cancel-batch"
                    onClick={() =>
                      void w.cancelRequests(batch.map((q) => q.id))
                    }
                  >
                    Cancelar tanda · {batch.length} pendientes
                  </button>
                )}
              </div>
              <button
                className="icon-button"
                aria-label={`Generar antes: ${scene?.title}`}
                title="Generar en cuanto haya un espacio disponible"
                disabled={index === 0}
                onClick={() => void w.prioritize(item.id)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Cancelar solicitud: ${scene?.title}`}
                onClick={() => void w.cancelRequests([item.id])}
              >
                <X size={17} />
              </button>
            </li>
          );
        })}
      </ol>
      {!!recoverable.length && (
        <section>
          <h3>Resultados por recuperar</h3>
          <p className="hint">
            Google ya recibió estos clips. Recuperar consulta su estado sin
            generar otro vídeo.
          </p>
          {recoverable.length > 1 && (
            <button
              className="button compact"
              disabled={!!w.jobs.length}
              onClick={() =>
                void w.run(
                  recoverable.map((s) => s.id),
                  "generate",
                  undefined,
                  true,
                )
              }
            >
              Recuperar {recoverable.length} resultados
            </button>
          )}
          <ul className="activity-list">
            {recoverable.map((scene) => (
              <li key={scene.id}>
                <div>{scene.title}</div>
                <button
                  className="button compact"
                  disabled={!!w.jobs.length}
                  onClick={() =>
                    void w.run([scene.id], "generate", undefined, true)
                  }
                >
                  Recuperar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {w.notice?.error && (
        <p className="inline-error" role="alert">
          {w.notice.text}
        </p>
      )}
      {!!w.queue.length && (
        <p className="hint">
          Adelantar un clip cambia su turno. Cancelar pendientes no afecta a los
          vídeos que ya están generándose.
        </p>
      )}
    </StudioDialog>
  );
}
