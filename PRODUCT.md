# Vidgen Studio

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People creating and editing videos of any kind. The interface uses Spanish, with no templates or positioning around a specific use case.

## Product Purpose

Plan scenes, turn a script into an editable story, generate video through a personal Google API key, iterate on clips and download a finished sequence.

## Capabilities and Constraints

Fork of rajjitlai/Video_Orchestrator under MIT. React, TypeScript and Vite; browser-local IndexedDB; static deployment on Vercel. Integrate Gemini Omni 1.1 Flash directly through Google's Interactions API and retain Veo support. No credentials bundled into the deployment. Existing projects must remain readable.

Historia uses the same personal Google connection for Gemini planning, Nano Banana reference images and Gemini TTS narration. Model access and quota depend on that connection. Voice-over uses a selected Gemini TTS voice; character dialogue is generated with the video and requires review for delivery and voice consistency. Long scripts become editable scenes and clips within the selected video model's duration limits. Narration timing uses the actual audio duration, without claiming word-level timestamps.

## Operating Context

Primary workflow: project clip libraries, individual editing, reusable image references and multiple versions. Users can download selected original clips in ZIP for a local editor, or explicitly assemble an optional sequence with its own saved order. Requests that consume Google quota follow an explicit action with its scope visible. Downloads and local data are not synchronized across devices.

Historia starts with a script; narration mode, visual style and direction are optional inputs. Creating a proposal asks Gemini to organize the original text and suggest scenes, characters, voices and visual references. Reference image generation can be included in this step. The proposal remains editable before the separate production action creates narration and videos: users can revise text and visuals, reorder or split scenes, adjust the cast, select or regenerate references, and choose voice and output settings.

Input and proposal drafts survive navigation and reload in the current browser session; explicitly saved plans and completed assets persist with the local project. Interrupted work resumes from saved progress, with existing material preserved. Production continues while the user changes views within the open app. Regenerating a visual take retains its existing narration, and the resulting clips remain available in the library and editable montage. The interface distinguishes local drafts, saved plans, active work and recoverable errors.

## Product Principles

- Make the next action and the current generation state visible.
- Preserve completed clips when a new attempt fails.
- Keep a predictable, familiar video editing workspace.
- Show actual status and usage; do not invent billing estimates.

## Evidence on Hand

Original source, Google's public API documentation, browser workflow tests and real FFmpeg exports. Recovery of an existing Omni result was verified using the user's configured connection without submitting another generation. Automated generation tests use simulated responses and do not establish model availability or billing behavior.
