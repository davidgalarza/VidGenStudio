import { useRef, useState } from "react";
import {
  Check,
  Eye,
  ImagePlus,
  LoaderCircle,
  Search,
  Upload,
  ArrowLeft,
} from "lucide-react";
import type { Asset } from "../types";
import { storeImage } from "../lib/media";
import { StudioDialog } from "./StudioDialog";
export type ReferenceRole = "first" | "last" | "reference";
const copy = {
  first: {
    title: "Elegir fotograma inicial",
    hint: "Esta imagen define cómo empieza el vídeo.",
    action: "Usar fotograma inicial",
  },
  last: {
    title: "Elegir fotograma final",
    hint: "Esta imagen marca cómo debe terminar el vídeo.",
    action: "Usar fotograma final",
  },
  reference: {
    title: "Elegir referencias visuales",
    hint: "Elige hasta 3 imágenes para guiar personajes, objetos o estilo. Describe en el prompt qué quieres conservar de ellas.",
    action: "Usar referencias",
  },
};
export function ReferencePicker({
  role,
  title,
  description,
  actionLabel,
  assets,
  selectedIds,
  onApply,
  onRefresh,
  onClose,
}: {
  role: ReferenceRole;
  title?: string;
  description?: string;
  actionLabel?: string;
  assets: Asset[];
  selectedIds: string[];
  onApply: (ids: string[]) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(selectedIds);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const max = role === "reference" ? 3 : 1;
  const visible = assets.filter((a) =>
    a.file_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const focused = assets.find((a) => a.id === zoom);
  const chosen = selected.filter((id) => assets.some((a) => a.id === id));
  const toggle = (id: string) => {
    if (busy) return;
    setMessage("");
    setSelected((ids) =>
      ids.includes(id)
        ? ids.filter((item) => item !== id)
        : max === 1
          ? [id]
          : ids.length < max
            ? [...ids, id]
            : ids,
    );
  };
  const upload = async (files: File[]) => {
    if (busy || !files.length) return;
    if (max === 1 && files.length > 1) {
      setMessage("Para este fotograma, sube una sola imagen a la vez.");
      return;
    }
    if (files.length > 20) {
      setMessage("Sube como máximo 20 imágenes a la vez.");
      return;
    }
    setBusy(true);
    setMessage("");
    setSearch("");
    setZoom(undefined);
    const created: Asset[] = [],
      errors: string[] = [];
    try {
      for (const file of files) {
        try {
          created.push(await storeImage(file, file.name));
        } catch (e) {
          errors.push(
            `${file.name}: ${e instanceof Error ? e.message : "No se pudo subir."}`,
          );
        }
      }
      await onRefresh();
      if (created.length)
        setSelected((ids) =>
          max === 1
            ? [created[0].id]
            : [...new Set([...ids, ...created.map((a) => a.id)])].slice(0, max),
        );
      const extra =
        max > 1 && chosen.length + created.length > max
          ? " Todas se guardaron en Referencias; solo puedes usar 3 a la vez."
          : "";
      setMessage(
        [
          ...errors,
          created.length
            ? `${created.length} ${created.length === 1 ? "imagen guardada" : "imágenes guardadas"}.${extra}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo actualizar la biblioteca.",
      );
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    setBusy(true);
    setMessage("");
    try {
      await onApply(chosen);
      onClose();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No se pudo guardar la selección.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <StudioDialog
      title={title || copy[role].title}
      wide
      busy={busy}
      onClose={onClose}
    >
      <div
        className={`reference-picker ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes("Files")) {
            depth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = busy ? "none" : "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (--depth.current <= 0) {
            depth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        {!focused && (
          <>
            <p className="hint">{description || copy[role].hint}</p>
            <input
              ref={input}
              type="file"
              hidden
              aria-label="Subir imágenes de referencia"
              accept="image/png,image/jpeg,image/webp"
              multiple={max > 1}
              disabled={busy}
              onChange={(e) => {
                void upload(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
            <div className="reference-picker-toolbar">
              <label className="reference-search">
                <Search size={17} />
                <input
                  aria-label="Buscar referencias"
                  placeholder="Buscar por nombre"
                  value={search}
                  disabled={busy}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className="button"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                Subir imágenes
              </button>
            </div>
            <div
              className="reference-dropzone"
              data-testid="reference-dropzone"
            >
              {dragging
                ? "Suelta las imágenes aquí"
                : "También puedes arrastrar imágenes aquí"}
              <small>
                JPG, PNG o WebP · hasta 5 MB por imagen · se guardan en
                Referencias
              </small>
            </div>
          </>
        )}
        {message && (
          <p className="reference-message" role="status">
            {message}
          </p>
        )}
        {focused ? (
          <div className="reference-large">
            <button className="text-button" onClick={() => setZoom(undefined)}>
              <ArrowLeft size={16} /> Volver a la galería
            </button>
            <img src={focused.data_url} alt={focused.file_name} />
            <div>
              <span>{focused.file_name}</span>
              <button
                className="button"
                disabled={
                  busy ||
                  (max > 1 &&
                    chosen.length >= max &&
                    !chosen.includes(focused.id))
                }
                onClick={() => toggle(focused.id)}
              >
                {chosen.includes(focused.id)
                  ? "Quitar de la selección"
                  : "Seleccionar esta imagen"}
              </button>
            </div>
          </div>
        ) : visible.length ? (
          <div className="reference-picker-grid">
            {visible.map((asset) => (
              <article
                key={asset.id}
                className={`reference-choice ${chosen.includes(asset.id) ? "is-selected" : ""}`}
              >
                <button
                  className="reference-select"
                  aria-label={`Seleccionar ${asset.file_name}`}
                  aria-pressed={chosen.includes(asset.id)}
                  disabled={
                    busy ||
                    (max > 1 &&
                      chosen.length >= max &&
                      !chosen.includes(asset.id))
                  }
                  onClick={() => toggle(asset.id)}
                >
                  <img src={asset.data_url} alt="" loading="lazy" />
                  <span>{asset.file_name}</span>
                  {chosen.includes(asset.id) && (
                    <i>
                      <Check size={16} />
                    </i>
                  )}
                </button>
                <button
                  className="reference-enlarge icon-button"
                  aria-label={`Ampliar ${asset.file_name}`}
                  onClick={() => setZoom(asset.id)}
                >
                  <Eye size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="reference-picker-empty">
            <ImagePlus size={26} />
            <strong>
              {search
                ? "No hay referencias con ese nombre"
                : "Añade tu primera referencia"}
            </strong>
            <p>
              {search
                ? "Prueba otro nombre o sube una imagen nueva."
                : "Sube o arrastra una imagen. Podrás reutilizarla en otros clips."}
            </p>
          </div>
        )}
        <footer className="reference-picker-footer">
          <div>
            <strong>
              {max === 1
                ? chosen.length
                  ? "1 imagen seleccionada"
                  : "Elige una imagen"
                : `${chosen.length} de 3 seleccionadas`}
            </strong>
            <small>
              {max > 1 && chosen.length === 3
                ? "Quita una para elegir otra."
                : "La selección se aplica al confirmar."}
            </small>
          </div>
          <button className="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || (max === 1 && !chosen.length)}
            onClick={() => void apply()}
          >
            {busy ? "Guardando…" : actionLabel || copy[role].action}
          </button>
        </footer>
      </div>
    </StudioDialog>
  );
}
