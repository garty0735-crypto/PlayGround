import { clamp } from './utils.js';

/**
 * Tiny procedural sound engine. Everything is synthesised in the browser, so
 * the game has no external audio dependencies and can start instantly.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = localStorage.getItem('railrush-muted') === '1';
    this.musicPlaying = false;
    this.scheduler = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.energy = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 22;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.22;
    compressor.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.58;
    this.master.connect(compressor);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('railrush-muted', muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.58, this.ctx.currentTime + 0.18);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone(frequency, duration, options = {}) {
    if (!this.ctx || this.muted) return;
    const {
      type = 'sine',
      gain = 0.12,
      target = null,
      delay = 0,
      bus = this.sfxBus,
      attack = 0.005,
    } = options;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (target) osc.frequency.exponentialRampToValueAtTime(Math.max(20, target), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  noise(duration, options = {}) {
    if (!this.ctx || this.muted) return;
    const { gain = 0.1, frequency = 1000, q = 0.8, delay = 0, type = 'lowpass' } = options;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = this.ctx.createGain();
    const start = this.ctx.currentTime + delay;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.sfxBus);
    source.start(start);
    source.stop(start + duration);
  }

  click() {
    this.init();
    this.tone(440, 0.05, { type: 'triangle', gain: 0.06, target: 620 });
  }

  countdown(final = false) {
    this.init();
    if (final) {
      this.tone(660, 0.22, { type: 'square', gain: 0.06, target: 880 });
      this.tone(990, 0.32, { type: 'sine', gain: 0.07, delay: 0.06 });
    } else {
      this.tone(420, 0.1, { type: 'square', gain: 0.04, target: 440 });
    }
  }

  coin(combo = 0) {
    const offset = Math.min(combo, 12) * 28;
    this.tone(930 + offset, 0.075, { type: 'sine', gain: 0.095, target: 1400 + offset });
    this.tone(1720 + offset * 1.4, 0.13, { type: 'triangle', gain: 0.045, delay: 0.035 });
  }

  jump() {
    this.tone(210, 0.19, { type: 'triangle', gain: 0.09, target: 540 });
    this.noise(0.12, { gain: 0.035, frequency: 1600, type: 'highpass' });
  }

  land() {
    this.tone(110, 0.12, { type: 'sine', gain: 0.105, target: 58 });
    this.noise(0.08, { gain: 0.04, frequency: 340 });
  }

  slide() {
    this.noise(0.28, { gain: 0.075, frequency: 900, type: 'bandpass', q: 1.4 });
    this.tone(180, 0.22, { type: 'sawtooth', gain: 0.025, target: 90 });
  }

  lane() {
    this.noise(0.08, { gain: 0.032, frequency: 2100, type: 'highpass' });
    this.tone(320, 0.08, { type: 'sine', gain: 0.025, target: 240 });
  }

  powerup(kind = 'shield') {
    const base = kind === 'magnet' ? 420 : 520;
    [0, 0.07, 0.14, 0.23].forEach((delay, i) => {
      this.tone(base * (1 + i * 0.26), 0.22, {
        type: 'triangle',
        gain: 0.075,
        delay,
        target: base * (1.1 + i * 0.26),
      });
    });
  }

  nearMiss() {
    this.tone(1320, 0.12, { type: 'sine', gain: 0.045, target: 1680 });
    this.noise(0.1, { gain: 0.022, frequency: 2600, type: 'highpass' });
  }

  shieldBreak() {
    this.tone(620, 0.4, { type: 'sine', gain: 0.1, target: 120 });
    [0, 0.03, 0.07, 0.12].forEach((delay, i) => {
      this.tone(1500 - i * 170, 0.22, { type: 'triangle', gain: 0.05, delay });
    });
    this.noise(0.32, { gain: 0.1, frequency: 2400, type: 'highpass' });
  }

  crash() {
    this.noise(0.48, { gain: 0.24, frequency: 560, q: 0.55 });
    this.tone(92, 0.55, { type: 'sine', gain: 0.28, target: 38 });
    this.tone(220, 0.18, { type: 'sawtooth', gain: 0.08, target: 70 });
  }

  gameOver() {
    [0, 0.13, 0.3].forEach((delay, i) => {
      this.tone(330 - i * 55, 0.45, { type: 'triangle', gain: 0.06, delay, target: 240 - i * 45 });
    });
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicBus.gain.exponentialRampToValueAtTime(0.28, this.ctx.currentTime + 1.4);
    this.scheduler = setInterval(() => this.scheduleMusic(), 28);
  }

  stopMusic(fade = 0.6) {
    if (!this.ctx) return;
    this.musicPlaying = false;
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
    if (this.musicBus) {
      const time = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(time);
      this.musicBus.gain.setValueAtTime(Math.max(0.0001, this.musicBus.gain.value), time);
      this.musicBus.gain.exponentialRampToValueAtTime(0.0001, time + fade);
    }
  }

  setPaused(paused) {
    if (!this.ctx || !this.musicBus) return;
    const time = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(time);
    this.musicBus.gain.setTargetAtTime(paused ? 0.055 : 0.28, time, 0.08);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicPlaying) return;
    const lookAhead = 0.12;
    const tempo = 126;
    const stepDuration = 60 / tempo / 4;
    while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
      this.scheduleStep(this.step, this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.step = (this.step + 1) % 32;
    }
  }

  scheduleStep(step, time, stepDuration) {
    const ctx = this.ctx;
    const bus = this.musicBus;
    const bassNotes = [55, 0, 0, 55, 0, 65.41, 0, 55, 49, 0, 0, 55, 0, 73.42, 65.41, 0];
    const notes = [220, 0, 329.63, 0, 277.18, 0, 440, 0, 196, 0, 293.66, 0, 329.63, 0, 392, 0];

    const playOsc = (freq, duration, type, gain, target = null) => {
      if (!freq) return;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      if (target) osc.frequency.exponentialRampToValueAtTime(target, time + duration);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.exponentialRampToValueAtTime(gain, time + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(amp);
      amp.connect(bus);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    };

    if ([0, 4, 8, 11].includes(step % 16)) {
      playOsc(130, 0.2, 'sine', 0.3, 42);
    }
    if (step % 8 === 4) {
      // Snare.
      const length = Math.ceil(ctx.sampleRate * 0.1);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.15, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(bus);
      source.start(time);
    }
    if (step % 2 === 1) {
      const length = Math.ceil(ctx.sampleRate * 0.035);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.028, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(bus);
      source.start(time);
    }

    const index = step % 16;
    playOsc(bassNotes[index], stepDuration * 1.8, 'sawtooth', 0.045);
    const melody = notes[(step + 4) % 16];
    playOsc(melody, stepDuration * 0.72, 'triangle', 0.018);
  }

  destroy() {
    this.stopMusic(0);
    this.ctx?.close();
  }
}
