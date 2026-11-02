import {
    createExample as createSingleNoteExample,
} from "../examples/01-single-note.js";

import {
    createExample as createChordExample,
} from "../examples/02-chord.js";

export function setupExamples({ ensureAudio, getSynth }) {
    let singleNoteExample;
    let chordExample;

    const singleNotePlay = document.querySelector("#example-play");
    const singleNoteStop = document.querySelector("#example-stop");
    const singleNoteSource = document.querySelector("#example-source");

    const chordPlay = document.querySelector("#chord-play");
    const chordStop = document.querySelector("#chord-stop");
    const chordSource = document.querySelector("#chord-source");

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

    loadSource(
        "../examples/01-single-note.js",
        singleNoteSource
    );

    loadSource(
        "../examples/02-chord.js",
        chordSource
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
        },
    };
}