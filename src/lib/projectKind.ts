import { projectKind, type Project, type ProjectKind } from "../types";

/** Old script drafts live in sessionStorage, before a Story is persisted. */
export function resolveProjectKind(
  project: Project,
  legacyDraft?: string | null,
): ProjectKind {
  if (project.kind || project.story) return projectKind(project);
  try {
    const draft = JSON.parse(legacyDraft || "null");
    if (typeof draft?.script === "string" && draft.script.trim())
      return "story";
  } catch {
    /* A damaged draft must not prevent opening a clip project. */
  }
  return "clips";
}

export function withProjectKind(project: Project): Project {
  let draft: string | null = null;
  if (!project.kind && !project.story) {
    try {
      draft = sessionStorage.getItem(`vidgen-story-draft-${project.id}`);
    } catch {
      /* Optional legacy draft. */
    }
  }
  return { ...project, kind: resolveProjectKind(project, draft) };
}
