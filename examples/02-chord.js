export function createExample(synth, audioContext) {
  let notes = [];

  return {
    play() {
      if (notes.length > 0) return;

      const frequencies = [261.63, 329.63, 392.00]; // C major

      notes = synth.instruments.harmony.playMany(frequencies);
    },

    stop() {
      synth.instruments.harmony.stopMany(notes);
      notes = [];
    },
  };
}
