# tiny-synth

A tiny, opinionated synthesizer for the Web Audio API.

## Demo

[Try the live demo](https://ruanfh.github.io/tiny-synth/)

## Usage

The host application creates and owns the `AudioContext`.

```js
import { createSynth } from "./src/index.js";

const audioContext = new AudioContext();
const synth = createSynth({ audioContext });

synth.output.connect(audioContext.destination);

const note = synth.instruments.melody.play({
  frequency: 440,
  velocity: 0.8,
});

// Stop the note
note.stop();

// Clean up when finished
synth.dispose();
```

## Development

Requires a modern browser with Web Audio API support.

Run locally using a static HTTP server, for example:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

No build step or dependencies required.

## License

[MIT](LICENSE)
