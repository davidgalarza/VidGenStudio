import { useState } from "react";
import {
  Download,
  ImagePlus,
  LoaderCircle,
  Search,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import type { WorkspaceController } from "../lib/useWorkspace";
import { storeImage, downloadBlob } from "../lib/media";
import { getApiKey } from "../lib/settings";
import { errorMessage, generateImage, base64Blob } from "../lib/google";
import * as db from "../lib/storage";
import { VideoDownloadDialog } from "./VideoDownloadDialog";
import { sceneBlob, type Scene } from "../types";
import { Clip, Empty, IconButton } from "./common";
export function Library({
  workspace: w,
  videos = false,
  open,
}: {
  workspace: WorkspaceController;
  videos?: boolean;
  open: (id: string) => void;
}) {
  const [downloadClip, setDownloadClip] = useState<Scene>();
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [uploading, setUploading] = useState(false);
  const assets = w.assets.filter((a) =>
    a.file_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const clips = w.scenes.filter(
    (s) =>
      s.review !== "discarded" &&
      sceneBlob(s) &&
      `${s.title} ${s.prompt}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  async function upload(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) await storeImage(file, file.name);
      await w.refresh();
      w.notify(`${files.length} referencias guardadas.`);
    } catch (e) {
      await w.refresh();
      w.notify(errorMessage(e), true);
    } finally {
      setUploading(false);
    }
  }
  async function createImage() {
    setGenerating(true);
    try {
      const blob = await generateImage(
        getApiKey(),
        prompt,
        "9:16",
        AbortSignal.timeout(180000),
      );
      await storeImage(blob, `${prompt.slice(0, 45)}.png`);
      await w.refresh();
      setPrompt("");
      w.notify("Imagen lista. Ya puedes usarla como referencia en una escena.");
    } catch (e) {
      w.notify(errorMessage(e), true);
    } finally {
      setGenerating(false);
    }
  }
  return (
    <div className="page library-page">
      {downloadClip && (
        <VideoDownloadDialog
          video={{
            blobs: [sceneBlob(downloadClip)!],
            filename: `${downloadClip.title || "clip"}.mp4`,
            title: downloadClip.title || "Clip",
          }}
          onClose={() => setDownloadClip(undefined)}
        />
      )}
      <div className="section-heading">
        <div>
          <span className="kicker">Tu material creativo</span>
          <h1>
            {videos ? "Tomas listas para salir." : "Un mismo universo visual."}
          </h1>
        </div>
        {!videos && (
          <div className="inline">
            <button
              className="button"
              onClick={() => setShowGenerator(!showGenerator)}
            >
              <WandSparkles size={15} />
              Crear imagen
            </button>
            <label className="button primary upload-button">
              {uploading ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Upload size={15} />
              )}
              Subir imágenes
              <input
                aria-label="Subir imágenes a la biblioteca"
                disabled={uploading}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length)
                    void upload(Array.from(e.target.files));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>
      <p className="page-description">
        {videos
          ? "Descarga tus clips o vuelve al proyecto para seguir afinando."
          : "Personajes, productos y estilos que puedes reutilizar en cualquier escena."}
      </p>
      {!videos && showGenerator && (
        <form
          className="image-generator"
          onSubmit={(e) => {
            e.preventDefault();
            void createImage();
          }}
        >
          <label>
            Describe tu imagen de referencia
            <textarea
              rows={3}
              value={prompt}
              disabled={generating}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Una botella de vidrio verde sobre una mesa de piedra, luz natural lateral…"
            />
          </label>
          <div className="section-heading">
            <span>Gemini 3.1 Flash Image · consume cuota de Google</span>
            <button
              className="button primary"
              disabled={!prompt.trim() || generating || !getApiKey()}
            >
              {generating ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <ImagePlus size={15} />
              )}
              {generating ? "Generando imagen…" : "Generar imagen"}
            </button>
          </div>
          {!getApiKey() && (
            <p className="hint">
              Guarda tu API key en Ajustes para generar imágenes.
            </p>
          )}
        </form>
      )}
      <div className="library-toolbar">
        <span>
          {videos ? clips.length : assets.length}{" "}
          {videos ? "clips" : "referencias"}
        </span>
        <label className="search">
          <Search size={15} />
          <input
            aria-label={videos ? "Buscar clips" : "Buscar referencias"}
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {videos ? (
        clips.length ? (
          <div className="media-grid">
            {clips.map((scene) => (
              <article key={scene.id} className="media-item">
                <Clip blob={sceneBlob(scene)} />
                <div>
                  <strong>{scene.title || `Escena ${scene.order + 1}`}</strong>
                  <small>
                    {w.projects.find((p) => p.id === scene.project_id)?.name}
                  </small>
                  <div className="section-heading">
                    <button
                      className="text-button"
                      onClick={() => open(scene.project_id)}
                    >
                      Abrir proyecto
                    </button>
                    <IconButton
                      label={`Descargar ${scene.title || "clip"}`}
                      onClick={() => setDownloadClip(scene)}
                    >
                      <Download size={16} />
                    </IconButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Tus mejores tomas, juntas">
            Genera una escena y aparecerá aquí, lista para descargar.
          </Empty>
        )
      ) : assets.length ? (
        <div className="media-grid">
          {assets.map((asset) => (
            <article className="media-item" key={asset.id}>
              <img src={asset.data_url} alt={asset.file_name} />
              <div>
                <strong title={asset.file_name}>{asset.file_name}</strong>
                <div className="section-heading">
                  <span>Referencia</span>
                  <div className="inline">
                    <IconButton
                      label={`Descargar ${asset.file_name}`}
                      onClick={() => {
                        const match = asset.data_url.match(
                          /^data:([^;]+);base64,(.+)$/s,
                        );
                        if (match)
                          downloadBlob(
                            base64Blob(match[2], match[1]),
                            asset.file_name,
                          );
                      }}
                    >
                      <Download size={15} />
                    </IconButton>
                    <IconButton
                      label={`Eliminar ${asset.file_name}`}
                      disabled={w.jobs.length > 0}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Eliminar esta referencia? Se quitará también de las escenas que la usan.",
                          )
                        )
                          void w.action(() => db.deleteAsset(asset.id));
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={search ? "No hay coincidencias" : "Empieza por una referencia"}
        >
          {search
            ? "Prueba con otro nombre."
            : "Sube una imagen o crea una con Gemini. Podrás usarla como fotograma, personaje o estilo."}
        </Empty>
      )}
    </div>
  );
}
