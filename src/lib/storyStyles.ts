import type {
  StoryConfig,
  StoryMode,
  StoryStyle,
  StoryStyleProfile,
  StyleParameters,
} from "../types";

import { styleExtensions } from "./styleExtensions";

export const storyStyles: { id: StoryStyle; label: string; prompt: string }[] =
  [
    {
      id: "realistic",
      label: "Realista",
      prompt:
        "Photorealistic, natural lighting, believable environments and movement.",
    },
    {
      id: "cinematic",
      label: "Cinematográfico",
      prompt:
        "Cinematic photography, deliberate composition, expressive lighting, consistent color grading.",
    },
    {
      id: "cartoon",
      label: "Animación 2D",
      prompt:
        "Hand-drawn 2D animation, expressive characters, clean silhouettes, consistent linework and color palette.",
    },
    {
      id: "3d",
      label: "Animación 3D",
      prompt:
        "Stylized 3D animation, appealing shapes, tactile materials, consistent character design.",
    },
    {
      id: "explainer",
      label: "Explicativo",
      prompt:
        "Didactic visual explanation. Demonstrate the actual concept with clear concrete examples, progressive reveals, cause and effect. One idea at a time. Avoid generic stock footage and decorative unrelated imagery.",
    },
    {
      id: "infographic",
      label: "Infografía animada",
      prompt:
        "Animated diagrams and visual metaphors, simple high-contrast shapes, legible hierarchy. Show relationships and processes progressively. Avoid dense text, invented statistics and illegible labels.",
    },
    {
      id: "anime",
      label: "Anime",
      prompt:
        "Japanese-inspired 2D animation, expressive facial acting, cinematic cel shading and painted backgrounds. Original character designs.",
    },
    {
      id: "stopmotion",
      label: "Stop motion",
      prompt:
        "Handcrafted stop-motion clay animation, tactile miniatures, visible material textures and deliberate expressive movement.",
    },
    {
      id: "watercolor",
      label: "Acuarela",
      prompt:
        "Animated watercolor illustration, translucent pigment, textured paper and fluid, gentle movement. Keep faces and action readable.",
    },
    {
      id: "papercut",
      label: "Papel recortado",
      prompt:
        "Layered paper-cut animation, tactile cut edges, dimensional paper scenery, coherent silhouettes and parallax.",
    },
    {
      id: "pixel",
      label: "Pixel art",
      prompt:
        "Crisp intentional pixel art animation, limited coherent palette, readable pixel characters and scenery, no smoothing.",
    },
    {
      id: "comic",
      label: "Novela gráfica",
      prompt:
        "Animated graphic novel, expressive ink outlines, bold shadow shapes, intentional limited colors and dramatic composition. No speech bubbles or printed words.",
    },
  ];

