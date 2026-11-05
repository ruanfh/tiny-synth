export function createExample(synth, audioContext) {
  let playing = false;
  let playbackId = 0;

  const beat = 60 / 100;
  const barDuration = 3 * beat;

  // Bass and chord voicings for each bar.
  // The first G bar is the introduction.
  // The final G is omitted so the loop joins cleanly back to the intro.
  const bars = [
    { bass: 98.00, chord: [196.00, 246.94, 293.66] }, // G
    { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { bass: 110.00, chord: [220.00, 261.63, 329.63] }, // Am
    { bass: 146.83, chord: [293.66, 349.23, 440.00] }, // Dm
    { bass: 98.00, chord: [196.00, 246.94, 293.66] }, // G
    { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { bass: 110.00, chord: [220.00, 261.63, 329.63] }, // Am
    { bass: 87.31, chord: [174.61, 220.00, 261.63] }, // F
    { bass: 87.31, chord: [174.61, 220.00, 261.63] }, // F
    { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { bass: 110.00, chord: [220.00, 261.63, 329.63] }, // Am
    { bass: 146.83, chord: [293.66, 349.23, 440.00] }, // Dm
    { bass: 98.00, chord: [196.00, 246.94, 293.66] }, // G
    { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C
    { bass: 87.31, chord: [174.61, 220.00, 261.63] }, // F
    { bass: 130.81, chord: [261.63, 329.63, 392.00] }, // C
  ];

  // Melody: [frequency, beat offset, duration in beats]
  // Uppercase ABC notes are octave 4; lowercase notes are octave 5.
  const melody = [
    [[392.00, 2, 1]],                         // G: z2 G
    [[523.25, 0, 2], [493.88, 2, 1]],        // C: c2 B
    [[523.25, 0, 2], [659.25, 2, 1]],        // Am: c2 e
    [[587.33, 0, 2], [523.25, 2, 1]],        // Dm: d2 c
    [[587.33, 0, 2], [659.25, 2, 0.5],
    [587.33, 2.5, 0.5]],                    // G: d2 e/ d/
    [[523.25, 0, 2], [523.25, 2, 1]],        // C: c2 c
    [[659.25, 0, 2], [783.99, 2, 1]],        // Am: e2 g
    [[880.00, 0, 3]],                        // F: a3
    [[880.00, 2, 1]],                        // F: z2 a
    [[783.99, 0, 2], [659.25, 2, 1]],        // C: g2 e
    [[659.25, 0, 2], [523.25, 2, 1]],        // Am: e2 c
    [[587.33, 0, 2], [523.25, 2, 1]],        // Dm: d2 c
    [[587.33, 0, 2], [659.25, 2, 0.5],
    [587.33, 2.5, 0.5]],                    // G: d2 e/ d/
    [[523.25, 0, 2], [440.00, 2, 1]],        // C: c2 A
    [[440.00, 0, 2], [392.00, 2, 1]],        // F: A2 G
    [[523.25, 0, 3]],                        // C: c3
  ];

  const cycleDuration = bars.length * barDuration;

  function scheduleNote(instrument, frequency, velocity, start, duration) {
    const note = instrument.play(frequency, velocity, start);
    note.stop(start + duration);
  }

  function scheduleCycle(startTime, id) {
    if (playbackId !== id) return;

    bars.forEach((bar, index) => {
      const barStart = startTime + index * barDuration;

      // Waltz accompaniment: bass on beat 1, chords on beats 2 and 3.
      scheduleNote(
        synth.instruments.harmony,
        bar.bass,
        0.8,
        barStart,
        beat * 0.9
      );

      [1, 2].forEach(beatIndex => {
        bar.chord.forEach(frequency => {
          scheduleNote(
            synth.instruments.harmony,
            frequency,
            0.45,
            barStart + beatIndex * beat,
            beat * 0.9
          );
        });
      });

      // Melody
      melody[index].forEach(([frequency, offset, duration]) => {
        scheduleNote(
          synth.instruments.melody,
          frequency,
          0.7,
          barStart + offset * beat,
          duration * beat
        );
      });
    });

    // Schedule the next cycle a little before this one ends.
    const nextStart = startTime + cycleDuration;
    const delay = Math.max(0, (nextStart - audioContext.currentTime - 0.25) * 1000);

    window.setTimeout(() => {
      scheduleCycle(nextStart, id);
    }, delay);
  }

  return {
    play() {
      if (playing) return;
      playing = true;

      const id = ++playbackId;
      const startTime = audioContext.currentTime + 0.1;
      scheduleCycle(startTime, id);
    },

    stop() {
      playbackId++;
      playing = false;

      synth.instruments.melody.stopAll(audioContext.currentTime, 0.03);
      synth.instruments.harmony.stopAll(audioContext.currentTime, 0.03);
    },
  };
}
