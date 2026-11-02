
import { createInstrument } from "./audio/instrument.js";

const CLEANUP_MARGIN = 0.15;

/**
 * Create a synthesizer with melody and harmony instruments.
 *
 * The host owns the AudioContext and the connection to destination.
 */
export function createSynth({ audioContext }) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  const output = audioContext.createGain();

  const melodyBus = audioContext.createGain();
  const harmonyBus = audioContext.createGain();

  melodyBus.connect(output);
  harmonyBus.connect(output);

  const melody = createInstrument({
    audioContext,
    output: melodyBus,
    polyphony: 4,
    voiceDefaults: {
      amplitudes: [1, 0.2, 0.1, 0.05, 0.025],
      attack: 0.1,
      release: 0.2,
      vibratoDepth: 20,
      vibratoRate: 5,
    },
  });

  const harmony = createInstrument({
    audioContext,
    output: harmonyBus,
    polyphony: 8,
    voiceDefaults: {
      amplitudes: [1, 0.5, 0.25, 0.125, 0.0625],
      attack: 0.1,
      release: 0.2,
      vibratoDepth: 15,
      vibratoRate: 1,
    },
  });

  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;

    const melodyTail = melody.dispose();
    const harmonyTail = harmony.dispose();

    const tailDuration = Math.max(melodyTail, harmonyTail);

    window.setTimeout(() => {
      melodyBus.disconnect();
      harmonyBus.disconnect();
      output.disconnect();
    }, (tailDuration + CLEANUP_MARGIN) * 1000);
  }

  return {
    output,

    instruments: {
      melody,
      harmony,
    },

    dispose,

    get disposed() {
      return disposed;
    },
  };
}