const extra: [StoryStyle, string, string][] = [
  [
    "broll",
    "B-roll realista",
    "Photoreal supporting footage: purposeful environmental details, hands and objects illustrating narration. No presenter addressing camera. Motivate each shot from the narrated idea.",
  ],
  [
    "nature",
    "Naturaleza inmersiva",
    "Photoreal nature cinematography, living ecosystems, atmospheric landscapes and botanical details. Illustrate the actual narration without inventing scientific facts.",
  ],
  [
    "macro",
    "Macro y detalles",
    "Extreme photoreal close-ups with controlled depth of field, tactile surfaces and deliberate focus transitions. Make small mechanisms and material details readable.",
  ],
  [
    "slides",
    "Diapositivas visuales",
    "Animated editorial presentation: one large explanatory visual per composition, generous negative space, clear progressive builds. Use diagrammatic relationships, not dense text or bullet lists. No invented labels or statistics.",
  ],
  [
    "whiteboard",
    "Pizarra animada",
    "Whiteboard animation with crisp hand-drawn lines on a light surface. Build simple causal diagrams stroke by stroke in narration order. No decorative scribbles or illegible text.",
  ],
  [
    "motiongraphics",
    "Motion graphics",
    "Professional flat motion graphics with bold simple shapes, coherent graphic rhythm and meaningful transitions. Translate each spoken idea into a concrete visual relationship. No random shapes or invented written words.",
  ],
  [
    "isometric",
    "Mundos isométricos",
    "Precise isometric miniature worlds and systems. Maintain parallel projection, stable spatial layout and a clear focal action. Animate one explanatory process at a time.",
  ],
  [
    "blueprint",
    "Plano técnico",
    "Technical blueprint animation, fine precise linework, cyan on deep blue, stable orthographic views. Reveal mechanisms progressively; show conceptual relationships without fake measurements or labels.",
  ],
  [
    "cutaway",
    "Cortes y mecanismos 3D",
    "Didactic three-dimensional cutaways and exploded views. Keep components spatially coherent, reveal interior structure and illustrate only processes supported by the script. No fabricated technical labels.",
  ],
  [
    "overlays",
    "Realista + gráficos",
    "Photoreal footage with restrained explanatory graphics overlaid in perspective: arrows, outlines, highlights and paths attached to the relevant objects. Real environment remains legible. Graphics support precisely the narrated idea; avoid text unless essential.",
  ],
  [
    "collage",
    "Collage editorial",
    "Animated photographic cutouts, tactile papers and bold flat color fields. Compose a clear visual metaphor tied to the narration, with layered depth and controlled movement. No invented magazine headlines.",
  ],
  [
    "timeline",
    "Procesos paso a paso",
    "Visual sequences showing a process evolving through meaningful stages. Consistent objects and spatial orientation, progressive reveals, clear before-and-after relationships. Do not invent dates, numbers or stages absent from the script.",
  ],
  [
    "documentary",
    "Documental cercano",
    "Natural documentary character cinematography, available light, observational camera and authentic understated behavior. Maintain readable faces and believable conversational eye-lines.",
  ],
  [
    "studio",
    "Retrato de estudio",
    "Polished studio conversation with a simple intentional background, flattering soft key light and clean medium/close framing. Prioritize speech, microexpressions and unobstructed mouths.",
  ],
  [
    "noir",
    "Cine noir",
    "Black-and-white noir photography with sculpted chiaroscuro, meaningful shadows and restrained dramatic character blocking. Keep talking faces readable and avoid excessive darkness.",
  ],
  [
    "retro",
    "Película analógica",
    "Warm analog film aesthetic, gentle highlight rolloff, subtle grain, period-neutral original wardrobe and expressive natural dialogue. No artificial film borders or damage obscuring faces.",
  ],
  [
    "cel",
    "Animación cel clásica",
    "Traditional cel animation with clean ink contours, flat color fills, limited purposeful shading and hand-painted scenery. Original expressive characters with clear mouth animation and stable proportions.",
  ],
  [
    "clay",
    "Plastilina",
    "Tactile clay character animation, sculpted surfaces and carefully staged miniature environments. Expressive faces, distinct silhouettes, coherent materials and readable synchronized speech.",
  ],
  [
    "puppet",
    "Marionetas",
    "Handcrafted fabric and felt puppets in a physical miniature set. Visible textile texture, expressive articulated mouths and convincing gestures. Keep character proportions and materials consistent.",
  ],
  [
    "storybook",
    "Cuento ilustrado",
    "Animated storybook gouache illustration, layered painted scenery, warm tactile brushwork and appealing original character design. Dialogue-driven facial acting remains clear.",
  ],
  [
    "rotoscope",
    "Rotoscopia",
    "Rotoscope-style animation with realistic human motion beneath expressive painted linework and flattened colors. Stable facial identity, natural gestures and readable lip movements.",
  ],
  [
    "lowpoly",
    "Low poly",
    "Stylized low-poly 3D characters with deliberate geometric silhouettes and faceted environments. Keep faces expressive with visible mouth articulation and consistent polygonal design.",
  ],
];
storyStyles.push(
  ...extra.map(([id, label, prompt]) => ({ id, label, prompt })),
  ...styleExtensions.map(({ id, label, prompt }) => ({ id, label, prompt })),
);
const voiceoverOnly: StoryStyle[] = [
  "explainer",
  "infographic",
  ...extra.slice(0, 12).map((s) => s[0]),
  ...styleExtensions.filter((s) => s.mode === "voiceover").map((s) => s.id),
];
const spokenOnly = [
  ...extra.slice(12).map((s) => s[0]),
  ...styleExtensions.filter((s) => s.mode === "spoken").map((s) => s.id),
];
export const stylesForMode = (mode: StoryMode) =>
  storyStyles.filter(
    (s) => !(mode === "spoken" ? voiceoverOnly : spokenOnly).includes(s.id),
  );
