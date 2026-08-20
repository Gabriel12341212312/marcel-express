/**
 * Sound. Entirely synthesized — there are no audio files in this project.
 *
 * The bed is deliberately quiet: wind across an embankment, a low rail hum,
 * and the rhythmic clack of rail joints that speeds up as you do. Marcel's
 * diesel sits underneath it and rises only when he is close, so most of the
 * time you hear him without looking, and occasionally you notice he has got
 * loud.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bed = null;
    this.sfx = null;
    this.volume = 0.7;
    this.noise = null;
    this.engine = null;
    this.started = false;
    this.hbIntensity = 0;
    this.hbTimer = null;
    this.clackTimer = 0;
    this.speed = 0;
  }

  /** Must be called from a user gesture. */
  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.bed = this.ctx.createGain();
    this.bed.gain.value = 0.55;
    this.bed.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.noise = this.makeNoise(2);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  makeNoise(seconds) {
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---------------------------- the bed ---------------------------- */

  startAmbience() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // wind across the cutting: band-passed noise, slowly breathing
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 480;
    wf.Q.value = 0.5;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.07;
    const breathAmt = ctx.createGain();
    breathAmt.gain.value = 0.028;
    breath.connect(breathAmt);
    breathAmt.connect(wg.gain);
    wind.connect(wf); wf.connect(wg); wg.connect(this.bed);

    // the low hum a live rail makes, more felt than heard
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 51;
    const hg = ctx.createGain();
    hg.gain.value = 0.035;
    hum.connect(hg); hg.connect(this.bed);

    // a fifth above it, very quiet, to keep the drone from being a dead tone
    const hum2 = ctx.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.value = 76.5;
    const hg2 = ctx.createGain();
    hg2.gain.value = 0.014;
    hum2.connect(hg2); hg2.connect(this.bed);

    wind.start(t0); breath.start(t0); hum.start(t0); hum2.start(t0);
    this.startEngine();
  }

  /**
   * Rail joints. Called every frame with the current speed; it schedules a
   * clack whenever enough track has gone past. This is the metronome the
   * whole game runs to.
   */
  tickRails(dt, speed) {
    if (!this.ctx) return;
    this.speed = speed;
    this.clackTimer -= dt * speed;
    if (this.clackTimer <= 0) {
      this.clackTimer = 18;   // a rail length
      this.clack();
    }
  }

  clack() {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const at of [0, 0.055]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 220 + Math.random() * 90;
      f.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.09);
      src.connect(f); f.connect(g); g.connect(this.bed);
      src.start(t0 + at); src.stop(t0 + at + 0.1);
    }
  }

  /* ---------------------------- Marcel's engine ---------------------------- */

  startEngine() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bed);

    // diesel: a saw through a low-pass, wobbled so it idles rather than drones
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    const wob = ctx.createOscillator();
    wob.frequency.value = 5.4;
    const wobAmt = ctx.createGain();
    wobAmt.gain.value = 7;
    wob.connect(wobAmt); wobAmt.connect(saw.frequency);
    saw.connect(lp); lp.connect(out);

    // radiator fans
    const fans = ctx.createBufferSource();
    fans.buffer = this.noise;
    fans.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 760;
    bp.Q.value = 0.7;
    const fg = ctx.createGain();
    fg.gain.value = 0.28;
    fans.connect(bp); bp.connect(fg); fg.connect(out);

    saw.start(t0); wob.start(t0); fans.start(t0);
    this.engine = { out, saw, lp, wob };
  }

  /** @param {number} i 0 (far down the line) .. 1 (right behind you) */
  setEngine(i) {
    if (!this.engine) return;
    const v = Math.max(0, Math.min(1, i));
    const now = this.ctx.currentTime;
    this.engine.out.gain.setTargetAtTime(0.03 + v * 0.42, now, 0.4);
    this.engine.saw.frequency.setTargetAtTime(34 + v * 26, now, 0.6);
    this.engine.lp.frequency.setTargetAtTime(130 + v * 620, now, 0.6);
    this.engine.wob.frequency.setTargetAtTime(4.5 + v * 7, now, 0.6);
  }

  /* ---------------------------- one-shots ---------------------------- */

  /** A two-tone locomotive horn. Used sparingly; it should mean something. */
  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const [f, at, dur] of [[311, 0, 1.1], [415, 0.06, 1.05]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.10, t0 + at + 0.09);
      g.gain.setValueAtTime(0.10, t0 + at + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(lp); lp.connect(g); g.connect(this.sfx);
      osc.start(t0 + at); osc.stop(t0 + at + dur + 0.05);
    }
  }

  /** The station tannoy: the chime, then something unintelligible. */
  tannoy() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    [[659, 0], [523, 0.28]].forEach(([f, at]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.055, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.7);
      osc.connect(g); g.connect(this.sfx);
      osc.start(t0 + at); osc.stop(t0 + at + 0.75);
    });
    this.speak(1.9, 0.035, 900);
  }

  /**
   * Speech: a band-passed buzz with moving formants. Marcel and the tannoy
   * both use it; neither is meant to be intelligible.
   */
  speak(duration = 1.5, vol = 0.06, centre = 430) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 96;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centre;
    bp.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + duration);
    osc.connect(bp); bp.connect(g); g.connect(this.sfx);
    osc.start(t0); osc.stop(t0 + duration);

    const jitter = setInterval(() => {
      if (!this.ctx) return;
      bp.frequency.setTargetAtTime(centre * (0.6 + Math.random()), ctx.currentTime, 0.03);
    }, 110);
    setTimeout(() => clearInterval(jitter), duration * 1000 + 120);
  }

  /** Switching tracks: the clack of a point blade. */
  switchTrack() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t0); src.stop(t0 + 0.14);
  }

  footstep(onSteel) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = onSteel ? 1.5 : 1.0;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = onSteel ? 900 : 380;
    f.Q.value = onSteel ? 2.0 : 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(onSteel ? 0.10 : 0.14, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t0); src.stop(t0 + 0.1);
  }

  jump() { this.burst(560, 0.09, 0.16, 1.3); }
  land() { this.burst(200, 0.11, 0.13, 0.85); }
  sweep() { this.burst(300, 0.10, 0.55, 1.0, 4200); }

  /** Shared filtered-noise hit. */
  burst(freq, vol, dur, rate = 1, sweepTo = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /** Running into something. Metal, and then a bit of regret. */
  crash() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    this.burst(1800, 0.30, 0.35, 1.0, 160);
    for (const fr of [148, 156]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(fr, t0);
      osc.frequency.exponentialRampToValueAtTime(fr * 0.6, t0 + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(g); g.connect(this.sfx);
      osc.start(t0); osc.stop(t0 + 0.5);
    }
  }

  /** Squeezing past something: a short, soft tick. Heard often, so tiny. */
  graze() { this.arp([1568], 'sine', 0.035, 0.04); }

  coin() { this.arp([1046], 'triangle', 0.05, 0.05); }
  caught() { this.arp([523, 698], 'sine', 0.07, 0.09); }
  good() { this.arp([523, 659, 784], 'sine', 0.06, 0.08); }
  error() { this.arp([349, 294], 'triangle', 0.06, 0.1); }
  powerup() { this.arp([440, 587, 784], 'triangle', 0.07, 0.07); }
  chime() { this.arp([784, 988, 1175, 1568], 'sine', 0.06, 0.09); }

  arp(freqs, type, vol, step) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    freqs.forEach((fr, i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = fr;
      const g = ctx.createGain();
      const at = t0 + i * step;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + step + 0.18);
      osc.connect(g); g.connect(this.sfx);
      osc.start(at); osc.stop(at + step + 0.2);
    });
  }

  /* ---------------------------- heartbeat ---------------------------- */

  setHeartbeat(i) { this.hbIntensity = i; }

  maybeTickHeartbeat() {
    if (this.hbTimer || this.hbIntensity <= 0.02 || !this.ctx) return;
    const iv = 1000 - this.hbIntensity * 620;
    this.hbTimer = setTimeout(() => {
      this.hbTimer = null;
      this.thump(0.16 + this.hbIntensity * 0.2);
      setTimeout(() => this.thump(0.11 + this.hbIntensity * 0.15), 145);
      this.maybeTickHeartbeat();
    }, iv);
  }

  stopHeartbeat() {
    if (this.hbTimer) clearTimeout(this.hbTimer);
    this.hbTimer = null;
    this.hbIntensity = 0;
  }

  thump(vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(52, t0);
    osc.frequency.exponentialRampToValueAtTime(36, t0 + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(g); g.connect(this.sfx);
    osc.start(t0); osc.stop(t0 + 0.18);
  }
}
