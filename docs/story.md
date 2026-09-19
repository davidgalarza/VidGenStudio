# Proyectos de historia

[Documentación](README.md) · [Uso general](usage.md)

Historia convierte un guion en un proyecto audiovisual editable. Utiliza la misma clave de Google para Gemini, Gemini TTS, Nano Banana y el modelo de vídeo. Crear un proyecto sigue sin añadir clips automáticamente.

## Del guion a la producción

1. Pulsa **Nuevo proyecto → Proyecto de historia** y pega en **Guion completo** solo lo que se escuchará. En **Cómo se escucha** elige personajes hablando o voz en off; el valor inicial es **Voz en off · Gemini TTS**. El estilo inicial es **Realista** y puedes cambiarlo o personalizarlo antes de crear la propuesta. **Dar indicaciones** sigue siendo opcional.
2. Pulsa **Crear propuesta**. Gemini organiza escenas narrativas, personajes, voces, lugares, acciones e intervenciones. No necesitas escribir un guion técnico. Por defecto, Nano Banana genera también imágenes de referencia; desmarca esa opción si prefieres elegirlas después. Esta etapa utiliza texto e imágenes, todavía no genera voz ni vídeo.
3. Revisa la propuesta. En **Escenas** puedes editar títulos, texto e imagen, dividir, unir con la siguiente, ordenar, quitar o añadir momentos y elegir sus referencias. Las conversaciones permiten ajustar quién dice cada parte, su interpretación, las acciones y cómo se filma. **Personajes y referencias** reúne las apariencias, descripciones de voz, escenarios e imágenes reutilizables. **Voz y estilo** permite cambiar narración, voz de Gemini, dirección creativa, estilo, formato y modelo.
4. Pulsa **Producir historia** cuando el plan esté listo. Se guardan los cambios, se prepara la narración y se añaden los vídeos a la cola en segundo plano. En voz en off, el audio real determina los clips necesarios; con personajes hablando, se usa una estimación conservadora del habla.
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

Para un monólogo basta con pegar las palabras y elegir **Personajes hablando**; Gemini propone el personaje. Para una conversación, identifica a cada hablante en el texto libre:

```text
Ana: ¿Qué hay detrás de esa puerta?
Leo: Vamos a descubrirlo.
Ana: Te sigo.
```

No hace falta añadir acciones, cámaras ni lugares al guion. Gemini propone esas indicaciones por separado. En **Voz en off**, todo el texto se trata como narración literal: los nombres seguidos de dos puntos también forman parte de lo que leerá la voz.

También puedes poner el nombre en su propia línea, por ejemplo `Ana:` y sus palabras debajo. Si Gemini separa esa etiqueta en una intervención o escena, la aplicación la vincula automáticamente al diálogo y no crea tomas vacías. El hablante se mantiene hasta la siguiente etiqueta, incluso entre lotes; el guion original se conserva.

La voz generada dentro del vídeo no ofrece un identificador de voz fijo ni garantiza repetir exactamente cada palabra. Las descripciones y referencias visuales no clonan una voz; esta integración no envía referencias de audio. Revisa el diálogo, la pronunciación y la continuidad. Para controlar mejor la voz entre tomas, usa Gemini TTS en voz en off. Tampoco se realiza una transcripción automática para verificar el texto pronunciado por TTS.

## Escenas, conversaciones y tomas

Una **escena** reúne lo que sucede en un mismo contexto; una **intervención** contiene lo que dice un personaje; una **toma** es un clip generado. Cambiar de hablante no obliga a crear otra escena. Una escena larga puede producir varias tomas, y un intercambio breve puede incluir varias voces dentro de un solo vídeo.

Cada intervención tiene un personaje, sus palabras, una interpretación opcional y **Acción y movimiento**. La interpretación y las acciones son indicaciones visuales o de actuación, no palabras que deban pronunciarse. Puedes editar, reordenar, añadir o quitar intervenciones, o abrir la edición como texto. **En escena** permite añadir oyentes que reaccionan en silencio; quienes hablan se incluyen automáticamente. **Lugar de la escena** vincula una referencia reutilizable.

**Cómo se filma** ofrece tres opciones:

- **Automático:** agrupa intercambios breves cuando caben; limita cada toma a dos hablantes y tres intervenciones como máximo.
- **Plano compartido:** pide mantener juntos a los personajes y agrupa el diálogo mientras lo permita la duración. Una escena larga sigue necesitando varios clips.
- **Alternar:** cada toma contiene un solo hablante; las intervenciones largas se reparten entre las tomas necesarias.

