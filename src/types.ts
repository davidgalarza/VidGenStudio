export const OMNI_MODEL = "gemini-omni-1.1-flash";
export const VEO_MODEL = "veo-3.1-generate-preview";
export type Model = typeof OMNI_MODEL | typeof VEO_MODEL;
export type AspectRatio = "9:16" | "16:9";
export type Resolution = "360p" | "720p" | "1080p" | "4k";
export type GenerationMode = "generate" | "edit" | "extend";
export interface VideoSettings {
  model: Model;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  duration: number;
}
export const DEFAULT_VIDEO: VideoSettings = {
  model: OMNI_MODEL,
  aspectRatio: "9:16",
  resolution: "720p",
  duration: 8,
};
export interface SequenceItem {
  id: string;
  scene_id: string;
  version_id?: string;
  follow_active?: boolean;
  in: number;
  out?: number;
  volume: number;
}
export interface Project {
  id: string;
  /** Missing on older projects; inferred without moving or deleting media. */
  kind?: ProjectKind;
  name: string;
  created_at: string;
  updated_at?: string;
  sequence_ids?: string[];
  sequence_items?: SequenceItem[];
  sequence_aspect?: AspectRatio;
  story?: Story;
}
export type ProjectKind = "clips" | "story";
export function projectKind(
  project: Pick<Project, "kind" | "story">,
): ProjectKind {
  return project.kind || (project.story ? "story" : "clips");
}
export type StoryMode = "spoken" | "voiceover";
export type StoryStyle =
  | "realistic"
  | "cinematic"
  | "cartoon"
  | "3d"
  | "explainer"
  | "infographic"
  | "anime"
  | "stopmotion"
  | "watercolor"
  | "papercut"
  | "pixel"
  | "comic"
  | "broll"
  | "nature"
  | "macro"
  | "slides"
  | "whiteboard"
  | "motiongraphics"
  | "isometric"
  | "blueprint"
  | "cutaway"
  | "overlays"
  | "collage"
  | "timeline"
  | "documentary"
  | "studio"
  | "noir"
  | "retro"
  | "cel"
  | "clay"
  | "puppet"
  | "storybook"
  | "rotoscope"
  | "lowpoly";
