
export class FakeAudioParam {
    constructor(value = 0) {
        this.value = value;
        this.calls = [];
    }

    setValueAtTime(value, when) {
        this.value = value;
        this.calls.push({ method: "setValueAtTime", value, when });
    }

    setTargetAtTime(value, when, timeConstant) {
        this.value = value;
        this.calls.push({
            method: "setTargetAtTime",
            value,
            when,
            timeConstant,
        });
    }

    cancelScheduledValues(when) {
        this.calls.push({ method: "cancelScheduledValues", when });
    }

    linearRampToValueAtTime(value, when) {
        this.value = value;
        this.calls.push({ method: "linearRampToValueAtTime", value, when });
    }

    cancelAndHoldAtTime(when) {
        this.calls.push({ method: "cancelAndHoldAtTime", when });
    }
}

export class FakeAudioNode {
    constructor() {
        this.connections = [];
        this.disconnected = false;
    }

    connect(destination) {
        this.connections.push(destination);
        return destination;
    }

    disconnect() {
        this.disconnected = true;
        this.connections = [];
    }
}

export class FakeOscillatorNode extends FakeAudioNode {
    constructor() {
        super();

        this.type = "sine";
        this.frequency = new FakeAudioParam();
        this.detune = new FakeAudioParam();
        this.onended = null;

        this.startCalls = [];
        this.stopCalls = [];
    }

    start(when = 0) {
        this.startCalls.push(when);
    }

    stop(when = 0) {
        this.stopCalls.push(when);
    }

    // Simulate the browser's ended event.
    finish() {
        this.onended?.();
    }
}

export class FakeGainNode extends FakeAudioNode {
    constructor() {
        super();
        this.gain = new FakeAudioParam(1);
    }
}

export class FakeAudioContext {
    constructor({
        sampleRate = 44100,
        currentTime = 0,
    } = {}) {
        this.sampleRate = sampleRate;
        this.currentTime = currentTime;

        this.oscillators = [];
        this.gains = [];
    }

    createOscillator() {
        const oscillator = new FakeOscillatorNode();
        this.oscillators.push(oscillator);
        return oscillator;
    }

    createGain() {
        const gain = new FakeGainNode();
        this.gains.push(gain);
        return gain;
    }
}
