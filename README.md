# Vidgen Studio

**Genera clips, organízalos y monta una secuencia desde el navegador.**

Editor de vídeo de uso general con interfaz en español, React, TypeScript y Vite. Cada persona utiliza su propia API key de Google. Los proyectos y los vídeos se guardan localmente; el montaje y la exportación se procesan en tu dispositivo.

Este proyecto es un fork independiente de [Video Orchestrator, de Rajjit Laishram](https://github.com/rajjitlai/Video_Orchestrator). Conserva su licencia y atribución. No es un producto oficial de Google.

[English overview](README.en.md) · [Guía de uso](docs/usage.md) · [Despliegue](docs/deployment.md) · [Contribuir](CONTRIBUTING.md) · [Problemas frecuentes](docs/troubleshooting.md)

## Qué incluye

- **Modo Historia:** pega un guion y Gemini propone escenas, personajes, voces y referencias con Nano Banana. Revisa el plan y produce vídeos con diálogo o voz en off de Gemini TTS, usando una sola clave de Google. [Cómo funciona](docs/story.md).
- **Proyectos vacíos:** crea clips cuando los necesites, sin plantillas ni tomas automáticas.
- **Generación con Google:** integración con Gemini Omni 1.1 Flash y Veo 3.1, referencias visuales y generación de imágenes de referencia.
- **Cola paralela persistente:** hasta 3 vídeos a la vez por defecto (ajustable de 1 a 4), tandas de 1 a 20 clips independientes y recuperación múltiple tras recargar.
- **Biblioteca de clips:** búsqueda, filtros, favoritos, descartados, papelera, comparación y reutilización de ajustes.
- **Edición y extensión con Omni:** crea clips derivados y conserva el original.
- **Editor de secuencia:** arrastra, ordena, recorta ambos extremos, divide, duplica, ajusta audio, deshaz y previsualiza el resultado.
- **Revisión precisa:** vista ampliada, miniaturas, bucle de una toma, navegación entre cortes y atajos de teclado.
- **Descargas:** originales, ZIP con metadatos opcionales y MP4 del montaje; resoluciones de descarga de 720p, 1080p y 4K mediante escalado local.

## Empezar en local

Requiere **Node.js 22.12 o posterior** y npm. Un navegador de escritorio Chromium reciente es la referencia de las pruebas automatizadas.

```bash
git clone https://github.com/davidgalarza/VidGenStudio.git
cd VidGenStudio
npm ci
npm run dev
```

Abre la dirección que muestra Vite, normalmente [localhost:5173](http://localhost:5173). Crea un proyecto y pulsa **Nuevo clip**. Para generar, introduce tu clave personal en **Ajustes**.

No necesitas `.env`, una cuenta de servicio, una base de datos externa ni un backend. **No incluyas una API key en el repositorio ni en variables `VITE_*` del despliegue.**

El acceso a los modelos y sus costes dependen de Google y de tu cuenta. Una clave válida no garantiza permisos o cuota para un modelo. Los identificadores y restricciones implementados están documentados en [integración con Google](docs/google-api.md); las pruebas simuladas no certifican disponibilidad real del servicio.

## Desplegar en Vercel

Importa tu fork, selecciona **Vite**, usa `npm run build` y publica `dist`. El archivo [vercel.json](vercel.json) incluye los encabezados que necesita el motor de vídeo. Cada usuario introduce su propia clave después de abrir la aplicación.

Consulta la [guía de despliegue](docs/deployment.md) para instalación, comprobaciones y otros alojamientos estáticos.

## Qué debes saber

- **Almacenamiento local:** no hay sincronización, cuentas ni copia de seguridad de proyectos. Cambiar de navegador, dominio o puerto cambia el almacenamiento accesible. Descargar un ZIP no crea un proyecto reimportable.
- **Generación remota:** los prompts y referencias enviados se procesan en Google. Pausar el seguimiento no cancela necesariamente su procesamiento o facturación.
- **Montaje de una pista:** cortes directos, sin títulos, transiciones ni pistas de música independientes. No incluye importación general de vídeos externos como clips.
- **Escalado convencional:** Lanczos aumenta las dimensiones; no reconstruye detalle mediante IA.
- **Recursos del dispositivo:** la exportación necesita memoria, CPU y aislamiento entre orígenes. Mantén abierta la pestaña. Para montajes grandes, descarga los originales y usa un editor local.

Más detalles en [privacidad y datos](docs/privacy.md) y [problemas frecuentes](docs/troubleshooting.md).

## Documentación

| Necesito…                              | Guía                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Usar clips, referencias, cola y editor | [Guía de uso](docs/usage.md)                                             |
| Instalar o desplegar                   | [Despliegue](docs/deployment.md)                                         |
| Entender los modelos y la recuperación | [API de Google](docs/google-api.md)                                      |
| Saber qué se almacena o transmite      | [Privacidad](docs/privacy.md)                                            |
| Modificar el código                    | [Arquitectura](docs/architecture.md) y [desarrollo](docs/development.md) |
| Reportar un fallo o colaborar          | [Contribución](CONTRIBUTING.md) y [seguridad](SECURITY.md)               |
| Preparar una publicación               | [Guía de publicación](docs/releasing.md) y [cambios](CHANGELOG.md)       |

## Validación

```bash
npm test
npm run lint
npm run build
```

Las pruebas de navegador usan respuestas de Google simuladas y vídeos sintéticos; la exportación ejecuta FFmpeg real. Para ejecutarlas, sigue [desarrollo y pruebas](docs/development.md). No requieren claves reales.

## Licencia y créditos

El código de la aplicación conserva la [licencia MIT original](LICENSE), con copyright de Rajjit Laishram. Las mejoras de este fork se registran en [CHANGELOG.md](CHANGELOG.md) y en el historial de Git.

El núcleo FFmpeg distribuido con la aplicación tiene licencia **GPL-2.0-or-later**, independiente de la licencia declarada para el código de la aplicación. Consulta [avisos de terceros](THIRD_PARTY_NOTICES.md), el [texto incluido](public/licenses/FFmpeg-GPL-2.0.txt) y la documentación de sus componentes antes de redistribuir binarios.
