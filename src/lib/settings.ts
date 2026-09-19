import { DEFAULT_VIDEO, type VideoSettings } from "../types";
const KEY = "vid_gen_api_key";
const PARALLELISM_KEY = "vidgen_parallelism";
export const DEFAULT_PARALLELISM = 3;
export function getParallelism(): number {
  try {
    const value = Number(localStorage.getItem(PARALLELISM_KEY));
    return Number.isInteger(value) && value >= 1 && value <= 4
      ? value
      : DEFAULT_PARALLELISM;
  } catch {
    return DEFAULT_PARALLELISM;
  }
}
export function saveParallelism(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 4)
    throw new Error("Elige entre 1 y 4 vídeos simultáneos.");
  localStorage.setItem(PARALLELISM_KEY, String(value));
}
export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
export function setApiKey(key: string): void {
  if (key.trim()) localStorage.setItem(KEY, key.trim());
  else localStorage.removeItem(KEY);
}
export function getDefaults(): VideoSettings {
  try {
    return {
      ...DEFAULT_VIDEO,
      ...JSON.parse(localStorage.getItem("vidgen_defaults") || "{}"),
    };
  } catch {
    return { ...DEFAULT_VIDEO };
  }
}
export function saveDefaults(settings: VideoSettings): void {
  localStorage.setItem("vidgen_defaults", JSON.stringify(settings));
}
