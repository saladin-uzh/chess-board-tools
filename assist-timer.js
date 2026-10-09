(() => {
  "use strict";
  function createTurnTimer() {
    let key = null, start = 0, bucket = 0;
    return {
      reset() { key = null; bucket = 0; },
      update(snapshot, now, visible, pending = false) {
        if (!snapshot?.active || !snapshot.side || snapshot.context === "analysis" ||
            (!pending && snapshot.side !== snapshot.turn)) { this.reset(); return false; }
        const next = pending && key !== null ? key : `${snapshot.session}:${snapshot.side}:${snapshot.fen}`;
        if (next !== key) { key = next; start = now; bucket = 0; return false; }
        const elapsedBucket = Math.floor((now - start) / 10000);
        if (elapsedBucket <= bucket) return false;
        bucket = elapsedBucket;
        return visible && snapshot.stable;
      },
    };
  }
  function createAudio() {
    let context = null, blocked = false, resuming = false;
    return {
      unlock() {
        if (blocked || resuming) return;
        try {
          const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!Audio) { blocked = true; return; }
          context ??= new Audio();
          if (context.state === "suspended") {
            resuming = true;
            Promise.resolve(context.resume()).catch(() => { blocked = true; })
              .finally(() => { resuming = false; });
          }
        } catch { blocked = true; }
      },
      tick() {
        if (!context || context.state !== "running" || blocked) return;
        try {
          const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime;
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.035, time + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(time); oscillator.stop(time + 0.08);
        } catch { blocked = true; }
      },
      close() {
        if (context) { Promise.resolve(context.close()).catch(() => {}); context = null; }
        blocked = false;
      },
    };
  }
  globalThis.ChessAssistTimer = Object.freeze({ createTurnTimer, createAudio });
})();
