export function createExample(synth) {
  let note = null;

  return {
    play() {
      if (note?.isPlaying) return;

      note = synth.instruments.melody.play({
        frequency: 440,
        velocity: 0.4,
      });
    },

    stop() {
      note?.stop();
      note = null;
    },
  };
}