# tiny-synth

A tiny, headless Web Audio synthesizer. The repository preview is developed alongside the library and imports the actual source modules.

## Run locally

Serve the repository root using any static HTTP server.

No Node.js, npm, bundler, or build step is required. The browser loads native JavaScript ES modules directly. Serve over HTTP(S); opening `index.html` through `file://` will generally prevent module loading.

## Design boundaries

`src/` contains audio behavior only. `preview/` owns browser UI, controls, examples, and host-side routing. MIDI, sequencing, effects, and application-level mixing remain host responsibilities.
