# Vidgen Studio

A general-purpose, browser-based video generation and sequence editor. The interface is in Spanish. Built with React, TypeScript and Vite; projects and media are stored locally in IndexedDB.

This is an independent fork of [Video Orchestrator by Rajjit Laishram](https://github.com/rajjitlai/Video_Orchestrator). It preserves the original attribution and MIT license. It is not an official Google product.

[Español](README.md) · [Documentation index](docs/README.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Features

- **Story mode:** paste a script and let Gemini propose scenes, cast, voices and Nano Banana references. Review everything before producing character dialogue or Gemini TTS voiceover with one Google key, timed montage and per-scene regeneration. See the [Story guide](docs/story.md).

- Empty projects with user-created clips, search, favorites, trash and comparison.
- Google video generation using a personal API key, visual references and a persistent queue.
- Independent outputs for batch requests; derived edit/extension clips preserve their sources.
- A single-track editor with ordering, trims, split, duplicate, volume, undo/redo and live preview.
- Focus view, representative filmstrip thumbnails, review loops and keyboard shortcuts.
- Original downloads, ZIP archives with optional metadata, and local MP4 sequence export.
- Optional 720p, 1080p and 4K download scaling using Lanczos, not AI detail reconstruction.

## Run locally

Use Node.js 22.12+ and npm:

```bash
git clone https://github.com/davidgalarza/VidGenStudio.git
cd VidGenStudio
npm ci
npm run dev
```

Open the URL printed by Vite. Add your personal Google key in **Ajustes** only when you want to generate media. There is no backend, service account or required `.env` file. Never put shared credentials in the frontend or `VITE_*` variables.

For Vercel, import the fork as a Vite project, build with `npm run build` and publish `dist`. Keep the headers from `vercel.json`; local processing requires cross-origin isolation.

## Practical limits

Model access, quota and charges depend on Google and your account. Mocked generation tests do not establish real API availability. The code's contracts are documented in [Google integration](docs/google-api.md).

Data is local to a browser origin, with no cloud sync or full-project backup/import. Keep the tab open for work to continue. Pausing local polling does not necessarily cancel remote generation. The editor has one track and direct cuts; it does not include transitions, titles, separate music tracks or general external-video import. Large exports may exceed device memory.

The detailed [usage](docs/usage.md), [deployment](docs/deployment.md), [architecture](docs/architecture.md), [development](docs/development.md), [privacy](docs/privacy.md) and [troubleshooting](docs/troubleshooting.md) guides are currently in Spanish.

## License

Application code retains the [MIT license](LICENSE). The bundled FFmpeg core is GPL-2.0-or-later and has separate redistribution terms; read [third-party notices](THIRD_PARTY_NOTICES.md). The application's MIT label does not replace the licenses of distributed dependencies.
