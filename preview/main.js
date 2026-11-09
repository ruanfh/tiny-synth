import { createSynth } from "../src/index.js";
import { setupExamples } from "./examples.js";

const chordIntervals = {
  monotone: [0],
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const masterInput = document.querySelector("#master-level");
const masterValue = document.querySelector("#master-level-value");

const playAllButton = document.querySelector("#play-all");
const stopAllButton = document.querySelector("#stop-all");

let audioContext;
let synth;

// ---------- Per-instrument state ----------

function createInstrumentUI(name, options = {}) {
  const prefix = name;

  const noteInput = document.querySelector(`#${prefix}-note, #${prefix}-root`);
  const chordInput = document.querySelector(`#${prefix}-chord`);

  const playButton = document.querySelector(`#${prefix}-play`);
  const stopButton = document.querySelector(`#${prefix}-stop`);

  const harmonicInputs = [0, 1, 2, 3, 4].map((i) =>
    document.querySelector(`#${prefix}-harmonic-${i}`)
  );
  const harmonicOutputs = [0, 1, 2, 3, 4].map((i) =>
    document.querySelector(`#${prefix}-harmonic-value-${i}`)
  );

  const depthInput = document.querySelector(`#${prefix}-vibrato-depth`);
  const depthValue = document.querySelector(`#${prefix}-vibrato-depth-value`);
  const rateInput = document.querySelector(`#${prefix}-vibrato-rate`);
  const rateValue = document.querySelector(`#${prefix}-vibrato-rate-value`);

  const attackInput = document.querySelector(`#${prefix}-attack`);
  const attackValue = document.querySelector(`#${prefix}-attack-value`);
  const releaseInput = document.querySelector(`#${prefix}-release`);
  const releaseValue = document.querySelector(`#${prefix}-release-value`);

  const levelInput = document.querySelector(`#${prefix}-level`);
  const levelValue = document.querySelector(`#${prefix}-level-value`);

  let activeNotes = [];
  let activeIntervals = [];

  function getInstrument() {
    return synth?.instruments[name];
  }

  function readAmplitudes() {
    return harmonicInputs.map((input) => Number(input.value));
  }

  function configure() {
    const instrument = getInstrument();
    if (!instrument) return;

    instrument.setAmplitudes(readAmplitudes());
    instrument.setVibratoDepth(Number(depthInput.value));
    instrument.setVibratoRate(Number(rateInput.value));
    instrument.setAttack(Number(attackInput.value));
    instrument.setRelease(Number(releaseInput.value));
    updateLevel();
  }

  function updateLevel() {
    const instrument = getInstrument();
    if (!instrument || !audioContext) return;

    const level = Number(levelInput.value) / 100;

    instrument.output.gain.setTargetAtTime(
      level,
      audioContext.currentTime,
      0.015
    );
  }

  function stop() {
    for (const note of activeNotes) {
      note.stop(undefined, 0.03);
    }
    activeNotes = [];
    activeIntervals = [];
  }

  async function play() {
    await ensureAudio();
    if (synth.disposed) return;

    examples.stopAll();
    stop();
    updateMasterLevel();
    configure();

    const instrument = getInstrument();
    const rootFrequency = Number(noteInput.value);

    if (options.chord && chordInput) {
      const intervals = chordIntervals[chordInput.value];
      const velocity = 0.35 / Math.sqrt(intervals.length);

      for (const semitones of intervals) {
        const frequency = rootFrequency * Math.pow(2, semitones / 12);
        activeIntervals.push(semitones);
        activeNotes.push(instrument.play(frequency, velocity));
      }
    } else {
      const velocity = options.velocity ?? 0.75;
      activeNotes.push(instrument.play(rootFrequency, velocity));
    }
  }

  // Live controls
  noteInput?.addEventListener("change", () => {
    if (activeNotes.length === 0) return;

    const rootFrequency = Number(noteInput.value);

    if (options.chord && activeIntervals.length > 0) {
      activeNotes.forEach((note, index) => {
        note.setFrequency(
          rootFrequency * Math.pow(2, activeIntervals[index] / 12)
        );
      });
    } else if (activeNotes[0]) {
      activeNotes[0].setFrequency(rootFrequency);
    }
  });

  chordInput?.addEventListener("change", () => {
    if (activeNotes.length > 0) play();
  });

  harmonicInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      harmonicOutputs[index].textContent = Number(input.value).toFixed(2);
      getInstrument()?.setAmplitudes(readAmplitudes());
    });
  });

  depthInput.addEventListener("input", () => {
    depthValue.textContent = depthInput.value;
    getInstrument()?.setVibratoDepth(Number(depthInput.value));
  });

  rateInput.addEventListener("input", () => {
    rateValue.textContent = Number(rateInput.value).toFixed(1);
    getInstrument()?.setVibratoRate(Number(rateInput.value));
  });

  attackInput.addEventListener("input", () => {
    attackValue.textContent = Number(attackInput.value).toFixed(2);
    getInstrument()?.setAttack(Number(attackInput.value));
  });

  releaseInput.addEventListener("input", () => {
    releaseValue.textContent = Number(releaseInput.value).toFixed(2);
    getInstrument()?.setRelease(Number(releaseInput.value));
  });

  playButton.addEventListener("click", play);
  stopButton.addEventListener("click", stop);

  return { play, stop, configure };
}

async function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
    synth = createSynth({ audioContext });
    synth.output.connect(audioContext.destination);

    bassUI.configure();
    melodyUI.configure();
    harmonyUI.configure();
    updateMasterLevel();
  }

  if (audioContext.state !== "running") {
    await audioContext.resume();
  }
}

function updateMasterLevel() {
  if (!synth) return;

  synth.output.gain.setTargetAtTime(
    Number(masterInput.value) / 100,
    audioContext.currentTime,
    0.015
  );
}

const bassUI = createInstrumentUI("bass", { velocity: 0.85 });
const melodyUI = createInstrumentUI("melody", { velocity: 0.7 });
const harmonyUI = createInstrumentUI("harmony", { chord: true });

const examples = setupExamples({
  ensureAudio,
  getSynth: () => synth,
  getAudioContext: () => audioContext,
  stopOthers() {
    bassUI.stop();
    melodyUI.stop();
    harmonyUI.stop();
    examples.stopAll();
  },
});

masterInput.addEventListener("input", () => {
  masterValue.textContent = masterInput.value;
  updateMasterLevel();
});

playAllButton.addEventListener("click", async () => {
  examples.stopAll();
  await bassUI.play();
  await melodyUI.play();
  await harmonyUI.play();
});

stopAllButton.addEventListener("click", () => {
  bassUI.stop();
  melodyUI.stop();
  harmonyUI.stop();
  examples.stopAll();
});

window.addEventListener("pagehide", () => {
  bassUI.stop();
  melodyUI.stop();
  harmonyUI.stop();
  examples.dispose();
  synth?.dispose();
});

levelInput.addEventListener("input", () => {
  levelValue.textContent = levelInput.value;
  updateLevel();
});
