# Problemas frecuentes

[Documentación](README.md)

## El proyecto está vacío

Es el comportamiento esperado. **Nuevo proyecto** no crea un clip por defecto. Usa **Nuevo clip** y escribe el prompt. Crear el borrador no inicia una generación.

## La clave funciona, pero un modelo falla

**Comprobar conexión** solo consulta el catálogo. Comprueba el acceso, la cuota y la facturación de tu cuenta en Google. La aplicación requiere una clave de la API oficial, no la de un intermediario. No cambies de modelo esperando recuperar una operación que pertenece al anterior.

## «The file failed to be processed.»

Puede fallar la preparación de una referencia o la del archivo de salida en Google. Si la interfaz identifica una referencia, vuelve a subirla en JPG o PNG y revisa que se pueda previsualizar. El envío prepara copias JPEG normalizadas; los originales permanecen guardados.

Si Google declara un fallo del archivo de salida, puede que no exista un vídeo descargable. La aplicación realiza una recuperación acotada del resultado conocido cuando corresponde. **Reintentar clip** envía una solicitud nueva y puede tener coste; no equivale a descargar otra vez un archivo existente.

## «No se generó un vídeo» o resultado vacío

Revisa el mensaje completo, las restricciones del prompt y las referencias. Que una respuesta HTTP sea válida no implica que incluya un vídeo. Conserva el resultado anterior si existe. Reporta un ejemplo mínimo sin datos privados; no publiques tu clave ni enlaces firmados.

## La cola se detuvo o recargué la página

La cola se pausa tras errores y al recuperar el estado después de una recarga. Usa **Recuperar resultado** si existe un ID remoto, o **Continuar cola** para solicitudes pendientes. Pausar solo detiene el seguimiento local. No hay ejecución de fondo con la pestaña cerrada.

Si la conexión se cortó antes de recibir un identificador, consulta tu actividad en Google antes de lanzar otra generación: el servidor pudo aceptar la primera.

## Ya no puedo editar o extender un vídeo

La edición/extensión usa el contexto de una interacción Omni anterior. Puede caducar según la retención del proveedor. Conservar el vídeo local permite verlo y montarlo, pero no restaura ese contexto remoto. Los vídeos sin interacción Omni compatible no se pueden convertir en entradas editables mediante una importación de archivos: esa función no existe.

## «No se pudo iniciar el motor de vídeo»

Usa HTTPS o localhost. Comprueba que el alojamiento conserva los encabezados de `vercel.json` y que `window.crossOriginIsolated` es `true`. Comprueba también la carga del archivo `.wasm` y del worker. Sirve `dist` mediante un servidor, no abriendo `index.html` como archivo local. Consulta [despliegue](deployment.md).

## Exportar tarda mucho, falla o se queda sin memoria

Cierra otras pestañas y prueba una resolución menor. El escalado y la unión consumen recursos locales; aumentar a 4K no reconstruye detalle mediante IA. Solo se prepara un vídeo a la vez. Cancelar termina el worker y permite iniciar después otro trabajo.

El escalado individual rechaza fuentes de más de 512 MB y salidas de más de 8,3 megapíxeles. El ZIP no implementa ZIP64 y está limitado a 4 GB. Un montaje puede fallar por memoria mucho antes de alcanzar límites teóricos; no hay una duración máxima universal garantizada. Descarga originales por grupos y termina el trabajo en un editor local si hace falta.

## El montaje no reproduce o no permite exportar

Alguna toma puede no tener vídeo disponible o su archivo aún no se ha leído. Revisa esa toma, espera a que cargue o quítala del montaje. La secuencia fija una versión de origen; no cambia silenciosamente a otra si falta la anterior. Quitar una toma del montaje conserva el clip en el proyecto.

Las bandas negras conservan el encuadre al mezclar proporciones. El volumen y los recortes se aplican al exportar. El botón de bucle solo sirve para revisar una toma y no añade repeticiones al MP4.

## No veo mis proyectos

Comprueba navegador, perfil, modo privado, dominio y puerto. `localhost:5173`, `127.0.0.1:5173` y el dominio publicado tienen almacenamientos distintos. No borres datos del sitio como primer intento de solución. Si ya se borró IndexedDB, la aplicación no dispone de una copia remota para restaurarlo.

La papelera permite recuperar clips borrados, pero no proyectos eliminados ni datos del sitio borrados desde el navegador. Un ZIP descargado no se puede reimportar como proyecto.

## Informar de un problema

Usa una [incidencia del repositorio](https://github.com/davidgalarza/VidGenStudio/issues) con pasos, resultado esperado, navegador, sistema, revisión de Git y un mensaje de error saneado. Si implica credenciales o una vulnerabilidad, consulta [SECURITY.md](../SECURITY.md).

## Historia: preparación o voz

**Continuar propuesta** y **Continuar producción** reutilizan los planes, imágenes y audios ya guardados. Si falla Gemini TTS o Nano Banana, comprueba el acceso al modelo y la cuota de tu cuenta de Google; se utiliza la misma clave de Ajustes. Si solo fallan las imágenes, puedes **Revisar sin más imágenes** y completarlas después. Un fallo después de enviar una solicitud puede haber consumido saldo y no se reintenta automáticamente.

Si la actualización del almacenamiento pide cerrar otras pestañas, cierra las pestañas antiguas de Vidgen Studio. La migración añade el almacén de narraciones y conserva proyectos, vídeos y referencias. Consulta [Modo Historia](story.md) para sincronización, materiales y limitaciones del diálogo generado.
