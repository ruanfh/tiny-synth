import { createHarmonics } from "./harmonics.js";
import { createVibrato } from "./vibrato.js";
import { createEnvelope } from "./envelope.js";

/**
 * Create a single synthesizer voice.
 *
 * The caller is responsible for connecting output to its audio graph.
 */
export function createVoice({
  audioContext,
  frequency,
  velocity = 1,
  amplitudes = [1, 0, 0, 0, 0],
  vibratoDepth = 0,
  vibratoRate = 5,
  attack = 0.02,
  release = 0.2,
}) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  validatePositive(frequency, "frequency");
  validateRange(velocity, 0, 1, "velocity");

  const harmonics = createHarmonics({
    audioContext,
    frequency,
    amplitudes,
  });

  const envelope = createEnvelope({
    audioContext,
    attack,
    release,
  });

  const voiceGain = audioContext.createGain();
  voiceGain.gain.value = velocity;

  const vibrato = createVibrato({
    audioContext,
    detuneParams: harmonics.detuneParams,
    depth: vibratoDepth,
    rate: vibratoRate,
  });

  // Internal signal chain:
  // Harmonics -> Envelope -> Voice gain -> Output
  harmonics.output.connect(envelope.output);
  envelope.output.connect(voiceGain);

  let started = false;
  let stopped = false;
  let cleanupScheduled = false;
  let startTime = null;
  let stopTime = null;

  function cleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;

    harmonics.output.disconnect();
    envelope.output.disconnect();
    voiceGain.disconnect();
  }

  function start(when = audioContext.currentTime) {
    if (started || stopped) return;

    started = true;
    startTime = when;

    harmonics.start(when);
    vibrato.start(when);
    envelope.start(when);
  }

  function stop(when = audioContext.currentTime, fadeTime) {
    if (stopped) return;

    if (fadeTime !== undefined) {
      if (!Number.isFinite(fadeTime) || fadeTime < 0) {
        throw new RangeError("fadeTime must be a non-negative finite number");
      }
    }

    stopped = true;
    stopTime = when;

    if (when < startTime) {
      vibrato.stop(when);
      harmonics.stop(when);
      cleanup();
      return;
    }

    const releaseDuration =
      fadeTime !== undefined ? fadeTime : envelope.release;

    // fadeTime === undefined → normal musical release
    // fadeTime provided     → abrupt / pause fade
    envelope.stop(when, fadeTime);

    const endTime = when + releaseDuration;

    vibrato.stop(endTime);
    harmonics.stop(endTime);

    const delay = Math.max(0, endTime - audioContext.currentTime);
    window.setTimeout(cleanup, (delay + 0.1) * 1000);
  }

  return {
    output: voiceGain,

    start,
    stop,

    setAmplitudes(nextAmplitudes, when = audioContext.currentTime) {
      if (stopped) return;
      harmonics.setAmplitudes(nextAmplitudes, when);
    },

    setVibratoDepth(nextDepth, when = audioContext.currentTime) {
      if (stopped) return;
      vibrato.setDepth(nextDepth, when);
    },

    setVibratoRate(nextRate, when = audioContext.currentTime) {
      if (stopped) return;
      vibrato.setRate(nextRate, when);
    },

    setRelease(nextRelease) {
      if (stopped) return;
      envelope.setRelease(nextRelease);
    },

    get isPlaying() {
      const now = audioContext.currentTime;

      return (
        started &&
        now >= startTime &&
        (stopTime === null || now < stopTime)
      );
    },

    setFrequency(nextFrequency, when = audioContext.currentTime) {
      if (stopped) return;
      harmonics.setFrequency(nextFrequency, when);
    },
  };
}

function validatePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function validateRange(value, min, max, name) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(
      `${name} must be between ${min} and ${max}`
    );
  }
}
