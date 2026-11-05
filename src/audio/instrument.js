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
  const scheduledNotes = new Set();
  const voiceGain = 1 / polyphony;
  const noteGroups = new WeakMap();

  const settings = {
    amplitudes: [...(voiceDefaults.amplitudes ?? [1, 0, 0, 0, 0])],
    vibratoDepth: voiceDefaults.vibratoDepth ?? 0,
    vibratoRate: voiceDefaults.vibratoRate ?? 5,
    attack: voiceDefaults.attack ?? 0.02,
    release: voiceDefaults.release ?? 0.2,
  };

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

  function scheduleNote(entry) {
    const delay = Math.max(
      0,
      entry.startTime - audioContext.currentTime
    );

    window.setTimeout(() => {
      if (entry.cancelled || disposed) return;

      const remaining = entry.startTime - audioContext.currentTime;

      if (remaining > 0) {
        scheduleNote(entry);
        return;
      }

      scheduledNotes.delete(entry);
      startNote(entry);
    }, delay * 1000);
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

  function startNote(entry) {
    if (entry.cancelled || disposed) return;

    const now = audioContext.currentTime;

    allocateVoice(now);

    const voice = createVoice({
      ...settings,
      audioContext,
      frequency: entry.frequency,
      velocity: entry.velocity,
    });

    const outputGain = audioContext.createGain();
    outputGain.gain.value = voiceGain;

    voice.output.connect(outputGain);
    outputGain.connect(output);

    entry.voice = voice;
    entry.outputGain = outputGain;
    entry.startedAt = now;
    entry.releasing = false;
    entry.release = settings.release;

    activeVoices.push(entry);

    voice.start(entry.startTime);
    if (entry.stopTime !== null) {
      voice.stop(entry.stopTime, entry.stopFadeTime);

      if (entry.stopTime <= audioContext.currentTime) {
        entry.releasing = true;
      }

      scheduleCleanup(entry, entry.stopTime, entry.release);
    }
  }

  function stealVoice(entry, when) {
    const param = entry.outputGain.gain;

    param.cancelScheduledValues(when);
    param.setValueAtTime(voiceGain, when);
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
      entry => entry.releasing
    );

    // Otherwise steal the oldest voice that has already started.
    if (!candidate) {
      const playingVoices = activeVoices.filter(
        entry => entry.startTime <= when
      );

      candidate = playingVoices.reduce(
        (oldest, entry) =>
          !oldest || entry.startedAt < oldest.startedAt
            ? entry
            : oldest,
        null
      );
    }

    // Never steal a voice that is only scheduled for the future.
    if (candidate) {
      stealVoice(candidate, when);
    }
  }

  function play(frequency, velocity = 1, when = audioContext.currentTime) {
    if (disposed) {
      throw new Error("Cannot play: instrument has been disposed");
    }

    if (!Number.isFinite(frequency) || frequency <= 0) {
      throw new RangeError("frequency must be a positive finite number");
    }

    if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
      throw new RangeError("velocity must be between 0 and 1");
    }

    if (!Number.isFinite(when) || when < 0) {
      throw new RangeError("when must be a non-negative finite number");
    }

    const entry = {
      frequency,
      velocity,
      startTime: when,
      stopTime: null,
      startedAt: null,
      voice: null,
      outputGain: null,
      releasing: false,
      cancelled: false,
      release: settings.release,
      stopFadeTime: undefined,
    };

    if (when <= audioContext.currentTime) {
      startNote(entry);
    } else {
      scheduledNotes.add(entry);
      scheduleNote(entry);
    }

    function stop(stopTime = audioContext.currentTime, fadeTime) {
      if (entry.cancelled || entry.stopTime !== null) return;
      if (entry.voice && !activeVoices.includes(entry)) return;

      if (!Number.isFinite(stopTime) || stopTime < 0) {
        throw new RangeError("stopTime must be a non-negative finite number");
      }

      if (stopTime < entry.startTime && !entry.voice) {
        entry.cancelled = true;
        scheduledNotes.delete(entry);
        return;
      }

      if (
        fadeTime !== undefined &&
        (!Number.isFinite(fadeTime) || fadeTime < 0)
      ) {
        throw new RangeError(
          "fadeTime must be a non-negative finite number"
        );
      }

      entry.stopTime = stopTime;
      entry.stopFadeTime = fadeTime;

      if (entry.voice) {
        entry.voice.stop(stopTime, fadeTime);

        const releaseDuration =
          fadeTime !== undefined ? fadeTime : entry.release;

        if (stopTime <= audioContext.currentTime) {
          entry.releasing = true;
        }

        scheduleCleanup(entry, stopTime, releaseDuration);
      }
    }

    return {
      stop,

      get isPlaying() {
        return (
          !entry.cancelled &&
          entry.voice !== null &&
          activeVoices.includes(entry) &&
          audioContext.currentTime >= entry.startTime &&
          (entry.stopTime === null ||
            audioContext.currentTime < entry.stopTime) &&
          entry.voice.isPlaying
        );
      },

      setFrequency(nextFrequency) {
        if (entry.cancelled) return;

        if (entry.voice) {
          entry.voice.setFrequency(nextFrequency);
        } else {
          if (!Number.isFinite(nextFrequency) || nextFrequency <= 0) {
            throw new RangeError("frequency must be a positive finite number");
          }

          entry.frequency = nextFrequency;
        }
      },
    };
  }

  function playMany(frequencies, velocity = 1) {
    const notes = frequencies.map((frequency) => play(frequency, velocity));

    noteGroups.set(notes, [...notes]);

    return notes;
  }

  function stopMany(notes) {
    const group = noteGroups.get(notes);

    if (!group) {
      throw new TypeError(
        "stopMany expects an array returned by playMany"
      );
    }

    for (const note of group) {
      note.stop();
    }
  }

  function setAmplitudes(nextAmplitudes) {
    settings.amplitudes = [...nextAmplitudes];

    for (const entry of activeVoices) {
      if (!entry.releasing) {
        entry.voice.setAmplitudes(settings.amplitudes);
      }
    }
  }

  function setVibratoDepth(nextDepth) {
    settings.vibratoDepth = nextDepth;

    for (const entry of activeVoices) {
      if (!entry.releasing) {
        entry.voice.setVibratoDepth(nextDepth);
      }
    }
  }

  function setVibratoRate(nextRate) {
    settings.vibratoRate = nextRate;

    for (const entry of activeVoices) {
      if (!entry.releasing) {
        entry.voice.setVibratoRate(nextRate);
      }
    }
  }

  function setAttack(nextAttack) {
    settings.attack = nextAttack;
  }

  function setRelease(nextRelease) {
    settings.release = nextRelease;

    for (const entry of activeVoices) {
      if (!entry.releasing) {
        entry.voice.setRelease(nextRelease);
        entry.release = nextRelease;
      }
    }
  }

  function stopAll(when = audioContext.currentTime, fadeTime) {
    if (!Number.isFinite(when) || when < 0) {
      throw new RangeError("when must be a non-negative finite number");
    }

    if (
      fadeTime !== undefined &&
      (!Number.isFinite(fadeTime) || fadeTime < 0)
    ) {
      throw new RangeError(
        "fadeTime must be a non-negative finite number"
      );
    }

    for (const entry of [...scheduledNotes]) {
      if (entry.startTime > when) {
        entry.cancelled = true;
        scheduledNotes.delete(entry);
      } else {
        entry.stopTime = when;
        entry.stopFadeTime = fadeTime;
      }
    }

    for (const entry of [...activeVoices]) {
      if (entry.releasing) continue;

      entry.releasing = true;
      entry.voice.stop(when, fadeTime);

      if (when < entry.startTime) {
        removeVoice(entry);
        disconnectVoice(entry);
        continue;
      }

      const releaseDuration =
        fadeTime !== undefined ? fadeTime : entry.release;

      scheduleCleanup(entry, when, releaseDuration);
    }

    const latestEndTime = Math.max(
      latestTailEndTime,
      ...activeVoices.map(entry =>
        entry.releasing
          ? audioContext.currentTime + entry.release
          : 0
      ),
      when
    );

    return Math.max(0, latestEndTime - audioContext.currentTime);
  }

  function dispose() {
    if (disposed) return 0;

    disposed = true;
    return stopAll();
  }

  return {
    output,
    play,
    playMany,
    stopMany,
    setAmplitudes,
    setVibratoDepth,
    setVibratoRate,
    setAttack,
    setRelease,
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