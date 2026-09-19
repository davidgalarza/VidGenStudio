# Proyectos de historia

[Documentación](README.md) · [Uso general](usage.md)

Historia convierte un guion en un proyecto audiovisual editable. Utiliza la misma clave de Google para Gemini, Gemini TTS, Nano Banana y el modelo de vídeo. Crear un proyecto sigue sin añadir clips automáticamente.

## Del guion a la producción

1. Pulsa **Nuevo proyecto → Proyecto de historia** y pega el **Guion completo**. Puedes dejar que Gemini decida la narración y el estilo, o abrir **Dar indicaciones** para orientar la propuesta.
2. Pulsa **Crear propuesta**. Gemini organiza las escenas, detecta personajes, propone voces y describe qué se verá. Por defecto, Nano Banana genera también imágenes de referencia; desmarca esa opción si prefieres elegirlas después. Esta etapa utiliza texto e imágenes, todavía no genera voz ni vídeo.
3. Revisa la propuesta. En **Escenas** puedes editar títulos, texto e imagen, dividir, ordenar, quitar o añadir momentos y elegir sus referencias. **Personajes y referencias** reúne las apariencias, descripciones de voz e imágenes reutilizables. **Voz y estilo** permite cambiar narración, voz de Gemini, dirección creativa, estilo, formato y modelo.
4. Pulsa **Producir historia** cuando el plan esté listo. Se guardan los cambios, se prepara la narración y se añaden los vídeos a la cola en segundo plano. El audio real determina cuántos clips necesita cada escena.
5. Revisa las tomas y abre el montaje para recortar, mover, dividir o quitar partes. Cada vídeo se puede regenerar conservando su narración. Las tomas anteriores siguen disponibles.

