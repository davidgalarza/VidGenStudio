# Vidgen Studio

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas que crean y editan vídeos de cualquier tipo. La interfaz está en español, sin plantillas ni posicionamiento para un uso específico.

## Product Purpose

Planificar escenas, convertir un guion en una historia editable, generar vídeo con una clave personal de Google, iterar sobre clips y descargar una secuencia terminada.

## Capabilities and Constraints

Fork de rajjitlai/Video_Orchestrator con licencia MIT. React, TypeScript y Vite; IndexedDB local al navegador; despliegue estático en Vercel. Integración directa de Gemini Omni 1.1 Flash mediante Interactions de Google, conservando soporte para Veo. El despliegue no incluye credenciales. Los proyectos existentes deben seguir siendo legibles.

Historia utiliza la misma conexión personal de Google para planificar con Gemini, crear referencias con Nano Banana y narrar con Gemini TTS. El acceso a modelos y la cuota dependen de esa conexión. La voz en off utiliza una voz seleccionada de Gemini TTS; el diálogo de personajes se genera con el vídeo y requiere revisión de las palabras, la interpretación y la consistencia de voces. Los guiones largos se convierten en escenas y tomas editables dentro de los límites del modelo de vídeo. Los tiempos de narración se basan en la duración real del audio, sin afirmar que existen marcas por palabra.

Las conversaciones pueden reunir varios hablantes y oyentes en una escena narrativa. Las intervenciones separan las palabras de la interpretación y la acción; el sistema las reparte en tomas automáticas, compartidas o alternadas. Las referencias de escenarios vacíos se reutilizan para orientar la continuidad del lugar. Las doce muestras de estilo facilitan la elección visual: son ilustraciones, no plantillas ni referencias adjuntadas automáticamente a Google. No se promete identidad de voz fija, pronunciación literal ni escenografía idéntica.

## Operating Context

Dos tipos explícitos de proyecto: Clips abre una biblioteca; Historia abre su guion, propuesta o etapa de producción guardada. La creación comienza vacía, sin llamadas al proveedor. Los proyectos anteriores con una historia guardada o un borrador inicial de sesión no vacío se abren como Historia; todos sus clips, versiones, referencias y datos de montaje siguen accesibles. La pantalla inicial permite filtrar por tipo.

Flujo de Clips: bibliotecas por proyecto, edición individual, referencias reutilizables y múltiples versiones. Se pueden descargar originales seleccionados en ZIP para un editor local o montar explícitamente una secuencia opcional con su propio orden guardado. Las solicitudes que consumen cuota de Google siguen una acción explícita con alcance visible. Las descargas y los datos locales no se sincronizan entre dispositivos.

Historia tiene vistas dedicadas de Guion y escenas, Materiales y Montaje. Materiales reutiliza la biblioteca completa, incluidos los clips independientes anteriores. La producción agrupa las tomas por escena narrativa y permite búsqueda y filtros de estado, conservando el orden del guion y las ediciones pendientes al alternar vistas. Montaje vuelve a su vista de entrada después de guardar.

Historia empieza solo con las palabras que se escucharán. Un monólogo no necesita personajes configurados; una conversación identifica en el texto quién dice cada parte; en voz en off el texto se lee como narración literal. El modo, el estilo y la dirección son indicaciones opcionales. Crear propuesta pide a Gemini organizar el texto original y proponer escenas, reparto, voces, acciones, lugares y referencias visuales. La generación de referencias puede incluirse en esta etapa. La propuesta permanece editable antes de producir: se pueden revisar palabras e imágenes, reordenar, dividir o unir escenas, ajustar intervenciones y participantes, seleccionar o regenerar referencias y cambiar voz y ajustes de salida.

Los borradores iniciales y de propuesta sobreviven a la navegación y la recarga durante la sesión del navegador; los planes guardados explícitamente y los medios terminados persisten con el proyecto local. El trabajo interrumpido continúa desde el avance guardado y conserva el material existente. La producción sigue al cambiar de vista dentro de la aplicación abierta. Regenerar una toma visual conserva su narración en voz en off; en diálogo se regenera la toma concreta y se conservan las versiones anteriores. Los clips siguen disponibles en la biblioteca y el montaje editable. La interfaz distingue borradores locales, planes guardados, trabajo activo y errores recuperables.

Revisar diálogo es una acción opcional y explícita sobre una toma terminada de hasta 14 MB. Envía vídeo y descripciones del reparto a Gemini, consume cuota y compara localmente la transcripción con el texto previsto. Puede equivocarse, no cambia ni regenera contenido automáticamente y su resultado es temporal, no persistido.

## Product Principles

- Hacer visibles la siguiente acción y el estado de generación.
- Conservar los clips terminados si falla un nuevo intento.
- Mantener un espacio de edición de vídeo predecible y familiar.
- Empezar por el guion, automatizar el plan y permitir corregirlo antes de producir.
- Mostrar el estado y uso reales; no inventar estimaciones de facturación.

## Evidence on Hand

Código original, documentación pública de Google, pruebas de flujos de navegador y exportaciones reales de FFmpeg. En trabajo anterior se comprobó la recuperación de un resultado Omni existente con la conexión configurada por el usuario, sin solicitar otra generación. Las pruebas automáticas de generación y revisión de diálogo usan respuestas simuladas: no acreditan disponibilidad de modelos, precisión audiovisual, consistencia de voces ni comportamiento de facturación real.
