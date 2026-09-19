import type { StoryBlock, StoryReference } from "../types";

const clean = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/gu, " ");
const key = (name: string) => clean(name).toLocaleLowerCase();
const accentKey = (name: string) =>
  key(name).normalize("NFD").replace(/\p{M}/gu, "");

// Match only unambiguous names, never semantic guesses such as two different rooms.
function named<T>(items: T[], name: string, label: (item: T) => string) {
  const exact = items.filter((item) => key(label(item)) === key(name));
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const unaccented = items.filter(
    (item) => accentKey(label(item)) === accentKey(name),
  );
  return unaccented.length === 1 ? unaccented[0] : undefined;
}
const isSet = (ref: StoryReference) =>
  ref.type === "PRODUCT" && !ref.characterName;

/** Reconcile a complete, validated batch locally; callers' saved data stays untouched. */
export function reconcileStoryLocations(
  saved: StoryReference[],
  proposed: Omit<StoryReference, "id">[],
  blocks: StoryBlock[],
) {
  const references = saved.map((ref) => ({ ...ref }));
  const aliases: { name: string; id: string }[] = [];
  function alias(name: string, id: string) {
    if (!aliases.some((item) => key(item.name) === key(name) && item.id === id))
      aliases.push({ name, id });
  }
  function uniqueName(name: string) {
    const base = clean(name);
    let candidate = base,
      suffix = 2;
    while (references.some((ref) => key(ref.name) === key(candidate)))
      candidate = `${base} · ${suffix++}`;
    return candidate;
  }
  for (const input of proposed) {
    const candidate: StoryReference = {
      id: crypto.randomUUID(),
      name: clean(input.name),
      type: input.type,
      prompt: input.prompt,
      characterName: input.characterName?.trim() || undefined,
      locationName: input.locationName
        ? clean(input.locationName) || undefined
        : undefined,
    };
    const existing =
      (isSet(candidate) && candidate.locationName
        ? named(
            references.filter((ref) => isSet(ref) && !!ref.locationName),
            candidate.locationName,
            (ref) => ref.locationName!,
          )
        : undefined) ||
      named(
        references.filter(
          (ref) =>
            ref.type === candidate.type &&
            (!candidate.locationName ||
              !ref.locationName ||
              key(ref.locationName) === key(candidate.locationName)),
        ),
        candidate.name,
        (ref) => ref.name,
      );
    if (existing) {
      // Preserve an existing image, ID and set description across planning batches.
      if (isSet(existing) && !existing.locationName && candidate.locationName)
        existing.locationName = candidate.locationName;
      alias(candidate.name, existing.id);
    } else {
      alias(candidate.name, candidate.id);
      candidate.name = uniqueName(candidate.name);
      references.push(candidate);
    }
  }
  const linkedBlocks = blocks.map((block) => {
    let location: StoryReference | undefined;
    if (block.locationName) {
      location = named(
        references.filter((ref) => isSet(ref) && !!ref.locationName),
        block.locationName,
        (ref) => ref.locationName!,
      );
      if (!location) {
        // Older/model responses sometimes provide the set name without its link field.
        location = named(
          references.filter((ref) => isSet(ref) && !ref.locationName),
          block.locationName,
          (ref) => ref.name,
        );
        if (location) location.locationName = clean(block.locationName);
      }
      if (!location) {
        location = {
          id: crypto.randomUUID(),
          name: uniqueName(block.locationName),
          locationName: clean(block.locationName),
          type: "PRODUCT",
          prompt: [
            `Referencia del escenario vacío «${clean(block.locationName)}». Una única vista amplia, reutilizable, sin personas, texto ni rótulos.`,
            "Extrae del contexto visual solo el espacio, la arquitectura, los materiales, el mobiliario y la luz. Mantén una distribución coherente. Omite personajes, acciones y diálogo; no inventes nuevos acontecimientos.",
            `Contexto visual de la escena: ${block.visual || block.locationName}`,
          ].join("\n"),
        };
        references.push(location);
      }
    }
    const referenceNames = block.referenceNames?.map((name) => {
      const alias = named(aliases, name, (item) => item.name);
      const ref =
        (location && named([location], name, (item) => item.locationName!)) ||
        (alias && references.find((item) => item.id === alias.id)) ||
        named(references, name, (item) => item.name);
      if (!ref)
        throw new Error(
          `Falta la referencia «${name}» de la escena «${block.title}». Tu guion se conserva.`,
        );
      return ref.name;
    });
    return {
      ...block,
      locationName: location?.locationName || block.locationName,
      referenceNames: referenceNames ? [...new Set(referenceNames)] : undefined,
    };
  });
  return { references, blocks: linkedBlocks };
}
