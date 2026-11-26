// Cakrawala Courier — sound, all synthesised with WebAudio: an engine hum that
// follows the throttle, a chime for a ring, a thud for a hard landing and a
// noise burst for a crash. No audio files, and nothing breaks if the browser
// refuses the AudioContext.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Wind: looped noise through a bandpass, gain follows airspeed.
      const length = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) samples[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 700;
      band.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(band);
      band.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  return {
    /** Call on the first user gesture so the context is allowed to start. */
    unlock() {
      if (ensure() && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    /** Every frame while flying: hum and wind follow throttle and speed. */
    update(throttle, speedKt, engineOn) {
      if (!ensure() || muted || !ctx) return;
      try {
        const target = engineOn ? 0.015 + throttle * 0.05 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speedKt * 0.12, ctx.currentTime, 0.1);
        windGain.gain.setTargetAtTime(Math.min(0.05, speedKt * 0.00028), ctx.currentTime, 0.15);
      } catch {
        // Ignore audio errors mid-flight.
      }
    },
    ring() {
      tone(880, 0.35, 'sine', 0.16);
      tone(1318, 0.5, 'sine', 0.12, 0.09);
    },
    checkpoint() {
      tone(660, 0.3, 'sine', 0.15);
      tone(990, 0.45, 'sine', 0.12, 0.08);
    },
    thud() {
      tone(90, 0.25, 'sine', 0.25);
      tone(60, 0.35, 'triangle', 0.2, 0.02);
    },
    crash() {
      if (!ensure() || muted) return;
      try {
        const length = ctx.sampleRate * 0.7;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.4;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      } catch {
        // Ignore audio errors.
      }
      tone(55, 0.6, 'sine', 0.3);
    },
    click() {
      tone(520, 0.08, 'sine', 0.08);
    },
  };
}