export function styleCategory(
  id: StoryStyle,
): "Realismo" | "Animación" | "Explicación" {
  const extension = styleExtensions.find((s) => s.id === id);
  if (extension) return extension.category;
  if (
    [
      "realistic",
      "cinematic",
      "broll",
      "nature",
      "macro",
      "documentary",
      "studio",
      "noir",
      "retro",
    ].includes(id)
  )
    return "Realismo";
  if (
    voiceoverOnly.includes(id) &&
    !["broll", "nature", "macro", "collage"].includes(id)
  )
    return "Explicación";
  return "Animación";
}
const descriptions: Partial<Record<StoryStyle, string>> = {
  realistic: "Luz natural y texturas reales",
  cinematic: "Luz y encuadres de cine",
  cartoon: "Dibujo 2D expresivo",
  "3d": "Volumen y personajes estilizados",
  explainer: "Ideas que se entienden al verlas",
  infographic: "Diagramas y formas en movimiento",
  anime: "Líneas expresivas y fondos pintados",
  stopmotion: "Miniaturas con textura artesanal",
  watercolor: "Pigmentos y bordes suaves",
  papercut: "Capas de papel con profundidad",
  pixel: "Píxeles y movimiento retro",
  comic: "Tinta, contraste y tramas",
  broll: "Imágenes de apoyo, sin presentador",
  nature: "Paisajes y vida en primer plano",
  macro: "Lo pequeño ocupa la pantalla",
  slides: "Una idea por composición",
  whiteboard: "Dibujos que explican paso a paso",
  motiongraphics: "Formas y ritmo con intención",
  isometric: "Sistemas vistos con perspectiva",
  blueprint: "Líneas técnicas y estructuras",
  cutaway: "Muestra cómo funciona por dentro",
  overlays: "Flechas y destacados sobre vídeo",
  collage: "Fotografía, recortes y papel",
  timeline: "Del inicio al resultado, visualmente",
  documentary: "Actuación cotidiana, cámara cercana",
  studio: "La voz y el rostro al frente",
  noir: "Blanco y negro, luz y misterio",
  retro: "Textura de película y tonos cálidos",
  cel: "Contornos nítidos y fondos pintados",
  clay: "Personajes de plastilina con vida",
  puppet: "Tela, fieltro y gestos expresivos",
  storybook: "Pintura cálida que cobra vida",
  rotoscope: "Movimiento real, acabado ilustrado",
  lowpoly: "Geometría sencilla y expresiva",
};
export const styleDescription = (id: StoryStyle) =>
  styleExtensions.find((s) => s.id === id)?.description ||
  descriptions[id] ||
  "";
