const HARMONIC_COUNT = 5;
const AMPLITUDE_SMOOTHING = 0.015;

/**
 * Create one harmonic sound source.
 *
 * amplitudes:
 *   [fundamental, 2nd, 3rd, 4th, 5th harmonic]
 *
 * The coefficients are not normalized. Overall loudness is
 * controlled elsewhere in the audio graph.
 */
export function createHarmonics({
  audioContext,
  frequency,
  amplitudes = [1, 0.5, 0.25, 0.125, 0.0625],
}) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  validateFrequency(frequency);
  validateAmplitudes(amplitudes);

  const output = audioContext.createGain();
  const nyquist = audioContext.sampleRate / 2;

  const oscillators = [];
  const partialGains = [];
  const detuneParams = [];

  let started = false;
  let stopped = false;
  let cleanedUp = false;
  let currentFrequency = frequency;
  let currentAmplitudes = [...amplitudes];
  let endedCount = 0;

  function updatePartialLevels(
    when = audioContext.currentTime,
    smooth = false
  ) {
    for (let i = 0; i < HARMONIC_COUNT; i++) {
      const harmonicFrequency = currentFrequency * (i + 1);
      const audible = harmonicFrequency < nyquist;
      const level = audible ? currentAmplitudes[i] : 0;
      const param = partialGains[i].gain;

      param.cancelScheduledValues(when);

      if (smooth) {
        param.setTargetAtTime(
          level,
          when,
          AMPLITUDE_SMOOTHING
        );
      } else {
        param.setValueAtTime(level, when);
      }
    }
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;

    for (const oscillator of oscillators) {
      oscillator.disconnect();
    }

    for (const gain of partialGains) {
      gain.disconnect();
    }

    output.disconnect();
  }

  for (let i = 0; i < HARMONIC_COUNT; i++) {
    const oscillator = audioContext.createOscillator();
    const partialGain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency * (i + 1);

    partialGain.gain.value =
      frequency * (i + 1) < nyquist ? amplitudes[i] : 0;

    oscillator.connect(partialGain);
    partialGain.connect(output);

    oscillator.onended = () => {
      endedCount++;

      if (endedCount === HARMONIC_COUNT) {
        cleanup();
      }
    };

    oscillators.push(oscillator);
    partialGains.push(partialGain);
    detuneParams.push(oscillator.detune);
  }

  return {
    output,

    // Internal modulation targets for the vibrato module.
    detuneParams,

    start(when = audioContext.currentTime) {
      if (started || stopped) return;

      started = true;

      for (const oscillator of oscillators) {
        oscillator.start(when);
      }
    },

    stop(when = audioContext.currentTime) {
      if (stopped) return;
      stopped = true;

      if (!started) {
        cleanup();
        return;
      }

      for (const oscillator of oscillators) {
        oscillator.stop(when);
      }
    },

    setFrequency(nextFrequency, when = audioContext.currentTime) {
      if (stopped) return;

      validateFrequency(nextFrequency);
      currentFrequency = nextFrequency;

      for (let i = 0; i < HARMONIC_COUNT; i++) {
        oscillators[i].frequency.setValueAtTime(
          nextFrequency * (i + 1),
          when
        );
      }

      updatePartialLevels(when);
    },

    setAmplitudes(nextAmplitudes, when = audioContext.currentTime) {
      if (stopped) return;

      validateAmplitudes(nextAmplitudes);
      currentAmplitudes = [...nextAmplitudes];

      updatePartialLevels(when, true);
    },
  };
}

function validateFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new RangeError("frequency must be a positive finite number");
  }
}

function validateAmplitudes(amplitudes) {
  if (
    !Array.isArray(amplitudes) ||
    amplitudes.length !== HARMONIC_COUNT ||
    amplitudes.some(value => !Number.isFinite(value) || value < 0)
  ) {
    throw new RangeError(
      "amplitudes must contain exactly five non-negative finite numbers"
    );
  }
}