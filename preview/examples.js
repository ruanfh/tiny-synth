import {
    createExample as createSingleNoteExample,
} from "../examples/01-single-note.js";

export function setupExamples({ ensureAudio, getSynth }) {
    let singleNoteExample;

    const playButton = document.querySelector("#example-play");
    const stopButton = document.querySelector("#example-stop");
    const exampleSource = document.querySelector("#example-source");

    playButton.addEventListener("click", async () => {
        await ensureAudio();

        if (!singleNoteExample) {
            singleNoteExample = createSingleNoteExample(getSynth());
        }

        singleNoteExample.play();
    });

    stopButton.addEventListener("click", () => {
        singleNoteExample?.stop();
    });

    fetch(new URL("../examples/01-single-note.js", import.meta.url))
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not load example source");
            }

            return response.text();
        })
        .then(source => {
            exampleSource.textContent = source;

            if (window.hljs) {
                window.hljs.highlightElement(exampleSource);
            }
        })
        .catch(error => {
            console.error(error);
            exampleSource.textContent = error.message;
        });

    return {
        dispose() {
            singleNoteExample?.stop();
        },
    };
}