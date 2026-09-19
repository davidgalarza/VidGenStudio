import {
  activeVersion,
  sceneBlob,
  sceneSettings,
  sequenceScenes,
  type Project,
  type Scene,
  type SequenceItem,
  type Narration,
} from "../types";
export const FRAME = 1 / 24;
export function makeSequenceItem(
  scene: Scene,
  id: string = crypto.randomUUID(),
): SequenceItem {
  return {
    id,
    scene_id: scene.id,
    version_id: activeVersion(scene)?.id,
    follow_active: !!scene.story,
    in: 0,
    volume: 1,
  };
}
export function projectSequence(project: Project, scenes: Scene[]) {
  return (
    project.sequence_items ||
    sequenceScenes(project, scenes).map((scene) =>
      makeSequenceItem(scene, `legacy-${scene.id}`),
    )
  );
}
export function sequenceSource(item: SequenceItem, scenes: Scene[]) {
  const scene = scenes.find((s) => s.id === item.scene_id && !s.deleted_at);
  const version =
    item.follow_active && scene
      ? activeVersion(scene)
      : item.version_id
        ? scene?.versions?.find((v) => v.id === item.version_id)
        : undefined;
  return {
    scene,
    version_id: item.follow_active ? version?.id : item.version_id,
    blob:
      item.version_id || item.follow_active
        ? version?.blob
        : scene
          ? scene.video_blob || sceneBlob(scene)
          : undefined,
    duration: version?.duration || (scene ? sceneSettings(scene).duration : 8),
  };
}
export const sourceKey = (item: SequenceItem) =>
  `${item.scene_id}:${item.version_id || "legacy"}`;
export function resolveTimeline(
  items: SequenceItem[],
  scenes: Scene[],
  durations: Record<string, number> = {},
  narrations: Narration[] = [],
) {
  let cursor = 0;
  return items.map((item) => {
    const source = sequenceSource(item, scenes);
    const audio = narrations.find((n) => n.id === source.scene?.story?.audioId);
    const story = source.scene?.story;
    const narrationLength =
      audio && story ? (story.audioEnd || 0) - (story.audioStart || 0) : 0;
    const videoDuration = Math.max(
      FRAME,
      durations[sourceKey({ ...item, version_id: source.version_id })] ||
        source.duration,
    );
    const duration = narrationLength || videoDuration;
    const start = Math.max(0, Math.min(item.in, duration - FRAME));
    const end = Math.max(
      start + FRAME,
      Math.min(item.out ?? duration, duration),
    );
    const result = {
      ...item,
      ...source,
      in: start,
      out: end,
      sourceDuration: duration,
      videoDuration,
      narration: audio
        ? { blob: audio.blob, offset: story?.audioStart || 0 }
        : undefined,
      start: cursor,
      length: end - start,
    };
    cursor += result.length;
    return result;
  });
}
export type TimelineClip = ReturnType<typeof resolveTimeline>[number];
export function clipAtTime(clips: TimelineClip[], time: number) {
  return (
    clips.find((clip) => time < clip.start + clip.length - 0.00001) ||
    clips.at(-1)
  );
}
export function splitSequence(
  items: SequenceItem[],
  clip: TimelineClip,
  time: number,
  newId: string = crypto.randomUUID(),
) {
  const cut = clip.in + time - clip.start;
  if (cut < clip.in + FRAME || cut > clip.out - FRAME) return items;
  return items.flatMap((item) =>
    item.id === clip.id
      ? [
          { ...item, in: clip.in, out: cut },
          { ...item, id: newId, in: cut, out: clip.out },
        ]
      : [item],
  );
}
export function timecode(seconds: number) {
  const frames = Math.max(0, Math.round(seconds * 24));
  return `${String(Math.floor(frames / 1440)).padStart(2, "0")}:${String(Math.floor(frames / 24) % 60).padStart(2, "0")}:${String(frames % 24).padStart(2, "0")}`;
}
