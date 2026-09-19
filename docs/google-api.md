# Integración con Google

[Documentación](README.md)

Esta guía describe lo que **implementa el repositorio**, no una garantía de disponibilidad o condiciones comerciales de Google. Los contratos pueden cambiar y el acceso depende de la cuenta. La autoridad local es `src/types.ts` y `src/lib/google.ts`.

## Modelos y límites implementados

| Uso                   | Identificador enviado          | Opciones admitidas por la aplicación                                                                             |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Vídeo Omni            | `gemini-omni-1.1-flash`        | Generación de 3–10 segundos, enteros; 9:16/16:9; 360p, 720p, 1080p y 4k                                          |
| Vídeo Veo             | `veo-3.1-generate-preview`     | 4, 6 u 8 segundos en 720p; 8 segundos en 1080p; 9:16/16:9                                                        |
| Plan de Historia      | `gemini-3.8-flash`             | JSON estructurado: escenas, intervenciones, reparto, lugares, voz, estilo y referencias; conserva el guion local |
| Revisión de diálogo   | `gemini-3.8-flash`             | Análisis opcional de una toma de hasta 14 MB y transcripción estructurada                                        |
| Voz de Historia       | `gemini-3.1-flash-tts-preview` | PCM mono, 30 voces, dirección de voz por texto; se guarda como WAV                                               |
| Referencias generadas | `gemini-3.1-flash-image`       | Nano Banana; referencias de Historia con Interactions, 16:9 y 1K                                                 |

Las guías de personaje/objeto/estilo y la edición/extensión de vídeo utilizan Omni en esta interfaz. Veo admite fotogramas inicial y final; un final requiere un inicial. Omni también requiere ese orden y la UI limita las guías visuales a tres.

## Solicitudes

La aplicación llama mediante `fetch` a `https://generativelanguage.googleapis.com/v1beta`. No depende de un SDK de Google ni de un proxy propio. Las solicitudes oficiales se autentican con `x-goog-api-key`.

Omni usa `/interactions`, `background: true`, `store: true` y `response_format` de vídeo. La edición y extensión envían `previous_interaction_id`; necesitan el contexto remoto de un resultado Omni anterior. La extensión solicita 10 segundos adicionales y la aplicación limita el total declarado a 40 segundos. El contenido y la duración reales dependen de la respuesta del proveedor.

Las generaciones Omni en 360p/720p omiten la entrega por URI. Las de 1080p/4k y las ediciones/extensiones solicitan `delivery: "uri"`. El lector acepta distintas formas de salida, incluyendo contenido de vídeo en los pasos de la interacción, base64 y URI. Veo usa operaciones de generación de larga duración. Consulta el código y las pruebas de contrato al modificar estas rutas.

Antes de enviar referencias, `prepareReferenceImages` crea copias JPEG RGB, reduce la dimensión máxima a 2048 px, rellena transparencias con blanco y verifica un máximo de 4 MB por copia. No modifica las imágenes originales ni la captura persistida de la solicitud.

Para Historia, la propuesta, las referencias y la voz usan Interactions con la misma clave. Los contratos y las diferencias entre preparación y producción están en [Modo Historia](story.md). TTS no proporciona alineación de palabras en esta integración; el montaje usa duración medida y pausas acústicas.

El planificador de Historia recibe unidades numeradas del texto libre. Devuelve rangos de escenas e intervenciones, personajes, participantes, escenarios y dirección visual; el código reconstruye las palabras a partir del origen. `storyDialogue.ts` divide después el diálogo entre los límites de vídeo solicitados. Los prompts pueden incluir varios hablantes en una toma, oyentes silenciosos, acciones por intervención y un escenario compartido. Son instrucciones para el modelo: no garantizan palabras exactas, sincronización labial ni identidad de voz constante. Esta integración no envía referencias de audio ni realiza clonación de voz. Las tomas de Historia se generan de forma independiente y pueden entrar en la cola paralela.

