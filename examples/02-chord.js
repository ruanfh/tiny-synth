export function createExample(synth) {
  let notes = [];

  return {
    play() {
      if (notes.length > 0) return;

      const frequencies = [261.63, 329.63, 392.00]; // C major

      notes = frequencies.map(frequency =>
        synth.instruments.harmony.play({
          frequency,
          velocity: 0.3,
        })
      );
    },

    stop() {
      notes.forEach(note => note.stop());
      notes = [];
    },
  };
}
