import {
  OMNI_MODEL,
  VEO_MODEL,
  type VideoSettings,
  type GenerationTask,
} from "../types";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
export interface ReferenceImage {
  data: string;
  mimeType: string;
  role: "first" | "last" | "reference";
}
interface VideoOutput {
  data?: string;
  uri?: string;
  mime_type?: string;
}
interface Interaction {
  id?: string;
  status?: string;
  output_video?: VideoOutput;
  steps?: {
    type?: string;
    content?: (VideoOutput & { type?: string; text?: string })[];
  }[];
  error?: { message?: string };
  errors?: { message?: string }[];
}
function modelOutput(result: Interaction) {
  // output_video is an SDK convenience; the raw REST response uses steps.
  return (
    result.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || []) || []
  );
}
interface VeoOperation {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: {
        video?: {
          uri?: string;
          bytesBase64Encoded?: string;
          mimeType?: string;
        };
      }[];
      raiMediaFilteredReasons?: string[];
    };
  };
}
function providerMessage(message: string, apiKey = "") {
  const detail = apiKey ? message.replaceAll(apiKey, "[clave]") : message;
  if (/the file failed to be processed/i.test(detail))
    return "Google no pudo procesar un archivo de esta generación. Si usas referencias, prueba a sustituirlas de una en una. El mensaje de Google no especifica cuál falló.";
  return detail;
}
export class TerminalGenerationError extends Error {}
class OutputFileError extends TerminalGenerationError {}
export function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Seguimiento pausado. Google puede continuar la generación; recupera el resultado sin crear otro vídeo.";
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "Google está tardando demasiado. Recupera el resultado más tarde desde esta escena.";
  if (error instanceof TypeError)
    return "No se pudo conectar con Google. Comprueba tu conexión y recupera el resultado si ya se envió la solicitud.";
  return error instanceof Error
    ? providerMessage(error.message)
    : "No se pudo completar la acción. Inténtalo de nuevo.";
}
async function request<T>(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = providerMessage(String(body.error?.message || ""), apiKey);
    const hints: Record<number, string> = {
      400: "Google rechazó la solicitud. Revisa la clave, el prompt y las referencias.",
      401: "La clave no es válida. Revísala en Ajustes.",
      403: "Esta clave no tiene permiso para usar el modelo. Revisa el acceso y la facturación en Google AI Studio.",
      404: "El modelo o la generación ya no está disponible para esta clave.",
      429: "Has alcanzado la cuota o el límite de solicitudes de Google. Espera antes de reintentar.",
      500: "Google devolvió un error temporal.",
      503: "El modelo está ocupado. Inténtalo más tarde.",
    };
    throw new Error(
      `${hints[response.status] || `Google respondió con un error (${response.status}).`}${detail ? ` ${detail}` : ""}`,
    );
  }
  return response.json();
}
export function validateSettings(settings: VideoSettings) {
  if (![OMNI_MODEL, VEO_MODEL].includes(settings.model))
    throw new Error("Selecciona un modelo disponible.");
  if (!["9:16", "16:9"].includes(settings.aspectRatio))
    throw new Error("Formato no compatible.");
  if (settings.model === OMNI_MODEL) {
    if (
      !Number.isInteger(settings.duration) ||
      settings.duration < 3 ||
      settings.duration > 10
    )
      throw new Error("Omni admite clips de 3 a 10 segundos.");
    if (!["360p", "720p", "1080p", "4k"].includes(settings.resolution))
      throw new Error("Resolución no compatible.");
  } else if (
    ![4, 6, 8].includes(settings.duration) ||
    !["720p", "1080p"].includes(settings.resolution) ||
    (settings.resolution === "1080p" && settings.duration !== 8)
  )
    throw new Error(
      "Veo admite 4, 6 u 8 segundos en 720p, y 8 segundos en 1080p.",
    );
}
export function buildOmniPayload(
  task: GenerationTask,
  images: ReferenceImage[],
) {
  validateSettings(task.settings);
  if (!task.prompt.trim()) throw new Error("Describe lo que quieres crear.");
  if (task.mode !== "generate" && !task.previousInteractionId)
    throw new Error(
      "Selecciona una versión de Omni para editarla o extenderla.",
    );
  if (task.mode === "extend" && (task.previousDuration || 0) + 10 > 40)
    throw new Error("La extensión de Omni admite hasta 40 segundos en total.");
  if (
    images.some((i) => i.role === "last") &&
    !images.some((i) => i.role === "first")
  )
    throw new Error("Añade el fotograma inicial antes del final.");
  const sources: string[] = [],
    refs: string[] = [];
  let ref = 0;
  images.forEach((image, i) => {
    if (image.role === "first") sources.push(`<FIRST_FRAME>@Image${i + 1}`);
    else if (image.role === "last") sources.push(`<LAST_FRAME>@Image${i + 1}`);
    else refs.push(`<IMAGE_REF_${ref++}>@Image${i + 1}`);
  });
  const instructions =
    task.mode === "extend"
      ? "Extend this video by 10 seconds. "
      : task.mode === "edit"
        ? "Edit the previous video. Keep everything else the same. "
        : "";
  const prompt = [
    sources.length ? `[# Sources ${sources.join(" ")}]` : "",
    refs.length ? `[# References ${refs.join(" ")}]` : "",
    instructions + task.prompt,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    model: OMNI_MODEL,
    input: images.length
      ? [
          ...images.map((image) => ({
            type: "image",
            data: image.data,
            mime_type: image.mimeType,
          })),
          { type: "text", text: prompt },
        ]
      : prompt,
    response_format: {
      type: "video",
      aspect_ratio: task.settings.aspectRatio,
      resolution: task.settings.resolution,
      ...(task.mode === "generate"
        ? { duration: `${task.settings.duration}s` }
        : {}),
      // Google recommends URI delivery for large outputs (>720p). Short 360p/
      // 720p generations use direct delivery to avoid the extra Files pipeline.
      ...(task.mode !== "generate" ||
      ["1080p", "4k"].includes(task.settings.resolution)
        ? { delivery: "uri" }
        : {}),
    },
    background: true,
    store: true,
    ...(task.previousInteractionId
      ? { previous_interaction_id: task.previousInteractionId }
      : {}),
  };
}
export function buildVeoPayload(
  task: GenerationTask,
  images: ReferenceImage[],
) {
  validateSettings(task.settings);
  if (task.mode !== "generate")
    throw new Error(
      "La edición y la extensión de esta interfaz requieren Omni.",
    );
  if (images.some((i) => i.role === "reference"))
    throw new Error(
      "Usa Omni para generar con referencias de personaje o estilo.",
    );
  const first = images.find((i) => i.role === "first"),
    last = images.find((i) => i.role === "last");
  if (last && !first)
    throw new Error("Añade el fotograma inicial antes del final.");
  return {
    instances: [
      {
        prompt: task.prompt,
        ...(first
          ? {
              image: {
                bytesBase64Encoded: first.data,
                mimeType: first.mimeType,
              },
            }
          : {}),
        ...(last
          ? {
              lastFrame: {
                bytesBase64Encoded: last.data,
                mimeType: last.mimeType,
              },
            }
          : {}),
      },
    ],
    parameters: {
      aspectRatio: task.settings.aspectRatio,
      resolution: task.settings.resolution,
      durationSeconds: task.settings.duration,
      sampleCount: 1,
    },
  };
}
export function base64Blob(data: string, mimeType = "video/mp4"): Blob {
  const decoded = atob(data),
    bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
export async function blobDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
export async function downloadVideo(
  output: VideoOutput,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Blob> {
  if (output.data) return base64Blob(output.data, output.mime_type);
  if (!output.uri)
    throw new Error(
      "Google no devolvió un vídeo. Revisa el prompt y las restricciones del modelo.",
    );
  const url = new URL(
    /^files\/[\w-]+$/.test(output.uri) ? `${BASE}/${output.uri}` : output.uri,
  );
  if (
    url.protocol !== "https:" ||
    !["googleapis.com", "googleusercontent.com"].some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  )
    throw new Error("Google devolvió una dirección de descarga no reconocida.");
  const file =
    url.hostname === "generativelanguage.googleapis.com"
      ? url.pathname.match(/^\/v1beta\/files\/([\w-]+)(?::download)?$/)
      : null;
  if (file) {
    const pollingSignal = signal || AbortSignal.timeout(15 * 60 * 1000);
    for (;;) {
      const info = await request<{
        state?: string;
        error?: { message?: string };
      }>(`${BASE}/files/${file[1]}`, apiKey, { signal: pollingSignal });
      if (info.state === "ACTIVE") break;
      if (info.state === "FAILED")
        throw new OutputFileError(
          "Google no pudo preparar el archivo de vídeo generado. No se ha recuperado un vídeo descargable. Puedes reintentar el clip; esto enviará una nueva generación.",
        );
      if (info.state !== "PROCESSING")
        throw new Error(
          "Google devolvió un estado de archivo no reconocido. Recupera el resultado más tarde.",
        );
      await delay(5000, pollingSignal);
    }
    url.pathname = `/v1beta/files/${file[1]}:download`;
    url.search = "?alt=media";
  }
  // Signed storage links must not receive the user's API key.
  const headers =
    url.hostname === "generativelanguage.googleapis.com"
      ? { "x-goog-api-key": apiKey }
      : undefined;
  const response = await fetch(url, { headers, signal });
  if (!response.ok)
    throw new Error(
      `No se pudo descargar el vídeo (${response.status}). Recupera el resultado más tarde.`,
    );
  const blob = await response.blob();
  if (!blob.size || blob.type.includes("json") || blob.type.includes("html"))
    throw new Error("La descarga no contiene un vídeo válido.");
  return new Blob([blob], { type: output.mime_type || "video/mp4" });
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export async function generateVideo(args: {
  apiKey: string;
  task: GenerationTask;
  images: ReferenceImage[];
  signal: AbortSignal;
  onRemoteId: (id: string) => Promise<void>;
  onProgress: (text: string) => void;
  pollInterval?: number;
}): Promise<{ blob: Blob; interactionId?: string }> {
  const { apiKey, task, onProgress, onRemoteId } = args;
  let images = args.images;
  if (!apiKey.trim())
    throw new Error("Añade tu clave de Google en Ajustes para generar.");
  const signal = AbortSignal.any([
    args.signal,
    AbortSignal.timeout(15 * 60 * 1000),
  ]);
  signal.throwIfAborted();
  const interval = args.pollInterval ?? 5000;
  if (!task.remoteId && images.length) {
    // Validate before image decoding and before issuing any paid request.
    (task.settings.model === OMNI_MODEL ? buildOmniPayload : buildVeoPayload)(
      task,
      images,
    );
    onProgress("Preparando imágenes de referencia…");
    const { prepareReferenceImages } = await import("./referenceImages");
    images = await prepareReferenceImages(images, signal);
  }
  onProgress(task.remoteId ? "Recuperando generación…" : "Enviando a Google…");
  if (task.settings.model === OMNI_MODEL) {
    const endpoint = (id: string) =>
      `${BASE}/interactions/${encodeURIComponent(id)}`;
    let result = task.remoteId
      ? await request<Interaction>(endpoint(task.remoteId), apiKey, { signal })
      : await request<Interaction>(`${BASE}/interactions`, apiKey, {
          method: "POST",
          body: JSON.stringify(buildOmniPayload(task, images)),
          signal,
        });
    if (result.id) await onRemoteId(result.id);
    while (result.status && ["in_progress", "queued"].includes(result.status)) {
      if (!result.id)
        throw new Error(
          "Google no devolvió el identificador de la generación.",
        );
      onProgress("Omni está creando tu vídeo…");
      await delay(interval, signal);
      result = await request<Interaction>(endpoint(result.id), apiKey, {
        signal,
      });
    }
    if (
      result.error ||
      result.errors?.length ||
      (result.status && result.status !== "completed")
    )
      throw new (
        result.status === "failed" || result.status === "cancelled"
          ? TerminalGenerationError
          : Error
      )(
        providerMessage(
          result.error?.message ||
            result.errors?.map((e) => e.message).join(" ") ||
            `La generación terminó con estado ${result.status}.`,
          apiKey,
        ),
      );
    const content = modelOutput(result);
    const video =
      content.findLast(
        (part) => part.type === "video" && (part.data || part.uri),
      ) || result.output_video;
    if (!video) {
      const detail = content
        .filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join(" ")
        .replaceAll(apiKey, "[clave]")
        .slice(0, 1500);
      throw new Error(
        detail
          ? `Google respondió sin vídeo: ${detail}`
          : "Google terminó la solicitud sin incluir un vídeo ni explicar el motivo. Puedes recuperar el resultado antes de generar de nuevo.",
      );
    }
    onProgress("Guardando el vídeo…");
    let blob: Blob;
    try {
      blob = await downloadVideo(video, apiKey, signal);
    } catch (error) {
      if (!(error instanceof OutputFileError) || !result.id) throw error;
      // Google documents that GET can return inline data even when URI delivery
      // failed. Retrieve this interaction once; never repeat a paid POST.
      onProgress("Recuperando el vídeo desde la solicitud original…");
      const recovered = await request<Interaction>(
        endpoint(result.id),
        apiKey,
        { signal },
      );
      const alternative =
        modelOutput(recovered).findLast(
          (part) => part.type === "video" && part.data,
        ) || recovered.output_video;
      if (
        recovered.status !== "completed" ||
        recovered.error ||
        recovered.errors?.length ||
        !alternative?.data
      )
        throw error;
      blob = await downloadVideo(alternative, apiKey, signal);
    }
    return { blob, interactionId: result.id };
  }
  const endpoint = (name: string) => {
    if (
      !/^models\/[\w.-]+\/operations\/[\w.-]+$/.test(name) &&
      !/^operations\/[\w.-]+$/.test(name)
    )
      throw new Error("Identificador de operación no válido.");
    return `${BASE}/${name}`;
  };
  let operation = task.remoteId
    ? await request<VeoOperation>(endpoint(task.remoteId), apiKey, { signal })
    : await request<VeoOperation>(
        `${BASE}/models/${VEO_MODEL}:predictLongRunning`,
        apiKey,
        {
          method: "POST",
          body: JSON.stringify(buildVeoPayload(task, images)),
          signal,
        },
      );
  if (operation.name) await onRemoteId(operation.name);
  while (!operation.done) {
    if (!operation.name)
      throw new Error("Google no devolvió una operación de vídeo.");
    onProgress("Veo está creando tu vídeo…");
    await delay(interval, signal);
    operation = await request<VeoOperation>(endpoint(operation.name), apiKey, {
      signal,
    });
  }
  if (operation.error)
    throw new Error(operation.error.message || "Veo no pudo generar el vídeo.");
  const result = operation.response?.generateVideoResponse,
    video = result?.generatedSamples?.[0]?.video;
  if (!video)
    throw new Error(
      result?.raiMediaFilteredReasons?.join(" ") ||
        "Veo no devolvió un vídeo. Revisa el prompt.",
    );
  onProgress("Guardando el vídeo…");
  return {
    blob: await downloadVideo(
      {
        uri: video.uri,
        data: video.bytesBase64Encoded,
        mime_type: video.mimeType,
      },
      apiKey,
      signal,
    ),
  };
}
export async function testApiKey(apiKey: string, signal?: AbortSignal) {
  if (!apiKey.trim()) throw new Error("Introduce una clave de Google.");
  await request(`${BASE}/models?pageSize=1`, apiKey, { signal });
}
export async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: string,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!apiKey || !prompt.trim())
    throw new Error("Añade una clave y describe la imagen.");
  const result = await request<{
    candidates?: {
      content?: {
        parts?: { inlineData?: { data: string; mimeType: string } }[];
      };
    }[];
  }>(`${BASE}/models/gemini-3.1-flash-image:generateContent`, apiKey, {
    method: "POST",
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio },
      },
    }),
  });
  const image = result.candidates
    ?.flatMap((c) => c.content?.parts || [])
    .find((p) => p.inlineData)?.inlineData;
  if (!image)
    throw new Error(
      "Google no devolvió una imagen. Prueba con otra descripción.",
    );
  return base64Blob(image.data, image.mimeType);
}

/** Plan visuals only: script and audio timing remain owned by the local editor. */
export async function planStoryVisuals(
  apiKey: string,
  input: string,
  ids: string[],
) {
  const result = await request<Interaction & { output_text?: string }>(
    `${BASE}/interactions`,
    apiKey,
    {
      method: "POST",
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    visual: { type: "string" },
                  },
                  required: ["id", "title", "visual"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scenes"],
            additionalProperties: false,
          },
        },
      }),
    },
  );
  const text =
    result.output_text ||
    modelOutput(result)
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join("");
  let parsed: { scenes?: { id: string; title: string; visual: string }[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini no devolvió un plan válido. Tu guion y los audios guardados se conservan.",
    );
  }
  const scenes = parsed?.scenes;
  if (
    !Array.isArray(scenes) ||
    scenes.length !== ids.length ||
    new Set(scenes.map((s) => s.id)).size !== ids.length ||
    scenes.some(
      (s) =>
        !ids.includes(s.id) ||
        typeof s.title !== "string" ||
        typeof s.visual !== "string" ||
        !s.visual.trim(),
    )
  )
    throw new Error(
      "El plan de Gemini está incompleto. El guion no se ha modificado.",
    );
  return scenes;
}