La lista de **Tomas previstas** muestra el reparto del texto y la duración estimada antes de producir. Cambiar estas opciones recalcula el plan localmente, sin generar vídeo. La aplicación conserva las palabras y su orden al repartirlas; el resultado del modelo puede apartarse del plan y necesita revisión.

## Revisar el diálogo generado

En una toma terminada de personajes hablando, guarda primero tus cambios y pulsa **Revisar diálogo → Analizar esta toma con Gemini**. Es una solicitud opcional que envía ese vídeo y las descripciones del reparto a Gemini, usando tu clave y consumiendo cuota de análisis de vídeo. El límite local es de 14 MB por vídeo; los vídeos mayores se revisan escuchándolos manualmente.

Gemini transcribe lo que oye sin recibir las palabras previstas. La aplicación compara después hablantes y palabras localmente, ignorando diferencias de mayúsculas y puntuación. Puedes ver el texto previsto, la transcripción y las observaciones sobre posibles cortes, solapamientos o sincronización labial. **La transcripción coincide** describe esa comparación, no certifica que el vídeo sea correcto: la transcripción y la identificación de voces pueden equivocarse.

La revisión no modifica ni regenera nada automáticamente. Puedes cerrar, escuchar el vídeo y ajustar o regenerar solo esa toma. El resultado es temporal: no se guarda en el proyecto ni se exporta y se descarta al cambiar de versión o recargar. Cerrar durante el análisis interrumpe el seguimiento local; no garantiza cancelar el procesamiento o coste remoto. **Volver a revisar con Gemini** inicia otra solicitud explícita.

## Planificación y referencias

El planificador recibe fragmentos numerados y devuelve rangos consecutivos para las escenas y sus intervenciones, títulos, acciones visuales y una configuración. El código reconstruye las palabras desde el texto original y rechaza rangos con omisiones, duplicaciones, cambios de orden o hablantes incoherentes. Procesa guiones largos por lotes y guarda el avance; nuevos personajes pueden aparecer en lotes posteriores. No hay un límite fijo de duración total impuesto por la interfaz; siguen aplicando las cuotas de la cuenta, el almacenamiento y el número de solicitudes.

Nano Banana crea referencias compartidas de personajes, escenarios, objetos o estilo. Los escenarios representan el lugar vacío: arquitectura, luz, mobiliario y posiciones estables, sin personas ni etiquetas. La misma referencia puede acompañar varias escenas y tomas; no se genera otro escenario por cambiar la cámara. Puedes añadir un **Escenario o lugar**, editar su descripción, regenerar una imagen, elegir una existente o subir una propia con el selector.

Si Gemini nombra un lugar pero omite su ficha de referencia, el plan crea una ficha editable del escenario vacío a partir de la descripción visual. También vincula variantes inequívocas de mayúsculas, espacios y tildes, y reutiliza las imágenes ya guardadas al continuar otro lote. No modifica el diálogo ni solicita otra planificación para reparar ese enlace. La generación de su imagen respeta la opción **Crear también las referencias visuales**. Si una versión anterior dejó la propuesta detenida con ese error, recarga la aplicación y pulsa **Continuar propuesta** en el mismo proyecto.

Las referencias de estilo se generan primero y pueden acompañar a las demás imágenes. Cambiar la descripción no regenera una imagen automáticamente. La selección automática usa los personajes presentes y reserva espacio para el escenario, dentro del límite de tres guías de Omni; también puedes fijar una selección por escena. Con más personajes, no todos tendrán una guía de imagen en cada solicitud: sus descripciones siguen formando parte del prompt. Veo utiliza una referencia como fotograma inicial. Las imágenes y las indicaciones ayudan a la continuidad, pero no garantizan una identidad o escenografía idéntica.

## Elegir y personalizar un estilo

El catálogo contiene **58 estilos distintos**: **36 para voz en off** y **32 para personajes hablando**, con diez estilos comunes a ambos modos. La última ampliación añade doce opciones por modo y conserva las anteriores. No hay una elección automática de estilo en la entrada: la propuesta utiliza la selección aplicada.

Los diez estilos comunes abarcan Realista, Cinematográfico, Animación 2D y 3D, Anime, Stop motion, Acuarela, Papel recortado, Pixel art y Novela gráfica. Voz en off incluye alternativas para explicar, ilustrar o mostrar procesos: por ejemplo Mapas y recorridos, Datos en movimiento, Demostración cenital, Mundo microscópico y Origami en movimiento. Para personajes hay opciones como Conversación de entrevista, Teatro filmado, Comedia de situación, Fantasía pictórica, Personajes de madera y Óleo animado. Cada ficha explica en qué situaciones puede servir y muestra sus seis ajustes.

