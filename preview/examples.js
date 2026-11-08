import {
    createExample as createSingleNoteExample,
} from "../examples/01-single-note.js";

import {
    createExample as createChordExample,
} from "../examples/02-chord.js";

import {
    createExample as createArpeggioExample,
} from "../examples/03-arpeggio.js";

import {
    createExample as createSongExample,
} from "../examples/04-auld-lang-syne.js"

import {
    createExample as createSong2Example,
} from "../examples/05-song2.js"

export function setupExamples({ ensureAudio, getSynth, getAudioContext }) {
    let singleNoteExample;
    let chordExample;
    let arpeggioExample;
    let songExample;
    let song2Example;

    const singleNotePlay = document.querySelector("#example-play");
    const singleNoteStop = document.querySelector("#example-stop");
    const singleNoteSource = document.querySelector("#example-source");

    const chordPlay = document.querySelector("#chord-play");
    const chordStop = document.querySelector("#chord-stop");
    const chordSource = document.querySelector("#chord-source");

    const arpeggioPlay = document.querySelector("#arpeggio-play");
    const arpeggioStop = document.querySelector("#arpeggio-stop");
    const arpeggioSource = document.querySelector("#arpeggio-source");

    const songPlay = document.querySelector("#song-play");
    const songStop = document.querySelector("#song-stop");
    const songSource = document.querySelector("#song-source");

    const song2Play = document.querySelector("#song2-play");
    const song2Stop = document.querySelector("#song2-stop");
    const song2Source = document.querySelector("#song2-source");

    singleNotePlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!singleNoteExample) {
            singleNoteExample = createSingleNoteExample(getSynth(), getAudioContext());
        }

        singleNoteExample.play();
    });

    singleNoteStop.addEventListener("click", () => {
        singleNoteExample?.stop();
    });

    chordPlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!chordExample) {
            chordExample = createChordExample(getSynth(), getAudioContext());
        }

        chordExample.play();
    });

    chordStop.addEventListener("click", () => {
        chordExample?.stop();
    });

    arpeggioPlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!arpeggioExample) {
            arpeggioExample = createArpeggioExample(getSynth(), getAudioContext());
        }

        arpeggioExample.play();
    });

    arpeggioStop.addEventListener("click", () => {
        arpeggioExample?.stop();
    });

    songPlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!songExample) {
            songExample = createSongExample(getSynth(), getAudioContext());
        }

        songExample.play();
    });

    songStop.addEventListener("click", () => {
        songExample?.stop();
    });

    song2Play.addEventListener("click", async () => {
        await ensureAudio();

        if (!song2Example) {
            song2Example = createSong2Example(getSynth(), getAudioContext());
        }

        song2Example.play();
    });

    song2Stop.addEventListener("click", () => {
        song2Example?.stop();
    });

    loadSource(
        "../examples/01-single-note.js",
        singleNoteSource
    );

    loadSource(
        "../examples/02-chord.js",
        chordSource
    );

    loadSource(
        "../examples/03-arpeggio.js",
        arpeggioSource
    );

    loadSource(
        "../examples/04-auld-lang-syne.js",
        songSource
    );

    loadSource(
        "../examples/05-song2.js",
        song2Source
    );

    function loadSource(path, element) {
        fetch(new URL(path, import.meta.url))
            .then(response => {
                if (!response.ok) {
                    throw new Error("Could not load example source");
                }

                return response.text();
            })
            .then(source => {
                element.textContent = source;
                window.hljs?.highlightElement(element);
            })
            .catch(error => {
                console.error(error);
                element.textContent = error.message;
            });
    }

    return {
        dispose() {
            singleNoteExample?.stop();
            chordExample?.stop();
            arpeggioExample?.stop();
            songExample?.stop();
            song2Example?.stop();
        },
    };
}