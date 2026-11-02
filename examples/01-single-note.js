export function createExample(synth) {
  let note = null;

  return {
    play() {
      if (note?.isPlaying) return;

      note = synth.instruments.melody.play(440);
    },

    stop() {
      note?.stop();
      note = null;
    },
  };
}