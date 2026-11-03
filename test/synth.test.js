
import { test } from "node:test";
import assert from "node:assert/strict";

import { createSynth } from "../src/synth.js";
import { FakeAudioContext } from "./helpers/fake-audio-context.js";
import { createFakeTimers } from "./helpers/fake-timers.js";

function withTestSynth(callback) {
    const originalWindow = globalThis.window;
    const timers = createFakeTimers();

    globalThis.window = {
        setTimeout: timers.setTimeout,
    };

    try {
        const audioContext = new FakeAudioContext();
        const synth = createSynth({ audioContext });

        callback({ synth, audioContext, timers });
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
    }
}

test("creates a synth, plays a note, stops it and disposes", () => {
    withTestSynth(({ synth, timers }) => {
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
    });
});

test("does not steal voices before reaching polyphony limit", () => {
    withTestSynth(({ synth, timers }) => {
        const melody = synth.instruments.melody;

        const notes = [
            melody.play(261.63),
            melody.play(293.66),
            melody.play(329.63),
            melody.play(349.23),
        ];

        assert.equal(melody.activeVoiceCount, 4);
        assert.ok(notes.every(note => note.isPlaying));

        synth.dispose();
        timers.runAll();
    });
});

test("steals the oldest held voice when polyphony is exceeded", () => {
    withTestSynth(({ synth, timers }) => {
        const melody = synth.instruments.melody;

        const notes = [
            melody.play(261.63),
            melody.play(293.66),
            melody.play(329.63),
            melody.play(349.23),
        ];

        const fifthNote = melody.play(392);

        assert.equal(notes[0].isPlaying, false);
        assert.ok(notes.slice(1).every(note => note.isPlaying));
        assert.equal(fifthNote.isPlaying, true);
        assert.equal(melody.activeVoiceCount, 4);

        synth.dispose();
        timers.runAll();
    });
});

test("prefers stealing a releasing voice over a held voice", () => {
    withTestSynth(({ synth, timers }) => {
        const melody = synth.instruments.melody;

        const notes = [
            melody.play(261.63),
            melody.play(293.66),
            melody.play(329.63),
            melody.play(349.23),
        ];

        // Begin releasing the first note.
        notes[0].stop();

        // Allocate another voice before the release cleanup runs.
        const fifthNote = melody.play(392);

        assert.ok(notes.slice(1).every(note => note.isPlaying));
        assert.equal(fifthNote.isPlaying, true);
        assert.equal(melody.activeVoiceCount, 4);

        synth.dispose();
        timers.runAll();
    });
});

