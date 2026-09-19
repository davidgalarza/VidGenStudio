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
