# Modo Historia

[Documentación](README.md) · [Guía de uso](usage.md)

Historia convierte un guion completo en escenas de un proyecto y las añade al montaje. Está disponible desde **Historia**, dentro de cualquier proyecto. Crear un proyecto sigue sin añadir clips automáticamente.

## Elegir cómo contarla

- **Voz en off:** ElevenLabs narra el texto y Google genera las imágenes que lo acompañan. Usa una voz y configuración constantes; las peticiones de audio incluyen contexto anterior y posterior para favorecer la continuidad.
- **Personajes hablando:** Omni o Veo generan tanto la imagen como el diálogo. Escribe una descripción visual y de voz para cada personaje. Para varios, usa `Ana: diálogo` y `Luis: diálogo` en líneas distintas; una línea sin nombre continúa con el personaje anterior. Cada toma tiene un hablante.

Los estilos disponibles son realista, cinematográfico, animación 2D, animación 3D, explicativo e infografía animada. **Dirección creativa** añade ambiente, época, composición o el enfoque didáctico. Los estilos explicativos solicitan ejemplos concretos y relaciones de causa y efecto; no certifican exactitud factual ni garantizan texto legible dentro de una imagen generada.

Puedes elegir referencias visuales para los personajes desde la biblioteca o subirlas en el selector. Omni recibe hasta tres imágenes de guía; Veo utiliza la imagen del hablante como fotograma inicial. Las descripciones y voces de todos los personajes se repiten en los prompts para favorecer la continuidad.

## Preparar y generar

1. Pega el **Guion completo**, elige el modo y el estilo. En voz en off, añade tu clave de ElevenLabs y pulsa **Cargar mis voces**, o introduce un Voice ID disponible para tu cuenta. También puedes guardar esa clave en Ajustes.
2. Pulsa **Preparar historia**. Esto utiliza Gemini para el plan visual y, en voz en off, ElevenLabs para la narración. Aún no solicita los vídeos.
3. Revisa cada fragmento, escucha la voz y ajusta **Lo que se verá**. **Generar vídeos** envía las escenas pendientes a la cola existente. También puedes generar una sola escena.
4. Abre el montaje para previsualizar imagen y voz juntas, ordenar, dividir, recortar o quitar tomas, y exportar el MP4.

La preparación y la cola siguen funcionando mientras navegas por la aplicación, con la pestaña abierta. **Pausar preparación** termina y guarda la petición actual antes de parar. Tras recargar o un fallo, **Continuar preparación** reutiliza los audios y escenas ya guardados. Una respuesta perdida antes de guardarse puede haber consumido saldo; no hay reintento automático de peticiones facturables.

## Guiones largos y sincronización

El guion no se resume con IA. En voz en off se divide en bloques de hasta 1.200 caracteres, conservando el texto, y se envía a ElevenLabs con `eleven_multilingual_v2`. El resultado de cada bloque se guarda antes de medirlo y planificar las imágenes. Los tiempos por carácter y la duración real del audio determinan los cortes, procurando límites entre palabras. Todos los intervalos son contiguos y cubren también las pausas.

Cada escena visual respeta el máximo del modelo: 10 segundos en Omni o 8 en Veo. La duración solicitada se redondea a una opción admitida y el montaje usa solo el rango necesario para su narración. Si el vídeo devuelto es más corto, se mantiene su último fotograma hasta terminar ese fragmento de voz; se hace tanto en la previsualización como en la exportación.

En personajes hablando, la división usa una estimación conservadora de palabras y caracteres por segundo. El prompt pide el texto literal, una sola voz y tiempo para acabar la frase. **No hay alineación forzada ni comprobación automática de lo que realmente dice el vídeo**: hay que revisar pronunciación, final de frase y continuidad antes de exportar. Un modelo puede omitir palabras o variar la voz. Para narración estable y tiempos medidos, usa voz en off.

No hay un límite artificial de escenas por historia. El procesamiento es secuencial y las historias extensas requieren cuota, almacenamiento y tiempo. La exportación sigue sujeta a los recursos de FFmpeg en el navegador; para trabajos largos puedes descargar los materiales y montar fuera.

## Editar sin rehacerlo todo

- **Regenerar imagen** cambia esa toma, conserva la narración y guarda el vídeo anterior. **Toma utilizada** permite volver a una versión anterior.
- En personajes hablando se puede editar el diálogo de una escena si cabe en su duración máxima, guardar y regenerar. El guion original queda como referencia.
- La voz en off preparada no se reescribe al editar un prompt visual. Para partir de otro guion o cambiar la voz global, crea otra historia en un proyecto nuevo. Actualmente hay una historia por proyecto.
- Reordenar una toma mueve su fragmento de voz; recortar o dividir recorta/divide también ese audio. Quitar una toma del montaje quita ese fragmento de la exportación, sin borrar la fuente.
- Eliminar una escena la mueve a la papelera de Clips; se puede restaurar. No se vuelve a generar automáticamente para rellenar una eliminación intencional.

El montaje de Historia sigue la toma activa de sus escenas para que una regeneración se vea en su lugar. Los montajes normales conservan sus versiones fijadas. Los clips originales de la biblioteca se descargan con su audio original: **Exportar vídeo** desde el montaje es la opción que incorpora la voz en off.

**Descargar voz y guion** guarda los bloques MP3, `guion.txt` y `escenas.json` con el texto, la descripción visual y los rangos de audio de cada escena. Sirve para continuar en un editor local; no es un formato de proyecto reimportable ni una EDL. Para personajes hablados se descarga el guion y el plan.

## Contratos y almacenamiento

- Gemini: `POST /v1beta/interactions`, modelo `gemini-3.8-flash`, respuesta JSON estructurada. El plan se solicita por grupos de ocho escenas; solo puede proponer títulos y acciones visuales para sus IDs. La aplicación valida que no falten ni sobren escenas. Véase [salidas estructuradas de Gemini](https://ai.google.dev/gemini-api/docs/structured-output).
- ElevenLabs: `GET /v1/voices` para cargar voces y `POST /v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128`. La autenticación usa `xi-api-key`, solo en el origen de ElevenLabs. El audio se recibe en base64 con `alignment` sobre el texto original. Véase [voz con tiempos de ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps).
- El modelo y los ajustes de voz son los mismos para todos los bloques; se envían `previous_text`, `next_text` y hasta tres `previous_request_ids` cuando se dispone de ellos.
- IndexedDB, esquema 2: `Project.story` guarda configuración y bloques; `Scene.story` guarda texto, plan y rango de audio; el almacén `narrations` guarda cada MP3 una sola vez. Los proyectos anteriores se conservan al migrar.
- La clave de ElevenLabs se guarda aparte en `localStorage`, como `vidgen_elevenlabs_key`. No se incluye en manifiestos ni en registros del proyecto. Consulta [privacidad](privacy.md).

Las pruebas automatizadas simulan ambos proveedores y usan audio sintético. Verifican cobertura del guion, tiempos, persistencia, recuperación sin repetir audio, regeneración por escena y exportación local con narración audible. No certifican acceso real, voces disponibles ni calidad generativa de una cuenta.
