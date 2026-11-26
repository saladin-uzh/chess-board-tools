(() => {
  "use strict";
  function frequency(snapshot, preferences) {
    if (preferences?.tickMode === "amount") return preferences.tickFrequency;
    if (preferences?.tickMode === "increment" && snapshot?.incrementSeconds > 0) return snapshot.incrementSeconds;
    const time = snapshot?.initialSeconds;
    return typeof time === "number" && Number.isFinite(time) && time > 0
      ? Math.min(30, Math.max(2, Math.ceil(time / 120))) : null;
  }
  function createTurnTimer() {
    let key = null, session = null, side = null, start = 0, bucket = 0, unavailable = false, interval = 10000;
    return {
      get turn() { return unavailable ? null : key; },
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
        const seconds = frequency(snapshot, preferences);
        if (seconds === null) { this.reset(); return false; }
        const nextInterval = seconds * 1000;
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
    let cancelTick = null;
    function stop() { cancelTick?.(); }
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
        stop();
        let oscillator, gain;
        const release = () => {
          if (cancelTick === cancel) cancelTick = null;
          if (oscillator) { oscillator.onended = null; oscillator.disconnect(); oscillator = null; }
          gain?.disconnect(); gain = null;
        };
        const cancel = () => {
          try { oscillator?.stop(); } catch { /* The source can be stopped before initialization finishes. */ }
          release();
        };
        try {
          oscillator = context.createOscillator(); gain = context.createGain();
          const time = context.currentTime, peak = 0.20 * volume / 100;
          oscillator.type = "sine";
          for (const [frequency, offset] of [[740, 0], [1110, 0.11]]) {
            const note = time + offset;
            oscillator.frequency.setValueAtTime(frequency, note);
            gain.gain.setValueAtTime(0, note);
            gain.gain.linearRampToValueAtTime(peak, note + 0.006);
            gain.gain.exponentialRampToValueAtTime(Math.min(peak, 0.0001), note + 0.084);
            gain.gain.setValueAtTime(0, note + 0.09);
          }
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.onended = release;
          oscillator.start(time); cancelTick = cancel; oscillator.stop(time + 0.20);
        } catch { blocked = true; cancel(); }
      },
      stop,
      close() {
        stop();
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
