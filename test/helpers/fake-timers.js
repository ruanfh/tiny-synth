export function createFakeTimers() {
  const timers = [];

  return {
    timers,

    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },

    runPending() {
      const pending = timers.splice(0);
      pending.forEach(timer => timer.callback());
    },

    runAll() {
      while (timers.length > 0) {
        timers.shift().callback();
      }
    },
  };
}
