# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Cambios del fork Vidgen Studio posteriores a la versión heredada. No representan una nueva release numerada publicada.

### Añadido

- Ampliación de la biblioteca con 24 estilos (doce por modo): ahora 58 distintos, 36 para voz en off y 32 para personajes hablando. Detalles con guía de uso, comparación de hasta tres estilos incluidos los personales, favoritos locales y búsqueda por técnica o uso sin tildes.
- Conversaciones con varios personajes dentro de una escena: intervenciones editables, interpretación, acciones, oyentes y tomas automáticas, compartidas o alternadas. La entrada sigue siendo texto libre.
- Escenarios vacíos generados con Nano Banana como referencias reutilizables.
- Biblioteca visual inicial de 34 estilos distintos: 24 para voz en off y 20 para personajes hablando, con búsqueda, filtros y seis controles por modo. Conservó los estilos anteriores y añadió 22 opciones antes de la ampliación descrita arriba.
- Estilos personales: crear, personalizar, guardar, clonar, editar y eliminar, con copias independientes en cada proyecto y referencias guardadas en una biblioteca local.
- Análisis explícito de hasta seis imágenes o vídeos con Gemini, propuesta revisable y aplicación manual; no adjunta automáticamente los archivos a las generaciones. Tres atlas ilustrativos con procedencia documentada.
- Revisión opcional del diálogo con Gemini: transcripción, comparación de palabras y hablantes y observaciones, sin regeneraciones automáticas.
- Generación paralela de clips e historias: 3 solicitudes simultáneas por defecto, ajuste de 1 a 4, progreso por escena, recuperación múltiple y reducción automática a 1 tras un límite de cuota.

- Revisión de descripciones con Gemini para generaciones bloqueadas por contenido: propuesta visible, alternativas señaladas, aplicación manual y reintento con el texto actualizado, sin regenerar la narración ni modificar referencias.
- Modo Historia: guiones completos, personajes hablados o Gemini TTS, estilos visuales, plan editable con Gemini y regeneración por escena.
- Narración persistida con tiempos reales, recortes vinculados, reproducción y exportación con voz, recuperación de preparación y descarga de materiales.

- Integración REST de Omni, edición/extensión como clips derivados, referencias normalizadas y recuperación de resultados.
- Biblioteca de clips, favoritos, descartados, comparación, reutilización y papelera restaurable.
- Cola persistida con múltiples salidas independientes, pausa, prioridades y cancelación de pendientes.
- Selector visual de referencias, carga por arrastre y previsualización.
- Descargas originales, ZIP con metadatos opcionales y escalado local a 720p/1080p/4K.
- Editor de secuencia no destructivo: recortes, divisiones, duplicados, audio, deshacer/rehacer y previsualización.
- Vista ampliada, miniaturas reutilizadas, recorte desde el cursor, bucle de revisión y paneles móviles.
- Pruebas de contratos, persistencia, línea de tiempo y navegador con exportaciones reales de medios sintéticos.
- Guías de uso, arquitectura, despliegue, privacidad, desarrollo, seguridad y publicación; plantillas de colaboración y resumen en inglés.

### Cambiado

- Abrir una muestra permite explorarla sin cambiar la selección; solo Usar aplica el estilo. La navegación restaura foco y desplazamiento. Cinco atlas WebP reducen el total de muestras de unos 15,7 MB a unos 2,4 MB; se conservan los PNG originales y los prompts.
- Historia comienza con modo y estilo explícitos, inicialmente voz en off y Realista. Los ajustes personalizados se conservan al cambiar de modo; los parámetros y la dirección personalizada tienen prioridad visual sobre la base. Los ajustes se propagan al plan, Nano Banana y los vídeos.
- Producción de Historia agrupada por escena narrativa, con correcciones por toma, versiones anteriores conservadas y actualización de referencias automáticas al cambiar de hablante.
- Historia empieza por el guion: Gemini completa una propuesta editable de escenas, reparto, voces y referencias de Nano Banana antes de producir.
- Gemini TTS sustituye ElevenLabs con la misma clave de Google; WAV con duración real y cortes por pausas, sin inventar tiempos por palabra. Los audios antiguos se conservan.
- Revisiones persistidas, edición de escenas y referencias, planificación por lotes y recuperación de trabajo guardado.

- Los proyectos nuevos empiezan vacíos y los clips se crean por acción del usuario.
- Interfaz en español y de uso general, sin plantillas ni posicionamiento exclusivo para redes sociales.
- Las solicitudes guardan su entrada antes de pasar a la cola; la recuperación no repite automáticamente una generación.
- Los montajes conservan versión de origen, recortes, volumen y ocurrencias repetidas, compatibles con el orden antiguo.

### Corregido

- El reparto de diálogo en tomas prioriza frases y cláusulas completas, evita colas de pocas palabras y no cuenta los fragmentos consecutivos del mismo hablante como pausas o cambios de turno. Repara divisiones automáticas de una misma frase entre escenas compatibles, sin modificar el guion ni los vídeos existentes.

