// BLADE WIND — a moonlit samurai duel
// A self-contained pixel-art fighting game. No external assets or libraries.

const VW = 640;
const VH = 360;
const GROUND = 298;
const WORLD_W = 1060;
const GRAVITY = 1180;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
const sign = (v) => (v < 0 ? -1 : 1);
const rnd = (min = 1, max = 0) => min + Math.random() * (max - min);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};
const round = Math.round;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const dom = {
  title: document.getElementById('titleScreen'),
  pause: document.getElementById('pauseScreen'),
  end: document.getElementById('endScreen'),
  start: document.getElementById('startBtn'),
  resume: document.getElementById('resumeBtn'),
  pauseRestart: document.getElementById('pauseRestartBtn'),
  restart: document.getElementById('restartBtn'),
  sound: document.getElementById('soundBtn'),
  soundIcon: document.getElementById('soundIcon'),
  touch: document.getElementById('touchControls'),
  rotate: document.getElementById('rotateHint'),
  best: document.getElementById('bestScore'),
  endEyebrow: document.getElementById('endEyebrow'),
  endTitle: document.getElementById('endTitle'),
  endMessage: document.getElementById('endMessage'),
  endScore: document.getElementById('endScore'),
  endKills: document.getElementById('endKills'),
  endParries: document.getElementById('endParries'),
  endCombo: document.getElementById('endCombo'),
  endTime: document.getElementById('endTime'),
};

const isTouch =
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
  navigator.maxTouchPoints > 0;

function loadStore(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function saveStore(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage can be unavailable */
  }
}

// ---------------------------------------------------------------------------
// Audio: tiny procedural synth for koto, taiko, steel, and wind.
// ---------------------------------------------------------------------------

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.muted = loadStore('bladewind.muted', '0') === '1';
    this.nextNote = 0;
    this.step = 0;
    this.musicStarted = false;
  }

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    this.ctx = ac;

    this.master = ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62;
    this.master.connect(ac.destination);

    this.sfxBus = ac.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);

    this.musicBus = ac.createGain();
    this.musicBus.gain.value = 0.34;
    this.musicBus.connect(this.master);

    const len = ac.sampleRate * 1.2;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    // Low wind/drone bed.
    const droneGain = ac.createGain();
    droneGain.gain.value = 0.018;
    const droneFilter = ac.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 240;
    droneGain.connect(droneFilter).connect(this.musicBus);
    const droneA = ac.createOscillator();
    const droneB = ac.createOscillator();
    droneA.type = 'sine';
    droneB.type = 'triangle';
    droneA.frequency.value = 73.42;
    droneB.frequency.value = 110.0;
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneA.start();
    droneB.start();

    this.resume();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    saveStore('bladewind.muted', muted ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.04);
    }
  }

  toggle() {
    this.init();
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone(freq, dur, type = 'sine', vol = 0.08, when = 0, slideTo = 0, bus = null) {
    if (!this.ctx || this.muted) return;
    const t = when || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  noise(dur, vol, freq = 1200, q = 1, type = 'bandpass', when = 0, slideTo = 0, bus = null) {
    if (!this.ctx || this.muted) return;
    const t = when || this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(bus || this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  swing(heavy = false) {
    this.noise(heavy ? 0.17 : 0.1, heavy ? 0.2 : 0.12, heavy ? 700 : 1100, 0.7, 'bandpass', 0, heavy ? 180 : 320);
    if (heavy) this.tone(150, 0.1, 'triangle', 0.03, 0, 80);
  }
  hit(heavy = false) {
    this.noise(heavy ? 0.13 : 0.08, heavy ? 0.3 : 0.2, heavy ? 420 : 700, 0.8, 'lowpass');
    this.tone(heavy ? 72 : 95, heavy ? 0.16 : 0.1, 'triangle', heavy ? 0.12 : 0.07, 0, 42);
  }
  parry() {
    this.noise(0.11, 0.16, 3200, 1.4, 'highpass');
    this.tone(1180, 0.22, 'triangle', 0.07);
    this.tone(1770, 0.16, 'sine', 0.05);
    this.tone(2470, 0.11, 'sine', 0.035);
    this.tone(590, 0.12, 'square', 0.025);
  }
  deflect() {
    this.noise(0.08, 0.12, 2400, 1, 'highpass');
    this.tone(880, 0.13, 'triangle', 0.05);
    this.tone(1320, 0.09, 'sine', 0.035);
  }
  block() {
    this.noise(0.08, 0.14, 900, 0.8, 'bandpass');
    this.tone(330, 0.09, 'square', 0.035, 0, 220);
  }
  dodge() {
    this.noise(0.14, 0.1, 420, 0.8, 'bandpass', 0, 1500);
  }
  jump() {
    this.tone(210, 0.1, 'sine', 0.035, 0, 330);
  }
  land() {
    this.noise(0.05, 0.08, 320, 0.8, 'lowpass');
  }
  break() {
    this.noise(0.2, 0.18, 500, 0.7, 'lowpass');
    this.tone(120, 0.28, 'sawtooth', 0.055, 0, 55);
  }
  death() {
    this.tone(180, 0.5, 'sawtooth', 0.055, 0, 48);
    this.noise(0.3, 0.1, 500, 0.6, 'lowpass', 0, 120);
  }
  wave() {
    this.tone(110, 1.1, 'triangle', 0.07);
    this.tone(165, 0.9, 'sine', 0.045);
    this.tone(220, 0.7, 'sine', 0.03);
    this.noise(0.5, 0.06, 300, 0.5, 'lowpass');
  }
  heal() {
    [523, 659, 784].forEach((n, i) => this.tone(n, 0.25, 'sine', 0.028, this.ctx ? this.ctx.currentTime + i * 0.07 : 0));
  }
  victory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 440, 523, 659, 784, 1046].forEach((n, i) => {
      this.tone(n, 1.1 - i * 0.08, 'triangle', 0.045, t + i * 0.11);
      this.tone(n * 2, 0.5, 'sine', 0.02, t + i * 0.11);
    });
  }
  defeat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [220, 196, 164, 110, 82].forEach((n, i) => {
      this.tone(n, 0.9, 'triangle', 0.04, t + i * 0.16);
    });
  }

  startMusic() {
    this.init();
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    this.nextNote = this.ctx.currentTime + 0.3;
    this.step = 0;
  }

  updateMusic() {
    if (!this.ctx || this.muted || !this.musicStarted) return;
    const now = this.ctx.currentTime;
    if (this.nextNote < now - 0.5) this.nextNote = now + 0.05;
    while (this.nextNote < now + 0.3) {
      this.musicStep(this.step, this.nextNote);
      this.step++;
      this.nextNote += 0.46;
    }
  }

  musicStep(step, t) {
    const bar = step % 16;
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    if (bar === 0 || bar === 8) {
      this.tone(58, 0.55, 'sine', 0.055, t, 38, this.musicBus);
      this.noise(0.12, 0.035, 160, 0.7, 'lowpass', t, 70, this.musicBus);
    }
    if (bar === 6 || bar === 14) {
      this.tone(72, 0.35, 'sine', 0.035, t, 45, this.musicBus);
    }
    const plucks = [0, 2, 4, 5, 7, 9, 11, 12, 14];
    if (plucks.includes(bar)) {
      const deg = (step * 5 + bar * 3) % scale.length;
      const n = scale[deg];
      this.tone(n, 0.55, 'triangle', 0.018, t, 0, this.musicBus);
      this.tone(n * 2.01, 0.32, 'sine', 0.009, t, 0, this.musicBus);
    }
    if (bar === 12) {
      this.tone(165, 0.8, 'sine', 0.012, t, 0, this.musicBus);
    }
  }
}

const sound = new SoundEngine();

// ---------------------------------------------------------------------------
// Input: keyboard, touch buttons, and gamepad all feed the same action names.
// ---------------------------------------------------------------------------

const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  attack: ['KeyJ', 'KeyX'],
  parry: ['KeyK', 'KeyC'],
  dodge: ['KeyL', 'KeyV', 'ShiftLeft', 'ShiftRight'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  start: ['Enter', 'NumpadEnter'],
};

const GAME_CODES = new Set(Object.values(KEYMAP).flat());

class Input {
  constructor() {
    this.keys = new Set();
    this.just = new Set();
    this.virtual = new Set();
    this.virtualJust = new Set();
    this.gpDown = new Set();
    this.gpJust = new Set();
    this.prevButtons = [];
    this.bindKeyboard();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.just.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.virtual.clear();
    });
  }

  setVirtual(action, down) {
    if (down) {
      if (!this.virtual.has(action)) this.virtualJust.add(action);
      this.virtual.add(action);
    } else {
      this.virtual.delete(action);
    }
  }

  down(action) {
    if (this.virtual.has(action) || this.gpDown.has(action)) return true;
    const codes = KEYMAP[action] || [];
    return codes.some((c) => this.keys.has(c));
  }

  pressed(action) {
    if (this.virtualJust.has(action) || this.gpJust.has(action)) return true;
    const codes = KEYMAP[action] || [];
    return codes.some((c) => this.just.has(c));
  }

  pollGamepad() {
    this.gpDown.clear();
    this.gpJust.clear();
    if (!navigator.getGamepads) return;
    let pad = null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      this.prevButtons = [];
      return;
    }
    const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const axis = pad.axes[0] || 0;
    const map = { 0: 'jump', 1: 'dodge', 2: 'attack', 3: 'parry', 9: 'start' };
    for (const [i, action] of Object.entries(map)) {
      const idx = Number(i);
      if (pressed(idx)) {
        this.gpDown.add(action);
        if (!this.prevButtons[idx]) this.gpJust.add(action);
      }
    }
    if (axis < -0.32 || pressed(14)) this.gpDown.add('left');
    if (axis > 0.32 || pressed(15)) this.gpDown.add('right');
    if (pressed(8)) this.gpDown.add('pause');
    this.prevButtons = pad.buttons.map((b) => b.pressed);
  }

  endFrame() {
    this.just.clear();
    this.virtualJust.clear();
    this.gpJust.clear();
  }

  moveAxis() {
    let axis = 0;
    if (this.down('left')) axis -= 1;
    if (this.down('right')) axis += 1;
    return axis;
  }
}

const input = new Input();

