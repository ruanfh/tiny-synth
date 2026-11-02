import { createSynth } from "../src/index.js";

const frequencyInput = document.querySelector("#frequency");
const frequencyValue = document.querySelector("#frequency-value");
const chordInput = document.querySelector("#chord");

const depthInput = document.querySelector("#vibrato-depth");
const depthValue = document.querySelector("#vibrato-depth-value");
const rateInput = document.querySelector("#vibrato-rate");
const rateValue = document.querySelector("#vibrato-rate-value");

const attackInput = document.querySelector("#attack");
const attackValue = document.querySelector("#attack-value");
const releaseInput = document.querySelector("#release");
const releaseValue = document.querySelector("#release-value");

const masterInput = document.querySelector("#master-level");
const masterValue = document.querySelector("#master-level-value");

const playButton = document.querySelector("#play");
const stopButton = document.querySelector("#stop");

const amplitudes = [1, 0.5, 0.25, 0.125, 0.0625];

const chordIntervals = {
  monotone: [0],
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const harmonicInputs = amplitudes.map((_, index) =>
  document.querySelector(`#harmonic-${index}`)
);

const harmonicOutputs = amplitudes.map((_, index) =>
  document.querySelector(`#harmonic-value-${index}`)
);

let audioContext;
let synth;
let activeNotes = [];
let activeIntervals = [];

async function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
    synth = createSynth({ audioContext });

    // The host owns the connection to the destination.
    synth.output.connect(audioContext.destination);
  }

  if (audioContext.state !== "running") {
    await audioContext.resume();
  }
}

function updateMasterLevel() {
  if (!synth) return;

  const level = Number(masterInput.value) / 100;
  synth.output.gain.setTargetAtTime(
    level,
    audioContext.currentTime,
    0.015
  );
}

function stopChord() {
  const notes = activeNotes;
  activeNotes = [];
  activeIntervals = [];

  for (const note of notes) {
    note.stop();
  }
}

async function playChord() {
  await ensureAudio();

  if (synth.disposed) return;

  stopChord();
  updateMasterLevel();

  const rootFrequency = Number(frequencyInput.value);
  const intervals = chordIntervals[chordInput.value];
  const voiceLevel = 0.35 / Math.sqrt(intervals.length);

  for (const semitones of intervals) {
    const frequency =
      rootFrequency * Math.pow(2, semitones / 12);

    activeIntervals.push(semitones);

    const note = synth.instruments.harmony.play({
      frequency,
      velocity: voiceLevel,
      amplitudes: [...amplitudes],
      vibratoDepth: Number(depthInput.value),
      vibratoRate: Number(rateInput.value),
      attack: Number(attackInput.value),
      release: Number(releaseInput.value),
    });

    activeNotes.push(note);
  }
}

frequencyInput.addEventListener("input", () => {
  frequencyValue.textContent = frequencyInput.value;

  const rootFrequency = Number(frequencyInput.value);

  activeNotes.forEach((note, index) => {
    const frequency =
      rootFrequency * Math.pow(2, activeIntervals[index] / 12);

    note.setFrequency(frequency);
  });
});

harmonicInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    amplitudes[index] = Number(input.value);
    harmonicOutputs[index].textContent =
      amplitudes[index].toFixed(3);

    for (const note of activeNotes) {
      note.setAmplitudes([...amplitudes]);
    }
  });
});

depthInput.addEventListener("input", () => {
  depthValue.textContent = depthInput.value;

  for (const note of activeNotes) {
    note.setVibratoDepth(Number(depthInput.value));
  }
});

rateInput.addEventListener("input", () => {
  rateValue.textContent = Number(rateInput.value).toFixed(1);

  for (const note of activeNotes) {
    note.setVibratoRate(Number(rateInput.value));
  }
});

attackInput.addEventListener("input", () => {
  attackValue.textContent = Number(attackInput.value).toFixed(2);
  // Attack applies to notes started after this change.
});

releaseInput.addEventListener("input", () => {
  releaseValue.textContent = Number(releaseInput.value).toFixed(2);

  for (const note of activeNotes) {
    note.setRelease(Number(releaseInput.value));
  }
});

masterInput.addEventListener("input", () => {
  masterValue.textContent = masterInput.value;
  updateMasterLevel();
});

playButton.addEventListener("click", playChord);
stopButton.addEventListener("click", stopChord);

window.addEventListener("pagehide", () => {
  stopChord();
  synth?.dispose();
});
