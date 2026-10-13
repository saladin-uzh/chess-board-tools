(() => {
  "use strict";
  function frequency(snapshot, preferences) {
    if (preferences?.tickMode === "amount") return preferences.tickFrequency;
    if (preferences?.tickMode === "increment" && snapshot?.incrementSeconds > 0) return snapshot.incrementSeconds;
    const time = snapshot?.initialSeconds;
    return typeof time === "number" && Number.isFinite(time) && time > 0
      ? Math.min(30, Math.max(2, Math.ceil(time / 120))) : 10;
  }
  function createTurnTimer() {
    let key = null, session = null, side = null, start = 0, bucket = 0, unavailable = false, interval = 10000;
    return {
      reset() { key = null; session = side = null; bucket = 0; unavailable = false; },
      update(snapshot, now, visible, pending = false, preferences = null) {
        if (!snapshot) {
          unavailable = true;
          if (key !== null) bucket = Math.max(bucket, Math.floor((now - start) / interval));
          return false;
        }
        const samePendingTurn = pending && key !== null && snapshot.session === session && snapshot.side === side;
        const startingPendingTurn = pending && key === null;
        if (!snapshot.active || !snapshot.side || snapshot.context === "analysis" ||
            (!samePendingTurn && !startingPendingTurn && snapshot.side !== snapshot.turn)) { this.reset(); return false; }
        const next = samePendingTurn ? key : `${snapshot.session}:${snapshot.side}:${snapshot.fen}`;
        const nextInterval = frequency(snapshot, preferences) * 1000;
        const wasUnavailable = unavailable;
        unavailable = false;
        if (next !== key || nextInterval !== interval) {
          key = next; session = snapshot.session; side = snapshot.side;
          interval = nextInterval;
          start = now; bucket = 0; return false;
        }
        const elapsedBucket = Math.floor((now - start) / interval);
        if (elapsedBucket <= bucket) return false;
        bucket = elapsedBucket;
        return visible && snapshot.stable && !wasUnavailable;
      },
    };
  }
  function createAudio() {
    let context = null, blocked = false, resuming = false, generation = 0;
    return {
      unlock() {
        if (blocked || resuming) return;
        try {
          const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!Audio) { blocked = true; return; }
          context ??= new Audio();
          if (context.state === "suspended") {
            resuming = true;
            const resumedContext = context, resumedGeneration = generation;
            const current = () => context === resumedContext && generation === resumedGeneration;
            Promise.resolve(resumedContext.resume()).catch(() => { if (current()) blocked = true; })
              .finally(() => { if (current()) resuming = false; });
          }
        } catch { blocked = true; }
      },
      tick(volume = 50) {
        if (!context || context.state !== "running" || blocked || !Number.isFinite(volume) || volume <= 0 || volume > 100) return;
        try {
          const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime;
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.20 * volume / 100, time + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(time); oscillator.stop(time + 0.08);
        } catch { blocked = true; }
      },
      close() {
        const closedContext = context;
        generation++;
        context = null; blocked = false; resuming = false;
        try { if (closedContext) Promise.resolve(closedContext.close()).catch(() => {}); }
        catch { /* A closing context cannot affect the next audio session. */ }
      },
    };
  }
  globalThis.ChessAssistTimer = Object.freeze({ frequency, createTurnTimer, createAudio });
})();
