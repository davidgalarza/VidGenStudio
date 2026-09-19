# Guía de uso

[Documentación](README.md) · [Inicio del proyecto](../README.md)

## Proyectos y clips

**Nuevo proyecto** crea un proyecto vacío. No se añade ningún clip automáticamente. Pulsa **Nuevo clip** cuando quieras preparar el primero. Los proyectos y clips se ordenan por modificación reciente de forma predeterminada; puedes cambiar el orden de los clips.

## Formas de trabajar

El proyecto abre en **Clips del proyecto**. Usa **Nuevo clip** o abre uno existente para generar, revisar versiones y descargarlo en un modal individual. Al cerrarlo, vuelves a la biblioteca y los cambios quedan guardados. Para seguir en un editor local, selecciona clips y pulsa **Descargar seleccionados · ZIP**: se incluye la versión activa de cada vídeo. La resolución **Original** la conserva sin recomprimir. Los borradores se excluyen y los nombres llevan un índice para evitar colisiones. El ZIP admite hasta 4 GB; para más material, descarga por grupos.

## Historias desde un guion

Pulsa **Historia** dentro del proyecto para crear escenas desde un guion completo. Gemini propone narración, estilo, reparto y referencias de Nano Banana. Revisa y edita el plan; después pulsa **Producir historia** para crear la voz con Gemini TTS y generar los vídeos en segundo plano. Todo usa la misma clave de Google. Las escenas se añaden al montaje; puedes regenerar una imagen sin rehacer la voz y descargar los materiales para tu editor local. Consulta la [guía de Historia](story.md) para voces, estilos, duración y límites.

## Descargas y calidad

**Descargar clips** permite elegir seleccionados, favoritos o todos los disponibles. Puedes usar los nombres de los clips, un nombre común numerado o personalizar cada archivo. La vista previa muestra los nombres seguros definitivos y resuelve duplicados. Los prompts, ajustes, duración y origen se incluyen opcionalmente en `clips.json`. Los descartados se excluyen de Favoritos y Todos; puedes seleccionarlos explícitamente si quieres descargarlos.

**Resolución de descarga** funciona desde las tarjetas, el editor, Mis vídeos y el ZIP. La vista individual muestra las dimensiones reales antes y después del cambio. 720p, 1080p y 4K conservan la proporción vertical u horizontal. El nombre añade la resolución; los ajustes de generación del manifiesto permanecen separados de los datos de descarga. Si el archivo ya tiene las dimensiones solicitadas, se entrega sin recomprimir.

El escalado usa Lanczos con H.264 CRF 18 y preset `veryfast`. Se ejecuta en este dispositivo, sin enviar los vídeos a un servicio ni consumir cuota de Google. Conserva el audio por copia, la duración y la velocidad de los clips individuales. Es interpolación, no restauración con IA: aumenta la resolución sin recuperar detalle perdido. 1080p ofrece un equilibrio práctico; 4K puede tardar varios minutos y consumir mucha memoria. El motor se carga bajo demanda, muestra progreso y permite cancelar; mantén la pestaña abierta. Los ZIP procesan un clip cada vez. El escalado individual rechaza fuentes de más de 512 MB y salidas de más de 8,3 megapíxeles; la descarga Original conserva el archivo sin ese procesamiento. Las secuencias se codifican directamente en la resolución elegida, con audio normalizado y 24 fps.

