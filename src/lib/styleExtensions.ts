import type { StoryMode, StoryStyle, StyleParameters } from "../types";
export interface StyleExtension {
  id: StoryStyle;
  label: string;
  mode: StoryMode;
  category: "Realismo" | "Animación" | "Explicación";
  description: string;
  use: string;
  prompt: string;
  defaults: Partial<StyleParameters>;
  tags: string;
}
export const styleExtensions: StyleExtension[] = [
  {
    id: "maps",
    label: "Mapas y recorridos",
    mode: "voiceover",
    category: "Explicación",
    description: "Rutas, lugares y relaciones espaciales",
    use: "Para explicar un recorrido, ubicar lugares o conectar territorios.",
    prompt:
      "Animated cartographic storytelling: coherent top-down geography, restrained route traces and landmark reveals timed to narration. Preserve spatial relationships. Only show locations supplied by the script; do not invent borders, labels or geographic facts.",
    defaults: { camera: "locked", detail: "minimal", explanation: "diagrams" },
    tags: "mapa geografia viaje ruta territorio",
  },
  {
    id: "dataviz",
    label: "Datos en movimiento",
    mode: "voiceover",
    category: "Explicación",
    description: "Comparaciones visuales, claras y progresivas",
    use: "Para comparar cantidades, mostrar tendencias o explicar relaciones. Usa datos explícitos en el guion.",
    prompt:
      "Editorial data visualization with progressive charts and coherent visual encodings. Use only quantities explicitly present in the script; otherwise show qualitative comparisons without invented numbers, scales or statistics. One relationship per composition, precise visual hierarchy.",
    defaults: { detail: "minimal", camera: "locked", explanation: "diagrams" },
    tags: "datos estadisticas graficos barras comparacion tendencias",
  },
  {
    id: "topdown",
    label: "Demostración cenital",
    mode: "voiceover",
    category: "Realismo",
    description: "Manos y objetos vistos desde arriba",
    use: "Para explicar tareas, materiales y procesos sobre una mesa, paso a paso.",
    prompt:
      "Photoreal overhead tabletop demonstration. Locked top-down camera, hands and necessary objects clearly arranged, clean uncluttered work surface. Perform the steps of the narrated explanation in order without unnecessary props or a presenter speaking.",
    defaults: { camera: "locked", lighting: "soft", explanation: "visual" },
    tags: "tutorial manos mesa receta proceso cenital",
  },
  {
    id: "productviz",
    label: "Producto en 3D",
    mode: "voiceover",
    category: "Animación",
    description: "Materiales, volumen y detalles de producto",
    use: "Para presentar un objeto, mostrar sus acabados y destacar sus partes.",
    prompt:
      "Premium studio 3D product visualization. Physically coherent materials, precise silhouettes, controlled reflections and intentional reveal of functional details. Keep the same object proportions across shots. Do not invent specifications, branding or capabilities.",
    defaults: {
      lighting: "soft",
      camera: "gentle",
      detail: "rich",
      explanation: "visual",
    },
    tags: "producto render 3d objeto materiales estudio",
  },
  {
    id: "interface",
    label: "Interfaces ilustradas",
    mode: "voiceover",
    category: "Explicación",
    description: "Procesos digitales convertidos en imágenes",
    use: "Para explicar conceptos de software con interfaces simplificadas, sin depender de texto pequeño.",
    prompt:
      "Animated illustrative software-interface diagrams: simplified windows, deliberate cursor movement, meaningful state changes and generous spacing. Show conceptual workflows, not fake screenshots claiming to be a real application. Avoid tiny or invented text; communicate through clear shapes and motion.",
    defaults: { camera: "locked", detail: "minimal", explanation: "diagrams" },
    tags: "software interfaz app pantalla tutorial digital",
  },
  {
    id: "microscopic",
    label: "Mundo microscópico",
    mode: "voiceover",
    category: "Explicación",
    description: "Estructuras pequeñas que se pueden explorar",
    use: "Para acompañar explicaciones de células, materiales y estructuras invisibles a simple vista.",
    prompt:
      "Educational microscopic visualization with coherent three-dimensional structures, controlled cutaways and a readable focal process. Follow the script's scientific description. Do not invent anatomical relationships, mechanisms, scales or labels. Distinguish conceptual visualization from direct microscopy.",
    defaults: {
      lighting: "soft",
      camera: "gentle",
      detail: "rich",
      explanation: "visual",
    },
    tags: "ciencia celulas biologia microscopio material estructura",
  },
  {
    id: "space",
    label: "Cosmos",
    mode: "voiceover",
    category: "Realismo",
    description: "Planetas, luz y profundidad espacial",
    use: "Para astronomía, escalas grandes y recorridos por entornos espaciales.",
    prompt:
      "Cinematic astronomy visualization with coherent illumination, orbital geography and readable spatial scale. Restrained camera drift, rich planetary surfaces and deep space. Follow only script-supported astronomical facts; no fabricated telemetry, numbers or labels.",
    defaults: {
      pace: "calm",
      camera: "gentle",
      lighting: "dramatic",
      detail: "rich",
    },
    tags: "espacio astronomia planeta universo estrellas",
  },
  {
    id: "architecture",
    label: "Arquitectura y espacios",
    mode: "voiceover",
    category: "Realismo",
    description: "Luz, materiales y recorridos interiores",
    use: "Para mostrar un lugar, su distribución y cómo se relacionan sus espacios.",
    prompt:
      "Architectural visualization with believable materials, natural light, stable geometry and motivated spatial walkthroughs. Maintain consistent openings, proportions and furniture placement. Let the narration determine the relevant space; no invented project specifications.",
    defaults: {
      camera: "tracking",
      pace: "calm",
      lighting: "natural",
      detail: "rich",
    },
    tags: "arquitectura interior casa edificios inmobiliaria espacio recorrido",
  },
  {
    id: "timelapse",
    label: "Tiempo acelerado",
    mode: "voiceover",
    category: "Realismo",
    description: "Cambios y transformaciones en pocos segundos",
    use: "Para mostrar cómo algo crece, cambia o se transforma, manteniendo un encuadre estable.",
    prompt:
      "Photoreal time-lapse style transformation in a fixed coherent composition. Show the script's process evolving with stable object identity and spatial continuity. Compress visual time only, never the narration. Avoid unrelated morphing and implausible intermediate states.",
    defaults: { camera: "locked", pace: "dynamic", explanation: "visual" },
    tags: "timelapse crecimiento tiempo cambio transformacion",
  },
  {
    id: "silhouette",
    label: "Siluetas y capas",
    mode: "voiceover",
    category: "Animación",
    description: "Historias contadas con contornos y profundidad",
    use: "Para relatos, metáforas y atmósferas donde importan más los gestos que los detalles.",
    prompt:
      "Layered silhouette animation, crisp readable contours, atmospheric backlight and controlled parallax. Communicate the narrated action through clear poses and spatial relationships. Preserve identities through silhouettes and avoid decorative layers unrelated to the story.",
    defaults: { lighting: "dramatic", detail: "minimal", pace: "calm" },
    tags: "silueta sombras metafora parallax relato",
  },
  {
    id: "chalkboard",
    label: "Pizarra de tiza",
    mode: "voiceover",
    category: "Explicación",
    description: "Trazos claros sobre fondo oscuro",
    use: "Para explicaciones que se construyen con dibujos, relaciones y pasos visibles.",
    prompt:
      "Chalkboard explanatory animation on a deep green or charcoal surface. Deliberate legible chalk diagrams appear in explanation order, limited color accents emphasize relationships. Prioritize pictures and structure over text; never invent formulas or data.",
    defaults: {
      camera: "locked",
      palette: "mono",
      detail: "minimal",
      explanation: "diagrams",
    },
    tags: "pizarra tiza clase leccion dibujo oscuro",
  },
  {
    id: "origami",
    label: "Origami en movimiento",
    mode: "voiceover",
    category: "Animación",
    description: "Ideas que toman forma con papel plegado",
    use: "Para metáforas, transformaciones y explicaciones con una estética artesanal.",
    prompt:
      "Tactile origami animation: crisp folded paper forms, physically coherent folds, soft material shadows and purposeful transformations. Translate the narrated idea into a simple folded-paper visual while preserving continuity. No arbitrary folding unrelated to the explanation.",
    defaults: { camera: "locked", lighting: "soft", explanation: "visual" },
    tags: "origami papel pliegues artesanal transformacion",
  },
  {
    id: "sitcom",
    label: "Comedia de situación",
    mode: "spoken",
    category: "Realismo",
    description: "Conversaciones ágiles y reacciones claras",
    use: "Para intercambios cotidianos, humor y escenas de grupo con buena lectura de las reacciones.",
    prompt:
      "Bright naturalistic situation-comedy cinematography. Stable conversational geography, clear ensemble blocking and reaction shots motivated by speaker turns. Preserve the user's exact dialogue; never add jokes, laugh tracks, catchphrases or extra speech.",
    defaults: { lighting: "soft", camera: "locked", acting: "expressive" },
    tags: "comedia humor sitcom conversacion grupo",
  },
  {
    id: "stage",
    label: "Teatro filmado",
    mode: "spoken",
    category: "Realismo",
    description: "Gestos, presencia y espacio escénico",
    use: "Para monólogos y diálogos que necesitan una interpretación más corporal y una puesta en escena definida.",
    prompt:
      "Filmed theatrical performance with purposeful stage lighting, expressive blocking and legible faces. Maintain stage geography and let spoken turns motivate gestures. Preserve exact script; do not add narration, applause or theatrical dialogue not supplied by the user.",
    defaults: { camera: "locked", lighting: "dramatic", acting: "theatrical" },
    tags: "teatro escena escenario monologo interpretacion",
  },
  {
    id: "interview",
    label: "Conversación de entrevista",
    mode: "spoken",
    category: "Realismo",
    description: "Escucha, miradas y respuestas naturales",
    use: "Para conversaciones pausadas, preguntas y respuestas o un personaje hablando directamente a cámara.",
    prompt:
      "Editorial interview cinematography with composed medium shots and unobstructed speaking faces. Natural eye-lines, engaged silent listening and restrained motivated cuts. Do not invent an interviewer, questions, dialogue or documentary claims absent from the script.",
    defaults: {
      camera: "locked",
      lighting: "soft",
      acting: "subtle",
      pace: "calm",
    },
    tags: "entrevista preguntas respuestas podcast conversacion",
  },
  {
    id: "fantasy",
    label: "Fantasía pictórica",
    mode: "spoken",
    category: "Animación",
    description: "Personajes expresivos y atmósferas de cuento",
    use: "Para relatos con un acabado pictórico, luz envolvente y personajes con presencia cinematográfica.",
    prompt:
      "Painterly cinematic fantasy art direction, rich material texture, atmospheric depth and expressive original character designs. Adapt the script's existing world, costumes and action; do not invent magical powers, creatures or plot. Keep speaking faces and mouths clearly readable.",
    defaults: { lighting: "dramatic", detail: "rich", acting: "expressive" },
    tags: "fantasia cuento magico pintura aventura",
  },
  {
    id: "scifi",
    label: "Ciencia ficción cinematográfica",
    mode: "spoken",
    category: "Realismo",
    description: "Materiales precisos y luz de cine",
    use: "Para diálogos con una estética tecnológica y una puesta en escena cinematográfica.",
    prompt:
      "Grounded cinematic science-fiction visual treatment: precise materials, controlled practical light and coherent designed spaces. Respect the characters, setting and technology actually requested by the script. Avoid gratuitous neon, holographic text and invented plot or speech. Readable faces take priority.",
    defaults: {
      lighting: "dramatic",
      palette: "cool",
      detail: "rich",
      acting: "subtle",
    },
    tags: "ciencia ficcion sci fi futuro tecnologia cine",
  },
  {
    id: "rubberhose",
    label: "Cartoon elástico",
    mode: "spoken",
    category: "Animación",
    description: "Líneas redondas y gestos con energía",
    use: "Para personajes muy expresivos, humor visual y movimientos amplios.",
    prompt:
      "Original vintage-inspired rubber-hose 2D animation, rounded shapes, elastic limbs, bold silhouettes and expressive rhythmic poses. Keep character design stable, mouths readable and lip movement tied to exact spoken dialogue. No extra vocalizations or borrowed characters.",
    defaults: {
      lighting: "flat",
      acting: "theatrical",
      pace: "dynamic",
      detail: "minimal",
    },
    tags: "cartoon elastico retro vintage humor animacion",
  },
  {
    id: "pencil",
    label: "Lápiz de color",
    mode: "spoken",
    category: "Animación",
    description: "Trazo visible, papel y expresiones cálidas",
    use: "Para conversaciones cercanas con el carácter de una ilustración hecha a mano.",
    prompt:
      "Colored-pencil character animation with visible intentional strokes, textured paper and warm expressive drawings. Keep contours stable and avoid flicker obscuring faces. Clear mouth articulation and natural gestures carry the unchanged spoken script.",
    defaults: { lighting: "soft", palette: "warm", acting: "expressive" },
    tags: "lapiz color dibujo boceto ilustracion papel",
  },
  {
    id: "inkwash",
    label: "Tinta y aguadas",
    mode: "spoken",
    category: "Animación",
    description: "Pinceladas expresivas y espacio en blanco",
    use: "Para diálogos contemplativos y una imagen elegante que concentra la atención en el personaje.",
    prompt:
      "Expressive ink-and-wash character animation, deliberate brush contours, translucent tonal washes and generous negative space. Keep eyes and mouths distinct, identities stable and acting readable. Do not dissolve speaking faces into abstract marks.",
    defaults: {
      lighting: "flat",
      palette: "mono",
      acting: "subtle",
      pace: "calm",
    },
    tags: "tinta aguada sumi pincel blanco negro",
  },
  {
    id: "wooden",
    label: "Personajes de madera",
    mode: "spoken",
    category: "Animación",
    description: "Volumen tallado y textura artesanal",
    use: "Para conversaciones con personajes de juguete, materiales cálidos y gestos claros.",
    prompt:
      "Original carved-wood articulated character animation with visible wood grain, crafted miniature environments and expressive stylized faces. Keep joints, material identity and proportions consistent. Animate readable mouths for the user's exact dialogue; no puppet strings unless requested.",
    defaults: {
      camera: "locked",
      lighting: "soft",
      palette: "warm",
      acting: "expressive",
    },
    tags: "madera juguete tallado artesanal miniatura",
  },
  {
    id: "cel3d",
    label: "3D con acabado cel",
    mode: "spoken",
    category: "Animación",
    description: "Volumen 3D, sombras gráficas y contornos",
    use: "Para combinar movimiento tridimensional con un acabado cercano al dibujo animado.",
    prompt:
      "Cel-shaded 3D character animation: consistent volumes, controlled graphic shadow bands, clean contours and designed silhouettes. Original characters, expressive facial rigs and precise readable dialogue animation. Stable shading avoids distracting flicker.",
    defaults: { lighting: "flat", acting: "expressive", detail: "balanced" },
    tags: "3d cel shading anime contornos animacion",
  },
  {
    id: "lineless",
    label: "Animación sin contornos",
    mode: "spoken",
    category: "Animación",
    description: "Formas limpias y personajes muy legibles",
    use: "Para diálogos sencillos, personajes amables y escenas con pocos elementos.",
    prompt:
      "Lineless 2D character animation with clean color shapes, purposeful silhouettes and simple coherent backgrounds. Separate forms through color and shape rather than outlines. Keep expressive eyes and clearly articulated mouths, preserving every spoken word.",
    defaults: {
      lighting: "flat",
      detail: "minimal",
      acting: "expressive",
      palette: "pastel",
    },
    tags: "vectorial 2d plano minimalista sin contornos",
  },
  {
    id: "oilpaint",
    label: "Óleo animado",
    mode: "spoken",
    category: "Animación",
    description: "Materia pictórica, luz y rostros expresivos",
    use: "Para relatos emotivos y conversaciones con un acabado de pintura al óleo.",
    prompt:
      "Animated oil-painting character portraiture with tangible brushwork, rich pigment and coherent cinematic light. Maintain facial anatomy, speaking mouth clarity and stable identity beneath the paint. Painterly motion supports rather than obscures dialogue and silent reactions.",
    defaults: {
      lighting: "dramatic",
      detail: "rich",
      acting: "subtle",
      pace: "calm",
    },
    tags: "oleo pintura pincel pigmento retrato",
  },
];
