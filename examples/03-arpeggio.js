export function createExample(synth, audioContext) {
  let notes = [];

  return {
    play() {
      if (notes.some(note => note.isPlaying)) return;

      const frequencies = [
        261.63, 329.63, 392.00, 523.25,
        392.00, 329.63, 261.63,
      ];

      const startTime = audioContext.currentTime + 0.1;
      const interval = 0.2;
      const duration = 0.18;

      notes = frequencies.map((frequency, index) => {
        const when = startTime + index * interval;
        const note = synth.instruments.melody.play(frequency, 0.8, when);

        note.stop(when + duration);
        return note;
      });
    },

    stop() {
      synth.instruments.melody.stopAll(audioContext.currentTime, 0.03);
    },
  };
}
