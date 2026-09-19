import { DEFAULT_VIDEO, type VideoSettings } from "../types";
const KEY = "vid_gen_api_key";
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

const ELEVEN_KEY = "vidgen_elevenlabs_key";
export function getElevenLabsKey(): string {
  try {
    return localStorage.getItem(ELEVEN_KEY) || "";
  } catch {
    return "";
  }
}
export function setElevenLabsKey(key: string): void {
  if (key.trim()) localStorage.setItem(ELEVEN_KEY, key.trim());
  else localStorage.removeItem(ELEVEN_KEY);
}