// Touch buttons.
document.querySelectorAll('.touch-btn').forEach((btn) => {
  const action = btn.dataset.action;
  const press = (e) => {
    e.preventDefault();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    input.setVirtual(action, true);
    btn.classList.add('active');
  };
  const release = (e) => {
    if (e) e.preventDefault();
    input.setVirtual(action, false);
    btn.classList.remove('active');
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---------------------------------------------------------------------------
// Pixel palettes and combat data.
// ---------------------------------------------------------------------------

const PALETTES = {
  player: {
    robe: '#27344e', robe2: '#182135', robe3: '#33425f',
    trim: '#b83643', skin: '#e0b48a', skin2: '#b98968',
    hair: '#141219', steel: '#eef7f6', edge: '#ffffff',
    accent: '#e5c371', scarf: '#b52f3c', scarf2: '#7d1f2c',
    eye: '#f3e6cc',
  },
  ronin: {
    robe: '#43302b', robe2: '#2b1e1b', robe3: '#574039',
    trim: '#9b6c3c', skin: '#d1a27a', skin2: '#a77b59',
    hair: '#171319', steel: '#d6dfe0', edge: '#ffffff',
    accent: '#b58a4b', scarf: '#694037', scarf2: '#422823',
    eye: '#f0dec4',
  },
  ninja: {
    robe: '#28243c', robe2: '#181527', robe3: '#373152',
    trim: '#55aaa8', skin: '#403749', skin2: '#2b2533',
    hair: '#0d0c12', steel: '#c6dcdd', edge: '#ffffff',
    accent: '#59b7b2', scarf: '#3b8c89', scarf2: '#235554',
    eye: '#c8ffff',
  },
  brute: {
    robe: '#332d30', robe2: '#211d20', robe3: '#493f42',
    trim: '#8e3d38', skin: '#bd916b', skin2: '#8f6a4d',
    hair: '#121014', steel: '#cbd3d3', edge: '#ffffff',
    accent: '#a84b42', scarf: '#572e2c', scarf2: '#381d1c',
    eye: '#ffcf8e',
  },
  boss: {
    robe: '#422938', robe2: '#281722', robe3: '#5d3a4b',
    trim: '#d8aa50', skin: '#dbb58c', skin2: '#af8766',
    hair: '#e9e3d5', steel: '#fff1c2', edge: '#ffffff',
    accent: '#e3b95e', scarf: '#8d1e2d', scarf2: '#56121d',
    eye: '#ffd77a',
  },
};

const KINDS = {
  player: {
    name: 'RONIN', hp: 100, posture: 0, speed: 158, jump: 352,
    w: 17, h: 48, scale: 1, reach: 72, preferred: 54,
  },
  ronin: {
    name: 'WANDERING RONIN', hp: 54, posture: 58, speed: 84, jump: 282,
    w: 17, h: 46, scale: 1, reach: 72, preferred: 55,
    aggression: 0.55, parryChance: 0.12, dodgeChance: 0.12,
    attackCd: [1.0, 2.0], chainChance: 0.55,
  },
  ninja: {
    name: 'SHADOW', hp: 42, posture: 46, speed: 114, jump: 322,
    w: 16, h: 44, scale: 0.94, reach: 80, preferred: 48,
    aggression: 0.72, parryChance: 0.17, dodgeChance: 0.22,
    attackCd: [0.75, 1.45], chainChance: 0.45,
  },
  brute: {
    name: 'IRON MONK', hp: 108, posture: 96, speed: 61, jump: 242,
    w: 24, h: 52, scale: 1.16, reach: 84, preferred: 63,
    aggression: 0.48, parryChance: 0.06, dodgeChance: 0.04,
    attackCd: [1.35, 2.4], chainChance: 0.3,
  },
  boss: {
    name: 'LORD OF ASH', hp: 230, posture: 150, speed: 97, jump: 302,
    w: 24, h: 54, scale: 1.2, reach: 94, preferred: 66,
    aggression: 0.78, parryChance: 0.16, dodgeChance: 0.18,
    attackCd: [0.8, 1.5], chainChance: 0.9,
  },
};

const PLAYER_ATTACKS = [
  {
    name: 'cut', windup: 0.07, active: 0.09, recover: 0.17,
    damage: 10, range: 58, height: 38, posture: 8, knock: 95,
    lunge: 125, hurt: 0.2, swingStart: -1.7, swingEnd: 1.05,
  },
  {
    name: 'rise', windup: 0.09, active: 0.09, recover: 0.19,
    damage: 11, range: 62, height: 38, posture: 9, knock: 108,
    lunge: 135, hurt: 0.2, swingStart: -1.85, swingEnd: 1.15,
  },
  {
    name: 'moonfall', windup: 0.15, active: 0.12, recover: 0.3,
    damage: 20, range: 70, height: 42, posture: 18, knock: 220,
    lunge: 165, hurt: 0.34, swingStart: -2.75, swingEnd: 0.72, heavy: true,
  },
];

const MOVES = {
  r_slash: {
    windup: 0.4, active: 0.09, recover: 0.36, damage: 10, range: 64,
    height: 38, posture: 10, knock: 112, lunge: 90, hurt: 0.24,
    swingStart: -1.75, swingEnd: 1.0,
  },
  r_slash2: {
    windup: 0.24, active: 0.08, recover: 0.42, damage: 11, range: 66,
    height: 38, posture: 11, knock: 122, lunge: 112, hurt: 0.24,
    swingStart: -1.7, swingEnd: 1.1,
  },
  r_heavy: {
    windup: 0.72, active: 0.12, recover: 0.55, damage: 19, range: 74,
    height: 40, posture: 16, knock: 195, lunge: 82, hurt: 0.4,
    swingStart: -2.7, swingEnd: 0.62, heavy: true, unblockable: true,
  },
  n_slash: {
    windup: 0.25, active: 0.07, recover: 0.3, damage: 8, range: 58,
    height: 38, posture: 8, knock: 90, lunge: 120, hurt: 0.2,
    swingStart: -1.55, swingEnd: 1.0,
  },
  n_dash: {
    windup: 0.34, active: 0.1, recover: 0.38, damage: 11, range: 78,
    height: 40, posture: 12, knock: 145, lunge: 265, hurt: 0.28,
    swingStart: -1.8, swingEnd: 1.12, heavy: true,
  },
  b_sweep: {
    windup: 0.62, active: 0.13, recover: 0.55, damage: 16, range: 80,
    height: 40, posture: 15, knock: 175, lunge: 62, hurt: 0.34,
    swingStart: -1.9, swingEnd: 1.15, heavy: true,
  },
  b_smash: {
    windup: 0.82, active: 0.14, recover: 0.68, damage: 22, range: 84,
    height: 44, posture: 20, knock: 230, lunge: 74, hurt: 0.44,
    swingStart: -2.85, swingEnd: 0.55, heavy: true, unblockable: true,
  },
  boss_slash: {
    windup: 0.34, active: 0.08, recover: 0.28, damage: 11, range: 72,
    height: 40, posture: 10, knock: 120, lunge: 110, hurt: 0.24,
    swingStart: -1.8, swingEnd: 1.05,
  },
  boss_slash2: {
    windup: 0.22, active: 0.08, recover: 0.3, damage: 12, range: 74,
    height: 40, posture: 10, knock: 130, lunge: 120, hurt: 0.24,
    swingStart: -1.6, swingEnd: 1.12,
  },
  boss_red: {
    windup: 0.62, active: 0.13, recover: 0.5, damage: 20, range: 84,
    height: 42, posture: 18, knock: 230, lunge: 100, hurt: 0.42,
    swingStart: -2.75, swingEnd: 0.6, heavy: true, unblockable: true,
  },
  boss_quick: {
    windup: 0.2, active: 0.07, recover: 0.24, damage: 9, range: 68,
    height: 38, posture: 8, knock: 95, lunge: 90, hurt: 0.2,
    swingStart: -1.55, swingEnd: 1.0,
  },
  boss_lunge: {
    windup: 0.55, active: 0.14, recover: 0.55, damage: 24, range: 96,
    height: 44, posture: 22, knock: 260, lunge: 300, hurt: 0.46,
    swingStart: -1.9, swingEnd: 1.15, heavy: true, unblockable: true,
  },
};

const PATTERNS = {
  ronin: [
    ['r_slash'],
    ['r_slash', 'r_slash2'],
    ['r_heavy'],
    ['r_slash', 'r_heavy'],
  ],
  ninja: [
    ['n_slash'],
    ['n_dash'],
    ['n_slash', 'n_slash'],
    ['n_slash', 'n_dash'],
  ],
  brute: [
    ['b_sweep'],
    ['b_smash'],
    ['b_sweep', 'b_smash'],
  ],
  boss: [
    ['boss_slash', 'boss_slash2', 'boss_red'],
    ['boss_quick', 'boss_quick', 'boss_lunge'],
    ['boss_lunge'],
    ['boss_slash', 'boss_red'],
    ['boss_quick', 'boss_slash2', 'boss_lunge'],
  ],
};

const WAVES = [
  {
    name: 'THE WANDERER',
    sub: 'One blade waits beneath the gate',
    enemies: [{ kind: 'ronin', side: 1, offset: 235 }],
  },
  {
    name: 'TWIN MOONS',
    sub: 'Steel answers steel',
    enemies: [
      { kind: 'ronin', side: 1, offset: 220 },
      { kind: 'ninja', side: -1, offset: 245 },
    ],
  },
  {
    name: 'NIGHT STALKERS',
    sub: 'Shadows do not announce themselves',
    enemies: [
      { kind: 'ninja', side: 1, offset: 210 },
      { kind: 'ninja', side: -1, offset: 270 },
    ],
  },
  {
    name: 'THE IRON MONK',
    sub: 'A mountain that swings a blade',
    enemies: [
      { kind: 'brute', side: 1, offset: 230 },
      { kind: 'ronin', side: -1, offset: 280 },
    ],
  },
  {
    name: 'LORD OF ASH',
    sub: 'The last duel. The moon is watching.',
    boss: true,
    enemies: [{ kind: 'boss', side: 1, offset: 300 }],
  },
];

function makeMove(base) {
  const move = { ...base, total: base.windup + base.active + base.recover };
  return move;
}

// ---------------------------------------------------------------------------
// Fighter: shared physics, state machine, attacks and defense.
// ---------------------------------------------------------------------------

let NEXT_FIGHTER_ID = 1;

class Fighter {
  constructor(kind, x, opts = {}) {
    const stats = KINDS[kind];
    this.id = NEXT_FIGHTER_ID++;
    this.kind = kind;
    this.stats = stats;
    this.isPlayer = kind === 'player';
    this.scale = stats.scale || 1;
    this.w = stats.w * this.scale;
    this.h = stats.h * this.scale;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.maxPosture = stats.posture;
    this.posture = 0;
    this.postureDelay = 0;
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = opts.facing || 1;
    this.speed = stats.speed;
    this.jumpPower = stats.jump;
    this.moveIntent = 0;

    this.state = 'idle';
    this.stateT = 0;
    this.stateDur = 0;
    this.dead = false;
    this.deathT = 0;

    this.attack = null;
    this.attackIndex = 0;
    this.attackSerial = 0;
    this.lastSeenAttack = -1;
    this.hitSet = new Set();
    this.swingPlayed = false;
    this.hitLanded = false;
    this.attackQueue = 0;
    this.comboIndex = 0;
    this.comboWindow = 0;

    this.parryDur = 0.34;
    this.parryWindow = 0.19;
    this.parryCd = 0;
    this.dodgeDur = 0.28;
    this.dodgeCd = 0;
    this.dodgeDir = 1;
    this.iframe = 0;
    this.perfectDodge = false;

    this.attackCd = rnd(stats.attackCd ? stats.attackCd[0] : 1, stats.attackCd ? stats.attackCd[1] : 2);
    this.jumpCd = 0;
    this.aiTimer = 0;
    this.aiDecision = rnd(0.04, 0.14);
    this.enemyPattern = null;
    this.enemyPatternIndex = 0;
    this.phase = 1;

    this.hurtT = 0;
    this.invuln = 0;
    this.flash = 0;
    this.spawnT = opts.spawnT || 0;
    this.flashColor = '#ffffff';

    this.spawnSide = opts.facing || 1;
    this.scarfPhase = rnd(0, TAU);
  }

  get alive() {
    return !this.dead && this.state !== 'dead';
  }

  canAct() {
    return this.onGround && (this.state === 'idle' || this.state === 'run');
  }

  setState(name, dur = 0) {
    if (this.dead) return;
    this.state = name;
    this.stateT = 0;
    this.stateDur = dur;
  }

  addHp(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  faceTarget(game) {
    const target = this.isPlayer
      ? game.enemies.find((e) => e.alive && Math.abs(e.x - this.x) < 150) ||
        game.enemies.find((e) => e.alive)
      : game.player;
    if (target && !target.dead && Math.abs(target.x - this.x) > 2) {
      this.facing = sign(target.x - this.x);
    }
  }

  updateTimers(dt) {
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.jumpCd = Math.max(0, this.jumpCd - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.aiDecision -= dt;
    if (this.posture > 0) {
      this.postureDelay = Math.max(0, this.postureDelay - dt);
      if (this.postureDelay <= 0) this.posture = Math.max(0, this.posture - 7.5 * dt);
    }
  }

  jump(game, dir = 0) {
    if (!this.canAct()) return false;
    const d = dir || this.moveIntent || this.facing;
    this.setState('jump', 0);
    this.vy = -this.jumpPower;
    this.onGround = false;
    this.vx = d * this.speed * 0.92;
    this.facing = sign(d);
    game.spawnDust(this.x, this.y, -sign(d), 4);
    if (this.isPlayer) sound.jump();
    return true;
  }

  requestParry(game) {
    if (!this.canAct() || this.parryCd > 0) return false;
    this.faceTarget(game);
    this.attackQueue = 0;
    this.setState('parry', this.parryDur);
    this.parryCd = this.isPlayer ? 0.38 : rnd(2.2, 4.2);
    this.vx *= 0.24;
    return true;
  }

  requestDodge(game, dir = 0) {
    if (!this.canAct() || this.dodgeCd > 0) return false;
    let d = dir;
    if (!d) d = this.moveIntent || -this.facing;
    if (this.x < 50) d = Math.max(d, 1);
    if (this.x > WORLD_W - 50) d = Math.min(d, -1);
    this.attackQueue = 0;
    this.setState('dodge', this.dodgeDur);
    this.dodgeDir = d;
    this.iframe = 0.21;
    this.perfectDodge = false;
    game.spawnAfterimages(this);
    this.dodgeCd = this.isPlayer ? 0.55 : rnd(1.35, 2.5);
    this.facing = sign(d);
    this.vx = d * this.speed * (this.isPlayer ? 3.15 : 2.9);
    game.spawnDust(this.x, this.y, -sign(d), 6);
    if (this.isPlayer) sound.dodge();
    return true;
  }

  requestAttack(game) {
    if (this.state === 'attack') {
      if (this.attack && this.stateT > this.attack.windup * 0.3 && this.attackQueue < 2) {
        this.attackQueue++;
      }
      return;
    }
    if (!this.canAct()) return;
    let idx = 0;
    if (this.comboWindow > 0) idx = Math.min(this.comboIndex + 1, 2);
    this.startAttack(idx, game);
  }

  startAttack(index, game) {
    let move;
    if (this.isPlayer) {
      move = makeMove(PLAYER_ATTACKS[index] || PLAYER_ATTACKS[0]);
      this.attackIndex = index;
    } else {
      const key = this.enemyPattern
        ? this.enemyPattern[this.enemyPatternIndex]
        : 'r_slash';
      move = makeMove(MOVES[key] || MOVES.r_slash);
      if (this.kind === 'boss' && this.phase === 2) {
        move = {
          ...move,
          windup: move.windup * 0.8,
          recover: move.recover * 0.82,
          damage: move.damage * 1.1,
          total: move.windup * 0.8 + move.active + move.recover * 0.82,
        };
      }
    }
    this.faceTarget(game);
    this.attackSerial++;
    this.attack = move;
    this.state = 'attack';
    this.stateT = 0;
    this.stateDur = move.total;
    this.hitSet.clear();
    this.swingPlayed = false;
    this.hitLanded = false;
    this.comboWindow = 0;
    this.vx = this.facing * move.lunge;
  }

  updateAttack(dt, game) {
    const a = this.attack;
    if (!a) {
      this.setState('idle');
      return;
    }
    if (!this.swingPlayed && this.stateT >= a.windup) {
      this.swingPlayed = true;
      sound.swing(!!a.heavy);
    }
    if (this.stateT >= a.windup && this.stateT <= a.windup + a.active) {
      this.performHits(game);
    }
    if (this.stateT < a.total) return;

    if (this.isPlayer) {
      this.comboIndex = this.attackIndex;
      this.comboWindow = this.attackIndex === 2 ? 0 : 0.44;
      if (this.attackQueue > 0 && this.attackIndex < 2) {
        this.attackQueue--;
        this.startAttack(this.attackIndex + 1, game);
        return;
      }
      this.attackQueue = 0;
      this.setState('idle');
    } else {
      if (
        this.enemyPattern &&
        this.enemyPatternIndex < this.enemyPattern.length - 1 &&
        !game.player.dead &&
        Math.random() < this.stats.chainChance
      ) {
        this.enemyPatternIndex++;
        this.startAttack(0, game);
        return;
      }
      this.enemyPattern = null;
      this.setState('idle');
      this.attackCd = rnd(this.stats.attackCd[0], this.stats.attackCd[1]);
    }
  }

  applyPhysics(dt, game) {
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y >= GROUND) {
      if (this.vy > 120) game.spawnDust(this.x, GROUND, 0, 3);
      this.y = GROUND;
      this.vy = 0;
      this.onGround = true;
      if (this.state === 'jump') {
        this.setState('idle');
        if (this.isPlayer) sound.land();
      }
    } else {
      this.onGround = false;
    }
    this.x = clamp(this.x, 28, WORLD_W - 28);
  }

  update(dt, game) {
    if (this.dead) {
      this.deathT += dt;
      this.stateT += dt;
      this.vx = approach(this.vx, 0, 650 * dt);
      this.applyPhysics(dt, game);
      return;
    }
    this.stateT += dt;
    this.updateTimers(dt);

    if (this.spawnT > 0) {
      this.spawnT -= dt;
      this.moveIntent = 0;
      this.vx = approach(this.vx, 0, 900 * dt);
      this.applyPhysics(dt, game);
      return;
    }

    switch (this.state) {
      case 'hurt':
      case 'stagger':
      case 'block':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.stateT >= this.stateDur) this.setState('idle');
        this.applyPhysics(dt, game);
        return;

      case 'attack': {
        this.updateAttack(dt, game);
        const a = this.attack;
        const sliding = a && this.stateT < a.windup + a.active + 0.02;
        this.vx = approach(this.vx, 0, (sliding ? 260 : 1000) * dt);
        this.applyPhysics(dt, game);
        return;
      }

      case 'parry':
        this.vx = approach(this.vx, 0, 1250 * dt);
        if (this.stateT >= this.parryDur) this.setState('idle');
        this.applyPhysics(dt, game);
        return;

      case 'dodge':
        this.vx = approach(this.vx, 0, 520 * dt);
        if (this.stateT >= this.stateDur) this.setState('idle');
        this.applyPhysics(dt, game);
        return;

      case 'jump':
        this.vx = approach(this.vx, this.moveIntent * this.speed * 0.9, 620 * dt);
        if (this.moveIntent) this.facing = this.moveIntent;
        this.applyPhysics(dt, game);
        return;

      default: {
        this.vx = approach(this.vx, this.moveIntent * this.speed, 1650 * dt);
        if (this.moveIntent) this.facing = this.moveIntent;
        const want = this.onGround ? (this.moveIntent ? 'run' : 'idle') : 'jump';
        if (this.state !== want) {
          this.state = want;
          this.stateT = 0;
        }
        this.applyPhysics(dt, game);
      }
    }
  }

  inHitbox(target, attack) {
    const dx = (target.x - this.x) * this.facing;
    const dy = Math.abs(target.y - this.y);
    return dx > -10 && dx < attack.range + target.w * 0.45 && dy < attack.height;
  }

  performHits(game) {
    const targets = this.isPlayer ? game.enemies : [game.player];
    for (const target of targets) {
      if (!target || target.dead || this.hitSet.has(target.id)) continue;
      if (!this.inHitbox(target, this.attack)) continue;
      this.hitSet.add(target.id);
      const result = target.receiveHit(this, this.attack, game);
      if (result && result !== 'miss') this.hitLanded = true;
    }
  }

  receiveHit(attacker, attack, game) {
    if (this.dead) return null;
    if (this.spawnT > 0) return null;
    if (attack.unblockable && !this.onGround && this.y < GROUND - 8) return 'miss';

    if (this.state === 'dodge' && this.iframe > 0) {
      if (this.isPlayer && !this.perfectDodge && this.stateT < 0.17) {
        this.perfectDodge = true;
        game.onPerfectDodge(this, attacker);
      }
      return 'miss';
    }
    if (this.invuln > 0) return 'miss';

    if (this.state === 'parry' && !attack.unblockable) {
      if (this.stateT <= this.parryWindow) {
        this.setState('idle');
        this.parryCd = Math.min(this.parryCd, 0.16);
        game.onParry(this, attacker);
        return 'parry';
      }
      return this.blockHit(attacker, attack, game);
    }

    return this.takeDamage(attacker, attack, game);
  }

  blockHit(attacker, attack, game) {
    const dir = Math.abs(this.x - attacker.x) > 1 ? sign(this.x - attacker.x) : attacker.facing;
    let dmg = attack.damage * 0.24;
    if (this.isPlayer) dmg = Math.min(dmg, 5.5);
    this.hp -= dmg;
    this.flash = 0.12;
    this.flashColor = '#d9e4e2';
    this.invuln = 0.22;
    this.setState('block', 0.16);
    this.vx = dir * 88;
    if (!this.isPlayer) {
      this.posture = Math.min(this.maxPosture, this.posture + attack.posture * 1.25);
      this.postureDelay = 1.4;
    }
    game.onBlock(this, attacker, attack, dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    } else if (!this.isPlayer && this.posture >= this.maxPosture) {
      this.breakGuard(game);
    }
    return 'block';
  }

  takeDamage(attacker, attack, game) {
    const dir = Math.abs(this.x - attacker.x) > 1 ? sign(this.x - attacker.x) : attacker.facing;
    let dmg = attack.damage;
    if (this.state === 'stagger') dmg *= 1.5;
    this.attackQueue = 0;
    this.hp -= dmg;
    this.flash = 0.15;
    this.flashColor = '#ff9d91';
    this.invuln = this.isPlayer ? 0.44 : 0.1;
    this.setState('hurt', attack.hurt || 0.24);
    this.vx = dir * (attack.knock || 110);
    if (attack.unblockable && attack.heavy) this.vy = -55;
    if (!this.isPlayer) {
      this.posture = Math.min(this.maxPosture, this.posture + attack.posture * 0.55);
      this.postureDelay = 1.5;
    }
    game.onDamage(this, attacker, dmg, attack);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    } else if (!this.isPlayer && this.posture >= this.maxPosture) {
      this.breakGuard(game);
    }
    return 'hurt';
  }

  stagger(dur = 0.6) {
    if (this.dead) return;
    this.attack = null;
    this.enemyPattern = null;
    this.attackQueue = 0;
    this.setState('stagger', dur);
  }

  breakGuard(game) {
    if (this.dead) return;
    if (this.state === 'stagger') {
      this.stateDur = Math.max(this.stateDur, 1.15);
      return;
    }
    this.posture = 0;
    this.attack = null;
    this.enemyPattern = null;
    this.setState('stagger', 1.3);
    this.invuln = 0.08;
    game.onGuardBreak(this);
  }

  die(game) {
    if (this.dead) return;
    this.state = 'dead';
    this.stateT = 0;
    this.deathT = 0;
    this.dead = true;
    this.attack = null;
    this.enemyPattern = null;
    game.onDeath(this);
  }

  // -------------------------------------------------------------------------
  // Enemy thoughts: approach, read the player's wind-up, parry, dodge, jump.
  // -------------------------------------------------------------------------

  updateAI(dt, game) {
    if (this.dead || this.spawnT > 0) {
      this.moveIntent = 0;
      return;
    }
    const player = game.player;
    if (!player || player.dead) {
      this.moveIntent = 0;
      return;
    }

    if (this.kind === 'boss' && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.speed = this.stats.speed * 1.12;
      game.onBossPhase2(this);
    }

    if (!this.canAct()) {
      this.moveIntent = 0;
      return;
    }

    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    if (dist > 3) this.facing = dir;

    let move = 0;
    if (dist > this.stats.preferred + 8) move = dir;
    else if (dist < 23) move = -dir;
    if (dist < 60) {
      for (const other of game.enemies) {
        if (other === this || !other.alive) continue;
        if (Math.abs(other.x - this.x) < 22 && Math.abs(other.y - this.y) < 26) {
          move = Math.abs(player.x - other.x) < dist ? -dir * 0.4 : dir * 0.4;
        }
      }
    }
    this.moveIntent = move;

    // A blade read the instant it is drawn. One fair roll per player attack.
    if (player.state === 'attack' && player.attackSerial !== this.lastSeenAttack) {
      this.lastSeenAttack = player.attackSerial;
      if (dist < 108) {
        if (
          this.parryCd <= 0 &&
          dist < 94 &&
          Math.random() < this.stats.parryChance
        ) {
          this.requestParry(game);
          return;
        }
        if (this.dodgeCd <= 0 && Math.random() < this.stats.dodgeChance) {
          this.requestDodge(game, dist < 32 ? dir : -dir);
          return;
        }
      }
    }

    // Occasional leap over the player, and hopping approaches from range.
    if (this.jumpCd <= 0) {
      if (dist < 46 && Math.random() < dt * 1.15) {
        this.jump(game, Math.random() < 0.7 ? dir : -dir);
        this.jumpCd = rnd(2.8, 4.6);
        return;
      }
      if (dist > 165 && Math.random() < dt * 0.28) {
        this.jump(game, dir);
        this.jumpCd = rnd(3.5, 5.5);
        return;
      }
    }

    if (this.aiDecision <= 0) {
      this.aiDecision = rnd(0.06, 0.13);
      const reach = this.stats.reach;
      if (
        this.attackCd <= 0 &&
        dist < reach + 9 &&
        Math.abs(player.y - this.y) < 22 &&
        game.canEnemyAttack(this) &&
        Math.random() < this.stats.aggression
      ) {
        this.startEnemyPattern(game, dist);
        return;
      }
      // Reposition with a short hop when the player is far and passive.
      if (dist > 150 && Math.random() < 0.08) {
        this.moveIntent = dir;
      }
    }
  }

  startEnemyPattern(game, dist) {
    let list = PATTERNS[this.kind] || PATTERNS.ronin;
    let chosen = pick(list);
    if (this.kind === 'boss') {
      if (dist > 125) {
        chosen = pick([PATTERNS.boss[1], PATTERNS.boss[2], PATTERNS.boss[4]]);
      } else if (this.phase === 2 && Math.random() < 0.4) {
        chosen = pick([PATTERNS.boss[0], PATTERNS.boss[1], PATTERNS.boss[4]]);
      }
    }
    this.enemyPattern = chosen.slice();
    this.enemyPatternIndex = 0;
    this.startAttack(0, game);
  }
}

// ---------------------------------------------------------------------------
// Game orchestration: five waves, camera, effects, scoring, and UI.
// ---------------------------------------------------------------------------

class Game {
  constructor() {
    this.state = 'title';
    this.paused = false;
    this.ending = false;
    this.endTimer = 0;
    this.time = 0;
    this.ambientTime = 0;
    this.elapsed = 0;

    this.player = new Fighter('player', 470);
    this.enemies = [];
    this.camX = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.flashT = 0;
    this.flashMax = 0.1;
    this.flashColor = '#ffffff';

    this.waveIndex = -1;
    this.waveState = 'idle';
    this.waveTimer = 0;
    this.banner = null;
    this.tutorialT = 0;

    this.score = 0;
    this.kills = 0;
    this.parries = 0;
    this.perfectDodges = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.best = Number(loadStore('bladewind.best', '0')) || 0;

    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.afterimages = [];
    this.petals = [];

    this.attractPlayer = new Fighter('player', 858, { facing: 1 });
    this.attractEnemy = new Fighter('ronin', 984, { facing: -1 });
    this.attractPlayer.stateT = 3;
    this.attractEnemy.stateT = 7;

    this.initPetals();
    this.camX = WORLD_W - VW;
    this.updateBestLabel();
    this.updateSoundIcon();
    this.bindUI();
  }

  bindUI() {
    dom.start.addEventListener('click', () => this.startRun());
    dom.resume.addEventListener('click', () => this.resume());
    dom.pauseRestart.addEventListener('click', () => this.startRun());
    dom.restart.addEventListener('click', () => this.startRun());
    dom.sound.addEventListener('click', () => this.toggleMute());
    window.addEventListener('resize', () => this.updateChrome());
    window.addEventListener('orientationchange', () => setTimeout(() => this.updateChrome(), 120));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.paused) this.pause();
    });
  }

  updateBestLabel() {
    dom.best.textContent = String(this.best).padStart(6, '0');
  }

  updateSoundIcon() {
    dom.soundIcon.textContent = sound.muted ? '×' : '♪';
    dom.sound.setAttribute('aria-label', sound.muted ? 'Enable sound' : 'Mute sound');
  }

  toggleMute() {
    sound.toggle();
    this.updateSoundIcon();
  }

  showTouch(show) {
    const visible = isTouch && show;
    dom.touch.classList.toggle('hidden', !visible);
    dom.touch.setAttribute('aria-hidden', visible ? 'false' : 'true');
    this.updateChrome();
  }

  updateChrome() {
    const portrait = window.innerHeight > window.innerWidth * 1.02;
    const showRotate = isTouch && portrait && this.state === 'playing' && !this.paused;
    dom.rotate.classList.toggle('hidden', !showRotate);
  }

  initPetals() {
    this.petals = [];
    for (let i = 0; i < 58; i++) {
      this.petals.push({
        x: rnd(-80, WORLD_W + 80),
        y: rnd(-VH, VH),
        vx: rnd(5, 17),
        vy: rnd(9, 25),
        phase: rnd(0, TAU),
        sway: rnd(6, 17),
        size: Math.random() < 0.2 ? 3 : 2,
        front: Math.random() < 0.28,
        alpha: rnd(0.25, 0.75),
      });
    }
  }

  startRun() {
    sound.init();
    sound.startMusic();
    sound.resume();
    this.state = 'playing';
    this.paused = false;
    this.ending = false;
    this.endTimer = 0;
    this.time = 0;
    this.elapsed = 0;
    this.player = new Fighter('player', 470);
    this.enemies = [];
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.afterimages = [];
    this.score = 0;
    this.kills = 0;
    this.parries = 0;
    this.perfectDodges = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.flashT = 0;
    this.waveIndex = -1;
    this.waveState = 'idle';
    this.waveTimer = 0;
    this.camX = clamp(470 - VW / 2, 0, WORLD_W - VW);
    this.tutorialT = 16;
    this.initPetals();

    dom.title.classList.add('hidden');
    dom.pause.classList.add('hidden');
    dom.end.classList.add('hidden');
    this.showTouch(true);
    this.startWave(0);
  }

  startWave(index) {
    this.waveIndex = index;
    const wave = WAVES[index];
    this.waveState = 'fighting';
    this.waveTimer = 0;
    this.enemies = this.enemies.filter((e) => e.alive);
    for (const spec of wave.enemies) {
      let x = this.player.x + spec.side * spec.offset;
      if (x < 55 || x > WORLD_W - 55) x = this.player.x - spec.side * (spec.offset + 60);
      x = clamp(x, 55, WORLD_W - 55);
      const enemy = new Fighter(spec.kind, x, {
        spawnT: wave.boss ? 1.15 : 0.8,
        facing: sign(this.player.x - x),
      });
      enemy.lastSeenAttack = 0;
      this.enemies.push(enemy);
      this.spawnDust(x, GROUND, 0, 8, true);
    }
    this.banner = {
      title: wave.boss ? 'FINAL DUEL' : `WAVE ${index + 1}`,
      sub: wave.name,
      note: wave.sub,
      t: 2.1,
      max: 2.1,
      color: wave.boss ? '#e2b95f' : '#e8c57a',
    };
    sound.wave();
  }

  canEnemyAttack(enemy) {
    if (enemy.kind === 'boss') return true;
    let attackers = 0;
    for (const e of this.enemies) {
      if (e !== enemy && e.alive && e.state === 'attack') attackers++;
    }
    return attackers === 0 || Math.random() < 0.14;
  }

  handlePlayerInput() {
    const p = this.player;
    if (!p || p.dead) return;
    const axis = input.moveAxis();
    p.moveIntent = axis;
    if (input.pressed('jump')) p.jump(this, axis || p.facing);
    if (input.pressed('dodge')) p.requestDodge(this, axis || 0);
    if (input.pressed('attack')) p.requestAttack(this);
    if (input.pressed('parry')) p.requestParry(this);
  }

  handleGlobalInput() {
    if (input.pressed('mute')) this.toggleMute();

    if (this.state === 'playing' && input.pressed('pause')) {
      if (this.paused) this.resume();
      else this.pause();
      return;
    }
    if (this.state === 'title') {
      if (input.pressed('start') || input.pressed('jump') || input.pressed('attack')) {
        this.startRun();
      }
      return;
    }
    if ((this.state === 'gameover' || this.state === 'victory') &&
        (input.pressed('start') || input.pressed('jump') || input.pressed('attack'))) {
      this.startRun();
    }
  }

  pause() {
    if (this.state !== 'playing' || this.paused) return;
    this.paused = true;
    dom.pause.classList.remove('hidden');
    this.showTouch(false);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    dom.pause.classList.add('hidden');
    this.showTouch(this.state === 'playing');
    sound.resume();
  }

  update(dt) {
    if (this.state !== 'playing' || this.paused) return;

    this.handlePlayerInput();

    const real = Math.min(dt, 0.05);
    this.ambientTime += real;
    this.updatePetals(real);
    if (this.hitstop > 0) {
      this.hitstop -= real;
      this.shake = Math.max(0, this.shake - 14 * real);
      this.flashT = Math.max(0, this.flashT - real);
      return;
    }

    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - real);
    const worldDt = real * (this.slowmo > 0 ? 0.38 : 1);
    this.time += worldDt;
    this.elapsed += worldDt;
    this.banner && (this.banner.t -= real);
    this.shake = Math.max(0, this.shake - 18 * real);
    this.flashT = Math.max(0, this.flashT - real);
    this.tutorialT = Math.max(0, this.tutorialT - real);

    this.player.update(worldDt, this);

    for (const enemy of this.enemies) {
      if (!enemy.dead) enemy.updateAI(worldDt, this);
      enemy.update(worldDt, this);
    }

    this.resolveCollisions(worldDt);
    this.updateEffects(worldDt);
    this.updateCamera(worldDt);

    if (this.comboTimer > 0) {
      this.comboTimer -= worldDt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.checkWaveState(real);

    if (this.ending) {
      this.endTimer -= real;
      if (this.endTimer <= 0) this.finish(false);
    }
  }

  resolveCollisions(dt) {
    const all = [this.player, ...this.enemies].filter((f) => f.alive && f.spawnT <= 0);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.state === 'dodge' || b.state === 'dodge') continue;
        if (Math.abs(a.y - b.y) > 34) continue;
        const minDist = (a.w * 0.62 + b.w * 0.62);
        const dx = b.x - a.x;
        const dist = Math.abs(dx);
        if (dist >= minDist || dist < 0.001) continue;
        const push = (minDist - dist) * 0.5;
        const dir = sign(dx);
        a.x -= dir * push;
        b.x += dir * push;
        a.x = clamp(a.x, 28, WORLD_W - 28);
        b.x = clamp(b.x, 28, WORLD_W - 28);
      }
    }
  }

  updateCamera(dt) {
    let focus = this.player.x + this.player.facing * 22;
    const alive = this.enemies.filter((e) => e.alive);
    if (alive.length) {
      let nearest = alive[0];
      for (const e of alive) {
        if (Math.abs(e.x - this.player.x) < Math.abs(nearest.x - this.player.x)) nearest = e;
      }
      focus = lerp(this.player.x, nearest.x, 0.28);
    }
    const target = clamp(focus - VW / 2, 0, WORLD_W - VW);
    this.camX = lerp(this.camX, target, 1 - Math.exp(-4.2 * dt));
  }

  checkWaveState(dt) {
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 1.45);
    const alive = this.enemies.filter((e) => e.alive);
    if (this.waveState === 'fighting' && alive.length === 0 && !this.player.dead && !this.ending) {
      this.waveState = 'clear';
      this.waveTimer = this.waveIndex === WAVES.length - 1 ? 3.4 : 2.25;
      this.onWaveClear();
    } else if (this.waveState === 'clear' && !this.player.dead) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        if (this.waveIndex >= WAVES.length - 1) this.finish(true);
        else this.startWave(this.waveIndex + 1);
      }
    }
  }

  addCombo() {
    this.combo++;
    this.comboTimer = 2.0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
  }

  onDamage(victim, attacker, dmg, attack) {
    sound.hit(!!attack.heavy);
    this.hitstop = Math.max(this.hitstop, attack.heavy ? 0.075 : 0.045);
    this.shake = Math.max(this.shake, attack.heavy ? 8 : 3.5);
    const midX = (victim.x + attacker.x) / 2;
    const midY = Math.min(victim.y, attacker.y) - 30;
    this.spawnSparks(midX, midY, victim.isPlayer ? '#ff8a82' : '#ffe7b0', attack.heavy ? 14 : 8, attack.heavy ? 210 : 150);
    this.addRing(midX, midY, victim.isPlayer ? '#d55356' : '#f5dfb1', attack.heavy ? 30 : 20, 0.26, 2);

    if (victim.isPlayer) {
      this.combo = 0;
      this.comboTimer = 0;
      this.flash('#a92f38', 0.13, 0.2);
      this.addText(victim.x, victim.y - 58, `-${Math.round(dmg)}`, '#ff8b83', 10);
    } else {
      this.score += Math.round(dmg * 10);
      this.addCombo();
      this.addText(victim.x, victim.y - 58, `${Math.round(dmg)}`, '#fff0c8', attack.heavy ? 12 : 9);
      if (this.combo > 1) this.addText(victim.x + 18, victim.y - 48, `x${this.combo}`, '#e8c57a', 8);
    }
  }

  onBlock(victim, attacker, attack, dmg) {
    sound.block();
    this.hitstop = Math.max(this.hitstop, 0.025);
    this.shake = Math.max(this.shake, 2.5);
    this.spawnSparks(victim.x - victim.facing * 4, victim.y - 30, '#cbd9d7', 6, 100);
    this.addText(victim.x, victim.y - 62, 'BLOCK', '#cddbd8', 8);
    if (!victim.isPlayer) this.score += 15;
  }

  onParry(defender, attacker) {
    this.hitstop = Math.max(this.hitstop, 0.095);
    this.spawnSparks((defender.x + attacker.x) / 2, defender.y - 32, '#d8ffff', 18, 230);
    this.addRing((defender.x + attacker.x) / 2, defender.y - 30, '#b9f6f5', 38, 0.34, 2.5);

    if (defender.isPlayer) {
      sound.parry();
      this.parries++;
      this.addCombo();
      this.score += 160;
      defender.addHp(2);
      this.slowmo = Math.max(this.slowmo, 0.3);
      this.shake = Math.max(this.shake, 9);
      this.flash('#c3fbfa', 0.17, 0.22);
      this.addText(defender.x, defender.y - 66, 'PARRY', '#c9ffff', 13);
      this.addText(defender.x + 30, defender.y - 52, '+160', '#e8c57a', 8);
      attacker.stagger(0.72);
      attacker.vx = sign(attacker.x - defender.x || 1) * 165;
      if (!attacker.isPlayer) {
        attacker.posture = Math.min(attacker.maxPosture, attacker.posture + 40);
        attacker.postureDelay = 1.8;
        if (attacker.posture >= attacker.maxPosture) attacker.breakGuard(this);
      }
    } else {
      sound.deflect();
      this.shake = Math.max(this.shake, 5);
      this.flash('#9ebaff', 0.1, 0.14);
      this.addText(defender.x, defender.y - 66, 'DEFLECTED', '#b5cfff', 10);
      attacker.stagger(0.42);
      attacker.vx = sign(attacker.x - defender.x || 1) * 175;
    }
  }

  onPerfectDodge(player, attacker) {
    sound.parry();
    this.perfectDodges++;
    this.addCombo();
    this.score += 120;
    this.slowmo = Math.max(this.slowmo, 0.42);
    this.shake = Math.max(this.shake, 5);
    this.flash('#8fb8ff', 0.13, 0.2);
    this.addText(player.x, player.y - 64, 'PERFECT DODGE', '#a9cfff', 11);
    this.addText(player.x + 44, player.y - 50, '+120', '#e8c57a', 8);
    this.addRing(player.x, player.y - 26, '#8fb8ff', 32, 0.3, 2);
    this.spawnSparks(player.x, player.y - 28, '#9fc4ff', 10, 120);
    player.addHp(2);
  }

  onGuardBreak(enemy) {
    sound.break();
    this.score += 100;
    this.shake = Math.max(this.shake, 10);
    this.slowmo = Math.max(this.slowmo, 0.18);
    this.flash('#f1cd7a', 0.13, 0.18);
    this.addText(enemy.x, enemy.y - 72, 'GUARD BROKEN', '#ffd36e', 11);
    this.spawnSparks(enemy.x, enemy.y - 36, '#ffd987', 16, 180);
    this.addRing(enemy.x, enemy.y - 34, '#ffd36e', 36, 0.38, 2);
  }

  onDeath(fighter) {
    if (fighter.isPlayer) {
      sound.death();
      this.ending = true;
      this.endTimer = 1.8;
      this.slowmo = Math.max(this.slowmo, 0.6);
      this.flash('#a72835', 0.22, 0.5);
      this.shake = Math.max(this.shake, 14);
      this.addText(fighter.x, fighter.y - 58, 'FALLEN', '#ff9c93', 12);
      return;
    }

    this.kills++;
    this.addCombo();
    this.player.addHp(4);
    this.score += fighter.kind === 'boss' ? 1400 : 280;
    sound.death();
    this.spawnDeathPetals(fighter.x, fighter.y - 24, fighter.kind === 'boss' ? 32 : 14);
    this.spawnSparks(fighter.x, fighter.y - 28, '#d9b4a1', fighter.kind === 'boss' ? 26 : 12, 190);
    this.addText(fighter.x, fighter.y - 68, fighter.kind === 'boss' ? 'LORD FELLED' : 'FELLED', '#e8c57a', fighter.kind === 'boss' ? 13 : 10);
    this.shake = Math.max(this.shake, fighter.kind === 'boss' ? 16 : 5);
    if (fighter.kind === 'boss') {
      this.slowmo = Math.max(this.slowmo, 1.25);
      this.flash('#e8c57a', 0.25, 0.6);
    }
  }

  onWaveClear() {
    this.score += 500;
    this.player.addHp(this.waveIndex >= WAVES.length - 1 ? 0 : 22);
    sound.wave();
    if (this.waveIndex < WAVES.length - 1) sound.heal();
    this.spawnHeal(this.player.x, this.player.y - 30, 14);
    if (this.waveIndex >= WAVES.length - 1) {
      this.banner = {
        title: 'THE MOON RELENTS',
        sub: 'Dawn breaks over the garden',
        note: 'The last blade has fallen',
        t: 3.1,
        max: 3.1,
        color: '#e8c57a',
      };
      this.slowmo = Math.max(this.slowmo, 0.8);
      this.flash('#f0d388', 0.2, 0.55);
    } else {
      this.banner = {
        title: 'WAVE CLEARED',
        sub: WAVES[this.waveIndex + 1].name,
        note: '+22 HP · the next blade waits',
        t: 2.2,
        max: 2.2,
        color: '#e8c57a',
      };
      this.flash('#d6bb7a', 0.08, 0.18);
    }
  }

  onBossPhase2(boss) {
    this.banner = {
      title: 'PHASE II',
      sub: 'THE ASH AWAKENS',
      note: 'His guard breaks, his blade burns',
      t: 1.8,
      max: 1.8,
      color: '#e26a58',
    };
    sound.break();
    this.shake = Math.max(this.shake, 12);
    this.slowmo = Math.max(this.slowmo, 0.35);
    this.flash('#c04438', 0.15, 0.35);
    this.spawnSparks(boss.x, boss.y - 30, '#ff765f', 28, 220);
    this.addRing(boss.x, boss.y - 30, '#e45d4c', 46, 0.55, 3);
    this.addText(boss.x, boss.y - 82, 'ASH AWAKENS', '#ff9478', 11);
  }

  flash(color, alpha = 0.12, duration = 0.2) {
    this.flashColor = color;
    this.flashT = duration;
    this.flashMax = duration;
    this.flashAlpha = alpha;
  }

  // -------------------------------------------------------------------------
  // Particles, floating text, rings, and afterimages.
  // -------------------------------------------------------------------------

  addParticle(p) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push(p);
  }

  spawnSparks(x, y, color, count = 10, speed = 170) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU);
      const s = rnd(speed * 0.3, speed);
      this.addParticle({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        grav: 380, drag: 1.8, life: rnd(0.14, 0.34), max: 0.34,
        size: Math.random() < 0.35 ? 2 : 1, color,
      });
    }
  }

  spawnDust(x, y, dir, count = 4, big = false) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'dust', x: x + rnd(-7, 7), y: y - rnd(0, 5),
        vx: dir * rnd(8, 34) + rnd(-16, 16), vy: rnd(-38, -8),
        grav: 38, drag: 1.6, life: rnd(0.25, 0.55), max: 0.55,
        size: big ? rnd(2, 4) : rnd(1, 3), color: big ? '#8a7665' : '#7f7061',
      });
    }
  }

  spawnHeal(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'spark', x: x + rnd(-10, 10), y: y + rnd(-6, 8),
        vx: rnd(-18, 18), vy: rnd(-48, -16), grav: -8, drag: 0.7,
        life: rnd(0.45, 0.9), max: 0.9, size: 1,
        color: Math.random() < 0.5 ? '#a8e8a4' : '#e8d58a',
      });
    }
  }

  spawnDeathPetals(x, y, count = 14) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'petal', x: x + rnd(-12, 12), y: y + rnd(-24, 8),
        vx: rnd(-70, 70), vy: rnd(-120, -20), grav: 150, drag: 0.9,
        life: rnd(0.7, 1.5), max: 1.5, size: rnd(2, 4),
        spin: rnd(-8, 8), angle: rnd(0, TAU),
        color: Math.random() < 0.55 ? '#e79aa6' : '#e8c57a',
      });
    }
  }

  spawnAfterimages(f) {
    for (let i = 1; i <= 3; i++) {
      const snap = Object.assign({}, f);
      snap.x = f.x - f.dodgeDir * i * 9;
      this.afterimages.push({
        snap,
        life: 0.2 + i * 0.035,
        max: 0.2 + i * 0.035,
        alpha: 0.2 - i * 0.04,
      });
    }
    if (this.afterimages.length > 24) this.afterimages.splice(0, this.afterimages.length - 24);
  }

  addText(x, y, str, color = '#fff', size = 10) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({
      x, y, str, color, size,
      life: 0.85, max: 0.85, vy: 25, vx: rnd(-5, 5),
    });
  }

  addRing(x, y, color, max = 30, life = 0.3, width = 2) {
    this.rings.push({ x, y, color, max, life, maxLife: life, width });
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'petal') p.angle += p.spin * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= t.vy * dt;
      t.x += t.vx * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
  }

  updatePetals(dt) {
    const t = this.ambientTime;
    for (const p of this.petals) {
      p.x += (p.vx + Math.sin(t * 1.2 + p.phase) * p.sway) * dt;
      p.y += p.vy * dt;
      if (p.y > VH + 12 || p.x > WORLD_W + 130) {
        p.y = -10;
        p.x = rnd(-80, WORLD_W + 80);
        p.phase = rnd(0, TAU);
      }
      if (p.x < -140) p.x = WORLD_W + 90;
    }
  }

  updateAmbient(dt) {
    this.ambientTime += dt;
    this.updatePetals(dt);
    if (this.state === 'title') {
      this.time += dt * 0.7;
      this.attractPlayer.stateT += dt;
      this.attractEnemy.stateT += dt;
      this.camX = WORLD_W - VW + Math.sin(this.ambientTime * 0.22) * 5;
    }
  }

  finish(won) {
    if (this.state !== 'playing') return;
    const previousBest = this.best;
    if (won) {
      this.score += Math.max(0, Math.round(3000 - this.elapsed * 9));
      sound.victory();
    } else {
      sound.defeat();
    }
    this.state = won ? 'victory' : 'gameover';
    this.paused = false;
    this.ending = false;
    this.best = Math.max(this.best, this.score);
    saveStore('bladewind.best', this.best);
    this.updateBestLabel();
    this.showTouch(false);
    dom.pause.classList.add('hidden');
    this.showEnd(won, previousBest);
    this.updateChrome();
  }

  showEnd(won, previousBest) {
    const isBest = this.score > previousBest;
    dom.endEyebrow.textContent = won ? 'THE MOON WITNESSES' : 'THE DUEL ENDS';
    dom.endTitle.textContent = won ? 'VICTORY' : 'DEFEATED';
    dom.endTitle.style.color = won ? '#f0d48d' : '#f4e8d3';
    dom.endMessage.textContent = won
      ? 'The last blade falls. Dawn is yours.'
      : 'The moonlight is patient. Rise again.';
    if (isBest && this.score > 0) dom.endMessage.textContent += '  ·  A NEW BEST.';
    dom.endScore.textContent = String(this.score).padStart(6, '0');
    dom.endKills.textContent = String(this.kills);
    dom.endParries.textContent = String(this.parries);
    dom.endCombo.textContent = String(this.bestCombo);
    dom.endTime.textContent = this.formatTime(this.elapsed);
    dom.end.classList.remove('hidden');
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}

