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
        assert.ok(synth.instruments.bass);
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
        const vibratoGain = audioContext.gains[12];
        assert.equal(vibratoGain.gain.value, 30);

        // Verify that updated amplitudes are normalized.
        const harmonicGains = audioContext.gains.slice(5, 10);

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
        const envelopeGain = audioContext.gains[10];

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

test("schedules a note to play in the future", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const note = synth.instruments.melody.play(440, 1, 1);

        assert.equal(note.isPlaying, false);
        assert.equal(synth.instruments.melody.activeVoiceCount, 0);

        audioContext.currentTime = 1;
        timers.runPending();

        assert.equal(note.isPlaying, true);
        assert.equal(synth.instruments.melody.activeVoiceCount, 1);

        note.stop();
        synth.dispose();
        timers.runAll();
    });
});

test("cancels a note scheduled for the future", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const note = synth.instruments.melody.play(440, 1, 1);

        audioContext.currentTime = 0.5;
        note.stop();

        assert.equal(note.isPlaying, false);
        assert.equal(synth.instruments.melody.activeVoiceCount, 0);

        synth.dispose();
        timers.runAll();
    });
});

test("stopAll cancels notes scheduled in the future", () => {
    withTestSynth(({ synth }) => {
        const melody = synth.instruments.melody;
        const note = melody.play(440, 1, 1);

        assert.equal(note.isPlaying, false);
        assert.equal(melody.activeVoiceCount, 0);

        const tailDuration = melody.stopAll();

        assert.equal(note.isPlaying, false);
        assert.equal(melody.activeVoiceCount, 0);
        assert.equal(tailDuration, 0);

        synth.dispose();
    });
});

test("continues playing until its scheduled stop time", () => {
    withTestSynth(({ synth, audioContext }) => {
        const note = synth.instruments.melody.play(440);

        note.stop(2);

        assert.equal(note.isPlaying, true);

        audioContext.currentTime = 1.9;
        assert.equal(note.isPlaying, true);

        audioContext.currentTime = 2;
        assert.equal(note.isPlaying, false);

        synth.dispose();
    });
});

test("does not steal voices scheduled to start in the future", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const melody = synth.instruments.melody;
        const startTime = audioContext.currentTime + 1;

        const notes = [
            melody.play(261.63, 1, startTime),
            melody.play(329.63, 1, startTime + 0.2),
            melody.play(392.00, 1, startTime + 0.4),
            melody.play(523.25, 1, startTime + 0.6),
        ];

        assert.ok(notes.every(note => !note.isPlaying));
        assert.equal(melody.activeVoiceCount, 0);

        audioContext.currentTime = startTime;
        timers.runPending();

        assert.ok(notes[0].isPlaying);
        assert.equal(melody.activeVoiceCount, 1);

        audioContext.currentTime = startTime + 0.2;
        timers.runPending();

        assert.ok(notes.slice(0, 2).every(note => note.isPlaying));

        audioContext.currentTime = startTime + 0.4;
        timers.runPending();

        audioContext.currentTime = startTime + 0.6;
        timers.runPending();

        assert.ok(notes.every(note => note.isPlaying));
        assert.equal(melody.activeVoiceCount, 4);

        synth.dispose();
        timers.runPending();
    });
});

test("scheduled stop uses the configured release", () => {
    withTestSynth(({ synth, audioContext }) => {
        const melody = synth.instruments.melody;

        melody.setRelease(0.5);

        const note = melody.play(440);
        note.stop(2);

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2.5
            )
        );

        synth.dispose();
    });
});

test("note stop uses a custom release duration", () => {
    withTestSynth(({ synth, audioContext }) => {
        const melody = synth.instruments.melody;

        melody.setRelease(0.5);

        const note = melody.play(440);
        note.stop(2, 0.03);

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2.03
            )
        );

        synth.dispose();
    });
});

test("note stop supports zero release duration", () => {
    withTestSynth(({ synth, audioContext }) => {
        const note = synth.instruments.melody.play(440);

        note.stop(2, 0);

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2
            )
        );

        synth.dispose();
    });
});