- La propuesta ya no se detiene si Gemini nombra un lugar sin crear su referencia: vincula nombres equivalentes o prepara una ficha editable del escenario a partir de la descripción visual. Reutiliza referencias e imágenes entre lotes, conserva el guion y respeta la opción de generar imágenes.

- Los ajustes de estilo pendientes se pueden retomar después de cerrar el modal o alternar Escenas y Voz y estilo. Cancelar los descarta y Usar los aplica; el aviso aclara que recargar o salir de la vista pierde ese borrador en memoria.
- Los nombres de personaje en una línea separada se vinculan a sus palabras cuando Gemini los divide en intervenciones o escenas vacías. Se conserva el guion y el hablante al cruzar escenas y lotes, sin pedir otro plan por ese motivo.
- Validación de hablantes y rangos del guion, continuidad del personaje entre lotes y foco en la intervención concreta que necesita texto. Las etiquetas con negritas o guiones se pueden renombrar sin alterar las palabras pronunciadas.
- Reconocimiento de nombres de personaje en Historia y selectores sin asignaciones engañosas. Los errores identifican escenas concretas y permiten corregir nombres en grupo.

- Tratamiento de fallos terminales de archivos de Google y reintento explícito.
- Normalización de referencias y lectura de resultados con base64 o URI.
- Exportación con fuentes silenciosas, recortes de una sola toma y formatos mezclados.

## Historial heredado

Las notas siguientes se conservan del proyecto original como registro histórico. Sus rutas, dependencias y funciones describen aquel estado, no la implementación actual del fork.

## [1.0.0] - 2026-05-04

### Added

#### Core Architecture

- Browser-native application - runs entirely in the browser without backend
- IndexedDB storage layer via `idb` library for projects, scenes, and assets
- localStorage for user settings and API key management
- Direct Google GenAI SDK (`@google/genai`) integration for API calls

#### Video Features

- Video generation using Google Veo 3.1 (`veo-3.1-generate-preview`)
- Frame-to-frame continuity with first frame image support
- In-browser video stitching via ffmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`)
- Video export with scene concatenation
- Real-time generation progress tracking

#### Image Features

- AI image generation using Gemini (`gemini-3.1-flash-image-preview`)
- Asset upload and management (Character, Product, Style types)
- Project asset linking/unlinking

#### UI/UX

- React 19 + TypeScript 5 + Vite build system
- Tailwind CSS v4 with dark theme
- Responsive sidebar navigation
- Project dashboard with "Active Flows" management
- Scene-based storyboard interface
- Asset library with upload and generation
- Settings panel with API key configuration and testing
- Usage tracking dashboard (tokens, cost estimation)
- Notification system for user feedback

#### Documentation

- MIT License (Copyright 2026 Rajjit Laishram)
- Comprehensive README with setup instructions
- Contributing guidelines
- This changelog

### Dependencies

#### Production

- `@ffmpeg/ffmpeg@^0.12.15` - WebAssembly video processing
- `@ffmpeg/util@^0.12.2` - FFmpeg utilities
- `@google/genai@^0.8.0` - Google AI SDK
- `@tailwindcss/vite@^4.2.4` - Tailwind Vite plugin
- `axios@^1.15.2` - HTTP client (for API fallback)
- `idb@^8.0.2` - IndexedDB wrapper
- `lucide-react@^0.468.0` - Icon library
- `react@^19.2.5` - UI library
- `react-dom@^19.2.5` - React DOM
- `react-router-dom@^7.14.2` - Routing
- `tailwindcss@^4.2.4` - CSS framework

#### Development

- `@eslint/js@^10.0.1` - ESLint core
- `@types/node@^24.12.2` - Node.js types
- `@types/react@^19.2.14` - React types
- `@types/react-dom@^19.2.3` - React DOM types
- `@vitejs/plugin-react@^6.0.1` - Vite React plugin
- `eslint@^10.2.1` - Linter
- `eslint-plugin-react-hooks@^7.1.1` - React Hooks lint rules
- `eslint-plugin-react-refresh@^0.5.2` - React Refresh lint rules
- `globals@^17.5.0` - Global variables
- `typescript@~6.0.2` - TypeScript compiler
- `typescript-eslint@^8.58.2` - TypeScript ESLint
- `vite@^8.0.10` - Build tool

### Changed

- Migrated from Python/FastAPI backend to pure browser-based application
- Moved all source code from `frontend/` directory to project root
- Updated all documentation for new architecture
- Replaced server-side SQLite with client-side IndexedDB
- Replaced Python FFmpeg with ffmpeg.wasm

### Removed

- Python backend (FastAPI, SQLAlchemy, SQLite, python-multipart)
- Server-side video processing pipeline
- Environment file configuration (`.env`, `.env.example`)
- Google Cloud Storage dependency
- Backend `data/` directory and file storage
- `backend/` directory entirely
- `Plan.md` (old Python architecture documentation)
- `MIGRATION.md` (temporary migration guide)

---

## Pre-1.0 History

### Python Backend Era (Archived)

The project originally used a Python/FastAPI backend with:

- FastAPI + SQLAlchemy + SQLite
- Server-side video processing
- Google Cloud Storage for assets
- Python FFmpeg for video stitching

This architecture was completely replaced in v1.0.0 with the current browser-native approach.
