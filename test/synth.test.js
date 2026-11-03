
import { test } from "node:test";
import assert from "node:assert/strict";

import { createSynth } from "../src/synth.js";
import { FakeAudioContext } from "./helpers/fake-audio-context.js";
import { createFakeTimers } from "./helpers/fake-timers.js";

test("creates a synth, plays a note, stops it and disposes", () => {
  const audioContext = new FakeAudioContext();
  const timers = createFakeTimers();

  const originalWindow = globalThis.window;

  globalThis.window = {
    setTimeout: timers.setTimeout,
  };

  try {
    const synth = createSynth({ audioContext });

    assert.equal(synth.disposed, false);
    assert.ok(synth.output);
    assert.ok(synth.instruments.melody);
    assert.ok(synth.instruments.harmony);

    const note = synth.instruments.melody.play(440);

    assert.equal(note.isPlaying, true);

    note.stop();

    assert.equal(note.isPlaying, false);

    synth.dispose();

    assert.equal(synth.disposed, true);

    // Disposal should be safe to call more than once.
    synth.dispose();

    assert.equal(synth.disposed, true);

    // Run pending cleanup callbacks.
    timers.runAll();
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
