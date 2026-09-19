import type { StoryMode, StoryStyle, StoryStyleProfile } from "../types";
import {
  storyStyles,
  stylesForMode,
  styleCategory,
  styleDescription,
} from "./storyStyles";
import { styleExtensions } from "./styleExtensions";

const uses: Partial<Record<StoryStyle, string>> = {
  realistic:
    "Para escenas cotidianas, personas y lugares con una apariencia natural.",
  cinematic:
    "Para relatos donde el encuadre y la luz ayudan a transmitir la emoción.",
  cartoon:
    "Para comunicar con personajes expresivos y acciones fáciles de leer.",
  "3d": "Para personajes y objetos con volumen, materiales suaves y movimiento estilizado.",
  explainer:
    "Para enseñar una idea con ejemplos concretos y mostrar por qué ocurre algo.",
  infographic:
    "Para representar relaciones, comparaciones y procesos mediante diagramas claros.",
  anime:
    "Para relatos expresivos con fondos pintados, poses definidas y luz cinematográfica.",
  stopmotion:
    "Para historias con miniaturas, materiales visibles y movimiento artesanal.",
  watercolor:
    "Para relatos tranquilos, recuerdos y escenas con un acabado suave de papel y pigmento.",
  papercut:
    "Para representar ideas mediante capas, siluetas y profundidad de papel recortado.",
  pixel:
    "Para relatos con estética de videojuego retro y una paleta de color limitada.",
  comic:
    "Para escenas dramáticas con tinta, sombras marcadas y composición de novela gráfica.",
  broll:
    "Para acompañar una narración con imágenes reales de apoyo, sin presentador.",
  nature: "Para explicar o contar a través de paisajes, plantas y ecosistemas.",
  macro: "Para mostrar detalles de materiales, texturas y mecanismos pequeños.",
  slides:
    "Para explicar una idea a la vez con composiciones amplias y progresivas.",
  whiteboard:
    "Para construir una explicación mediante dibujos y relaciones paso a paso.",
  motiongraphics:
    "Para conceptos abstractos que se entienden mejor mediante formas y movimiento.",
  isometric:
    "Para mostrar cómo se relacionan las partes de un sistema o un espacio.",
  blueprint:
    "Para explicar estructuras y mecanismos con líneas y vistas técnicas.",
  cutaway:
    "Para explorar el interior de un objeto y mostrar cómo funcionan sus componentes.",
  overlays:
    "Para señalar detalles y explicar acciones con gráficos sobre imágenes reales.",
  collage:
    "Para ideas editoriales y metáforas que combinan fotografía, recortes y papel.",
  timeline:
    "Para explicar la evolución de un proceso, del punto de partida al resultado.",
  documentary:
    "Para testimonios y conversaciones con gestos cotidianos y una cámara cercana.",
  studio:
    "Para concentrar la atención en el rostro, la voz y las expresiones del personaje.",
  noir: "Para diálogos con misterio y tensión, en blanco y negro y con sombras marcadas.",
  retro:
    "Para escenas con textura de película, tonos cálidos y un aire analógico.",
  cel: "Para conversaciones animadas con contornos nítidos, colores planos y fondos pintados.",
  clay: "Para diálogos con personajes de plastilina, formas expresivas y miniaturas táctiles.",
  puppet:
    "Para personajes de tela y fieltro con una interpretación gestual y teatral.",
  storybook:
    "Para relatos cálidos que parecen las páginas de un cuento ilustrado.",
  rotoscope:
    "Para combinar una actuación de movimiento natural con un acabado dibujado.",
  lowpoly:
    "Para personajes geométricos, escenas sencillas y siluetas muy legibles.",
};
const tags: Partial<Record<StoryStyle, string>> = {
  realistic: "fotografia real fotorealista",
  cinematic: "cine pelicula",
  cartoon: "dibujos animados 2d",
  "3d": "render volumen",
  watercolor: "agua pintura acuarela",
  broll: "fondos apoyo stock realista",
  whiteboard: "pizarra blanca clase leccion",
  slides: "presentacion diapositivas clase",
  overlays: "realista animaciones explicativas flechas",
  cutaway: "3d mecanismos interior corte",
  infographic: "datos grafico diagrama infografia",
  motiongraphics: "grafico diseno formas",
  pixel: "videojuego retro 8 bit",
};
export function styleUse(id: StoryStyle) {
  return (
    styleExtensions.find((s) => s.id === id)?.use ||
    uses[id] ||
    styleDescription(id)
  );
}
export const foldStyleSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
export function matchesStyleSearch(id: StoryStyle, query: string, extra = "") {
  const haystack = foldStyleSearch(
    [
      storyStyles.find((s) => s.id === id)?.label,
      styleDescription(id),
      styleCategory(id),
      styleUse(id),
      tags[id],
      styleExtensions.find((s) => s.id === id)?.tags,
      extra,
    ].join(" "),
  );
  return foldStyleSearch(query)
    .split(/\s+/)
    .every((token) => haystack.includes(token));
}
// Keep sprite order separate from presentation order so existing samples stay stable.
export function browseStyles(mode: StoryMode) {
  const first: StoryStyle[] =
    mode === "voiceover"
      ? [
          "broll",
          "overlays",
          "explainer",
          "infographic",
          "slides",
          "topdown",
          "nature",
          "motiongraphics",
        ]
      : [
          "realistic",
          "cinematic",
          "cartoon",
          "3d",
          "documentary",
          "interview",
          "anime",
          "clay",
        ];
  return [...stylesForMode(mode)].sort((a, b) => {
    const rank = (id: StoryStyle) =>
      first.includes(id) ? first.indexOf(id) : first.length;
    return rank(a.id) - rank(b.id);
  });
}
export const styleKey = (profile: StoryStyleProfile) =>
  profile.presetId || `builtin:${profile.base}`;
export const STYLE_FAVORITES_KEY = "vidgen-style-favorites";
export function readStyleFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STYLE_FAVORITES_KEY) || "[]",
    );
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter((id): id is string => typeof id === "string"),
          ),
        ].slice(0, 1000)
      : [];
  } catch {
    return [];
  }
}
export function writeStyleFavorites(value: string[]) {
  try {
    localStorage.setItem(STYLE_FAVORITES_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
