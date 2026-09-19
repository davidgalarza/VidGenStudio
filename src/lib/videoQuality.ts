export type DownloadResolution = "original" | "720p" | "1080p" | "4k";
export const downloadResolutions: {
  value: DownloadResolution;
  label: string;
}[] = [
  { value: "original", label: "Original · sin recomprimir" },
  { value: "720p", label: "720p · HD" },
  { value: "1080p", label: "1080p · Full HD" },
  { value: "4k", label: "4K · Ultra HD" },
];
export function outputDimensions(
  width: number,
  height: number,
  resolution: DownloadResolution,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("No se pudieron leer las dimensiones del vídeo.");
  if (resolution === "original") return { width, height };
  const short =
    resolution === "4k" ? 2160 : resolution === "1080p" ? 1080 : 720;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return width >= height
    ? { width: even((short * width) / height), height: short }
    : { width: short, height: even((short * height) / width) };
}
export function qualityFilename(name: string, resolution: DownloadResolution) {
  return resolution === "original"
    ? name
    : `${name.replace(/\.mp4$/i, "")}-${resolution}.mp4`;
}
export interface VideoSegment {
  start: number;
  end: number;
  volume: number;
  narration?: { blob: Blob; start: number };
}
export interface VideoProcessingOptions {
  segments?: VideoSegment[];
  signal?: AbortSignal;
  onProgress?: (progress: { text: string; fraction?: number }) => void;
}
