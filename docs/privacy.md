# Privacidad y almacenamiento

[Documentación](README.md)

## Qué queda en el navegador

| Dato                         | Ubicación                                        | Observaciones                                                                  |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Clave personal               | localStorage, `vid_gen_api_key`                  | No está cifrada por la aplicación; el JavaScript del mismo origen puede leerla |
| Clave de ElevenLabs          | localStorage, `vidgen_elevenlabs_key`            | Se envía solo al proveedor de voz; no está cifrada por la aplicación           |
| Borrador de Historia         | sessionStorage, `vidgen-story-draft-{projectId}` | Guion y configuración mientras se prepara; nunca incluye claves                |
| Narración de Historia        | IndexedDB, almacén `narrations`                  | MP3, alineación del texto y metadatos                                          |
| Ajustes de generación        | localStorage, `vidgen_defaults`                  | Preferencias locales                                                           |
| Proyectos, clips y versiones | IndexedDB, `vid-gen-studio`                      | Incluye blobs de vídeo, prompts y metadatos                                    |
| Referencias                  | IndexedDB, almacén `assets`                      | Imágenes y vínculos a proyectos                                                |
| Cola y recuperación          | Registros de clips en IndexedDB                  | Solicitudes capturadas e identificadores remotos                               |
| Archivos descargados         | Carpeta de descargas que elijas                  | Quedan fuera del control de la aplicación                                      |

No hay cuentas ni sincronización entre dispositivos. IndexedDB y localStorage están separados por origen: protocolo, dominio y puerto. Un despliegue de prueba con otra URL no verá los datos del despliegue principal.

El navegador puede restringir o desalojar almacenamiento, especialmente en modo privado o si falta espacio. La aplicación no ofrece una copia completa reimportable del proyecto. Descarga los medios importantes; `clips.json` ayuda a conservar metadatos, pero no restaura una sesión ni el montaje.

## Qué sale del dispositivo

Al generar se envían a Google los prompts, los ajustes y las referencias seleccionadas. Las ediciones y extensiones también usan el identificador de la interacción anterior. Omni solicita que el proveedor conserve el contexto mediante `store: true`; su retención depende del proveedor.

En Historia, Google recibe el contexto del guion, personajes y fragmentos para diseñar el plan visual. ElevenLabs recibe el guion narrado, la voz elegida y contexto de los bloques vecinos; la retención y el consumo dependen de ese proveedor. El guion y la configuración final se guardan en el proyecto local.

Google devuelve el resultado directamente o mediante una URI de sus servicios. El alojamiento estático entrega los archivos de la aplicación; su operador puede tener registros de acceso web. El código actual no incorpora un SDK de analítica ni envía los proyectos a un backend propio.

La previsualización, los recortes, las miniaturas, el ZIP y el escalado local no envían los vídeos a Google. La primera exportación carga el motor FFmpeg desde el mismo sitio.

## Compartir archivos e incidencias

El manifiesto opcional `clips.json` puede incluir prompts, ajustes, títulos y vínculos de origen. Revísalo antes de compartir el ZIP. Un vídeo o imagen puede contener información personal aunque no lleve una API key.

El ZIP de materiales de Historia incluye el guion completo, narraciones y descripciones visuales con tiempos de audio. Tampoco es una copia reimportable.

No publiques claves, cabeceras de autorización, enlaces firmados, capturas de DevTools con solicitudes reales, trazas de navegador o volcados de IndexedDB sin limpiarlos. Usa los vídeos sintéticos de `e2e/fixtures` para reproducir problemas cuando sea posible.

## Eliminar y recuperar

Mover clips a la papelera conserva sus vídeos y permite restaurarlos; no libera ese espacio. Eliminar un proyecto elimina sus clips, incluidos los de su papelera, y las narraciones de Historia. No supone borrar resultados ya almacenados por Google ni archivos descargados al sistema.

La clave se puede retirar con **Eliminar clave guardada** en Ajustes; esa acción no está disponible mientras hay una generación activa. Borrar los datos del sitio en el navegador elimina también proyectos, referencias, solicitudes y preferencias. Haz las descargas necesarias antes. Si una clave se expone, revócala en Google o ElevenLabs, según corresponda; borrarla de un archivo o de la interfaz no la revoca.

Consulta [seguridad](../SECURITY.md) para reportar una vulnerabilidad.