Los vídeos se producen en paralelo, hasta 3 a la vez por defecto. Cada escena muestra su propio progreso; el orden del montaje, el guion y las voces se conservan aunque los resultados lleguen en otro orden. Puedes elegir de 1 a 4 en **Ajustes → Generación en paralelo**. La planificación, la creación de referencias y la preparación de la voz mantienen su flujo actual. Consulta [cola, pausa y recuperación](usage.md#cola-pausa-y-recuperación) para los límites de Google, prioridades y recuperación múltiple.

El guion y las indicaciones iniciales se conservan al salir a Ajustes o recargar. Si otra vista cambia el proyecto mientras tienes ediciones pendientes, puedes recuperar tu borrador o usar la versión guardada.

El borrador de revisión sobrevive a una recarga en la misma pestaña; **Guardar cambios** lo guarda en el proyecto. Producir también lo guarda. El guion original permanece disponible en los materiales, aunque edites o reordenes el texto de las escenas.

## Personajes por revisar

Los nombres se reconocen aunque cambien las mayúsculas o los espacios; las variantes de acentos solo se vinculan cuando identifican un único personaje. Si una escena contiene un nombre desconocido, el selector lo muestra como **Sin asignar** en lugar de aparentar que ya tiene personaje.

El aviso **Personajes por revisar** reúne las escenas afectadas por cada nombre. Puedes saltar a una escena por su número, ver solo las pendientes y asignar el mismo personaje a todo el grupo con una sola acción. Si intentas producir, el editor te lleva a las escenas que necesitan corrección e indica número, título y nombre. No se genera contenido para resolver estas asignaciones y el guion original se conserva.

## Dos formas de narrar

- **Voz en off:** Gemini TTS lee el texto; los vídeos ilustran su significado. La misma voz y las mismas indicaciones se reutilizan en todas las escenas. Hay 30 voces seleccionables y dirección de tono, acento y ritmo mediante texto. El montaje silencia el sonido original del vídeo y añade la narración.
- **Personajes hablando:** el modelo de vídeo genera imagen, diálogo y sonido. Gemini propone un reparto con apariencia y descripción de voz constantes; las referencias ayudan a mantener la identidad. Puedes usar etiquetas como `Ana: ...` y `Luis: ...`; no se envían como palabras que deban pronunciarse.

La voz generada dentro del vídeo no ofrece un identificador de voz fijo ni garantiza repetir exactamente cada palabra. Revisa el diálogo, la pronunciación y la continuidad. Para controlar mejor la voz entre tomas, usa Gemini TTS en voz en off. Tampoco se realiza una transcripción automática para verificar el texto pronunciado por TTS.

## Planificación y referencias

El planificador recibe fragmentos numerados y devuelve rangos consecutivos, títulos, acciones visuales y una configuración. El código conserva el texto original y rechaza respuestas con omisiones, duplicaciones o cambios de orden. Procesa guiones largos por lotes y guarda el avance; nuevos personajes pueden aparecer en lotes posteriores. No hay un límite fijo de duración total impuesto por la interfaz; siguen aplicando las cuotas de la cuenta, el almacenamiento y el número de solicitudes.

Nano Banana crea referencias compartidas de personajes, objetos o estilo. Las referencias de estilo se generan primero y pueden acompañar a las demás imágenes. Puedes editar su descripción, regenerar una imagen, elegir una existente o subir una propia con el selector. Cambiar la descripción no regenera una imagen automáticamente. Las escenas usan referencias automáticas; también puedes fijar una selección por escena. Omni admite hasta tres; Veo utiliza una como fotograma inicial.

Los estilos incluyen realista, cinematográfico, cartoon, animación 3D, explicativo, e infografía. Son instrucciones visuales para el modelo, no plantillas de contenido ni garantías de apariencia exacta.

## Duración y sincronización

Gemini TTS devuelve PCM que la aplicación envuelve en WAV mono de 16 bits. La duración se calcula a partir de las muestras reales. Esta integración no recibe tiempos por palabra y no los inventa.

Si una narración supera el límite del vídeo, se distribuye entre intervalos contiguos, buscando pausas acústicas; si no hay una pausa dentro del límite, se cambia la imagen sin eliminar audio. Cada tramo muestra el texto de la escena completa como contexto, no como una transcripción temporizada de ese tramo. El montaje cubre el audio completo, incluidas sus pausas. Si el vídeo es más corto, mantiene el último fotograma hasta completar la narración.

El diálogo dentro del vídeo se divide conservadoramente según palabras y caracteres. Omni solicita de 3 a 10 segundos; Veo, 4, 6 u 8 segundos (8 en 1080p). La estimación de habla no garantiza que el modelo pronuncie todo: cada toma necesita revisión.

Para escenas editadas manualmente se admiten hasta 3.000 caracteres por bloque de voz. Usa **Dividir** para repartir una escena mayor; esto no limita la longitud total del guion.

## Pausa, errores y recuperación

Mantén la pestaña abierta durante las solicitudes. Puedes cambiar de vista y seguir trabajando; **Pausar** guarda el resultado de la petición actual y detiene las siguientes. Si recargas después, **Continuar propuesta** o **Continuar producción** reutiliza planes, referencias y narraciones ya guardados. Si falla la primera narración, vuelves a la propuesta editable. En producciones parciales, **Editar partes pendientes** permite corregir el texto y la imagen de las partes aún no preparadas; continuar guarda esos cambios y conserva las escenas terminadas. Un audio guardado de Gemini solo se reutiliza si coinciden texto, voz e indicaciones.

Los errores de imágenes permiten **Revisar sin más imágenes** y completarlas después.

### Revisar una escena bloqueada por contenido

Si Google devuelve un bloqueo de contenido, aparece **Revisar descripción con Gemini** en la escena y en el editor de clips. Desde la biblioteca, **Revisar escena** abre el editor. No se ofrece esta revisión para errores de clave, cuota, conexión o procesamiento de archivos.

1. Pulsa **Revisar descripción con Gemini**. Se envía una única solicitud de texto con la descripción y el contexto de esa escena, usando la clave de Google configurada. Consume cuota de Gemini; no genera vídeo.
2. Compara la descripción actual con la propuesta. Una aclaración conserva la intención; si la propuesta cambia contenido, se presenta como **Alternativa: cambia parte de la escena** y explica el cambio. Puedes cerrar sin modificar nada o cancelar una revisión en curso. Si Gemini necesita cambios en el diálogo o el contexto, se indica **Necesita revisión manual** sin ofrecer una aplicación automática.
3. Pulsa **Aplicar descripción** para guardarla y, después, **Generar escena** o **Generar con cambios** cuando quieras crear el vídeo. Si hay otras solicitudes en una cola pausada, puedes continuar desde la actividad. Se actualiza también el texto de la solicitud fallida para no repetir el prompt anterior.

En Historia se conserva el texto hablado, el audio, sus tiempos, los personajes y las referencias. En ediciones y extensiones de clips se conserva el vídeo base. La revisión recibe texto, no las imágenes de referencia ni el vídeo base: no identifica qué archivo podría causar el bloqueo y no los sustituye. La propuesta aún no aplicada no se conserva al recargar; la descripción aceptada sí se guarda en el navegador.

No hay un bucle de reintentos ni cambios en los filtros de seguridad. El revisor busca aclaraciones legítimas o alternativas que cambien realmente el contenido problemático, nunca ocultarlo. No se garantiza la aceptación. Google aplica filtros al contenido generado y a las imágenes aportadas; consulta la [documentación de Veo](https://ai.google.dev/gemini-api/docs/veo).

Cada solicitud puede consumir cuota. No se repiten automáticamente solicitudes de pago. Una interrupción antes de guardar una respuesta puede dejar incierto si Google la procesó; continuar puede volver a solicitar esa parte. El bloqueo entre pestañas evita dos preparaciones simultáneas donde el navegador admite Web Locks.

Las claves se configuran una sola vez en Ajustes. El acceso a TTS, imágenes, texto y vídeo depende de los modelos habilitados y de la cuota de tu cuenta; comprobar la conexión no garantiza acceso a todos.

## Montaje y materiales

**Guion y escenas** abre en la etapa guardada. En producción, busca por nombre, texto o descripción visual y filtra **Todas / Por revisar / Pendientes / En proceso / Listas**. Las escenas conservan su número y orden de guion; los filtros y los cambios entre secciones no descartan las ediciones abiertas. Guarda los cambios de cada toma antes de salir del proyecto o recargar.

**Materiales** reúne todos los vídeos del proyecto, incluidas las tomas de apoyo o los clips de proyectos anteriores. Conserva generación individual, edición, extensión, comparación, favoritos, papelera y descargas. **Montaje** abre el editor de secuencia; al salir regresa a la sección desde la que lo abriste, después de guardar los ajustes.

El montaje sigue la toma activa de cada escena de Historia. Los montajes normales conservan sus versiones fijadas. **Exportar vídeo** incorpora la voz en off: descargar un clip original por separado conserva el archivo de vídeo recibido del modelo.

**Voz y guion** descarga WAV, el guion original y un manifiesto JSON con texto de escena, descripción visual y rangos de audio para continuar en otro editor. Las narraciones antiguas en MP3 siguen siendo reproducibles y exportables. No es una copia reimportable del proyecto.

## Contratos y almacenamiento

- Gemini LLM: `gemini-3.8-flash`, `POST /v1beta/interactions`, JSON estructurado.
- Gemini TTS: `gemini-3.1-flash-tts-preview`, misma ruta, `response_format.type=audio` y `generation_config.speech_config=[{voice}]`. PCM mono a 24 kHz por defecto. [Documentación de voz](https://ai.google.dev/gemini-api/docs/speech-generation).
- Nano Banana: `gemini-3.1-flash-image`, Interactions con `response_format.type=image`, `aspect_ratio=16:9` e `image_size=1K`. Puede recibir imágenes de estilo. [Documentación de imágenes](https://ai.google.dev/gemini-api/docs/image-generation).
- Todas las solicitudes usan `x-goog-api-key` exclusivamente en el origen de Google. No se necesita ElevenLabs; al iniciar se elimina su antigua clave local, conservando los audios de proyectos previos.
- IndexedDB, esquema 2: `Project.story` contiene fase, revisión, propuesta, reparto y referencias; `Scene.story` contiene el plan y rango de audio; `narrations` guarda cada audio una sola vez. El guardado de revisión comprueba versiones para evitar sobrescribir cambios de otra pestaña.

Consulta [integración con Google](google-api.md), [privacidad](privacy.md) y [desarrollo](development.md). Las pruebas usan respuestas simuladas y tonos sintéticos; no validan por sí solas el acceso de una cuenta a estos modelos.
