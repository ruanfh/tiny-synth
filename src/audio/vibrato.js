const PARAM_SMOOTHING = 0.015;

/**
 * Create a vibrato LFO that modulates oscillator detune in cents.
 *
 * All oscillators receive exactly the same modulation signal.
 */
export function createVibrato({
  audioContext,
  detuneParams,
  depth = 0,
  rate = 5,
}) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  if (!Array.isArray(detuneParams) || detuneParams.length === 0) {
    throw new TypeError("detuneParams must be a non-empty array");
  }

  validateDepth(depth);
  validateRate(rate);

  const lfo = audioContext.createOscillator();
  const depthGain = audioContext.createGain();

  lfo.type = "sine";
  lfo.frequency.value = rate;
  depthGain.gain.value = depth;

  lfo.connect(depthGain);

  for (const param of detuneParams) {
    if (!param || typeof param.setValueAtTime !== "function") {
      throw new TypeError("Each detune target must be an AudioParam");
    }

    depthGain.connect(param);
  }

  let started = false;
  let stopped = false;
  let cleanedUp = false;

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;

    lfo.disconnect();
    depthGain.disconnect();
  }

  function smoothParameter(param, value, when) {
    param.cancelScheduledValues(when);
    param.setTargetAtTime(value, when, PARAM_SMOOTHING);
  }

  lfo.onended = cleanup;

  return {
    start(when = audioContext.currentTime) {
      if (started || stopped) return;

      started = true;
      lfo.start(when);
    },

    stop(when = audioContext.currentTime) {
      if (stopped) return;

      stopped = true;

      if (!started) {
        cleanup();
        return;
      }

      lfo.stop(when);
    },

    setDepth(nextDepth, when = audioContext.currentTime) {
      if (stopped) return;

      validateDepth(nextDepth);
      smoothParameter(depthGain.gain, nextDepth, when);
    },

    setRate(nextRate, when = audioContext.currentTime) {
      if (stopped) return;

      validateRate(nextRate);
      smoothParameter(lfo.frequency, nextRate, when);
    },
  };
}

function validateDepth(depth) {
  if (!Number.isFinite(depth) || depth < 0) {
    throw new RangeError("depth must be a non-negative finite number");
  }
}

function validateRate(rate) {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError("rate must be a positive finite number");
  }
}
