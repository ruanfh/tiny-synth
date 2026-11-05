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

Velocity controls the volume of the note and is a normalized value between `0` and `1`.

The default velocity is `1`. You can also specify a velocity between `0` and `1`:

```js
const note = synth.instruments.melody.play(440, 0.5);
```

### Stop the note

Call `stop()` on a note handle to stop an individual note.

```js
note.stop();
```

You can optionally specify when the note should stop and how long its release should take:

```js
note.stop(when, fadeTime);
```

- `when`: absolute time from the AudioContext clock, in seconds. Defaults to `audioContext.currentTime`.
- `fadeTime`: release duration in seconds. Defaults to the instrument's configured release time.

A release override applies only to that note:

```js
// Use the configured release
note.stop();

// Use a 30 ms release
note.stop(audioContext.currentTime, 0.03);

// Stop with no release fade (will likely produce clicks)
note.stop(audioContext.currentTime, 0);
```

Once a note has a scheduled stop time, subsequent calls to `note.stop()` do not override it.

### Stop many notes

Use `stopMany()` to stop a group of notes returned by `playMany()`:

```js
const notes = synth.instruments.harmony.playMany([
  261.63,
  329.63,
  392.00,
]);

synth.instruments.harmony.stopMany(notes);
```

### Stop all notes

Use `stopAll()` to stop every note belonging to an instrument:

```js
synth.instruments.melody.stopAll();
```

It accepts the same timing and release arguments as `note.stop()`:

```js
// Stop all notes with a 30 ms release
synth.instruments.melody.stopAll(
  audioContext.currentTime,
  0.03
);
```

Notes scheduled to start after the specified stop time are cancelled.

### Schedule a note

Notes can be scheduled using an absolute time from the host's AudioContext clock, in seconds.

```js
const startTime = audioContext.currentTime + 1;
const note = synth.instruments.melody.play(440, 0.8, startTime);
```

The third argument specifies when the note starts. If omitted, the note starts immediately.
You can also schedule when a note stops:

```js
note.stop(startTime + 2);
```

This schedules the note's release two seconds after its start time.

A scheduled note can be cancelled before it starts:

```js
note.stop();
```

Scheduled notes only consume polyphony when they actually start playing. The isPlaying property reflects whether a note is currently playing, not whether it has been scheduled.

### Play many notes

```js
const notes = synth.instruments.harmony.playMany([261.63, 329.63, 392.00]);
```

### Stop many notes

```js
synth.instruments.harmony.stopMany(notes);
```

### Clean up when finished

```js
synth.dispose();
```

### Configure timbre

```js
synth.instruments.melody.setAmplitudes([1, 0.5, 0.25, 0.125, 0.0625]);
```

Where the first value is the fundamental and the others are the harmonics in order of lower to higher.

### Vibrato depth

Controls the vibrato depth in cents.

```js
synth.instruments.melody.setVibratoDepth(20);
```

### Vibrato rate

Controls how fast the vibrato oscillates, in Hz.

```js
synth.instruments.melody.setVibratoRate(5)
```

### Envelope attack

Controls how long the sound takes to reach its full amplitude after a note starts, in seconds.

```js
synth.instruments.melody.setAttack(0.1);
```

### Envelope release

controls how long the sound takes to fade out after a note is stopped, in seconds.

```js
synth.instruments.melody.setRelease(0.5);
```

## Development

Requires a modern browser with Web Audio API support.

Run locally using a static HTTP server, for example:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

No build step or dependencies required.

### Testing

```bash
node --test test/*.test.js
```

## Scope

tiny-synth focuses on sound generation and instrument management. Musical
sequencing and audio routing are the responsibility of the host application.

- No built-in sequencer or musical notation abstractions.
- Individual notes can be scheduled using the AudioContext clock.
- No tempo management.
- No automatic connection to the audio destination.
- The host owns and manages the `AudioContext`.

## License

[MIT](LICENSE)
