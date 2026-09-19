import { base64Blob, googleInteraction } from "./google";
export const TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const geminiVoices = [
  ["Kore", "Firme"],
  ["Charon", "Informativa"],
  ["Sulafat", "Cálida"],
  ["Puck", "Animada"],
  ["Zephyr", "Brillante"],
  ["Fenrir", "Expresiva"],
  ["Leda", "Juvenil"],
  ["Orus", "Firme"],
  ["Aoede", "Ligera"],
  ["Callirrhoe", "Relajada"],
  ["Autonoe", "Brillante"],
  ["Enceladus", "Suave y aireada"],
  ["Iapetus", "Clara"],
  ["Umbriel", "Relajada"],
  ["Algieba", "Suave"],
  ["Despina", "Suave"],
  ["Erinome", "Clara"],
  ["Algenib", "Grave"],
  ["Rasalgethi", "Informativa"],
  ["Laomedeia", "Animada"],
  ["Achernar", "Delicada"],
  ["Alnilam", "Firme"],
  ["Schedar", "Equilibrada"],
  ["Gacrux", "Madura"],
  ["Pulcherrima", "Directa"],
  ["Achird", "Amigable"],
  ["Zubenelgenubi", "Informal"],
  ["Vindemiatrix", "Amable"],
  ["Sadachbia", "Vivaz"],
  ["Sadaltager", "Experta"],
].map(([id, label]) => ({ id, label }));
export const validVoice = (id: string) => geminiVoices.some((v) => v.id === id);
export function pcmToWave(pcm: Uint8Array, rate = 24000) {
  if (
    !pcm.length ||
    pcm.length % 2 ||
    !Number.isInteger(rate) ||
    rate < 8000 ||
    rate > 96000
  )
    throw new Error("Gemini devolvió audio PCM no válido.");
  const header = new ArrayBuffer(44),
    view = new DataView(header);
  const ascii = (at: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  return new Blob([header, new Uint8Array(pcm)], { type: "audio/wav" });
}
// These are acoustic pauses, not word timestamps. Audio intervals always remain contiguous.
export function silenceCuts(pcm: Uint8Array, rate: number) {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength),
    window = Math.floor(rate * 0.04),
    cuts: number[] = [];
  let silentFrom = -1;
  for (let start = 0; start < pcm.byteLength / 2; start += window) {
    const end = Math.min(start + window, pcm.byteLength / 2);
    let energy = 0;
    for (let i = start; i < end; i++)
      energy += (view.getInt16(i * 2, true) / 32768) ** 2;
    const quiet = Math.sqrt(energy / (end - start)) < 0.012;
    if (quiet && silentFrom < 0) silentFrom = start / rate;
    if (!quiet && silentFrom >= 0) {
      if (start / rate - silentFrom >= 0.12)
        cuts.push((silentFrom + start / rate) / 2);
      silentFrom = -1;
    }
  }
  return cuts;
}
export async function createGeminiSpeech(
  key: string,
  voice: string,
  text: string,
  direction = "",
) {
  if (!validVoice(voice)) throw new Error("Elige una voz de Gemini TTS.");
  interface Audio {
    type?: string;
    data?: string;
    mime_type?: string;
  }
  const result = await googleInteraction<{
    output_audio?: Audio;
    steps?: { type?: string; content?: Audio[] }[];
  }>(key, {
    model: TTS_MODEL,
    input: `Read ONLY the text inside <script>, exactly and completely in its original language. Do not read instructions, tags, or add any introduction. Natural continuous narration, clear diction. Keep a consistent voice and comfortable pace. Direction: ${direction || "Warm, conversational, with natural pauses."}\n<script>\n${text}\n</script>`,
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice }] },
  });
  const parts = result.output_audio
    ? [result.output_audio]
    : result.steps
        ?.filter((s) => s.type === "model_output")
        .flatMap((s) => s.content || [])
        .filter((p) => p.type === "audio") || [];
  if (!parts.length || parts.some((p) => !p.data))
    throw new Error(
      "Gemini TTS no devolvió audio. No se ha repetido la solicitud.",
    );
  const mime = parts[0].mime_type || "audio/L16;codec=pcm;rate=24000";
  if (
    !/audio\/(L16|pcm)/i.test(mime) ||
    parts.some((p) => p.mime_type && p.mime_type !== mime)
  )
    throw new Error("Gemini TTS devolvió un formato de audio no compatible.");
  const rate = Number(mime.match(/rate=(\d+)/)?.[1] || 24000);
  const buffers = await Promise.all(
    parts.map(
      async (p) =>
        new Uint8Array(
          await base64Blob(p.data!, "application/octet-stream").arrayBuffer(),
        ),
    ),
  );
  const pcm = new Uint8Array(buffers.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const b of buffers) {
    pcm.set(b, offset);
    offset += b.length;
  }
  return {
    blob: pcmToWave(pcm, rate),
    duration: pcm.length / (rate * 2),
    cuts: silenceCuts(pcm, rate),
    provider: "gemini" as const,
    direction,
    text,
    voice,
  };
}
export function speechIntervals(
  duration: number,
  max: number,
  cuts: number[] = [],
) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(max) ||
    max <= 0.05
  )
    throw new Error("La duración de la narración no es válida.");
  const intervals: { start: number; end: number }[] = [];
  let start = 0;
  while (start < duration - 1e-6) {
    const limit = Math.min(duration, start + max - 0.05);
    const pause = cuts
      .filter(
        (t) =>
          Number.isFinite(t) && t > start + Math.min(3, max / 2) && t <= limit,
      )
      .at(-1);
    const end = limit < duration ? (pause ?? limit) : duration;
    intervals.push({ start, end });
    start = end;
  }
  return intervals;
}
