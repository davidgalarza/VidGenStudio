# Procedencia de recursos visuales

El catálogo usa cinco atlas ilustrativos generados con `image_gen`, con **58 celdas utilizadas**: 36 opciones para voz en off y 32 para personajes hablando, con diez compartidas. Cada original PNG mide **1672 × 941 píxeles** y tiene cuatro columnas y tres filas. Las muestras son estáticas: no se vuelven a generar al personalizar un estilo. Los cuatro atlas de ampliación se generaron desde texto, sin imágenes externas de referencia.

La aplicación sirve copias **WebP** comprimidas con `cwebp -q 82`, sin cambios de encuadre ni contenido. Los cinco archivos suman aproximadamente 2,4 MB, frente a 15,7 MB de los originales PNG, que se conservan como fuentes. `StyleSample.tsx` selecciona la celda por CSS; el orden visual de la galería es independiente del orden del atlas.

## `story-styles.png`

Imagen generada con IA mediante la herramienta `image_gen` para el selector de estilos de Historia. Es un atlas PNG de **1672 × 941 píxeles**, organizado en cuatro columnas y tres filas. `StyleSample.tsx` muestra cada celda con posicionamiento de fondo CSS; la copia WebP se incluye en la aplicación.

La imagen se solicitó como una comparación visual de la misma escena —dos exploradores junto a una planta en un entorno de jardín o invernadero— reinterpretada en doce técnicas. El encargo pedía un atlas de cuatro columnas y tres filas, mantener reconocible la escena entre estilos y evitar texto, etiquetas y tipografía. Esta es una descripción del encargo, no una transcripción literal del prompt.

Orden de las celdas, de izquierda a derecha y de arriba abajo:

| Fila | Columna 1                 | Columna 2                     | Columna 3           | Columna 4                  |
| ---- | ------------------------- | ----------------------------- | ------------------- | -------------------------- |
| 1    | Realista (`realistic`)    | Cinematográfico (`cinematic`) | Cartoon (`cartoon`) | Animación 3D (`3d`)        |
| 2    | Explicativo (`explainer`) | Infografía (`infographic`)    | Anime (`anime`)     | Stop motion (`stopmotion`) |
| 3    | Acuarela (`watercolor`)   | Papel recortado (`papercut`)  | Pixel art (`pixel`) | Cómic (`comic`)            |

Las celdas sirven para explicar visualmente una elección de estilo. No son plantillas de contenido, fotogramas de vídeos generados por Historia ni resultados reales de Gemini, Veo u Omni. Abrir una muestra permite revisar sus detalles. Pulsar **Usar** selecciona instrucciones de estilo; **no envía esta imagen automáticamente como referencia a Google**. Las referencias del proyecto se crean, suben y seleccionan por separado.

Ninguno de estos atlas procede de un banco de imágenes ni se atribuye a un fotógrafo o ilustrador externo. Esta nota registra su origen generado con IA; no les asigna una licencia de stock ni una certificación de exclusividad. La licencia del código del proyecto se encuentra en [LICENSE](../../LICENSE).

## `story-styles-voiceover.png`

Doce muestras para imágenes que acompañan una narración: una planta, agua, luz y un entorno de jardín o invernadero, interpretados con diferentes recursos visuales. El [prompt literal](story-styles-voiceover-prompt.md) documenta el encargo y su orden exacto.

| Fila | Columna 1                          | Columna 2                          | Columna 3                        | Columna 4                         |
| ---- | ---------------------------------- | ---------------------------------- | -------------------------------- | --------------------------------- |
| 1    | B-roll realista (`broll`)          | Naturaleza inmersiva (`nature`)    | Macro y detalles (`macro`)       | Diapositivas visuales (`slides`)  |
| 2    | Pizarra animada (`whiteboard`)     | Motion graphics (`motiongraphics`) | Mundos isométricos (`isometric`) | Plano técnico (`blueprint`)       |
| 3    | Cortes y mecanismos 3D (`cutaway`) | Realista + gráficos (`overlays`)   | Collage editorial (`collage`)    | Procesos paso a paso (`timeline`) |

## `story-styles-spoken.png`

Muestras de dos personajes adultos ficticios conversando en un invernadero, con una puesta en escena comparable entre técnicas. El [prompt literal](story-styles-spoken-prompt.md) documenta el encargo. Las dos últimas celdas son variaciones adicionales que no se usan en el selector; no representan estilos extra del catálogo.

| Fila | Columna 1                          | Columna 2                     | Columna 3             | Columna 4                      |
| ---- | ---------------------------------- | ----------------------------- | --------------------- | ------------------------------ |
| 1    | Documental cercano (`documentary`) | Retrato de estudio (`studio`) | Cine noir (`noir`)    | Película analógica (`retro`)   |
| 2    | Animación cel clásica (`cel`)      | Plastilina (`clay`)           | Marionetas (`puppet`) | Cuento ilustrado (`storybook`) |
| 3    | Rotoscopia (`rotoscope`)           | Low poly (`lowpoly`)          | No utilizada          | No utilizada                   |

Los cinco recursos explican opciones de dirección artística; no demuestran resultados reales de Gemini, Veo u Omni, ni garantizan diagramas, texto o apariencias exactas. Elegir una muestra no la adjunta a ninguna solicitud. Los archivos que un usuario sube para analizar su propio estilo pertenecen a una biblioteca local separada y solo se envían a Google mediante la acción explícita de análisis.

## `story-styles-voiceover-extended.png`

Doce muestras adicionales para acompañar una narración con recursos didácticos, objetos, espacios y procesos. Generado con `image_gen`; [prompt literal](story-styles-voiceover-extended-prompt.md). Archivo servido: `story-styles-voiceover-extended.webp`.

| Fila | Columna 1                           | Columna 2                          | Columna 3                        | Columna 4                                |
| ---- | ----------------------------------- | ---------------------------------- | -------------------------------- | ---------------------------------------- |
| 1    | Mapas y recorridos (`maps`)         | Datos en movimiento (`dataviz`)    | Demostración cenital (`topdown`) | Producto en 3D (`productviz`)            |
| 2    | Interfaces ilustradas (`interface`) | Mundo microscópico (`microscopic`) | Cosmos (`space`)                 | Arquitectura y espacios (`architecture`) |
| 3    | Tiempo acelerado (`timelapse`)      | Siluetas y capas (`silhouette`)    | Pizarra de tiza (`chalkboard`)   | Origami en movimiento (`origami`)        |

## `story-styles-spoken-extended.png`

Doce muestras adicionales de dos adultos ficticios conversando en un invernadero, con tratamientos de fotografía, escenografía y animación. Generado con `image_gen`; [prompt literal](story-styles-spoken-extended-prompt.md). Archivo servido: `story-styles-spoken-extended.webp`.

| Fila | Columna 1                                 | Columna 2                       | Columna 3                                | Columna 4                      |
| ---- | ----------------------------------------- | ------------------------------- | ---------------------------------------- | ------------------------------ |
| 1    | Comedia de situación (`sitcom`)           | Teatro filmado (`stage`)        | Conversación de entrevista (`interview`) | Fantasía pictórica (`fantasy`) |
| 2    | Ciencia ficción cinematográfica (`scifi`) | Cartoon elástico (`rubberhose`) | Lápiz de color (`pencil`)                | Tinta y aguadas (`inkwash`)    |
| 3    | Personajes de madera (`wooden`)           | 3D con acabado cel (`cel3d`)    | Animación sin contornos (`lineless`)     | Óleo animado (`oilpaint`)      |
