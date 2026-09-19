import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { withVideoEngine } from "./videoEngine";
import {
  outputDimensions,
  type DownloadResolution,
  type VideoProcessingOptions,
} from "./videoQuality";
import type { AspectRatio } from "../types";

export async function stitchVideos(
  blobs: Blob[],
  aspect: AspectRatio,
  resolution: DownloadResolution = "720p",
  options: VideoProcessingOptions = {},
): Promise<Blob> {
  if (!blobs.length) throw new Error("No hay clips que exportar.");
  if (
    options.segments &&
    (options.segments.length !== blobs.length ||
      options.segments.some(
        (s) =>
          !Number.isFinite(s.start) ||
          s.start < 0 ||
          !Number.isFinite(s.end) ||
          s.end <= s.start ||
          !Number.isFinite(s.volume) ||
          s.volume < 0 ||
          s.volume > 1,
      ))
  )
    throw new Error("Los recortes del montaje no son válidos.");
  if (blobs.length === 1 && !options.segments)
    return resizeVideo(blobs[0], resolution, options);
  return withVideoEngine(options, async (ffmpeg) => {
    const files: string[] = [];
    try {
      const { width, height } = outputDimensions(
        aspect === "9:16" ? 720 : 1280,
        aspect === "9:16" ? 1280 : 720,
        resolution === "original" ? "720p" : resolution,
      );
      for (const [i, blob] of blobs.entries()) {
        options.signal?.throwIfAborted();
        options.onProgress?.({
          text: `Preparando clip ${i + 1} de ${blobs.length}…`,
          fraction: i / (blobs.length + 1),
        });
        const input = `in-${i}.mp4`,
          output = `clip-${i}.mp4`,
          probe = `probe-${i}.json`;
        files.push(input, output, probe);
        await ffmpeg.writeFile(input, await fetchFile(blob));
        // Core 0.12.10 may leave its shared return-code slot at -1 after a successful
        // ffprobe call. Validate the actual probe artifact instead of that slot.
        await ffmpeg.ffprobe([
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          input,
          "-o",
          probe,
        ]);
        const info = JSON.parse(
          (await ffmpeg.readFile(probe, "utf8")) as string,
        ) as { streams: { codec_type: string; duration?: string }[] };
        if (
          !Array.isArray(info.streams) ||
          !info.streams.some((stream) => stream.codec_type === "video")
        )
          throw new Error(
            "No se pudo leer el vídeo de una escena. Descarga los clips por separado.",
          );
        const hasAudio = info.streams.some(
          (stream) => stream.codec_type === "audio",
        );
        const segment = options.segments?.[i];
        const narration = segment?.narration;
        if (narration) {
          if (!Number.isFinite(narration.start) || narration.start < 0)
            throw new Error("El inicio de la narración no es válido.");
          const audio = `voice-${i}.mp3`;
          files.push(audio);
          await ffmpeg.writeFile(audio, await fetchFile(narration.blob));
        }
        const code = await ffmpeg.exec([
          ...(segment
            ? [
                "-ss",
                String(
                  narration
                    ? Math.min(
                        segment.start,
                        Math.max(
                          0,
                          Number(
                            info.streams.find((s) => s.codec_type === "video")
                              ?.duration || segment.end,
                          ) -
                            1 / 24,
                        ),
                      )
                    : segment.start,
                ),
              ]
            : []),
          "-i",
          input,
          ...(narration
            ? ["-ss", String(narration.start), "-i", `voice-${i}.mp3`]
            : !hasAudio
              ? [
                  "-f",
                  "lavfi",
                  "-i",
                  "anullsrc=channel_layout=stereo:sample_rate=48000",
                ]
              : []),
          "-map",
          "0:v:0",
          "-map",
          narration || !hasAudio ? "1:a:0" : "0:a:0",
          "-vf",
          `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24${narration && segment ? `,tpad=stop_mode=clone:stop_duration=${segment.end - segment.start}` : ""}`,
          ...(segment
            ? [
                "-t",
                String(segment.end - segment.start),
                "-af",
                `volume=${segment.volume},apad`,
              ]
            : []),
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-shortest",
          output,
        ]);
        if (code !== 0)
          throw new Error(
            "No se pudo preparar un clip para exportación. Descarga las tomas por separado.",
          );
      }
      options.onProgress?.({
        text: "Uniendo los clips…",
        fraction: blobs.length / (blobs.length + 1),
      });
      files.push("sequence.txt", "final.mp4");
      await ffmpeg.writeFile(
        "sequence.txt",
        blobs.map((_, i) => `file 'clip-${i}.mp4'`).join("\n"),
      );
      const code = await ffmpeg.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "sequence.txt",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "final.mp4",
      ]);
      if (code !== 0)
        throw new Error(
          "No se pudieron unir las escenas. Descarga los clips por separado.",
        );
      const data = (await ffmpeg.readFile("final.mp4")) as Uint8Array;
      return new Blob([new Uint8Array(data)], { type: "video/mp4" });
    } finally {
      if (ffmpeg.loaded)
        for (const file of files)
          await ffmpeg.deleteFile(file).catch(() => undefined);
    }
  });
}