Abre **Estilo visual** para buscar por nombre, técnica o uso y filtrar por categoría, **Favoritos** o **Mis estilos**. La búsqueda acepta varias palabras en cualquier orden y no distingue tildes. El orden inicial prioriza opciones apropiadas al modo. Puedes marcar favoritos del catálogo y personales para encontrarlos después en este navegador.

Pulsa una muestra para abrir sus detalles: la selección actual no cambia. Añade hasta tres estilos a **Comparar**, incluidos estilos personales, y contrasta apariencia, uso recomendado y parámetros. **Usar [nombre]** aplica la elección. **Personalizar** parte de esos ajustes, **Crear estilo** abre uno nuevo y **Ajustar estilo** abre la configuración actual. Al volver a la galería se restauran el desplazamiento y el foco.

Cada modo muestra seis controles: ritmo visual, movimiento de cámara, iluminación, color, detalle visual y un último control específico. En voz en off, **Cómo acompaña la explicación** elige imágenes de apoyo, demostraciones, diagramas progresivos o gráficos sobre la imagen. Con personajes, **Interpretación de los personajes** elige una actuación natural, contenida, expresiva o teatral. Puedes cambiar el nombre, el estilo base y las **Indicaciones del estilo**.

Los parámetros elegidos prevalecen sobre los valores del estilo base. Las indicaciones personalizadas prevalecen sobre ambos cuando hay un conflicto visual; no cambian el guion, las identidades de los hablantes ni el modo de narración. Estos ajustes se utilizan en la planificación, las referencias de Nano Banana y los prompts de vídeo. Cambiar de modo conserva una configuración personalizada, incluidos cambios solo de nombre o parámetros. Un estilo de catálogo sin personalizar que no exista en el nuevo modo pasa a Realista.

La galería muestra cuatro columnas en escritorio y dos en móvil; la comparación pasa de tres columnas a una. Las referencias y los ajustes se ven en dos columnas en escritorio y se alternan mediante **Ajustes / Referencias** en móvil. Las muestras son ilustraciones generadas con IA, no plantillas ni resultados garantizados del modelo. **La muestra no se vuelve a generar al ajustar los controles**: representa el estilo base, también al comparar estilos personalizados. Estas imágenes de la aplicación no se envían automáticamente a Google como referencias. Consulta su [procedencia](../src/assets/README.md).

### Mis estilos y configuración de cada proyecto

**Usar estos ajustes** aplica una copia de la configuración al borrador de la historia. **Guardar en Mis estilos** guarda además el perfil y sus archivos de referencia en este navegador para reutilizarlos. Son acciones distintas: guardar un estilo en la biblioteca no lo aplica al proyecto, y usarlo no guarda automáticamente sus archivos en la biblioteca. Guarda la propuesta del proyecto para que su configuración quede persistida.

Si cierras el modal sin aplicar, la galería ofrece **Continuar ajuste**. Se conservan temporalmente el perfil, los archivos y el análisis pendiente, también al alternar entre **Escenas** y **Voz y estilo**. **Cancelar** o **Descartar ajuste pendiente** elimina ese borrador; **Usar** aplica y limpia el pendiente. Este borrador está solo en memoria: se pierde al recargar o salir de la vista. Para conservarlo de forma duradera, guarda una copia en **Mis estilos**. La configuración ya aplicada al guion mantiene su guardado habitual de sesión o proyecto.

Desde **Mis estilos** puedes editar, clonar o eliminar entradas. En una entrada guardada, **Actualizar estilo guardado** modifica esa entrada y **Guardar como nuevo** crea otra. Los proyectos conservan su propia copia: modificar o borrar una entrada de la biblioteca no cambia las historias que ya la usan. La biblioteca y sus archivos son locales a este origen del navegador, sin sincronización ni exportación o importación de estilos.

### Crear un estilo a partir de imágenes o vídeos

1. En la configuración del estilo, pulsa **Subir imágenes o vídeos** o arrastra archivos a **Referencias**. Se admiten JPG, PNG y WebP, y vídeos MP4, WebM y MOV: hasta seis archivos y **14 MiB en total** (la interfaz lo expresa como 14 MB). Puedes previsualizarlos y quitar cualquiera; para vídeo, usa un fragmento corto.
2. Pulsa **Analizar con Gemini**. Es una solicitud explícita con tu clave de Google que consume cuota. Envía únicamente los archivos elegidos para ese análisis; las imágenes se normalizan en copias para el envío y los originales se conservan. El conjunto preparado también debe caber en 14 MiB.
3. Revisa el nombre, los parámetros, las indicaciones y la explicación que devuelve Gemini. **Aplicar análisis** los incorpora al borrador del estilo; **Descartar análisis** conserva los ajustes anteriores. Después puedes corregir cualquier campo antes de usarlo o guardarlo.
4. Pulsa **Usar estos ajustes** para aplicar el estilo al proyecto y, si quieres reutilizarlo con sus referencias, guárdalo también en **Mis estilos**.

