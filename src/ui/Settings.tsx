import { useState } from "react";
import {
  Check,
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  getApiKey,
  setApiKey,
  getDefaults,
  saveDefaults,
} from "../lib/settings";
import { errorMessage, testApiKey } from "../lib/google";
import { IconButton, VideoControls } from "./common";
import type { WorkspaceController } from "../lib/useWorkspace";
export function Settings({
  workspace: w,
  onKeyChange,
  returnToClip,
}: {
  workspace: WorkspaceController;
  onKeyChange: () => void;
  returnToClip?: () => void;
}) {
  const [key, setKey] = useState(getApiKey);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [defaults, setDefaults] = useState(getDefaults);
  async function check() {
    setChecking(true);
    setChecked(false);
    try {
      await testApiKey(key, AbortSignal.timeout(20000));
      setChecked(true);
      w.notify(
        "Google acepta la clave. El acceso a Omni se comprobará al generar tu primer vídeo.",
      );
    } catch (e) {
      w.notify(errorMessage(e), true);
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="page settings-page">
      {returnToClip && (
        <button className="text-button settings-return" onClick={returnToClip}>
          <ArrowLeft size={16} /> Volver al clip
        </button>
      )}
      <h1>Ajustes del estudio</h1>
      <p className="page-description">
        Conecta Google una vez. Después, céntrate en crear.
      </p>
      <section className="settings-section">
        <div className="settings-section-title">
          <KeyRound size={21} />
          <div>
            <h2>Tu conexión con Google</h2>
            <p>
              Usa una clave de Google AI Studio con acceso a Omni 1.1 Flash.
            </p>
          </div>
        </div>
        <label>
          Google API key
          <div className="key-field">
            <input
              type={visible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setChecked(false);
              }}
              placeholder="Pega aquí tu API key"
              aria-label="Google API key"
            />
            <IconButton
              label={visible ? "Ocultar clave" : "Mostrar clave"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconButton>
          </div>
        </label>
        <div className="settings-buttons">
          <button
            className="button primary"
            disabled={!key.trim() || checking}
            onClick={() => {
              try {
                setApiKey(key);
                onKeyChange();
                w.notify("Clave guardada en este navegador.");
              } catch (e) {
                w.notify(errorMessage(e), true);
              }
            }}
          >
            <Save size={15} />
            Guardar clave
          </button>
          <button
            className="button"
            disabled={!key.trim() || checking}
            onClick={() => void check()}
          >
            {checking ? (
              <LoaderCircle size={15} className="spin" />
            ) : checked ? (
              <Check size={15} />
            ) : (
              <ShieldCheck size={15} />
            )}
            {checking ? "Comprobando…" : "Comprobar conexión"}
          </button>
          {getApiKey() && (
            <button
              className="text-button"
              disabled={!!w.job}
              onClick={() => {
                setApiKey("");
                setKey("");
                setChecked(false);
                onKeyChange();
                w.notify("Clave eliminada de este navegador.");
              }}
            >
              Eliminar clave guardada
            </button>
          )}
        </div>
        <p className="hint">
          La clave se guarda en este navegador y se envía directamente a Google.
          La comprobación consulta el catálogo; no genera contenido. El consumo
          se factura en tu cuenta de Google.
        </p>
        <a
          className="text-link"
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
        >
          Obtener una API key en Google AI Studio
          <ExternalLink size={14} />
        </a>
      </section>
      <section className="settings-section">
        <h2>Una conexión para toda la historia</h2>
        <p>
          Tu clave de Google permite preparar el guion con Gemini, narrarlo con
          Gemini TTS, generar referencias con Nano Banana y producir los vídeos.
          El acceso y el consumo dependen de los modelos habilitados en tu
          cuenta.
        </p>
      </section>
      <section className="settings-section">
        <div className="settings-section-title">
          <div>
            <h2>Así empiezan tus proyectos</h2>
            <p>
              Valores para nuevos proyectos. Cada escena puede tener sus propios
              ajustes.
            </p>
          </div>
        </div>
        <VideoControls value={defaults} onChange={setDefaults} />
        <button
          className="button"
          onClick={() => {
            try {
              saveDefaults(defaults);
              w.notify("Preferencias guardadas para nuevos proyectos.");
            } catch (e) {
              w.notify(errorMessage(e), true);
            }
          }}
        >
          <Save size={15} />
          Guardar preferencias
        </button>
      </section>
      <section className="settings-section">
        <h2>Tu contenido, en este dispositivo</h2>
        <p>
          Los proyectos, las referencias y los vídeos se guardan en este
          navegador. No se sincronizan entre dispositivos. Descarga las tomas
          que quieras conservar antes de borrar los datos del navegador.
        </p>
        <p>
          Omni conserva el contexto de sus generaciones en Google para permitir
          ediciones y extensiones. Si ese contexto caduca, puedes seguir
          descargando tu vídeo local y generar una nueva toma.
        </p>
        <a
          className="text-link"
          href="https://github.com/davidgalarza/VidGenStudio"
          target="_blank"
          rel="noreferrer"
        >
          Código abierto · licencia MIT
          <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