async function probeVideo(ffmpeg: FFmpeg, input: string, output: string) {
  await ffmpeg.ffprobe([
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    input,
    "-o",
    output,
  ]);
  const info = JSON.parse(
    (await ffmpeg.readFile(output, "utf8")) as string,
  ) as {
    streams?: {
      codec_type: string;
      width: number;
      height: number;
      sample_aspect_ratio?: string;
      side_data_list?: { rotation?: number }[];
    }[];
    format?: { duration?: string };
  };
  const video = info.streams?.find((stream) => stream.codec_type === "video");
  if (!video)
    throw new Error(
      "No se pudo leer el vídeo. Prueba a descargar el original.",
    );
  const [sarWidth, sarHeight] = (video.sample_aspect_ratio || "1:1")
    .split(":")
    .map(Number);
  let width =
      video.width * (sarWidth > 0 && sarHeight > 0 ? sarWidth / sarHeight : 1),
    height = video.height;
  const rotation =
    video.side_data_list?.find((data) => data.rotation !== undefined)
      ?.rotation || 0;
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  return { width, height, duration: Number(info.format?.duration || 0) };
}
export async function resizeVideo(
  blob: Blob,
  resolution: DownloadResolution,
  options: VideoProcessingOptions = {},
): Promise<Blob> {
  options.signal?.throwIfAborted();
  if (resolution === "original") return blob;
  if (blob.size > 512 * 1024 * 1024)
    throw new Error(
      "Este vídeo es demasiado grande para escalarlo en el navegador. Descarga el original y procésalo en tu editor local.",
    );
  return withVideoEngine(options, async (ffmpeg) => {
    const files = [
      "resize-input.mp4",
      "resize-probe.json",
      "resize-output.mp4",
    ];
    let onProgress: ((event: { time: number }) => void) | undefined;
    try {
      options.onProgress?.({ text: "Leyendo el vídeo…" });
      await ffmpeg.writeFile(files[0], await fetchFile(blob));
      const source = await probeVideo(ffmpeg, files[0], files[1]);
      const target = outputDimensions(source.width, source.height, resolution);
      if (target.width === source.width && target.height === source.height)
        return blob;
      if (target.width * target.height > 3840 * 2160)
        throw new Error(
          "Este formato supera el tamaño admitido. Elige una resolución menor o descarga el original.",
        );
      const text = `Preparando ${target.width} × ${target.height}…`;
      options.onProgress?.({ text, fraction: 0 });
      let last = 0;
      onProgress = ({ time }) => {
        if (source.duration > 0)
          last = Math.max(
            last,
            Math.min(0.99, time / 1_000_000 / source.duration),
          );
        options.onProgress?.({
          text,
          fraction: source.duration > 0 ? last : undefined,
        });
      };
      ffmpeg.on("progress", onProgress);
      const code = await ffmpeg.exec([
        "-i",
        files[0],
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        `scale=${target.width}:${target.height}:flags=lanczos,setsar=1`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        files[2],
      ]);
      if (code !== 0)
        throw new Error(
          "No se pudo preparar esta resolución. Prueba 1080p o descarga el original.",
        );
      options.signal?.throwIfAborted();
      const result = (await ffmpeg.readFile(files[2])) as Uint8Array;
      return new Blob([new Uint8Array(result)], { type: "video/mp4" });
    } finally {
      if (onProgress) ffmpeg.off("progress", onProgress);
      if (ffmpeg.loaded)
        for (const file of files)
          await ffmpeg.deleteFile(file).catch(() => undefined);
    }
  });
}
