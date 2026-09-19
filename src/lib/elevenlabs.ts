import type { SpeechAlignment } from "../types";
import { base64Blob } from "./google";
export interface ElevenVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
}
const BASE = "https://api.elevenlabs.io/v1";
async function request(path: string, key: string, init: RequestInit = {}) {
  if (!key.trim())
    throw new Error("Conecta tu clave de ElevenLabs para crear la voz en off.");
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": key,
        ...init.headers,
      },
      signal: init.signal || AbortSignal.timeout(180000),
    });
  } catch {
    throw new Error(
      "No se pudo completar la conexión con ElevenLabs. Si la solicitud llegó a enviarse, puede haber consumo. No se reintentará automáticamente.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      typeof body.detail?.message === "string"
        ? body.detail.message
        : typeof body.detail === "string"
          ? body.detail
          : "Revisa tu clave, los permisos y el saldo de ElevenLabs.";
    throw new Error(
      `ElevenLabs (${response.status}): ${message.replaceAll(key, "[clave]")}`,
    );
  }
  return response;
}
export async function listVoices(key: string): Promise<ElevenVoice[]> {
  const response = await request("/voices", key, {
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as { voices?: ElevenVoice[] };
  if (!Array.isArray(data.voices))
    throw new Error("ElevenLabs no devolvió un catálogo de voces válido.");
  return data.voices.filter((v) => v.voice_id && v.name);
}
export async function createSpeech(
  key: string,
  voiceId: string,
  text: string,
  context: {
    previousText?: string;
    nextText?: string;
    previousRequestIds?: string[];
  },
) {
  const response = await request(
    `/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
        },
        previous_text: context.previousText,
        next_text: context.nextText,
        previous_request_ids: context.previousRequestIds?.length
          ? context.previousRequestIds.slice(-3)
          : undefined,
      }),
    },
  );
  const data = (await response.json()) as {
    audio_base64?: string;
    alignment?: SpeechAlignment;
  };
  if (!data.audio_base64)
    throw new Error(
      "ElevenLabs no devolvió audio. No se ha reintentado la solicitud.",
    );
  return {
    blob: base64Blob(data.audio_base64, "audio/mpeg"),
    alignment: data.alignment,
    requestId: response.headers.get("request-id") || undefined,
  };
}
export async function audioDuration(blob: Blob) {
  const context = new AudioContext();
  try {
    return (await context.decodeAudioData(await blob.arrayBuffer())).duration;
  } finally {
    await context.close();
  }
}
