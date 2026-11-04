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

export function setupExamples({ ensureAudio, getSynth, getAudioContext }) {
    let singleNoteExample;
    let chordExample;
    let arpeggioExample;
    let songExample;

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

    singleNotePlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!singleNoteExample) {
            singleNoteExample = createSingleNoteExample(getSynth());
        }

        singleNoteExample.play();
    });

    singleNoteStop.addEventListener("click", () => {
        singleNoteExample?.stop();
    });

    chordPlay.addEventListener("click", async () => {
        await ensureAudio();

        if (!chordExample) {
            chordExample = createChordExample(getSynth());
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
        },
    };
}