La alternativa de restauración [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) requiere otro entorno de ejecución (Python, un binario nativo o un servicio externo); no se incluye en el despliegue estático. [ffmpeg.wasm es más lento que FFmpeg nativo](https://ffmpegwasm.netlify.app/docs/faq/), por lo que para trabajo largo en 4K conviene el editor local.

## Comparar y revisar

Selecciona exactamente dos clips con vídeo y pulsa **Comparar 2 clips**. Ambos comparten reproducción y desplazamiento; puedes escuchar uno a la vez y marcar el favorito sin salir. Si las duraciones difieren, el más corto conserva su último fotograma mientras continúa el otro.

## Editor de secuencia

**Montar secuencia** abre un editor con biblioteca, previsualización y línea de tiempo. Añade vídeos con **+** o arrástralos desde la biblioteca; puedes usar un mismo vídeo varias veces. Arrastra las tomas para ordenarlas, o usa **Antes / Después**. Recorta ambos bordes en la línea de tiempo o introduce los segundos de inicio y final. **Dividir aquí** corta en la posición del cursor; **Duplicar**, **Quitar**, **Deshacer** y **Rehacer** permiten probar montajes sin tocar los originales.

### Previsualización y atajos

El cursor, la regla y el control bajo la previsualización recorren la secuencia sin tener que exportarla. La reproducción pasa entre tomas y respeta sus recortes y volumen; el siguiente clip se precarga. **Espacio** reproduce/pausa, **← / →** avanzan un fotograma (24 fps), **Mayús + flecha** avanza un segundo y **S** divide. También puedes ajustar el zoom y elegir formato vertical u horizontal; las imágenes se encajan completas con bandas cuando su proporción difiere.

**Ampliar editor** aprovecha la ventana completa y se cierra con **Esc**. La línea de tiempo muestra miniaturas representativas del vídeo, reutilizadas entre tomas y cargadas al acercarse a la zona visible. Una marca indica el punto de inserción al arrastrar: suelta en la mitad izquierda o derecha de una toma para colocar el clip antes o después. Puedes previsualizar cada vídeo desde la biblioteca antes de añadirlo.

**Empezar aquí (I)** y **Terminar aquí (O)** recortan la toma seleccionada en la posición del cursor. Los botones de corte anterior/siguiente permiten revisar las uniones. **Repetir toma seleccionada** reproduce en bucle esa toma para afinarla; es un control de revisión y no añade repeticiones a la exportación. Seleccionar la toma que ya estás viendo conserva el cursor. Un arrastre del volumen se deshace en un único paso. El botón de teclado muestra los atajos. En móvil, la línea de tiempo sigue a la previsualización y los paneles **Clips del proyecto / Ajustar toma** comparten el espacio inferior.

Los cambios se guardan automáticamente en este navegador, incluyendo recortes, repeticiones, audio y versión de origen. **Exportar vídeo** aplica esos mismos ajustes al MP4, incluso con una sola toma recortada. Los proyectos anteriores conservan su orden al abrirse. Es un montaje de una pista con cortes directos; las transiciones, los títulos y las pistas de música independientes quedan para el editor local.

## Generar, editar y extender

En el modal, escribe el prompt y ajusta la salida; las referencias son opcionales y se despliegan cuando las necesitas. Las instrucciones de edición y extensión también se guardan. Puedes preparar otro clip mientras se genera uno y volver desde Ajustes al clip abierto. En móvil, alterna entre **Configurar** y **Vista previa**. En la biblioteca puedes ordenar, filtrar los clips **Por revisar** y recuperar resultados pendientes directamente.

**Cantidad de clips** indica cuántos vídeos crear. Cada resultado aparece en una tarjeta independiente, listo para seleccionar, descargar, eliminar o añadir al montaje. Al aceptarlos, el modal se cierra y la biblioteca muestra el estado de Google y los clips pendientes. Cada solicitud conserva el prompt, los ajustes y las referencias enviados aunque después cambies el borrador.

**Editar** crea un clip nuevo con los cambios; **Extender** crea otro que incluye el vídeo original y 10 segundos de continuación. El clip de origen se conserva y los resultados tienen un enlace **Ver origen**. Si solicitas varios, todos parten de la misma toma seleccionada. Puedes extender de nuevo el resultado cuando quieras continuar desde él.

Los resultados guardados con el flujo anterior siguen disponibles en **Resultados anteriores**. **Separar en clips** conserva la toma activa en su tarjeta y convierte las demás en clips independientes, sin volver a generar ni perder archivos.

## Cola, pausa y recuperación

La cola produce hasta **3 vídeos a la vez** por defecto, tanto clips independientes como escenas de Historia. En **Ajustes → Generación en paralelo → Vídeos simultáneos** puedes elegir de 1 a 4; se guarda automáticamente. Aumentarlo aprovecha los espacios disponibles; reducirlo deja terminar las solicitudes activas antes de enviar otras. Los clips mantienen su lugar en la historia aunque terminen en distinto orden. Las solicitudes antiguas agrupadas sobre una misma escena siguen ejecutándose una tras otra.

**Ver actividad** muestra cada vídeo activo con su propio estado y las solicitudes pendientes. La flecha adelanta un clip al próximo espacio disponible; puedes cancelar una solicitud o los pendientes de una tanda completa. Las prioridades y cancelaciones se conservan al recargar. Cancelar pendientes no interrumpe las solicitudes activas.

**Pausar seguimiento** detiene el seguimiento local de todos los vídeos activos y la cola, sin cancelar las operaciones que Google ya recibió. Mantén la pestaña abierta para que siga avanzando. Tras recargar, lo pendiente se conserva pausado: usa **Recuperar resultado**, **Recuperar N resultados** desde Actividad, o **Continuar cola** para lo que aún no se envió. La recuperación consulta los identificadores guardados; no crea vídeos nuevos para esas operaciones.

Un error pausa los nuevos envíos; los demás vídeos ya iniciados siguen hasta guardar sus resultados o su propio error. Si Google responde con **429 / límite de cuota**, el estudio también reduce el paralelismo a 1, conservando ese ajuste. Puedes continuar cuando la cuota lo permita. No se reintenta automáticamente la solicitud fallida. Los [límites de Google](https://ai.google.dev/gemini-api/docs/rate-limits) dependen del proyecto y la cuenta; aumentar el paralelismo no los amplía ni garantiza una aceleración concreta.

**Reintentar clip** utiliza la solicitud guardada en esa misma tarjeta, incluyendo el vídeo base de una edición o extensión. Si varios vídeos terminan cuando ya no hay espacio para guardarlos, cada uno conserva su botón de descarga en el aviso: descárgalos antes de cerrar la pestaña.

## Referencias y generación

En **Ajustes**, guarda tu clave personal antes de generar. **Comprobar conexión** consulta el catálogo; no garantiza acceso a cada modelo. La generación depende de los permisos y cuota de tu cuenta.

En el modal de un clip, despliega las referencias. **Fotograma inicial** indica cómo empieza; **Fotograma final** requiere uno inicial. Las guías de personaje, objeto o estilo orientan la apariencia y no son una secuencia de fotogramas. Omni permite hasta tres guías en esta interfaz. El selector ofrece búsqueda, previsualización ampliada, carga por botón o arrastre y confirmación explícita. Cancelar conserva la selección anterior. Las imágenes subidas permanecen en la biblioteca para reutilizarlas.

Los originales se conservan. Al enviar una generación, el navegador prepara copias JPEG con fondo blanco para transparencias, hasta 2048 píxeles por lado y hasta 4 MB por copia. Si una referencia no se puede preparar, vuelve a subirla como JPG o PNG.

Consulta [problemas frecuentes](troubleshooting.md) para recuperar resultados y [privacidad](privacy.md) antes de compartir un ZIP con prompts.

## Referencias y vídeos desde la navegación

**Referencias** reúne las imágenes guardadas. Puedes buscar, subir archivos, descargar una imagen o generar una referencia nueva mediante Google. Generar una imagen necesita una clave y consume la cuota de esa cuenta. Eliminar una referencia la quita también de los borradores de escenas que la usan; revisa la confirmación antes de hacerlo. Las solicitudes que ya estaban capturadas en la cola conservan su entrada.

**Mis vídeos** reúne los clips disponibles de los proyectos, excluyendo los descartados. Permite buscar, descargar y abrir el proyecto de origen. No es una copia remota ni añade un segundo archivo del vídeo.

## Ajustes y conservación del trabajo

En **Ajustes** puedes guardar la clave, comprobar la conexión y elegir valores predeterminados para las generaciones nuevas. Usa **Eliminar clave guardada** para retirarla del navegador cuando no haya una generación activa. Esa acción no revoca la clave en Google ni elimina tus proyectos.

Las descargas guardan los archivos fuera de la aplicación. La papelera conserva los clips hasta que se elimine su proyecto. Para conocer el efecto de cambiar de dominio, borrar almacenamiento o compartir metadatos, consulta [privacidad](privacy.md).
