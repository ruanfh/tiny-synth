/**
 * Am Cycle – 8-bar loop in A minor with walking bass.
 *
 *   - bass    → walking quarter notes (from the ABC)
 *   - harmony → sustained 7th chords
 *   - melody  → simple upper line over the changes
 *
 * Progression: Am7 | Dm7 | G7 | Cmaj7 | Fmaj7 | Dm7 | E7 | Am7
 */
export function createExample(synth, audioContext) {
  let playing = false;
  let playbackId = 0;

  const beat = 60 / 120;        // ♩ = 120
  const barDuration = 4 * beat;

  // Pitch helpers (A4 = 440)
  const E2 = 82.41, F2 = 87.31, G2 = 98.00, Gs2 = 103.83, A2 = 110.00;
  const B2 = 123.47, C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61;
  const G3 = 196.00, Gs3 = 207.65, A3 = 220.00, B3 = 246.94, C4 = 261.63;
  const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, Gs4 = 415.30;
  const A4 = 440.00, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25;
  const F5 = 698.46, G5 = 783.99, A5 = 880.00;

  // Walking bass lines (quarter notes) – exactly the notes from the ABC
  // Walking bass – one octave lower than the original ABC notes
  const walkingBass = [
    // Am7   A c e g
    [A2, C3, E3, G3],
    // Dm7   d f a c'
    [D3, F3, A3, C4],
    // G7    g b d' f'
    [G3, B3, D4, F4],
    // Cmaj7 c e g b
    [C3, E3, G3, B3],
    // Fmaj7 F A c e
    [F2, A2, C3, E3],
    // Dm7   d f a c'
    [D3, F3, A3, C4],
    // E7    E ^G B d
    [E2, Gs2, B2, D3],
    // Am7   A c e g
    [A2, C3, E3, G3],
  ];

  // Harmony – full 7th chords (sustained)
  const chords = [
    [A3, C4, E4, G4],   // Am7
    [D4, F4, A4, C5],   // Dm7
    [G3, B3, D4, F4],   // G7
    [C4, E4, G4, B4],   // Cmaj7
    [F3, A3, C4, E4],   // Fmaj7
    [D4, F4, A4, C5],   // Dm7
    [E3, Gs3, B3, D4],  // E7
    [A3, C4, E4, G4],   // Am7
  ];

  // Simple original melody that sits above the changes
  // Format: [frequency, beatOffset, durationInBeats]
  const melody = [
    // bar 1  Am7
    [[E5, 0, 2], [G5, 2, 2]],
    // bar 2  Dm7
    [[F5, 0, 2], [A5, 2, 2]],
    // bar 3  G7
    [[G5, 0, 2], [F5, 2, 2]],
    // bar 4  Cmaj7
    [[E5, 0, 2], [G5, 2, 1], [E5, 3, 1]],
    // bar 5  Fmaj7
    [[C5, 0, 2], [A4, 2, 2]],
    // bar 6  Dm7
    [[F5, 0, 2], [D5, 2, 2]],
    // bar 7  E7
    [[B4, 0, 2], [Gs4, 2, 2]],
    // bar 8  Am7
    [[A4, 0, 2], [E5, 2, 2]],
  ];

  const cycleDuration = walkingBass.length * barDuration;

  function scheduleNote(instrument, frequency, velocity, start, duration) {
    const note = instrument.play(frequency, velocity, start);
    note.stop(start + duration);
  }

  function scheduleCycle(startTime, id) {
    if (playbackId !== id) return;

    walkingBass.forEach((bassNotes, barIndex) => {
      const barStart = startTime + barIndex * barDuration;

      // Walking bass – one quarter note each
      bassNotes.forEach((freq, i) => {
        scheduleNote(
          synth.instruments.bass,
          freq,
          0.5,
          barStart + i * beat,
          beat * 0.92
        );
      });

      // Harmony – sustained chord for the bar
      chords[barIndex].forEach((freq) => {
        scheduleNote(
          synth.instruments.harmony,
          freq,
          0.7,
          barStart,
          beat * 3.7
        );
      });

      // Melody
      melody[barIndex].forEach(([freq, offset, dur]) => {
        scheduleNote(
          synth.instruments.melody,
          freq,
          0.4,
          barStart + offset * beat,
          dur * beat * 0.9
        );
      });
    });

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

      synth.instruments.bass.stopAll(audioContext.currentTime, 0.04);
      synth.instruments.melody.stopAll(audioContext.currentTime, 0.04);
      synth.instruments.harmony.stopAll(audioContext.currentTime, 0.04);
    },
  };
}