// ---------------------------------------------------------------------------
// Background scenery, generated once with a fixed seed.
// ---------------------------------------------------------------------------

function makeRidge(seed, baseY, amp, count) {
  const rand = mulberry32(seed);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * (VW + 180) - 90;
    const y = baseY - rand() * amp - Math.sin(i * 0.9) * amp * 0.18;
    points.push({ x, y });
  }
  return points;
}

const BG = (() => {
  const rand = mulberry32(0xb1ade);
  const stars = [];
  for (let i = 0; i < 125; i++) {
    stars.push({
      x: rand() * VW,
      y: rand() * 225,
      size: rand() < 0.82 ? 1 : 2,
      phase: rand() * TAU,
      speed: 0.6 + rand() * 1.8,
      alpha: 0.25 + rand() * 0.65,
    });
  }
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    clouds.push({
      x: rand() * VW,
      y: 34 + rand() * 145,
      w: 60 + rand() * 150,
      h: 5 + rand() * 9,
      alpha: 0.08 + rand() * 0.16,
      speed: 0.5 + rand() * 1.4,
      layer: rand() < 0.5 ? 0 : 1,
    });
  }
  const bamboo = [];
  for (let i = 0; i < 46; i++) {
    bamboo.push({
      x: rand() * 1280 - 110,
      h: 65 + rand() * 135,
      w: rand() < 0.18 ? 3 : 2,
      phase: rand() * TAU,
      sway: 0.5 + rand() * 1.8,
      leaf: rand(),
    });
  }
  const grass = [];
  for (let i = 0; i < 120; i++) {
    grass.push({
      x: rand() * (WORLD_W + 80) - 40,
      y: GROUND + 1 + rand() * 5,
      h: 2 + rand() * 5,
      lean: rand() * 2 - 1,
      tone: rand(),
    });
  }
  const stones = [];
  for (let i = 0; i < 46; i++) {
    stones.push({
      x: rand() * (WORLD_W + 80) - 40,
      y: GROUND + 8 + rand() * 40,
      w: 2 + rand() * 6,
      h: 1 + rand() * 3,
      tone: rand(),
    });
  }
  const fireflies = [];
  for (let i = 0; i < 18; i++) {
    fireflies.push({
      x: rand() * WORLD_W,
      y: GROUND - 20 - rand() * 110,
      phase: rand() * TAU,
      speed: 0.5 + rand() * 1.2,
      size: rand() < 0.3 ? 2 : 1,
    });
  }
  return {
    stars, clouds, bamboo, grass, stones, fireflies,
    far: makeRidge(11, 262, 40, 17),
    mid: makeRidge(27, 278, 32, 14),
    near: makeRidge(43, 288, 14, 11),
  };
})();

