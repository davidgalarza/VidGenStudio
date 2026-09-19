# Seguridad

## Versiones y alcance

Los reportes deben indicar el commit o versión afectada. El mantenimiento se centra en `main`; no hay una política de soporte prolongado ni un programa de recompensas anunciado.

Son especialmente relevantes la exposición de claves, ejecución de contenido no confiable, URLs de descarga, persistencia, dependencias y tratamiento de archivos multimedia.

## Reportar de forma privada

No publiques claves ni detalles explotables en una incidencia pública. Si el repositorio tiene activados los reportes privados de GitHub, utiliza **Security → Report a vulnerability**. Esa capacidad depende de una configuración del repositorio; añadir este archivo no la activa.

Si no aparece la opción, abre una incidencia que solicite un canal privado de seguridad, sin incluir el fallo, credenciales, datos personales o pruebas explotables. El mantenedor debe acordar el canal antes de recibir los detalles. No se proporciona un correo de seguridad no verificado.

En el reporte privado incluye pasos mínimos, impacto, entorno y revisión afectada, usando datos sintéticos. No accedas a proyectos de terceros para demostrar un fallo ni ejecutes generaciones facturables con claves ajenas.

## Si se expuso una clave

Revócala o rótala en Google o ElevenLabs, según el proveedor y revisa el consumo de esa cuenta. Retirarla de un archivo, commit o comentario no basta para invalidarla. Indica al mantenedor dónde se publicó sin volver a pegarla. El historial y las copias de otros usuarios pueden conservarla.

## Modelo de confianza

La aplicación guarda la clave personal sin cifrado propio en localStorage. El código del mismo origen puede leerla. Aloja solo código que controles y no añadas scripts de terceros que no sean necesarios. El frontend no es un lugar seguro para una clave compartida de servidor.

Los proyectos viven en IndexedDB y no están respaldados remotamente por la aplicación. Al generar, los prompts y referencias se envían a Google y la voz en off de Historia envía su guion a ElevenLabs; al exportar, el procesamiento es local. Véase [privacidad](docs/privacy.md).

El motor distribuido y sus códecs tienen avisos de terceros. Actualizar dependencias requiere revisar compatibilidad, integridad del lockfile y licencias; esta documentación no sustituye una auditoría de seguridad.