export interface StyleParameters {
  pace: "calm" | "balanced" | "dynamic";
  camera: "locked" | "gentle" | "tracking" | "handheld";
  lighting: "natural" | "soft" | "dramatic" | "flat";
  palette: "original" | "warm" | "cool" | "pastel" | "vivid" | "mono";
  detail: "minimal" | "balanced" | "rich";
  explanation: "none" | "visual" | "diagrams" | "overlays";
  acting: "natural" | "subtle" | "expressive" | "theatrical";
}
/** Self-contained art direction; library changes never rewrite existing projects. */
export interface StoryStyleProfile {
  presetId?: string;
  name: string;
  base: StoryStyle;
  mode: StoryMode;
  parameters: StyleParameters;
  instructions: string;
  analysis?: string;
}
export interface StyleMedia {
  id: string;
  name: string;
  blob: Blob;
}
export interface SavedStoryStyle {
  id: string;
  profile: StoryStyleProfile;
  media: StyleMedia[];
  updatedAt: string;
}
export type StoryShotMode = "auto" | "shared" | "alternating";
export interface DialogueTurn {
  id: string;
  speaker: string;
  text: string;
  direction?: string;
  action?: string;
}
export interface StoryCharacter {
  name: string;
  description: string;
  voice: string;
  referenceId?: string;
}
export interface StoryReference {
  id: string;
  name: string;
  type: Asset["type"];
  prompt: string;
  characterName?: string;
  locationName?: string;
  assetId?: string;
}
export interface StoryConfig {
  script: string;
  mode: StoryMode;
  style: StoryStyle;
  styleProfile?: StoryStyleProfile;
  direction: string;
  characters: StoryCharacter[];
  voiceId: string;
  voiceName: string;
  settings: VideoSettings;
  voiceDirection?: string;
  references?: StoryReference[];
}
export interface StoryBlock {
  id: string;
  text: string;
  speaker?: string;
  sceneIds?: string[];
  title?: string;
  visual?: string;
  referenceIds?: string[];
  referenceNames?: string[];
  locationName?: string;
  participants?: string[];
  shotMode?: StoryShotMode;
  dialogue?: DialogueTurn[];
  /** Structured dialogue is only valid for this exact editable source. */
  dialogueSource?: string;
}
export interface Story extends StoryConfig {
  id: string;
  blocks: StoryBlock[];
  error?: string;
  phase?: "planning" | "review" | "production" | "ready";
  revision?: number;
  autoReferences?: boolean;
  planning?: {
    units: string[];
    cursor: number;
    mode?: StoryMode;
    style?: StoryStyle;
  };
}
export interface SpeechAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}
export interface Narration {
  id: string;
  project_id: string;
  story_id: string;
  block_id: string;
  blob: Blob;
  alignment?: SpeechAlignment;
  duration?: number;
  requestId?: string;
  provider?: "gemini";
  direction?: string;
  text?: string;
  voice?: string;
  cuts?: number[];
}
export interface StoryScene {
  storyId: string;
  blockId: string;
  text: string;
  speaker?: string;
  dialogue?: DialogueTurn[];
  locationName?: string;
  participants?: string[];
  shotMode?: StoryShotMode;
  /** Last automatic selection; a different actual selection is an explicit override. */
  autoReferenceIds?: string[];
  visual: string;
  planned: boolean;
  audioId?: string;
  audioStart?: number;
  audioEnd?: number;
  part?: { index: number; total: number };
}
export function sequenceScenes(project: Project, scenes: Scene[]): Scene[] {
  const own = scenes.filter((s) => s.project_id === project.id);
  // Projects created before optional sequences retain their original montage.
  return project.sequence_ids === undefined
    ? own.slice().sort((a, b) => a.order - b.order)
    : project.sequence_ids.flatMap((id) => own.find((s) => s.id === id) || []);
}
export interface Asset {
  id: string;
  type: "CHARACTER" | "PRODUCT" | "STYLE";
  data_url: string;
  file_name: string;
  is_global: boolean;
  project_ids: string[];
  created_at: string;
}
export interface ClipVersion {
  id: string;
  blob: Blob;
  prompt: string;
  settings: VideoSettings;
  mode: GenerationMode;
  interactionId?: string;
  duration: number;
  created_at: string;
}
export interface GenerationTask {
  remoteId?: string;
  prompt: string;
  settings: VideoSettings;
  mode: GenerationMode;
  previousInteractionId?: string;
  previousDuration?: number;
  started_at: string;
}
export interface QueuedGeneration {
  id: string;
  sceneId: string;
  task: GenerationTask;
  images: {
    mimeType: string;
    data: string;
    role: "first" | "last" | "reference";
  }[];
  index: number;
  total: number;
  created_at: string;
  resume?: boolean;
  batchId?: string;
  queueOrder?: number;
}
export interface Scene {
  id: string;
  project_id: string;
  order: number;
  title?: string;
  story?: StoryScene;
  review?: "favorite" | "discarded";
  generation_batch?: string;
  prompt: string;
  edit_prompt?: string;
  extend_prompt?: string;
  deleted_at?: string;
  deleted_sequence_index?: number;
  deleted_sequence_items?: { index: number; item: SequenceItem }[];
  status: "pending" | "processing" | "completed" | "failed" | "paused";
  settings?: VideoSettings;
  first_frame_asset_id?: string;
  last_frame_asset_id?: string;
  reference_asset_ids?: string[];
  versions?: ClipVersion[];
  active_version_id?: string;
  task?: GenerationTask;
  generation_queue?: QueuedGeneration[];
  output_request?: Pick<QueuedGeneration, "task" | "images">;
  origin?: {
    sceneId: string;
    versionId?: string;
    title: string;
    mode: GenerationMode;
  };
  error?: string;
  video_blob?: Blob;
  created_at: string;
  updated_at: string;
}
export function activeVersion(scene: Scene): ClipVersion | undefined {
  return (
    scene.versions?.find((v) => v.id === scene.active_version_id) ??
    scene.versions?.at(-1)
  );
}
export function sceneBlob(scene: Scene): Blob | undefined {
  return activeVersion(scene)?.blob ?? scene.video_blob;
}
export function sceneSettings(scene: Scene): VideoSettings {
  return { ...DEFAULT_VIDEO, ...scene.settings };
}
