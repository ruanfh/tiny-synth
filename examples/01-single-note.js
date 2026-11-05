export function createExample(synth, audioContext) {
  let note = null;

  return {
    play() {
      if (note?.isPlaying) return;

      note = synth.instruments.melody.play(440);
    },

    stop() {
      note?.stop(audioContext.currentTime, 0.03);
      note = null;
    },
  };
}