
/**
 * Create an attack-release amplitude envelope.
 *
 * Sustain is fixed at 1.
 */
export function createEnvelope({
  audioContext,
  attack = 0.02,
  release = 0.2,
}) {
  if (!audioContext) {
    throw new TypeError("audioContext is required");
  }

  validateTime(attack, "attack");
  validateTime(release, "release");

  const gain = audioContext.createGain();
  gain.gain.value = 0;

  let started = false;
  let stopped = false;
  let startTime = null;
  let activeAttack = attack;

  return {
    output: gain,

    start(when = audioContext.currentTime) {
      if (started || stopped) return;
      started = true;
      startTime = when;
      activeAttack = attack;

      const param = gain.gain;

      param.cancelScheduledValues(when);
      param.setValueAtTime(0, when);
      param.linearRampToValueAtTime(1, when + activeAttack);
    },

    stop(when = audioContext.currentTime, releaseOverride) {
      if (!started || stopped) return;
      stopped = true;

      const param = gain.gain;

      // Calculate the level during the linear attack.
      const elapsed = Math.max(0, when - startTime);
      const level =
        activeAttack === 0
          ? 1
          : Math.min(1, elapsed / activeAttack);

      const releaseTime =
        releaseOverride !== undefined ? releaseOverride : release;

      param.cancelScheduledValues(when);
      param.setValueAtTime(level, when);
      param.linearRampToValueAtTime(0, when + releaseTime);
    },

    setAttack(nextAttack) {
      validateTime(nextAttack, "attack");
      attack = nextAttack;
    },

    setRelease(nextRelease) {
      validateTime(nextRelease, "release");
      release = nextRelease;
    },

    get attack() {
      return attack;
    },

    get release() {
      return release;
    },
  };
}

function validateTime(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `${name} must be a non-negative finite number`
    );
  }
}