El análisis busca reglas de apariencia, materiales, color, luz, composición y movimiento; no reutiliza automáticamente las personas, escenas, voces o diálogo de los archivos. Los archivos de estilo **no se adjuntan automáticamente a las generaciones**: el texto y los parámetros extraídos orientan el plan, las referencias generadas y los vídeos. Para guiar un personaje o un lugar concreto, utiliza las referencias de la historia por separado. Los parámetros son indicaciones para el modelo, no un renderizado determinista: no se garantiza una reproducción visual exacta ni la precisión de diagramas o texto generado.

Un error, un análisis cancelado o una respuesta tardía no sustituye los ajustes actuales. **Cancelar análisis** o cerrar interrumpe la espera local; no garantiza cancelar el procesamiento o la facturación de Google. La propuesta de análisis pendiente es temporal. Solo los archivos de un estilo guardado en **Mis estilos** persisten para reutilizarlos; cerrar sin guardarlos no los incorpora al proyecto.

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

**Guion y escenas** abre en la etapa guardada. En producción, las tomas aparecen agrupadas por escena narrativa, con el lugar y el recuento de tomas listas. Busca por nombre, texto o descripción visual y filtra **Todas / Por revisar / Pendientes / En proceso / Listas**. Las escenas conservan su número y orden de guion; los filtros y los cambios entre secciones no descartan las ediciones abiertas. Guarda los cambios de cada toma antes de salir del proyecto o recargar.

Puedes corregir las palabras, la interpretación, las acciones y la descripción visual de una toma y regenerarla sin volver a producir toda la historia. Se conservan las versiones anteriores; regenerar no cambia las otras tomas. Una edición que ya no quepa en el límite de duración necesita acortar el texto o redistribuirlo: el editor de una toma producida no vuelve a planificar automáticamente el resto de la escena.

En las nuevas tomas con referencias automáticas, cambiar quién habla actualiza también los retratos seleccionados y conserva el escenario. Una selección de referencias modificada manualmente se respeta.

**Materiales** reúne todos los vídeos del proyecto, incluidas las tomas de apoyo o los clips de proyectos anteriores. Conserva generación individual, edición, extensión, comparación, favoritos, papelera y descargas. **Montaje** abre el editor de secuencia; al salir regresa a la sección desde la que lo abriste, después de guardar los ajustes.

El montaje sigue la toma activa de cada escena de Historia. Los montajes normales conservan sus versiones fijadas. **Exportar vídeo** incorpora la voz en off: descargar un clip original por separado conserva el archivo de vídeo recibido del modelo.

**Voz y guion** descarga WAV, el guion original y `escenas.json` con texto, intervenciones, participantes, lugar, descripción visual y rangos de audio para continuar en otro editor. El manifiesto conserva el formato `vidgen-story-materials-v2` y añade los campos opcionales `dialogue`, `participants` y `location`; las intervenciones incluyen interpretación y acción cuando existen. Las narraciones antiguas en MP3 siguen siendo reproducibles y exportables. No es una copia reimportable del proyecto.

## Contratos y almacenamiento

- Gemini LLM: `gemini-3.8-flash`, `POST /v1beta/interactions`, JSON estructurado.
- Gemini TTS: `gemini-3.1-flash-tts-preview`, misma ruta, `response_format.type=audio` y `generation_config.speech_config=[{voice}]`. PCM mono a 24 kHz por defecto. [Documentación de voz](https://ai.google.dev/gemini-api/docs/speech-generation).
- Nano Banana: `gemini-3.1-flash-image`, Interactions con `response_format.type=image`, `aspect_ratio=16:9` e `image_size=1K`. Puede recibir imágenes de estilo. [Documentación de imágenes](https://ai.google.dev/gemini-api/docs/image-generation).
- Todas las solicitudes usan `x-goog-api-key` exclusivamente en el origen de Google. No se necesita ElevenLabs; al iniciar se elimina su antigua clave local, conservando los audios de proyectos previos.
- IndexedDB, esquema 2: `Project.story` contiene fase, revisión, propuesta, reparto y referencias; `Scene.story` contiene el plan y rango de audio; `narrations` guarda cada audio una sola vez. El guardado de revisión comprueba versiones para evitar sobrescribir cambios de otra pestaña.

Consulta [integración con Google](google-api.md), [privacidad](privacy.md) y [desarrollo](development.md). Las pruebas usan respuestas simuladas y tonos sintéticos; no validan por sí solas el acceso de una cuenta a estos modelos.