test("does not override an already scheduled stop", () => {
    withTestSynth(({ synth, audioContext }) => {
        const note = synth.instruments.melody.play(440);
        const envelopeGain = audioContext.gains[10];

        note.stop(2, 0.5);
        note.stop(3, 0.1);

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2.5
            )
        );

        assert.equal(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 3.1
            ),
            false
        );

        synth.dispose();
    });
});

test("stopAll uses a custom release duration", () => {
    withTestSynth(({ synth, audioContext }) => {
        const melody = synth.instruments.melody;
        melody.setRelease(0.5);
        melody.play(440);

        const tailDuration = melody.stopAll(2, 0.03);

        assert.equal(tailDuration, 2.03);

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2.03
            )
        );

        synth.dispose();
    });
});

test("stopAll uses the configured release duration by default", () => {
    withTestSynth(({ synth, audioContext }) => {
        const melody = synth.instruments.melody;
        melody.setRelease(0.5);
        melody.play(440);

        melody.stopAll(2);

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 2.5
            )
        );

        synth.dispose();
    });
});

test("reuses a voice after its release finishes", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const melody = synth.instruments.melody;

        melody.setRelease(0.5);

        const notes = [
            melody.play(261.63),
            melody.play(293.66),
            melody.play(329.63),
            melody.play(349.23),
        ];

        notes[0].stop();

        assert.equal(melody.activeVoiceCount, 4);

        // Advance past the release duration and run cleanup.
        audioContext.currentTime = 0.6;
        timers.runPending();

        assert.equal(melody.activeVoiceCount, 3);

        const newNote = melody.play(392);

        assert.equal(newNote.isPlaying, true);
        assert.equal(melody.activeVoiceCount, 4);

        synth.dispose();
        timers.runAll();
    });
});

test("stopAll preserves custom release for scheduled notes", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const melody = synth.instruments.melody;
        melody.setRelease(0.5);

        const note = melody.play(440, 1, 1);

        melody.stopAll(1, 0.03);

        audioContext.currentTime = 1;
        timers.runPending();

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 1.03
            )
        );

        synth.dispose();
        timers.runAll();
    });
});

test("note stop preserves custom release for scheduled notes", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const melody = synth.instruments.melody;
        melody.setRelease(0.5);

        const note = melody.play(440, 1, 1);

        note.stop(1, 0.03);

        audioContext.currentTime = 1;
        timers.runPending();

        const envelopeGain = audioContext.gains[10];

        assert.ok(
            envelopeGain.gain.calls.some(
                call =>
                    call.method === "linearRampToValueAtTime" &&
                    call.value === 0 &&
                    call.when === 1.03
            )
        );

        synth.dispose();
        timers.runAll();
    });
});

test("invalid fadeTime does not change note state", () => {
    withTestSynth(({ synth }) => {
        const note = synth.instruments.melody.play(440);

        assert.throws(
            () => note.stop(2, -0.1),
            RangeError
        );

        assert.equal(note.isPlaying, true);

        // A valid stop should still work afterwards.
        note.stop(2);

        assert.equal(note.isPlaying, true);

        synth.dispose();
    });
});

test("invalid fadeTime does not change notes in stopAll", () => {
    withTestSynth(({ synth }) => {
        const melody = synth.instruments.melody;
        const note = melody.play(440);

        assert.throws(
            () => melody.stopAll(2, -0.1),
            RangeError
        );

        assert.equal(note.isPlaying, true);
        assert.equal(melody.activeVoiceCount, 1);

        // A valid stop should still work afterwards.
        melody.stopAll();

        assert.equal(note.isPlaying, false);

        synth.dispose();
    });
});

test("stops a note before its scheduled start time", () => {
    withTestSynth(({ synth, audioContext, timers }) => {
        const note = synth.instruments.melody.play(440, 1, 2);

        // The note has not started yet.
        assert.equal(note.isPlaying, false);

        // Advance to the scheduled start, allowing the voice to be created.
        audioContext.currentTime = 2;
        timers.runPending();

        assert.equal(note.isPlaying, true);

        // Schedule the stop before the audio start time.
        note.stop(1);

        assert.equal(note.isPlaying, false);

        synth.dispose();
        timers.runAll();
    });
});
