/** Recognize content rejections, not authentication, quota or file failures. */
export function isContentBlock(message = ""): boolean {
  return /prohibited[_\s-]+content|content[_\s-]+policy|content guidelines|safety[_\s-]+(?:blocked|filters?|guidelines)|blocked.{0,60}(?:safety|content)|(?:violate|violat(?:es|ion)).{0,50}(?:polic|guideline)|contenido.{0,30}(?:prohibido|seguridad)|bloqueo de contenido|normas de contenido/i.test(
    message,
  );
}

export const contentBlockMessage =
  "Google bloqueó esta generación por sus normas de contenido. Puedes revisar la descripción y las referencias antes de volver a generar.";
