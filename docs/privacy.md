# Privacidad y almacenamiento

[Documentación](README.md)

## Qué queda en el navegador

| Dato                         | Ubicación                                         | Observaciones                                                                         |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Clave personal               | localStorage, `vid_gen_api_key`                   | No está cifrada por la aplicación; el JavaScript del mismo origen puede leerla        |
| Borrador de Historia         | sessionStorage, `vidgen-story-draft-{projectId}`  | Guion inicial; nunca incluye claves                                                   |
| Propuesta de Historia        | sessionStorage, `vidgen-story-review-{projectId}` | Ediciones pendientes de guardar, con revisión del proyecto                            |
| Narración de Historia        | IndexedDB, almacén `narrations`                   | WAV PCM, duración real y pausas acústicas; admite MP3 antiguos con alineación         |
| Ajustes de generación        | localStorage, `vidgen_defaults`                   | Preferencias locales                                                                  |
| Proyectos, clips y versiones | IndexedDB, `vid-gen-studio`                       | Incluye blobs de vídeo, prompts y metadatos                                           |
| Referencias                  | IndexedDB, almacén `assets`                       | Imágenes y vínculos a proyectos                                                       |
| Cola y recuperación          | Registros de clips en IndexedDB                   | Solicitudes capturadas e identificadores remotos                                      |
| Revisión de diálogo          | Memoria de la vista                               | Transcripción y observaciones temporales; no se guardan en el proyecto ni se exportan |
| Archivos descargados         | Carpeta de descargas que elijas                   | Quedan fuera del control de la aplicación                                             |

**Mis estilos** usa además IndexedDB `vidgen-style-library`, almacén `styles`: conserva los perfiles y los Blobs originales de imágenes o vídeos cuando guardas una entrada. El proyecto conserva una copia de la configuración, sin copiar esos archivos.

Los favoritos de estilos se guardan en localStorage (`vidgen-style-favorites`) como identificadores de catálogo o entradas personales. Las comparaciones y los ajustes todavía sin aplicar son temporales. Cerrar el modal conserva el ajuste en memoria para retomarlo, también al alternar Escenas y Voz y estilo; recargar o salir de la vista lo elimina. Cancelar descarta ese pendiente. Guardar en Mis estilos persiste una copia y sus medios, mientras que Usar aplica la configuración al guion con su flujo de guardado habitual.

No hay cuentas ni sincronización entre dispositivos. IndexedDB y localStorage están separados por origen: protocolo, dominio y puerto. Un despliegue de prueba con otra URL no verá los datos del despliegue principal.

El navegador puede restringir o desalojar almacenamiento, especialmente en modo privado o si falta espacio. La aplicación no ofrece una copia completa reimportable del proyecto. Descarga los medios importantes; `clips.json` ayuda a conservar metadatos, pero no restaura una sesión ni el montaje.

## Qué sale del dispositivo

Al generar se envían a Google los prompts, los ajustes y las referencias seleccionadas. Las ediciones y extensiones también usan el identificador de la interacción anterior. Omni solicita que el proveedor conserve el contexto mediante `store: true`; su retención depende del proveedor.

En Historia, Google recibe el contexto del guion y sus fragmentos para proponer escenas, reparto y estilo. Nano Banana recibe las descripciones e imágenes de referencia necesarias. Gemini TTS recibe el texto narrado, la voz elegida y la dirección de voz. La retención y el consumo dependen de Google. El guion y la configuración final se guardan en el proyecto local.

Al confirmar **Analizar esta toma con Gemini**, se envían el vídeo seleccionado (hasta 14 MB) y las descripciones de apariencia y voz del reparto. Las palabras previstas se comparan localmente con la transcripción devuelta; no se incluyen en la solicitud de transcripción. Esta acción consume cuota de análisis de vídeo y no se ejecuta automáticamente al generar. Cerrar la revisión interrumpe el seguimiento local, sin garantizar la cancelación del procesamiento remoto o su coste. La transcripción no se guarda en IndexedDB y se pierde al recargar o cambiar de versión.

