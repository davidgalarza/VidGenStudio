# Desarrollo y pruebas

[Documentación](README.md) · [Contribuir](../CONTRIBUTING.md)

## Entorno

Usa Node.js 22.12+ y `npm ci` para instalar las versiones de `package-lock.json`. No se necesita una clave para compilar, ejecutar pruebas unitarias o ejecutar los escenarios de navegador simulados. `private: true` en `package.json` impide publicar por accidente el paquete en npm; no impide que el repositorio sea open source.

## Comandos

| Comando            | Uso                                                         |
| ------------------ | ----------------------------------------------------------- |
| `npm run dev`      | Servidor Vite con actualización de cambios                  |
| `npm run build`    | Comprobación TypeScript y compilación en `dist`             |
| `npm run preview`  | Servir la compilación local                                 |
| `npm test`         | Pruebas Vitest                                              |
| `npm run lint`     | ESLint para TypeScript, React y hooks                       |
| `npm run test:e2e` | Playwright contra un servidor ya iniciado                   |
| `npm run format`   | Formatear los directorios y archivos incluidos en el script |

Para documentación anidada, usa explícitamente `npx prettier --write docs/*.md .github/**/*.md`. Para cambios pequeños, formatea solo los archivos modificados y evita ruido en el diff.

## Pruebas unitarias

```bash
npm test
```

Los archivos de `tests` cubren contratos y errores de Google, datos persistidos con `fake-indexeddb`, nombres/ZIP, dimensiones de descarga y cálculo de recortes. No certifican disponibilidad de modelos, costes ni permisos reales de una cuenta.

`tests/storyDialogue.test.ts` comprueba monólogos y etiquetas de hablantes, conservación de palabras al repartir tomas, planos compartidos y alternados, límites temporales, invalidación del diálogo al editar el texto libre, cobertura de rangos del planificador, asignaciones de personajes, referencias de escenarios, persistencia y comparación de transcripciones. La duración del habla es una estimación: estas pruebas no verifican pronunciación, sincronización labial ni consistencia de voces de vídeos reales.

## Pruebas de navegador

En macOS se usa Google Chrome si está instalado en su ruta habitual. En otros entornos, instala Chromium:

```bash
npx playwright install chromium
```

En Linux puede ser necesario `npx playwright install --with-deps chromium`. También se puede indicar un ejecutable con `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Primera terminal:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Segunda terminal, en macOS/Linux:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

En PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:4173"
npm run test:e2e
```

Playwright no inicia automáticamente un servidor. Sin la variable anterior usa `http://127.0.0.1:5173`; comprueba el puerto para no probar una compilación antigua. No reconstruyas `dist` mientras se ejecutan las pruebas contra preview, porque cambiarían las URL de los módulos.

Las pruebas crean datos sintéticos en contextos aislados e interceptan las solicitudes de generación a Google. `e2e/story.spec.ts` comprueba propuesta editable, conservación del guion, referencias, pausa y recuperación sin repetir audio guardado, diálogo y exportación con narración. Los mocks de Gemini TTS generan PCM de un tono sintético; no son voces personales. Los escenarios de exportación ejecutan FFmpeg real y comprueban MP4/ZIP, dimensiones, audio y duración. No uses tu perfil personal del navegador para sembrar estos datos.

`e2e/dialogue.spec.ts` cubre una conversación pegada como texto libre, escenas con varios hablantes, escenarios reutilizables, edición de intervenciones, reparto en tomas, regeneración individual, conservación de versiones y revisión opcional del diálogo. También comprueba que un monólogo no exige configurar previamente personajes y que la galería de estilos se puede usar con teclado. Tanto la planificación como las imágenes, el vídeo y la revisión de Gemini usan respuestas simuladas; las muestras visuales del selector son el atlas local descrito en [procedencia de recursos](../src/assets/README.md).

Para ejecutar solo el área modificada:

```bash
npm run test:e2e -- --grep "timeline|refined montage"
```

`artifacts`, `test-results` y `playwright-report` están excluidos de Git. Las trazas de fallos pueden abrirse con `npx playwright show-trace RUTA_AL_TRACE.zip`; no compartas trazas de sesiones reales sin revisar su contenido.

## Cambios que necesitan atención especial

- Persistencia: mantener lectura de proyectos anteriores, blobs y posiciones restauradas desde la papelera.
- Historia: conservar el texto de origen, validar los rangos de escenas e intervenciones y mantener separados diálogo e indicaciones visuales. Los campos nuevos son opcionales para leer historias anteriores. No confundir una escena narrativa con un clip generado.
- Revisión de diálogo: mantenerla explícita y acotada a una toma; no reutilizar una revisión al cambiar de versión, ni convertir una transcripción incierta en una aprobación o un reintento de pago.
- Cola: guardar antes de cerrar el modal; distinguir pausa, recuperación y reintento; no repetir un POST facturable automáticamente.
- Montaje: conservar las fuentes, la duración real y la correspondencia entre previsualización y exportación.
- Interfaz: conservar el uso general, español, accesibilidad, teclado y controles móviles; consultar `DESIGN.md`.
- Archivos y URLs: validar tipos, tamaños y dominios; revocar object URLs y limpiar workers al cancelar.
- Dependencias: actualizar lockfile y avisos de licencia cuando cambien los componentes distribuidos.

## Verificación antes de un PR

Ejecuta `npm test`, `npm run lint` y `npm run build`. Añade o ejecuta escenarios de navegador relevantes para cambios de comportamiento. Describe qué comprobaste y qué no; no sustituyas una comprobación real de Google por una afirmación basada en mocks.

Las instrucciones de este archivo son reproducibles localmente. No implican que exista una ejecución de CI configurada ni una matriz certificada de navegadores.