Los escenarios reutilizables se generan con Nano Banana como lugares vacíos. Su `locationName` enlaza el plan con una referencia local; los tres espacios de guía de Omni se reparten entre el reparto presente y el lugar. Los 58 estilos y sus parámetros son instrucciones del prompt, filtradas en 36 opciones de voz en off y 32 de personajes hablando. Las imágenes del selector son ilustraciones de la aplicación y no se adjuntan automáticamente a las solicitudes.

**Revisar diálogo** usa Interactions con contenido de texto y vídeo en base64. Envía las descripciones del reparto y el vídeo, con un límite local de `14 * 1024 * 1024` bytes, y solicita `turns`, `notes` y `uncertain`. No incluye las palabras previstas: la comparación ocurre localmente tras la transcripción. Se valida la estructura de la respuesta y no se genera ningún vídeo como consecuencia del análisis. Cada análisis o repetición requiere una acción explícita y consume cuota; las observaciones y la transcripción pueden equivocarse. Este límite es una decisión de la aplicación, no una declaración del máximo general de la API.

## Análisis de referencias de estilo

`styleLibrary.ts` usa `gemini-3.8-flash` mediante Interactions para analizar explícitamente imágenes y vídeos y devolver un perfil editable. Una solicitud incluye los archivos seleccionados, el catálogo del modo y los parámetros admitidos. Admite hasta seis JPG/PNG/WebP o MP4/WebM/MOV y 14 MiB combinados; las imágenes se normalizan para el envío y se vuelve a limitar el conjunto preparado a 14 MiB. Es un límite de la aplicación, no el máximo general del proveedor.

La respuesta contiene nombre, estilo base, parámetros, indicaciones y análisis. Se valida antes de mostrarla y se aplica solo por acción del usuario. No se adjuntan automáticamente los archivos al planificador ni al modelo de vídeo: se utiliza la configuración textual extraída. Los parámetros prevalecen sobre el estilo base y las indicaciones personalizadas sobre ambos, dentro del ámbito visual. Son instrucciones, no un renderizado determinista; no se garantizan coincidencia exacta, diagramas correctos o texto legible. Cada análisis consume cuota; cancelar la espera local no garantiza cancelar el procesamiento remoto. Las muestras estáticas del catálogo no forman parte de la solicitud.

## Seguimiento y recuperación

- Se guarda el ID remoto tan pronto como está disponible.
- Pausar interrumpe el seguimiento local; no garantiza cancelar el trabajo remoto.
- Recuperar con un ID conocido hace consultas y descarga del resultado existente.
- Si el archivo está `PROCESSING`, se sigue consultando; solo se descarga desde Files cuando está `ACTIVE`.
- Un `FAILED` de archivo se trata como fallo de salida. La app puede intentar una recuperación directa acotada del mismo resultado mediante GET; no repite automáticamente el POST de generación.
- Tras un fallo terminal, **Reintentar clip** es una acción explícita que puede generar una nueva solicitud y un nuevo cargo.
- Sin ID remoto, una caída de red deja incierto si Google aceptó el POST. No hay garantía de generación exactamente una vez en ese caso.

Las URI de descarga deben usar HTTPS y dominios Google permitidos por el código. Las URL firmadas de almacenamiento no reciben la API key del usuario. No amplíes esa lista ni reenvíes credenciales a otro origen sin revisar el flujo.

## Pruebas y cambios del proveedor

**Comprobar conexión** consulta el catálogo de modelos; no genera contenido ni certifica acceso a uno concreto. Las pruebas automatizadas interceptan la red. Para validar un cambio real de contrato hace falta una comprobación separada con acceso al modelo y conocimiento del coste; no publiques su clave ni referencias privadas.

Al cambiar un modelo, actualiza tipos, validación, construcción y lectura de respuestas, UI, casos de error y pruebas. No sustituyas un modelo silenciosamente ni conviertas la recuperación en una segunda generación.

Los términos, precios, permisos, conservación de datos y disponibilidad se consultan directamente en Google. El repositorio no proporciona créditos de generación ni garantiza acceso por tener una clave.
