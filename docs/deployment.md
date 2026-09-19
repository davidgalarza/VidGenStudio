# Instalación y despliegue

[Documentación](README.md)

## Requisitos

- Node.js 22.12+ y npm. `package.json` declara un mínimo más amplio; utiliza 22.12+ para cumplir también el requisito de la versión de Vite resuelta en el lockfile.
- Navegador moderno con IndexedDB, reproducción MP4/H.264, Canvas y WebAssembly. Las pruebas automatizadas usan Chromium; no se certifica equivalencia en todos los navegadores móviles.
- HTTPS en producción, o localhost para desarrollo.
- Una clave personal de Google con los permisos necesarios solo si vas a generar contenido. El montaje y la descarga de vídeos ya guardados no necesitan una nueva generación.

## Desarrollo local

```bash
git clone https://github.com/davidgalarza/VidGenStudio.git
cd VidGenStudio
npm ci
npm run dev
```

Vite utiliza el puerto 5173 por defecto y puede elegir otro si está ocupado. Usa la dirección que imprima. Para fijarlo y evitar confundir almacenamientos:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

`localhost` y `127.0.0.1` son orígenes distintos. Conserva la misma dirección cuando quieras acceder a tus proyectos locales.

## Comprobar la compilación de producción

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Abre [127.0.0.1:4173](http://127.0.0.1:4173). Es otro origen: no verá los proyectos guardados en el puerto 5173. `preview` sirve para comprobar el resultado localmente, no sustituye al alojamiento de producción.

## Vercel

1. Crea tu fork en GitHub e impórtalo como proyecto en Vercel.
2. Mantén la raíz del repositorio como directorio de trabajo.
3. Selecciona Vite; instalación `npm ci`, build `npm run build`, salida `dist`.
4. Elige una versión de Node compatible con los requisitos anteriores.
5. Conserva `vercel.json` y despliega.
6. Abre la aplicación, crea un proyecto vacío y guarda tu clave dentro de Ajustes si vas a generar.

La detección de proyectos Vite está descrita en la [documentación oficial de Vercel](https://vercel.com/docs/frameworks/frontend/vite). Este repositorio proporciona su propia configuración de build y encabezados.

No hacen falta variables de entorno. Las variables `VITE_*` son configuración pública del frontend; nunca las uses para una clave de generación compartida. El alojamiento sirve los archivos y Google recibe las solicitudes directamente desde el navegador. No hay funciones serverless de generación en este proyecto.

## Otros alojamientos estáticos

Publica todo `dist`, incluyendo `assets` y `licenses`. El enrutamiento usa el fragmento `#`; no necesita reescribir rutas de proyectos en el servidor. Configura los encabezados que contiene `vercel.json`:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Los archivos con hash bajo `assets` admiten caché inmutable; evita aplicar esa política al HTML. Sirve el archivo `.wasm` con un tipo de contenido adecuado, como `application/wasm`, y conserva sus URL generadas por Vite.

El motor comprueba `crossOriginIsolated` antes de procesar vídeo. Que el sitio cargue no demuestra que sus encabezados permitan exportar. En DevTools, verifica `window.crossOriginIsolated === true` y prueba una exportación pequeña. Una incrustación en un iframe o un proxy que elimine encabezados puede impedirlo.

## Comprobación después del despliegue

- Un proyecto nuevo empieza sin clips.
- Recargar conserva los datos de ese origen.
- No hay claves dentro de los archivos publicados.
- El motor de vídeo y su `.wasm` se sirven desde el mismo despliegue.
- Una exportación de prueba produce un MP4 reproducible con los recortes esperados.
- Una prueba real de generación, si se decide hacerla, utiliza la cuenta del mantenedor con conocimiento de su posible coste.

Al cambiar de dominio, descarga primero el material importante: no hay migración automática entre orígenes ni importación de copias completas de proyectos.