Los escenarios y sus referencias forman parte de la misma información visual que se envía al generar. Las muestras del catálogo de estilos son recursos estáticos locales; elegir un estilo no envía esas imágenes a Google como referencias.

Subir o arrastrar imágenes y vídeos al editor de un estilo es local. **Analizar con Gemini** envía explícitamente los archivos seleccionados y las instrucciones de análisis a Google, con tu clave y consumo de cuota. Se admiten hasta seis archivos y 14 MiB en total; las imágenes se normalizan en copias para el envío y se vuelve a comprobar el tamaño preparado. Las instrucciones y parámetros obtenidos pueden utilizarse en los prompts de planificación, referencias y vídeo; los archivos de análisis no se adjuntan automáticamente a esas generaciones.

El resultado pendiente no reemplaza los ajustes hasta **Aplicar análisis**. Un error, cancelación o respuesta tardía no modifica el borrador. Cerrar o cancelar interrumpe la espera local, sin garantía de cancelar el procesamiento o coste remoto. **Guardar en Mis estilos** conserva el perfil y los originales en la biblioteca; **Usar estos ajustes** copia solo la configuración al proyecto. Sin guardar la entrada, los archivos cargados son temporales. No hay sincronización ni copia exportable de esta biblioteca.

Google devuelve el resultado directamente o mediante una URI de sus servicios. El alojamiento estático entrega los archivos de la aplicación; su operador puede tener registros de acceso web. El código actual no incorpora un SDK de analítica ni envía los proyectos a un backend propio.

La previsualización, los recortes, las miniaturas, el ZIP y el escalado local no envían los vídeos a Google. La primera exportación carga el motor FFmpeg desde el mismo sitio.

## Compartir archivos e incidencias

El manifiesto opcional `clips.json` puede incluir prompts, ajustes, títulos y vínculos de origen. Revísalo antes de compartir el ZIP. Un vídeo o imagen puede contener información personal aunque no lleve una API key.

El ZIP de materiales de Historia incluye el guion completo, narraciones, descripciones visuales y tiempos de audio. Cuando existen, añade las intervenciones con nombres de personajes, interpretación y acciones, los participantes y el lugar. Revisa estos metadatos antes de compartirlo. No incluye el resultado temporal de **Revisar diálogo** ni es una copia reimportable.

No publiques claves, cabeceras de autorización, enlaces firmados, capturas de DevTools con solicitudes reales, trazas de navegador o volcados de IndexedDB sin limpiarlos. Usa los vídeos sintéticos de `e2e/fixtures` para reproducir problemas cuando sea posible.

## Eliminar y recuperar

Mover clips a la papelera conserva sus vídeos y permite restaurarlos; no libera ese espacio. Eliminar un proyecto elimina sus clips, incluidos los de su papelera, y las narraciones de Historia. No supone borrar resultados ya almacenados por Google ni archivos descargados al sistema.

La clave se puede retirar con **Eliminar clave guardada** en Ajustes; esa acción no está disponible mientras hay una generación activa. Borrar los datos del sitio en el navegador elimina también proyectos, referencias, solicitudes y preferencias. Haz las descargas necesarias antes. Si una clave se expone, revócala en su proveedor; borrarla de un archivo o de la interfaz no la revoca.

La antigua clave `vidgen_elevenlabs_key` se elimina al iniciar la aplicación. No se hacen nuevas solicitudes a ElevenLabs; los audios de proyectos anteriores se conservan.

Eliminar una entrada de **Mis estilos** quita su perfil y sus archivos de esa biblioteca, pero los proyectos conservan la configuración que copiaron. Eliminar un proyecto no elimina sus estilos de la biblioteca. Borrar todos los datos del sitio elimina ambas bases; no elimina archivos que Google ya hubiera recibido durante un análisis.

Consulta [seguridad](../SECURITY.md) para reportar una vulnerabilidad.
