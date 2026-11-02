# tiny-synth

A tiny, opinionated synthesizer for the Web Audio API.

## Demo

[Try the live demo](https://ruanfh.github.io/tiny-synth/)

## Quick start

No cloning needed.

Create an `index.html` file with the following content and open it in a browser (or serve it with any static server):

<details>
<summary>Click to see a complete working HTML example</summary>

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>tiny-synth example</title>
</head>
<body>
  <button id="play">Play note</button>
  <button id="stop">Stop</button>

  <script type="module">
    import { createSynth } from "https://esm.sh/gh/ruanfh/tiny-synth@main/src/index.js";

    const audioContext = new AudioContext();
    const synth = createSynth({ audioContext });
    synth.output.connect(audioContext.destination);

    let note = null;

    document.getElementById("play").addEventListener("click", async () => {
      // Browsers require a user gesture before starting audio
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (note) note.stop();
      note = synth.instruments.melody.play(440);
    });

    document.getElementById("stop").addEventListener("click", () => {
      if (note) {
        note.stop();
        note = null;
      }
    });
  </script>
</body>
</html>
```

</details>

## Usage

### Import

```js
import { createSynth } from "https://esm.sh/gh/ruanfh/tiny-synth@main/src/index.js";
```

You can pin a specific commit instead of `@main` for stability:
`https://esm.sh/gh/ruanfh/tiny-synth@<commit-sha>/src/index.js`

### Initialize

The host application creates and owns the `AudioContext`.

```js
const audioContext = new AudioContext();
const synth = createSynth({ audioContext });

synth.output.connect(audioContext.destination);
```

### Play a note

There are two instruments available:
- `synth.instruments.melody` (4-voice polyphony)
- `synth.instruments.harmony` (8-voice polyphony)

```js
const note = synth.instruments.melody.play(440);
```

### Stop the note

```js
note.stop();
```

### Clean up when finished

```js
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
