
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

test("playMany starts all notes and returns usable handles", () => {
    withTestSynth(({ synth, timers }) => {
        const harmony = synth.instruments.harmony;

        const notes = harmony.playMany([261.63, 329.63, 392]);

        assert.equal(notes.length, 3);
        assert.ok(notes.every(note => note.isPlaying));
        assert.equal(harmony.activeVoiceCount, 3);

        synth.dispose();
        timers.runAll();
    });
});

test("stopMany stops all notes in a group", () => {
    withTestSynth(({ synth, timers }) => {
        const harmony = synth.instruments.harmony;

        const notes = harmony.playMany([261.63, 329.63, 392]);

        harmony.stopMany(notes);

        assert.ok(notes.every(note => !note.isPlaying));

        synth.dispose();
        timers.runAll();
    });
});

test("stopMany rejects arrays not returned by playMany", () => {
    withTestSynth(({ synth, timers }) => {
        const harmony = synth.instruments.harmony;

        const notes = [
            harmony.play(261.63),
            harmony.play(329.63),
        ];

        assert.throws(
            () => harmony.stopMany(notes),
            {
                name: "TypeError",
                message: "stopMany expects an array returned by playMany",
            }
        );

        synth.dispose();
        timers.runAll();
    });
});

test("stopMany can safely stop the same group more than once", () => {
    withTestSynth(({ synth, timers }) => {
        const harmony = synth.instruments.harmony;

        const notes = harmony.playMany([261.63, 329.63, 392]);

        harmony.stopMany(notes);
        harmony.stopMany(notes);

        assert.ok(notes.every(note => !note.isPlaying));

        synth.dispose();
        timers.runAll();
    });
});


test("new notes inherit the instrument's updated settings", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const melody = synth.instruments.melody;

        const amplitudes = [1, 0.4, 0.2, 0.1, 0.05];

        melody.setAmplitudes(amplitudes);
        melody.setVibratoDepth(30);
        melody.setVibratoRate(7);
        melody.setAttack(0.3);
        melody.setRelease(0.5);

        const note = melody.play(440);

        // Five harmonic oscillators plus one vibrato oscillator.
        const oscillators = audioContext.oscillators;

        assert.equal(oscillators.length, 6);

        // Vibrato oscillator receives the configured rate.
        assert.equal(oscillators[5].frequency.value, 7);

        // Vibrato depth is applied to its gain node.
        const vibratoGain = audioContext.gains[11];
        assert.equal(vibratoGain.gain.value, 30);

        // Verify that updated amplitudes are normalized.
        const harmonicGains = audioContext.gains.slice(4, 9);

        const sum = amplitudes.reduce(
            (total, value) => total + value,
            0
        );

        note.setFrequency(440); // No amplitude update here.
        melody.setAmplitudes(amplitudes);

        harmonicGains.forEach((gain, index) => {
            assert.ok(
                Math.abs(gain.gain.value - amplitudes[index] / sum) < 1e-10
            );
        });

        // Verify the configured attack.
        const envelopeGain = audioContext.gains[9];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 1 &&
                    call.when === 0.3
            )
        );

        // Verify the configured release through the note's cleanup timer.
        note.stop();

        assert.ok(
            timers.timers.some(timer => timer.delay === 600)
        );

        synth.dispose();
        timers.runAll();
    });
});

test("rejects invalid note frequencies", () => {
  withTestSynth(({ synth }) => {
    for (const frequency of [0, -440, NaN, Infinity]) {
      assert.throws(
        () => synth.instruments.melody.play(frequency),
        RangeError
      );
    }
  });
});

test("rejects invalid velocities", () => {
  withTestSynth(({ synth }) => {
    for (const velocity of [-0.1, 1.1, NaN, Infinity]) {
      assert.throws(
        () => synth.instruments.melody.play(440, velocity),
        RangeError
      );
    }
  });
});