function drawText(str, x, y, size, color, align = 'left', weight = '700', shadow = 'rgba(0,0,0,0.82)') {
  ctx.font = `${weight} ${size}px "Courier New", "Lucida Console", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function pixelDiamond(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

function drawSky(game) {
  const t = game.ambientTime;
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#06040d');
  sky.addColorStop(0.36, '#0f0a1e');
  sky.addColorStop(0.62, '#21132b');
  sky.addColorStop(0.82, '#3c2031');
  sky.addColorStop(1, '#5a3036');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, GROUND);

  for (const s of BG.stars) {
    const twinkle = 0.55 + Math.sin(t * s.speed + s.phase) * 0.45;
    ctx.globalAlpha = s.alpha * twinkle;
    ctx.fillStyle = s.size > 1 ? '#f3e9d4' : '#cfc8de';
    ctx.fillRect(round(s.x), round(s.y), s.size, s.size);
  }
  ctx.globalAlpha = 1;

  // Moon glow.
  const mx = 506;
  const my = 72;
  const glow = ctx.createRadialGradient(mx, my, 18, mx, my, 105);
  glow.addColorStop(0, 'rgba(255,239,201,0.28)');
  glow.addColorStop(0.14, 'rgba(255,229,176,0.16)');
  glow.addColorStop(0.5, 'rgba(238,196,141,0.06)');
  glow.addColorStop(1, 'rgba(238,196,141,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - 110, my - 110, 220, 220);

  ctx.fillStyle = '#f3e3be';
  ctx.beginPath();
  ctx.arc(mx, my, 42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff0ce';
  ctx.beginPath();
  ctx.arc(mx - 5, my - 6, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(199,175,141,0.22)';
  ctx.beginPath();
  ctx.arc(mx - 15, my - 5, 8, 0, TAU);
  ctx.arc(mx + 12, my + 14, 6, 0, TAU);
  ctx.arc(mx + 4, my - 20, 4, 0, TAU);
  ctx.arc(mx - 24, my + 18, 3, 0, TAU);
  ctx.fill();

  // A few long, thin clouds crossing the moon.
  for (const c of BG.clouds) {
    const x = ((c.x + t * c.speed * (c.layer ? 1.5 : 0.7)) % (VW + c.w + 60)) - c.w - 30;
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = c.layer ? '#241630' : '#160f23';
    ctx.fillRect(round(x), round(c.y), round(c.w), round(c.h));
    ctx.fillRect(round(x + c.w * 0.15), round(c.y - 3), round(c.w * 0.55), 3);
    ctx.fillRect(round(x + c.w * 0.3), round(c.y + c.h), round(c.w * 0.45), 2);
  }
  ctx.globalAlpha = 1;
}

function drawParallax(game) {
  const cam = game.camX;
  const t = game.ambientTime;

  // Far mountains.
  ctx.fillStyle = '#140e20';
  ctx.beginPath();
  ctx.moveTo(-100, GROUND);
  for (const p of BG.far) ctx.lineTo(p.x - cam * 0.08, p.y);
  ctx.lineTo(VW + 100, GROUND);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1b1227';
  ctx.beginPath();
  ctx.moveTo(-100, GROUND);
  for (const p of BG.mid) ctx.lineTo(p.x - cam * 0.16, p.y + 5);
  ctx.lineTo(VW + 100, GROUND);
  ctx.closePath();
  ctx.fill();

  // Pagoda silhouette.
  drawPagoda(300 - cam * 0.18, 258, 0.95, '#24162a');
  drawPagoda(70 - cam * 0.12, 270, 0.7, '#1e1224');

  // Torii gate in the middle distance.
  drawTorii(520 - cam * 0.36, 276, 1.05, '#2b1824');

  // Bamboo grove.
  for (const b of BG.bamboo) {
    const x = b.x - cam * 0.52;
    if (x < -30 || x > VW + 30) continue;
    const sway = Math.sin(t * b.sway + b.phase) * 2.2;
    const topX = x + sway;
    ctx.strokeStyle = b.w > 2 ? '#1b2b22' : '#14221c';
    ctx.lineWidth = b.w;
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 2);
    ctx.quadraticCurveTo(x + sway * 0.4, GROUND - b.h * 0.5, topX, GROUND - b.h);
    ctx.stroke();
    ctx.strokeStyle = '#203327';
    ctx.lineWidth = 1;
    for (let s = 1; s < 4; s++) {
      const yy = GROUND - (b.h * s) / 4;
      ctx.beginPath();
      ctx.moveTo(x + sway * 0.25, yy);
      ctx.lineTo(x + sway * 0.25 + 5, yy - 2);
      ctx.stroke();
    }
    if (b.leaf > 0.42) {
      ctx.strokeStyle = '#1b2d21';
      ctx.lineWidth = 1;
      for (let l = 0; l < 3; l++) {
        const ly = GROUND - b.h + l * 8;
        const dir = l % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(topX, ly);
        ctx.lineTo(topX + dir * (7 + b.leaf * 8), ly - 3);
        ctx.stroke();
      }
    }
  }

  // Last ridge, very near, dark.
  ctx.fillStyle = '#100c18';
  ctx.beginPath();
  ctx.moveTo(-100, GROUND);
  for (const p of BG.near) ctx.lineTo(p.x - cam * 0.25, p.y + 8);
  ctx.lineTo(VW + 100, GROUND);
  ctx.closePath();
  ctx.fill();
}

function drawPagoda(x, y, s, color) {
  ctx.fillStyle = color;
  for (let tier = 0; tier < 4; tier++) {
    const w = (44 - tier * 7) * s;
    const yy = y - tier * 20 * s;
    ctx.fillRect(round(x - w / 2), round(yy - 4 * s), round(w), round(4 * s));
    ctx.fillRect(round(x - w * 0.28), round(yy - 16 * s), round(w * 0.56), round(12 * s));
    ctx.fillRect(round(x - w * 0.62), round(yy - 6 * s), round(w * 1.24), round(3 * s));
    ctx.fillRect(round(x - 1), round(yy - 23 * s), 2, round(7 * s));
  }
  ctx.fillRect(round(x - 2), round(y - 3), 4, 4);
}

function drawTorii(x, y, s, color) {
  ctx.fillStyle = color;
  const w = 150 * s;
  ctx.fillRect(round(x - w / 2), round(y - 68 * s), 6 * s, 68 * s);
  ctx.fillRect(round(x + w / 2 - 6 * s), round(y - 68 * s), 6 * s, 68 * s);
  ctx.fillRect(round(x - w / 2 - 12 * s), round(y - 74 * s), (w + 24 * s), 6 * s);
  ctx.fillRect(round(x - w / 2 - 4 * s), round(y - 61 * s), (w + 8 * s), 4 * s);
  ctx.fillRect(round(x - 2), round(y - 83 * s), 4 * s, 12 * s);
}

function drawGround(game) {
  const t = game.ambientTime;
  // Soil.
  const soil = ctx.createLinearGradient(0, GROUND, 0, VH);
  soil.addColorStop(0, '#27201c');
  soil.addColorStop(0.2, '#1b1717');
  soil.addColorStop(1, '#0d0b10');
  ctx.fillStyle = soil;
  ctx.fillRect(-20, GROUND, WORLD_W + 40, VH - GROUND + 24);

  // Stone path band.
  ctx.fillStyle = '#211b1c';
  ctx.fillRect(-20, GROUND + 24, WORLD_W + 40, 28);
  ctx.fillStyle = 'rgba(232,197,122,0.055)';
  ctx.fillRect(-20, GROUND + 24, WORLD_W + 40, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  for (let x = 0; x < WORLD_W + 40; x += 34) {
    ctx.fillRect(x, GROUND + 24, 1, 28);
  }
  for (let x = 17; x < WORLD_W + 40; x += 68) {
    ctx.fillRect(x, GROUND + 37, 16, 1);
  }

  // Grass line and tufts.
  ctx.fillStyle = '#363b2d';
  ctx.fillRect(-20, GROUND - 2, WORLD_W + 40, 3);
  ctx.fillStyle = '#24291f';
  ctx.fillRect(-20, GROUND + 1, WORLD_W + 40, 2);
  for (const g of BG.grass) {
    ctx.fillStyle = g.tone > 0.6 ? '#45503b' : g.tone > 0.3 ? '#333e2e' : '#293326';
    const sway = Math.sin(t * 1.4 + g.x * 0.08) * 0.5;
    ctx.fillRect(round(g.x), round(g.y), 1, round(g.h));
    ctx.fillRect(round(g.x + g.lean + sway), round(g.y - g.h * 0.4), 1, round(g.h * 0.55));
  }

  // Stones.
  for (const s of BG.stones) {
    ctx.fillStyle = s.tone > 0.5 ? '#30292a' : '#252023';
    ctx.fillRect(round(s.x), round(s.y), round(s.w), round(s.h));
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(round(s.x), round(s.y), round(s.w), 1);
  }

  // Lanterns.
  for (const lx of [112, 352, 736, 1012]) {
    drawStoneLantern(lx, GROUND, t);
  }

  // A wind-bent tree at the far right.
  drawTree(1036, GROUND, t);

  // Fireflies.
  for (const f of BG.fireflies) {
    const fx = f.x + Math.sin(t * f.speed + f.phase) * 12;
    const fy = f.y + Math.cos(t * f.speed * 0.7 + f.phase) * 7;
    const a = 0.25 + (Math.sin(t * 2 + f.phase) * 0.5 + 0.5) * 0.55;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f5d58a';
    ctx.fillRect(round(fx), round(fy), f.size, f.size);
    if (f.size > 1) {
      ctx.globalAlpha = a * 0.22;
      ctx.fillRect(round(fx) - 1, round(fy), 4, 1);
      ctx.fillRect(round(fx), round(fy) - 1, 1, 4);
    }
  }
  ctx.globalAlpha = 1;
}

function drawStoneLantern(x, groundY, t) {
  const glow = ctx.createRadialGradient(x, groundY - 31, 2, x, groundY - 31, 31);
  glow.addColorStop(0, 'rgba(255,203,112,0.2)');
  glow.addColorStop(1, 'rgba(255,203,112,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 34, groundY - 65, 68, 68);

  ctx.fillStyle = '#2d2826';
  ctx.fillRect(x - 7, groundY - 5, 14, 5);
  ctx.fillRect(x - 3, groundY - 17, 6, 12);
  ctx.fillRect(x - 8, groundY - 29, 16, 12);
  ctx.fillStyle = '#4b3a2a';
  ctx.fillRect(x - 5, groundY - 27, 10, 8);
  ctx.fillStyle = `rgba(255,203,112,${0.72 + Math.sin(t * 3 + x) * 0.12})`;
  ctx.fillRect(x - 3, groundY - 25, 6, 5);
  ctx.fillStyle = '#2d2826';
  ctx.fillRect(x - 10, groundY - 32, 20, 3);
  ctx.fillRect(x - 8, groundY - 38, 16, 4);
  ctx.fillRect(x - 2, groundY - 42, 4, 4);
}

function drawTree(x, groundY, t) {
  ctx.strokeStyle = '#1a1118';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x - 8, groundY - 62, x - 26, groundY - 108);
  ctx.stroke();
  const branches = [
    [x - 18, groundY - 80, x - 48, groundY - 98],
    [x - 12, groundY - 93, x - 6, groundY - 124],
    [x - 22, groundY - 104, x - 50, groundY - 122],
    [x - 6, groundY - 118, x + 18, groundY - 132],
  ];
  ctx.lineWidth = 2;
  for (const [x1, y1, x2, y2] of branches) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + 6, (y1 + y2) / 2 - 6, x2, y2);
    ctx.stroke();
  }
  const rand = mulberry32(77);
  for (let i = 0; i < 26; i++) {
    const bx = x - 55 + rand() * 80;
    const by = groundY - 135 + rand() * 55;
    const sway = Math.sin(t * 0.9 + i) * 1.2;
    ctx.globalAlpha = 0.45 + rand() * 0.4;
    ctx.fillStyle = rand() > 0.45 ? '#b76b7e' : '#8f4d62';
    ctx.fillRect(round(bx + sway), round(by), 2, 2);
    if (rand() > 0.6) ctx.fillRect(round(bx + sway + 1), round(by + 2), 2, 1);
  }
  ctx.globalAlpha = 1;
}

function drawPetals(game, front) {
  const t = game.ambientTime;
  for (const p of game.petals) {
    if (!!p.front !== !!front) continue;
    const x = p.x - game.camX * (p.front ? 1.04 : 0.92);
    const y = p.y;
    const sway = Math.sin(t * 1.3 + p.phase) * 2;
    ctx.globalAlpha = p.alpha * (p.front ? 0.9 : 0.65);
    ctx.fillStyle = p.front ? '#eaa3b2' : '#c77f92';
    const w = p.size;
    const h = Math.max(1, p.size - 1);
    ctx.fillRect(round(x + sway), round(y), w, h);
    if (p.front) {
      ctx.globalAlpha = p.alpha * 0.3;
      ctx.fillRect(round(x + sway) - 1, round(y), w + 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Fighter rendering: chunky pixel samurai with pose-driven limbs and steel.
// ---------------------------------------------------------------------------

function localLimb(x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function swordPose(f) {
  const t = f.stateT;
  const st = f.state;
  if (st === 'attack' && f.attack) {
    const a = f.attack;
    let angle;
    if (t < a.windup) {
      angle = lerp(-0.55, a.swingStart, easeOut(t / Math.max(0.001, a.windup)));
    } else if (t < a.windup + a.active) {
      angle = lerp(a.swingStart, a.swingEnd, easeInOut((t - a.windup) / Math.max(0.001, a.active)));
    } else {
      const k = clamp((t - a.windup - a.active) / Math.max(0.001, a.recover), 0, 1);
      angle = lerp(a.swingEnd, -0.55, easeOut(k));
    }
    const handX = 3 + Math.cos(angle) * 8;
    const handY = -31 + Math.sin(angle) * 8;
    const active = t >= a.windup - 0.02 && t <= a.windup + a.active + 0.035;
    return {
      handX, handY, angle,
      glow: active ? 1 : t < a.windup ? 0.4 : 0.15,
      glowColor: a.unblockable ? '#ff6b58' : a.heavy ? '#f3d18a' : '#c8f4ee',
      trail: active,
      trailStart: a.swingStart,
      trailEnd: angle,
      trailColor: a.unblockable ? 'rgba(255,92,78,' : 'rgba(230,255,249,',
      trailWidth: a.heavy ? 4 : 2.5,
    };
  }
  if (st === 'parry') {
    return {
      handX: 9, handY: -28, angle: -1.28,
      glow: 1, glowColor: '#8cf3ea', trail: false,
    };
  }
  if (st === 'dodge') {
    return { handX: 2, handY: -23, angle: 1.05, glow: 0, trail: false };
  }
  if (st === 'stagger' || st === 'hurt') {
    return { handX: 3, handY: -21, angle: 1.32, glow: 0, trail: false };
  }
  return { handX: 7, handY: -24, angle: 0.62, glow: 0, trail: false };
}

function drawSwordLocal(pal, pose) {
  const { handX, handY, angle } = pose;
  if (pose.glow > 0) {
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(angle);
    ctx.globalAlpha *= pose.glow * 0.3;
    ctx.strokeStyle = pose.glowColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(27, 0);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(angle);
  ctx.fillStyle = '#2a1915';
  ctx.fillRect(-4, -1, 5, 2);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, -3, 2, 6);
  ctx.fillStyle = pal.steel;
  ctx.fillRect(2, -1, 24, 2);
  ctx.fillStyle = pal.edge;
  ctx.fillRect(2, -1, 24, 1);
  ctx.fillRect(25, -1, 4, 2);
  ctx.restore();
}

function drawScarf(f, pal, bob, st) {
  const t = f.stateT;
  const phase = f.scarfPhase;
  const sway = Math.sin(t * 5 + phase) * 2.2;
  const run = st === 'run' ? 4 : st === 'dodge' ? 7 : 0;
  ctx.strokeStyle = pal.scarf;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -33 + bob);
  ctx.quadraticCurveTo(-10 - run, -31 + bob + sway, -16 - run, -24 + bob + sway * 1.3);
  ctx.stroke();
  ctx.strokeStyle = pal.scarf2;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -35 + bob);
  ctx.quadraticCurveTo(-9 - run, -30 + bob - sway, -15 - run, -21 + bob - sway);
  ctx.stroke();
}

function drawCape(f, pal, bob) {
  ctx.fillStyle = pal.scarf2;
  ctx.beginPath();
  ctx.moveTo(-4, -36 + bob);
  ctx.lineTo(-17, -8 + bob + Math.sin(f.stateT * 3) * 1.5);
  ctx.lineTo(-11, -3 + bob);
  ctx.lineTo(-3, -17 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.scarf;
  ctx.beginPath();
  ctx.moveTo(-3, -35 + bob);
  ctx.lineTo(-13, -12 + bob);
  ctx.lineTo(-8, -8 + bob);
  ctx.lineTo(-1, -21 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.accent;
  ctx.fillRect(-15, -7 + bob, 3, 2);
}

function drawFighterHead(f, pal, bob) {
  // Neck and face.
  ctx.fillStyle = pal.skin2;
  ctx.fillRect(-2, -36 + bob, 5, 3);
  ctx.fillStyle = pal.skin;
  ctx.fillRect(-4, -43 + bob, 9, 8);
  ctx.fillStyle = pal.hair;
  ctx.fillRect(-5, -45 + bob, 11, 3);
  ctx.fillRect(-5, -43 + bob, 3, 4);
  ctx.fillRect(2, -40 + bob, 1, 1);
  ctx.fillStyle = pal.eye;
  ctx.fillRect(2, -40 + bob, 1, 1);
  ctx.fillStyle = '#17121a';
  ctx.fillRect(-1, -41 + bob, 3, 1);

  if (f.kind === 'player') {
    ctx.fillStyle = pal.hair;
    ctx.fillRect(-2, -49 + bob, 4, 4);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-5, -43 + bob, 11, 2);
    ctx.fillRect(-7, -42 + bob, 3, 1);
  } else if (f.kind === 'ronin') {
    ctx.fillStyle = '#5a4932';
    ctx.fillRect(-8, -47 + bob, 16, 2);
    ctx.fillRect(-5, -49 + bob, 10, 2);
    ctx.fillStyle = '#75613f';
    ctx.fillRect(-7, -48 + bob, 14, 1);
    ctx.fillStyle = '#1a1519';
    ctx.fillRect(-4, -45 + bob, 9, 1);
  } else if (f.kind === 'ninja') {
    ctx.fillStyle = pal.robe2;
    ctx.fillRect(-5, -46 + bob, 11, 5);
    ctx.fillRect(-5, -39 + bob, 11, 4);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-5, -42 + bob, 11, 1);
    ctx.fillStyle = pal.eye;
    ctx.fillRect(1, -41 + bob, 2, 1);
    ctx.fillRect(-3, -41 + bob, 1, 1);
  } else if (f.kind === 'brute') {
    ctx.fillStyle = '#2a2528';
    ctx.fillRect(-7, -47 + bob, 14, 5);
    ctx.fillRect(-9, -49 + bob, 4, 3);
    ctx.fillRect(5, -50 + bob, 4, 4);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-8, -47 + bob, 16, 1);
    ctx.fillStyle = pal.eye;
    ctx.fillRect(2, -42 + bob, 2, 1);
  } else if (f.kind === 'boss') {
    ctx.fillStyle = pal.hair;
    ctx.fillRect(-6, -46 + bob, 13, 4);
    ctx.fillRect(-8, -44 + bob, 3, 6);
    ctx.fillStyle = '#d9ad55';
    ctx.fillRect(-7, -48 + bob, 15, 3);
    ctx.fillRect(-10, -53 + bob, 3, 6);
    ctx.fillRect(7, -53 + bob, 3, 6);
    ctx.fillRect(-11, -55 + bob, 2, 3);
    ctx.fillRect(9, -55 + bob, 2, 3);
    ctx.fillStyle = '#ffcf6e';
    ctx.fillRect(2, -42 + bob, 2, 1);
    ctx.fillRect(-3, -42 + bob, 1, 1);
  }
}

function drawFighter(f, game, opts = {}) {
  const pal = PALETTES[f.kind];
  const st = f.state;
  const t = f.stateT;
  let alpha = opts.alpha !== undefined ? opts.alpha : 1;
  if (f.spawnT > 0) alpha *= clamp(1 - f.spawnT / 0.9, 0.2, 1);
  if (f.dead) alpha *= clamp(1 - f.deathT / 1.45, 0, 1);
  if (alpha <= 0.01) return;

  const scale = f.scale;
  const dead = f.dead;

  // Boss phase-two aura.
  if (f.kind === 'boss' && f.phase === 2 && !dead) {
    const glow = ctx.createRadialGradient(f.x, f.y - 28, 6, f.x, f.y - 28, 47);
    glow.addColorStop(0, 'rgba(221,72,58,0.2)');
    glow.addColorStop(1, 'rgba(221,72,58,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - 50, f.y - 80, 100, 100);
  }

  if (!opts.ghost) {
    ctx.save();
    ctx.globalAlpha = alpha * (dead ? 0.5 : 0.55);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND + 2, 14 * scale * (dead ? 1.5 : 1), 4 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(round(f.x), round(f.y));

  if (dead) {
    const fall = clamp(t * 3.2, 0, 1);
    ctx.translate(0, -7);
    ctx.rotate(fall * 1.5);
    ctx.translate(-5, 4);
  }

  ctx.scale(f.facing * scale, scale);

  let bob = Math.sin(game.time * 2.4 + f.id * 0.7) * 0.55;
  let lean = 0;
  let crouch = 0;
  if (dead) {
    bob = 0;
  } else if (st === 'run') {
    bob = Math.abs(Math.sin(t * 15)) * 1.4;
    lean = 0.04;
  } else if (st === 'jump') {
    lean = 0.03;
  } else if (st === 'dodge') {
    lean = 0.27;
    crouch = 2;
  } else if (st === 'hurt') {
    lean = -0.19;
    crouch = 1;
  } else if (st === 'stagger') {
    lean = 0.14;
    crouch = 5;
  } else if (st === 'parry') {
    lean = -0.03;
  }

  if (!dead) drawScarf(f, pal, bob, st);
  if (f.kind === 'boss' && !dead) drawCape(f, pal, bob);

  // Legs.
  const hip = -18 + bob * 0.25 + crouch * 0.4;
  let footA = { x: -4, y: 0 };
  let footB = { x: 4, y: 0 };
  if (dead) {
    footA = { x: -2, y: 0 };
    footB = { x: 8, y: -1 };
  } else if (st === 'run') {
    const swing = Math.sin(t * 15);
    footA = { x: -3 + swing * 6, y: 0 };
    footB = { x: 3 - swing * 6, y: 0 };
  } else if (st === 'jump') {
    footA = { x: -6, y: -6 };
    footB = { x: 7, y: -4 };
  } else if (st === 'dodge') {
    footA = { x: -9, y: 0 };
    footB = { x: 7, y: -2 };
  } else if (st === 'stagger') {
    footA = { x: -7, y: 0 };
    footB = { x: 3, y: 0 };
  } else if (st === 'attack') {
    footA = { x: -6, y: 0 };
    footB = { x: 6, y: 0 };
  }

  localLimb(-2, hip, footA.x, footA.y - 1, 4, pal.robe2);
  localLimb(2, hip, footB.x, footB.y - 1, 4, pal.robe);
  ctx.fillStyle = '#171319';
  ctx.fillRect(round(footA.x) - 2, round(footA.y) - 1, 5, 2);
  ctx.fillRect(round(footB.x) - 2, round(footB.y) - 1, 5, 2);

  // Torso.
  ctx.save();
  ctx.translate(0, bob + crouch);
  ctx.rotate(lean);

  ctx.fillStyle = pal.robe2;
  ctx.fillRect(-6, -23, 12, 9);
  ctx.fillStyle = pal.robe;
  ctx.fillRect(-6, -35, 12, 14);
  ctx.fillStyle = pal.robe3;
  ctx.fillRect(-6, -35, 4, 7);
  ctx.fillRect(2, -35, 4, 7);
  ctx.fillStyle = pal.trim;
  ctx.fillRect(-6, -23, 12, 2);
  ctx.fillRect(-1, -36, 1, 14);
  ctx.fillStyle = pal.robe3;
  ctx.fillRect(-8, -34, 3, 5);
  ctx.fillRect(5, -34, 3, 5);
  ctx.fillStyle = pal.trim;
  ctx.fillRect(-8, -35, 3, 1);
  ctx.fillRect(5, -35, 3, 1);

  drawFighterHead(f, pal, bob + crouch);

  // Back arm.
  localLimb(-3, -32 + bob + crouch, -7, -25 + bob + crouch, 3, pal.robe2);
  ctx.fillStyle = pal.skin2;
  ctx.fillRect(-8, -26 + bob + crouch, 3, 3);

  // Front arm, sword, trail.
  const pose = swordPose(f);
  if (pose.trail) {
    const a = f.attack;
    const progress = clamp((t - a.windup) / Math.max(0.001, a.active), 0, 1);
    const end = lerp(a.swingStart, a.swingEnd, easeInOut(progress));
    const alphaTrail = 0.28 + (1 - progress) * 0.35;
    ctx.save();
    ctx.translate(3, -31 + bob + crouch);
    ctx.strokeStyle = pose.trailColor + alphaTrail * 0.34 + ')';
    ctx.lineWidth = pose.trailWidth + 4;
    ctx.beginPath();
    ctx.arc(0, 0, 27, a.swingStart, end);
    ctx.stroke();
    ctx.strokeStyle = pose.trailColor + alphaTrail + ')';
    ctx.lineWidth = pose.trailWidth;
    ctx.beginPath();
    ctx.arc(0, 0, 27, a.swingStart, end);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + alphaTrail * 0.72 + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 27, a.swingStart, end);
    ctx.stroke();
    ctx.restore();
  }

  localLimb(4, -31 + bob + crouch, pose.handX, pose.handY + bob + crouch, 3, pal.skin);
  ctx.fillStyle = pal.skin;
  ctx.fillRect(round(pose.handX) - 1, round(pose.handY + bob + crouch) - 1, 3, 3);
  drawSwordLocal(pal, {
    ...pose,
    handX: pose.handX,
    handY: pose.handY + bob + crouch,
  });

  if (st === 'parry') {
    const pulse = 0.55 + Math.sin(game.time * 18) * 0.18;
    const strong = f.stateT <= f.parryWindow;
    ctx.globalAlpha = alpha * (strong ? 1 : 0.65);
    ctx.strokeStyle = '#8ef4ea';
    ctx.lineWidth = strong ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(9, -27 + bob + crouch, 17, -1.25, 1.2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(142,244,234,${0.24 * pulse})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(9, -27 + bob + crouch, 17, -1.25, 1.2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  ctx.restore();

  ctx.restore();
}

function drawFighterStatus(f, game) {
  if (f.isPlayer || !f.alive || f.spawnT > 0) return;
  const x = f.x;
  const top = f.y - f.h - 13;
  const w = 38 * f.scale;
  const h = 3;
  const bx = x - w / 2;

  ctx.fillStyle = 'rgba(5,4,8,0.85)';
  ctx.fillRect(bx - 1, top - 1, w + 2, h + 2);
  const hpRatio = clamp(f.hp / f.maxHp, 0, 1);
  ctx.fillStyle = f.kind === 'boss' ? '#d35b50' : '#c4484d';
  ctx.fillRect(bx, top, w * hpRatio, h);
  ctx.fillStyle = 'rgba(255,220,190,0.35)';
  ctx.fillRect(bx, top, w * hpRatio, 1);
  ctx.strokeStyle = 'rgba(232,197,122,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 0.5, top - 0.5, w + 1, h + 1);

  const postureRatio = f.maxPosture > 0 ? clamp(f.posture / f.maxPosture, 0, 1) : 0;
  if (postureRatio > 0.01) {
    ctx.fillStyle = 'rgba(5,4,8,0.8)';
    ctx.fillRect(bx, top + h + 1, w, 1);
    ctx.fillStyle = postureRatio > 0.78 ? '#ffcf5e' : '#c9a75d';
    ctx.fillRect(bx, top + h + 1, w * postureRatio, 1);
  }

  if (f.state === 'attack' && f.attack && f.stateT < f.attack.windup) {
    const k = f.stateT / Math.max(0.001, f.attack.windup);
    const pulse = 0.55 + Math.sin(game.time * 18) * 0.45;
    const iy = top - 11;
    if (f.attack.unblockable) {
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      pixelDiamond(x, iy, 5, 'rgba(176,35,45,0.92)');
      drawText('危', x, iy + 3, 6, '#ffe0d2', 'center', '700', 'rgba(0,0,0,0.5)');
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.35 + k * 0.65;
      pixelDiamond(x, iy, 3.5, 'rgba(240,255,251,0.9)');
      ctx.globalAlpha = 1;
    }
  }

  if (f.state === 'parry') {
    ctx.globalAlpha = 0.5 + Math.sin(game.time * 14) * 0.2;
    pixelDiamond(x, top - 8, 2, '#90f4ec');
    ctx.globalAlpha = 1;
  }

  if (f.state === 'stagger') {
    for (let i = 0; i < 3; i++) {
      const a = game.time * 5 + (i / 3) * TAU;
      const sx = x + Math.cos(a) * 9;
      const sy = top - 10 + Math.sin(a) * 3;
      ctx.fillStyle = i === 1 ? '#ffdc79' : '#d4b45f';
      ctx.fillRect(round(sx), round(sy), 2, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Effects, HUD, and frame composition.
// ---------------------------------------------------------------------------

function drawEffects(game) {
  // Expanding impact rings.
  for (const ring of game.rings) {
    const k = 1 - ring.life / ring.maxLife;
    const r = ring.max * easeOut(k);
    ctx.globalAlpha = Math.max(0, 1 - k) * 0.8;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width * (1 - k * 0.5);
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const p of game.particles) {
    const alpha = clamp(p.life / p.max, 0, 1);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    if (p.type === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      ctx.stroke();
    } else if (p.type === 'dust') {
      ctx.fillStyle = p.color;
      ctx.fillRect(round(p.x), round(p.y), round(p.size), round(p.size));
    } else if (p.type === 'petal') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -1, p.size, 2);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  for (const t of game.texts) {
    const a = clamp(t.life / 0.3, 0, 1);
    ctx.globalAlpha = a;
    drawText(t.str, t.x, t.y, t.size, t.color, 'center', '700', 'rgba(0,0,0,0.75)');
  }
  ctx.globalAlpha = 1;
}

function drawBar(x, y, w, h, ratio, color, shine) {
  ctx.fillStyle = 'rgba(5,4,8,0.82)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(50,36,38,0.7)';
  ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, w * clamp(ratio, 0, 1));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, fw, h);
  if (shine && fw > 0) {
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, fw, 1);
  }
  ctx.strokeStyle = 'rgba(232,197,122,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

function drawHUD(game) {
  if (game.state === 'title') return;
  const p = game.player;

  // Top strip.
  const top = ctx.createLinearGradient(0, 0, 0, 58);
  top.addColorStop(0, 'rgba(4,3,8,0.78)');
  top.addColorStop(0.72, 'rgba(4,3,8,0.3)');
  top.addColorStop(1, 'rgba(4,3,8,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VW, 58);

  // Player plaque.
  ctx.fillStyle = 'rgba(10,7,13,0.68)';
  ctx.fillRect(12, 10, 196, 31);
  ctx.strokeStyle = 'rgba(232,197,122,0.22)';
  ctx.strokeRect(12.5, 10.5, 195, 30);
  ctx.fillStyle = '#8f1f2a';
  ctx.fillRect(16, 14, 21, 21);
  ctx.strokeStyle = 'rgba(240,219,181,0.6)';
  ctx.strokeRect(16.5, 14.5, 20, 20);
  drawText('侍', 26.5, 30, 13, '#f6e6ce', 'center', '700', null);
  drawText('RONIN', 43, 20, 7, '#d8c5a5', 'left', '700');
  const hpRatio = clamp(p.hp / p.maxHp, 0, 1);
  const low = hpRatio < 0.3 && p.hp > 0;
  const pulse = low ? 0.7 + Math.sin(game.ambientTime * 10) * 0.3 : 1;
  drawBar(43, 24, 154, 7, hpRatio,
    low ? `rgba(224,68,66,${pulse})` : '#b7353f',
    low ? 'rgba(255,136,119,0.8)' : '#e16668');
  drawText(`${Math.max(0, Math.ceil(p.hp))}`, 196, 20, 7, hpRatio < 0.3 ? '#ff8d82' : '#c5b391', 'right');

  // Combo.
  if (game.combo > 1) {
    const pulse2 = 1 + Math.sin(game.ambientTime * 12) * 0.06;
    ctx.save();
    ctx.translate(18, 57);
    ctx.scale(pulse2, pulse2);
    drawText(`x${game.combo}`, 0, 0, 18, '#e8c57a', 'left', '700');
    drawText('COMBO', 2, 9, 6, '#a99471', 'left', '700');
    ctx.restore();
  }

  // Right-side wave and score.
  drawText(`WAVE ${game.waveIndex + 1} / ${WAVES.length}`, 604, 19, 7, '#b9a88b', 'right', '700');
  drawText(String(game.score).padStart(6, '0'), 604, 33, 12, '#e8c57a', 'right', '700');
  for (let i = 0; i < WAVES.length; i++) {
    const x = 604 - (WAVES.length - 1 - i) * 8;
    ctx.fillStyle = i < game.waveIndex ? '#b9954f' : i === game.waveIndex ? '#f0d79c' : 'rgba(185,149,83,0.24)';
    ctx.fillRect(x, 38, 4, 2);
  }

  // Boss bar.
  const boss = game.enemies.find((e) => e.kind === 'boss' && e.alive);
  if (boss) {
    const bx = 224;
    const bw = 194;
    drawText('LORD OF ASH', bx + bw / 2, 11, 7, '#d9c29f', 'center', '700');
    drawText('灰 の 王', bx + bw / 2 + 48, 11, 7, '#9e7c55', 'center', '700');
    drawBar(bx, 15, bw, 7, boss.hp / boss.maxHp, '#aa3b3e', '#dd6b5e');
    drawBar(bx, 23, bw, 2, boss.posture / boss.maxPosture, '#d4aa56', '#f1d184');
    if (boss.phase === 2) {
      drawText('PHASE II', bx + bw / 2, 34, 6, '#e66d57', 'center', '700');
    }
  }

  // Tutorial / read-the-blade prompt.
  if (game.waveIndex === 0 && game.tutorialT > 0 && !game.paused) {
    const a = clamp(game.tutorialT / 2.2, 0, 1);
    ctx.globalAlpha = a;
    if (!isTouch) {
      const text = 'A D  MOVE    SPACE  JUMP    J  STRIKE    K  PARRY    L  DODGE';
      ctx.fillStyle = 'rgba(6,4,10,0.7)';
      ctx.fillRect(86, VH - 28, 468, 18);
      ctx.strokeStyle = 'rgba(232,197,122,0.18)';
      ctx.strokeRect(86.5, VH - 27.5, 467, 17);
      drawText(text, VW / 2, VH - 16, 7, '#d7c5a5', 'center', '700');
    } else {
      drawText('WHITE GLINT = PARRY  ·  RED MARK = DODGE', VW / 2, VH - 13, 7, '#d7c5a5', 'center', '700');
    }
    ctx.globalAlpha = 1;
  }

  // A quiet cue when a parryable strike is winding up.
  if (!isTouch && game.state === 'playing' && !game.paused) {
    const cue = game.enemies.find(
      (e) => e.alive && e.state === 'attack' && e.attack && !e.attack.unblockable &&
        e.stateT < e.attack.windup && Math.abs(e.x - p.x) < 118 && p.canAct() && p.parryCd <= 0
    );
    if (cue) {
      const blink = 0.55 + Math.sin(game.ambientTime * 16) * 0.35;
      ctx.globalAlpha = blink;
      drawText('K · PARRY', p.x - game.camX, p.y - p.h - 26, 8, '#9ff7ef', 'center', '700');
      ctx.globalAlpha = 1;
    }
  }
}

function drawBanner(game) {
  if (!game.banner || game.banner.t <= 0) return;
  const b = game.banner;
  const fadeIn = clamp((b.max - b.t) / 0.25, 0, 1);
  const fadeOut = clamp(b.t / 0.42, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const y = 100;
  ctx.globalAlpha = alpha;
  const w = 330;
  const g = ctx.createLinearGradient(VW / 2 - w / 2, 0, VW / 2 + w / 2, 0);
  g.addColorStop(0, 'rgba(232,197,122,0)');
  g.addColorStop(0.2, 'rgba(232,197,122,0.4)');
  g.addColorStop(0.8, 'rgba(232,197,122,0.4)');
  g.addColorStop(1, 'rgba(232,197,122,0)');
  ctx.fillStyle = g;
  ctx.fillRect(VW / 2 - w / 2, y - 29, w, 1);
  ctx.fillRect(VW / 2 - w / 2, y + 14, w, 1);

  drawText(b.title, VW / 2, y, 22, b.color || '#e8c57a', 'center', '700');
  drawText(b.sub || '', VW / 2, y + 11, 8, '#e9d9ba', 'center', '700');
  if (b.note) drawText(b.note, VW / 2, y + 25, 6, '#a18d70', 'center', '700');
  ctx.globalAlpha = 1;
}

function drawFlash(game) {
  if (game.flashT <= 0) return;
  const alpha = clamp((game.flashT / game.flashMax) * (game.flashAlpha || 0.14), 0, 0.8);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = game.flashColor;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function render(game) {
  ctx.fillStyle = '#06040b';
  ctx.fillRect(0, 0, VW, VH);

  drawSky(game);
  drawParallax(game);
  drawPetals(game, false);

  const shakeX = game.shake > 0 ? (Math.random() * 2 - 1) * game.shake * 0.55 : 0;
  const shakeY = game.shake > 0 ? (Math.random() * 2 - 1) * game.shake * 0.4 : 0;

  ctx.save();
  ctx.translate(-game.camX + shakeX, shakeY);
  drawGround(game);

  // Dash echoes.
  for (const img of game.afterimages) {
    drawFighter(img.snap, game, { alpha: img.alpha * (img.life / img.max), ghost: true });
  }

  if (game.state === 'title') {
    drawFighter(game.attractPlayer, game);
    drawFighter(game.attractEnemy, game);
  } else {
    const fighters = [game.player, ...game.enemies].filter(Boolean);
    fighters.sort((a, b) => a.x - b.x);
    for (const f of fighters) {
      drawFighter(f, game);
    }
    for (const f of fighters) {
      drawFighterStatus(f, game);
    }
  }

  drawEffects(game);
  ctx.restore();

  drawPetals(game, true);

  if (game.state !== 'title') drawHUD(game);
  drawBanner(game);
  drawFlash(game);
}

// ---------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------

const game = new Game();
let lastFrame = performance.now();

function loop(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05);
  lastFrame = now;

  input.pollGamepad();
  game.handleGlobalInput();
  if (game.state === 'playing' && !game.paused) game.update(dt);
  else game.updateAmbient(dt);

  render(game);
  sound.updateMusic();
  input.endFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// A small debug handle is useful for previews and automated smoke tests.
window.__blade = {
  game,
  start: () => game.startRun(),
  wave: (index) => {
    if (game.state !== 'playing') game.startRun();
    game.enemies = [];
    game.startWave(clamp(index | 0, 0, WAVES.length - 1));
  },
  win: () => game.finish(true),
  lose: () => game.finish(false),
};