export const parameterOptions = {
  pace: {
    label: "Ritmo visual",
    options: { calm: "Pausado", balanced: "Equilibrado", dynamic: "Dinámico" },
    prompts: {
      calm: "Allow visual ideas to settle with slow deliberate movement.",
      balanced: "Balanced visual rhythm, each action has time to read.",
      dynamic:
        "Energetic purposeful visual rhythm without rushed speech or incoherent cuts.",
    },
  },
  camera: {
    label: "Movimiento de cámara",
    options: {
      locked: "Cámara fija",
      gentle: "Movimiento suave",
      tracking: "Sigue la acción",
      handheld: "Cámara en mano",
    },
    prompts: {
      locked: "Use locked camera and stable composition.",
      gentle: "Use subtle controlled camera movement.",
      tracking: "Use motivated tracking shots that follow the relevant action.",
      handheld:
        "Use subtle observational handheld camera, never distracting shake.",
    },
  },
  lighting: {
    label: "Iluminación",
    options: {
      natural: "Natural",
      soft: "Suave",
      dramatic: "Dramática",
      flat: "Uniforme / gráfica",
    },
    prompts: {
      natural: "Use believable natural lighting.",
      soft: "Soft diffuse flattering illumination.",
      dramatic: "Sculpted dramatic contrast while retaining readable subjects.",
      flat: "Even illumination and clear flat graphic color fields.",
    },
  },
  palette: {
    label: "Color",
    options: {
      original: "Propio del estilo",
      warm: "Cálido",
      cool: "Frío",
      pastel: "Pastel",
      vivid: "Vivo",
      mono: "Monocromo",
    },
    prompts: {
      original: "Keep the selected style's coherent palette.",
      warm: "Use a warm harmonious color palette.",
      cool: "Use a cool harmonious color palette.",
      pastel: "Use a soft pastel palette with readable contrast.",
      vivid: "Use vivid purposeful colors, preserve visual hierarchy.",
      mono: "Use a monochrome palette with rich tonal separation.",
    },
  },
  detail: {
    label: "Detalle visual",
    options: {
      minimal: "Esencial",
      balanced: "Equilibrado",
      rich: "Rico en detalles",
    },
    prompts: {
      minimal: "Reduce incidental detail; emphasize the essential subject.",
      balanced: "Balance subject detail with a clear uncluttered background.",
      rich: "Rich intentional material and environment detail without competing with the subject.",
    },
  },
  explanation: {
    label: "Cómo acompaña la explicación",
    options: {
      none: "Solo imágenes de apoyo",
      visual: "Demostraciones visuales",
      diagrams: "Diagramas progresivos",
      overlays: "Gráficos sobre la imagen",
    },
    prompts: {
      none: "Illustrate narration through supporting footage, without explanatory graphics or presenter.",
      visual:
        "Demonstrate the narrated concept concretely with visible cause and effect.",
      diagrams:
        "Build diagrams progressively in the same order as the narrated explanation; no invented labels or data.",
      overlays:
        "Add restrained explanatory arrows and highlights attached to relevant objects; no invented labels or data.",
    },
  },
  acting: {
    label: "Interpretación de los personajes",
    options: {
      natural: "Natural",
      subtle: "Contenida",
      expressive: "Expresiva",
      theatrical: "Teatral",
    },
    prompts: {
      natural: "Natural conversational acting and believable silent reactions.",
      subtle: "Understated microexpressions and restrained gestures.",
      expressive: "Expressive clear facial acting and purposeful gestures.",
      theatrical:
        "Broad theatrical acting, distinct poses, while preserving natural turn-taking and readable mouths.",
    },
  },
} as const;
export type StyleParameterKey = keyof StyleParameters;
export function defaultStyleParameters(
  base: StoryStyle,
  mode: StoryMode,
): StyleParameters {
  const graphic = styleCategory(base) === "Explicación";
  const result: StyleParameters = {
    pace: "balanced",
    camera: graphic ? "locked" : "gentle",
    lighting: graphic ? "flat" : "natural",
    palette: "original",
    detail: "balanced",
    explanation: graphic ? "diagrams" : "none",
    acting: "natural",
  };
  const overrides: Partial<Record<StoryStyle, Partial<StyleParameters>>> = {
    cinematic: { lighting: "dramatic" },
    cartoon: { lighting: "flat", acting: "expressive" },
    "3d": { lighting: "soft", acting: "expressive" },
    explainer: { explanation: "visual" },
    infographic: { detail: "minimal" },
    anime: { lighting: "dramatic", acting: "expressive" },
    stopmotion: { camera: "locked", lighting: "soft" },
    watercolor: { pace: "calm", lighting: "soft", palette: "pastel" },
    papercut: { camera: "locked", lighting: "soft" },
    pixel: { camera: "locked", lighting: "flat", detail: "minimal" },
    comic: { lighting: "dramatic" },
    broll: { pace: "calm" },
    nature: { pace: "calm", detail: "rich" },
    macro: { pace: "calm", detail: "rich", lighting: "soft" },
    slides: { pace: "calm", detail: "minimal" },
    whiteboard: { palette: "mono", detail: "minimal" },
    motiongraphics: { pace: "dynamic", palette: "vivid", detail: "minimal" },
    isometric: { explanation: "visual", lighting: "soft" },
    blueprint: { palette: "cool", detail: "rich" },
    cutaway: { explanation: "visual", lighting: "soft" },
    overlays: {
      explanation: "overlays",
      lighting: "natural",
      camera: "gentle",
    },
    collage: { lighting: "flat", camera: "locked" },
    timeline: { detail: "minimal" },
    documentary: { camera: "handheld", acting: "subtle" },
    studio: { camera: "locked", lighting: "soft" },
    noir: { palette: "mono", lighting: "dramatic", acting: "subtle" },
    retro: { palette: "warm", lighting: "soft" },
    cel: { lighting: "flat", acting: "expressive" },
    clay: { camera: "locked", lighting: "soft", acting: "expressive" },
    puppet: { camera: "locked", lighting: "soft", acting: "theatrical" },
    storybook: { palette: "warm", lighting: "soft", pace: "calm" },
    rotoscope: { lighting: "flat" },
    lowpoly: { lighting: "soft", detail: "minimal", acting: "expressive" },
  };
  Object.assign(
    result,
    overrides[base],
    styleExtensions.find((s) => s.id === base)?.defaults,
  );
  if (mode === "spoken") result.explanation = "none";
  return result;
}
export function createStyleProfile(
  base: StoryStyle,
  mode: StoryMode,
): StoryStyleProfile {
  return {
    name: storyStyles.find((s) => s.id === base)?.label || "Realista",
    base,
    mode,
    parameters: defaultStyleParameters(base, mode),
    instructions: "",
  };
}
export function validStyleProfile(value: unknown): value is StoryStyleProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as StoryStyleProfile;
  return (
    typeof p.name === "string" &&
    !!p.name.trim() &&
    p.name.length <= 100 &&
    storyStyles.some((s) => s.id === p.base) &&
    ["spoken", "voiceover"].includes(p.mode) &&
    typeof p.instructions === "string" &&
    p.instructions.length <= 6000 &&
    (p.analysis === undefined ||
      (typeof p.analysis === "string" && p.analysis.length <= 3000)) &&
    (p.presetId === undefined || typeof p.presetId === "string") &&
    !!p.parameters &&
    (Object.keys(parameterOptions) as StyleParameterKey[]).every((key) =>
      Object.hasOwn(parameterOptions[key].options, p.parameters[key]),
    )
  );
}
export function profileForMode(
  profile: StoryStyleProfile,
  mode: StoryMode,
): StoryStyleProfile {
  if (profile.mode === mode) return profile;
  // A custom style stays editable when changing narration. Mode-specific direction
  // is selected at prompt time; a built-in exclusive style gets a sensible counterpart.
  const defaults = createStyleProfile(profile.base, profile.mode);
  const customized =
    profile.presetId ||
    profile.instructions.trim() ||
    profile.name !== defaults.name ||
    (Object.keys(parameterOptions) as StyleParameterKey[]).some(
      (key) => profile.parameters[key] !== defaults.parameters[key],
    );
  if (customized) return { ...profile, mode };
  const base = stylesForMode(mode).some((s) => s.id === profile.base)
    ? profile.base
    : "realistic";
  return createStyleProfile(base, mode);
}
export function storyStylePrompt(
  story: Pick<StoryConfig, "style" | "styleProfile" | "mode">,
): string {
  const p = validStyleProfile(story.styleProfile)
    ? story.styleProfile
    : createStyleProfile(story.style, story.mode);
  const keys: StyleParameterKey[] = [
    "pace",
    "camera",
    "lighting",
    "palette",
    "detail",
    story.mode === "spoken" ? "acting" : "explanation",
  ];
  return [
    `VISUAL STYLE: ${p.name}. Base-style defaults: ${storyStyles.find((s) => s.id === p.base)?.prompt || ""}`,
    "VISUAL PRIORITY: The base supplies defaults. The explicit settings below override conflicting base defaults (including color, lighting and movement). Custom visual direction then overrides conflicting base defaults and settings. This priority applies only to appearance and staging; never override the script, speaker identities or selected narration mode.",
    ...keys.map((key) => {
      const prompts = parameterOptions[key].prompts as Record<string, string>;
      return prompts[p.parameters[key]];
    }),
    p.instructions &&
      `Custom visual direction (apply appearance and staging only; never change the script or voice mode): ${p.instructions}`,
    story.mode === "spoken"
      ? "Prioritize legible speaking faces, consistent character design and conversational continuity."
      : "Visuals accompany the external narration; do not add speaking presenters or change the narration.",
  ]
    .filter(Boolean)
    .join("\n");
}
