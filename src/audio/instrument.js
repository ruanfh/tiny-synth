import { createVoice } from "./voice.js";

const STEAL_FADE = 0.01;
const CLEANUP_MARGIN = 0.1;

/**
 * Create an instrument that manages a pool of synthesizer voices.
 *
 * The instrument does not connect itself to the audio destination.
 */
export function createInstrument({
  audioContext,
  output,
  polyphony,
  voiceDefaults = {},
}) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  if (!output) {
    throw new TypeError("output is required");
  }

  if (!Number.isInteger(polyphony) || polyphony < 1) {
    throw new RangeError("polyphony must be a positive integer");
  }

  const activeVoices = [];

  let latestTailEndTime = 0;
  let disposed = false;

  function removeVoice(entry) {
    const index = activeVoices.indexOf(entry);

    if (index !== -1) {
      activeVoices.splice(index, 1);
    }
  }

  function disconnectVoice(entry) {
    entry.outputGain.disconnect();
  }

  function scheduleCleanup(entry, when, release) {
    const endTime = when + release;

    latestTailEndTime = Math.max(latestTailEndTime, endTime);

    const delay = Math.max(
      0,
      endTime - audioContext.currentTime
    );

    window.setTimeout(() => {
      removeVoice(entry);
      disconnectVoice(entry);
    }, (delay + CLEANUP_MARGIN) * 1000);
  }

  function stealVoice(entry, when) {
    const param = entry.outputGain.gain;

    param.cancelScheduledValues(when);
    param.setValueAtTime(1, when);
    param.linearRampToValueAtTime(0, when + STEAL_FADE);

    entry.voice.stop(when);

    // Free the polyphony slot immediately, but preserve the fade.
    removeVoice(entry);

    latestTailEndTime = Math.max(
      latestTailEndTime,
      when + STEAL_FADE
    );

    window.setTimeout(() => {
      disconnectVoice(entry);
    }, STEAL_FADE * 1000 + 20);
  }

  function allocateVoice(when) {
    if (activeVoices.length < polyphony) {
      return;
    }

    // Prefer an already-releasing voice.
    let candidate = activeVoices.find(
      (entry) => entry.releasing
    );

    // Otherwise steal the oldest held voice.
    if (!candidate) {
      candidate = activeVoices.reduce((oldest, entry) =>
        entry.startedAt < oldest.startedAt ? entry : oldest
      );
    }

    stealVoice(candidate, when);
  }

  function play(noteOptions = {}) {
    if (disposed) {
      throw new Error("Cannot play: instrument has been disposed");
    }

    if (!noteOptions || typeof noteOptions !== "object") {
      throw new TypeError("noteOptions must be an object");
    }

    const now = audioContext.currentTime;

    allocateVoice(now);

    const options = {
      ...voiceDefaults,
      ...noteOptions,
      audioContext,
    };

    const voice = createVoice(options);

    const outputGain = audioContext.createGain();
    outputGain.gain.value = 1;

    voice.output.connect(outputGain);
    outputGain.connect(output);

    const entry = {
      voice,
      outputGain,
      startedAt: now,
      releasing: false,
      release: options.release ?? 0.2,
    };

    activeVoices.push(entry);

    voice.start(now);

    function isActive() {
      return !entry.releasing && activeVoices.includes(entry);
    }

    function stop(when = audioContext.currentTime) {
      if (!isActive()) return;

      entry.releasing = true;

      voice.stop(when);
      scheduleCleanup(entry, when, entry.release);
    }

    return {
      stop,

      setAmplitudes(nextAmplitudes) {
        if (!isActive()) return;
        voice.setAmplitudes(nextAmplitudes);
      },

      setVibratoDepth(nextDepth) {
        if (!isActive()) return;
        voice.setVibratoDepth(nextDepth);
      },

      setVibratoRate(nextRate) {
        if (!isActive()) return;
        voice.setVibratoRate(nextRate);
      },

      setRelease(nextRelease) {
        if (!isActive()) return;
        voice.setRelease(nextRelease);
        entry.release = nextRelease;
      },

      get isPlaying() {
        return isActive();
      },

      setFrequency(nextFrequency) {
        if (!isActive()) return;
        voice.setFrequency(nextFrequency);
      },
    };
  }

  function stopAll(when = audioContext.currentTime) {
    for (const entry of [...activeVoices]) {
      if (entry.releasing) continue;

      entry.releasing = true;
      entry.voice.stop(when);
      scheduleCleanup(entry, when, entry.release);
    }

    const latestEndTime = Math.max(
      latestTailEndTime,
      ...activeVoices.map(
        (entry) => entry.releasing
          ? audioContext.currentTime + entry.release
          : 0
      ),
      when
    );

    return Math.max(
      0,
      latestEndTime - audioContext.currentTime
    );
  }

  function dispose() {
    if (disposed) return 0;

    disposed = true;
    return stopAll();
  }

  return {
    output,
    play,
    stopAll,
    dispose,

    get activeVoiceCount() {
      return activeVoices.length;
    },

    get disposed() {
      return disposed;
    },
  };
}
