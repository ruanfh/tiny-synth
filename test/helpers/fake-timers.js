
export function createFakeTimers() {
  const timers = [];

  return {
    timers,

    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },

    runAll() {
      while (timers.length > 0) {
        timers.shift().callback();
      }
    },
  };
}
