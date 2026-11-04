// BLADE WIND — a moonlit samurai duel
// A self-contained, hand-animated 2D fighting game. No external assets or libraries.

const VW = 640;
const VH = 360;
const GROUND = 298;
const WORLD_W = 1060;
const GRAVITY = 1180;
const TAU = Math.PI * 2;
const RENDER_SCALE = 2;

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
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

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

  swing(heavy = false, style = 'side') {
    if (style === 'thrust') {
      this.noise(heavy ? 0.14 : 0.09, heavy ? 0.19 : 0.11, heavy ? 1500 : 1900, 0.9, 'bandpass', 0, 320);
      if (heavy) this.tone(185, 0.1, 'triangle', 0.025, 0, 90);
      return;
    }
    this.noise(heavy ? 0.17 : 0.1, heavy ? 0.2 : 0.12, heavy ? 700 : 1100, 0.7, 'bandpass', 0, heavy ? 180 : 320);
    if (heavy) this.tone(150, 0.1, 'triangle', 0.03, 0, 80);
  }
  charge() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.tone(150, 0.58, 'sine', 0.022, t, 420);
    this.tone(300, 0.5, 'triangle', 0.012, t, 760);
    this.noise(0.46, 0.035, 260, 1.2, 'bandpass', t, 1450);
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
    name: 'sidecut', style: 'side', comboLabel: 'SIDE CUT',
    windup: 0.07, active: 0.1, recover: 0.18,
    damage: 9, range: 64, height: 38, posture: 8, knock: 100,
    lunge: 125, hurt: 0.2, backReach: 18, swingStart: -2.05, swingEnd: 1.12,
  },
  {
    name: 'pierce', style: 'thrust', comboLabel: 'PIERCE',
    windup: 0.09, active: 0.08, recover: 0.2,
    damage: 12, range: 80, height: 28, posture: 11, knock: 125,
    lunge: 165, hurt: 0.22, backReach: 4,
  },
  {
    name: 'moonfall', style: 'overhead', comboLabel: 'CHARGED MOONFALL',
    windup: 0.62, active: 0.14, recover: 0.4,
    damage: 32, range: 86, height: 48, posture: 28, knock: 300,
    lunge: 140, hurt: 0.48, backReach: 10,
    swingStart: -2.95, swingEnd: 0.5, heavy: true, charged: true,
  },
];

const MOVES = {
  r_slash: {
    style: 'side', windup: 0.4, active: 0.09, recover: 0.36, damage: 10, range: 66,
    height: 38, posture: 10, knock: 112, lunge: 90, hurt: 0.24, backReach: 18,
    swingStart: -1.95, swingEnd: 1.08,
  },
  r_slash2: {
    style: 'side', windup: 0.24, active: 0.08, recover: 0.42, damage: 11, range: 68,
    height: 38, posture: 11, knock: 122, lunge: 112, hurt: 0.24, backReach: 16,
    swingStart: -1.7, swingEnd: 1.12,
  },
  r_thrust: {
    style: 'thrust', windup: 0.36, active: 0.08, recover: 0.42, damage: 12, range: 86,
    height: 28, posture: 11, knock: 135, lunge: 190, hurt: 0.25, backReach: 4,
  },
  r_heavy: {
    style: 'overhead', windup: 0.72, active: 0.12, recover: 0.55, damage: 19, range: 74,
    height: 40, posture: 16, knock: 195, lunge: 82, hurt: 0.4, backReach: 10,
    swingStart: -2.7, swingEnd: 0.62, heavy: true, unblockable: true, charged: true,
  },
  n_slash: {
    style: 'side', windup: 0.25, active: 0.07, recover: 0.3, damage: 8, range: 60,
    height: 38, posture: 8, knock: 90, lunge: 120, hurt: 0.2, backReach: 16,
    swingStart: -1.55, swingEnd: 1.04,
  },
  n_thrust: {
    style: 'thrust', windup: 0.24, active: 0.06, recover: 0.32, damage: 9, range: 80,
    height: 26, posture: 8, knock: 105, lunge: 185, hurt: 0.2, backReach: 4,
  },
  n_dash: {
    style: 'thrust', windup: 0.34, active: 0.1, recover: 0.38, damage: 11, range: 84,
    height: 30, posture: 12, knock: 145, lunge: 265, hurt: 0.28, backReach: 4,
    heavy: true,
  },
  b_sweep: {
    style: 'side', windup: 0.62, active: 0.13, recover: 0.55, damage: 16, range: 82,
    height: 40, posture: 15, knock: 175, lunge: 62, hurt: 0.34, backReach: 22,
    swingStart: -2.1, swingEnd: 1.18, heavy: true,
  },
  b_thrust: {
    style: 'thrust', windup: 0.58, active: 0.12, recover: 0.52, damage: 18, range: 96,
    height: 30, posture: 16, knock: 220, lunge: 230, hurt: 0.36, backReach: 4, heavy: true,
  },
  b_smash: {
    style: 'overhead', windup: 0.82, active: 0.14, recover: 0.68, damage: 22, range: 84,
    height: 44, posture: 20, knock: 230, lunge: 74, hurt: 0.44, backReach: 10,
    swingStart: -2.85, swingEnd: 0.55, heavy: true, unblockable: true, charged: true,
  },
  boss_slash: {
    style: 'side', windup: 0.34, active: 0.08, recover: 0.28, damage: 11, range: 74,
    height: 40, posture: 10, knock: 120, lunge: 110, hurt: 0.24, backReach: 18,
    swingStart: -1.95, swingEnd: 1.08,
  },
  boss_slash2: {
    style: 'side', windup: 0.22, active: 0.08, recover: 0.3, damage: 12, range: 76,
    height: 40, posture: 10, knock: 130, lunge: 120, hurt: 0.24, backReach: 16,
    swingStart: -1.6, swingEnd: 1.12,
  },
  boss_thrust: {
    style: 'thrust', windup: 0.32, active: 0.08, recover: 0.4, damage: 13, range: 96,
    height: 30, posture: 12, knock: 150, lunge: 230, hurt: 0.27, backReach: 4,
  },
  boss_red: {
    style: 'overhead', windup: 0.62, active: 0.13, recover: 0.5, damage: 20, range: 84,
    height: 42, posture: 18, knock: 230, lunge: 100, hurt: 0.42, backReach: 10,
    swingStart: -2.75, swingEnd: 0.6, heavy: true, unblockable: true, charged: true,
  },
  boss_quick: {
    style: 'side', windup: 0.2, active: 0.07, recover: 0.24, damage: 9, range: 70,
    height: 38, posture: 8, knock: 95, lunge: 90, hurt: 0.2, backReach: 14,
    swingStart: -1.55, swingEnd: 1.0,
  },
  boss_lunge: {
    style: 'thrust', windup: 0.55, active: 0.14, recover: 0.55, damage: 24, range: 100,
    height: 34, posture: 22, knock: 260, lunge: 300, hurt: 0.46, backReach: 4,
    heavy: true, unblockable: true, charged: true,
    swingStart: -1.9, swingEnd: 1.15,
  },
};

const PATTERNS = {
  ronin: [
    ['r_slash'],
    ['r_slash', 'r_slash2'],
    ['r_thrust'],
    ['r_slash', 'r_thrust'],
    ['r_heavy'],
    ['r_slash', 'r_heavy'],
  ],
  ninja: [
    ['n_slash'],
    ['n_thrust'],
    ['n_slash', 'n_slash'],
    ['n_slash', 'n_thrust'],
    ['n_dash'],
    ['n_thrust', 'n_dash'],
  ],
  brute: [
    ['b_sweep'],
    ['b_thrust'],
    ['b_smash'],
    ['b_sweep', 'b_smash'],
    ['b_sweep', 'b_thrust'],
  ],
  boss: [
    ['boss_slash', 'boss_slash2', 'boss_red'],
    ['boss_quick', 'boss_thrust', 'boss_lunge'],
    ['boss_thrust'],
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
    if (move.charged) sound.charge();
  }

  updateAttack(dt, game) {
    const a = this.attack;
    if (!a) {
      this.setState('idle');
      return;
    }
    if (!this.swingPlayed && this.stateT >= a.windup) {
      this.swingPlayed = true;
      sound.swing(!!a.heavy, a.style);
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
    const back = attack.backReach !== undefined ? attack.backReach : 10;
    return dx > -back && dx < attack.range + target.w * 0.45 && dy < attack.height;
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
    const list = PATTERNS[this.kind] || PATTERNS.ronin;
    const firstStyle = (pattern) => {
      const move = MOVES[pattern[0]];
      return move ? move.style : 'side';
    };
    let chosen;
    if (this.kind === 'boss') {
      if (dist > 125) {
        chosen = pick([PATTERNS.boss[1], PATTERNS.boss[2], PATTERNS.boss[3], PATTERNS.boss[5]]);
      } else if (this.phase === 2 && Math.random() < 0.4) {
        chosen = pick([PATTERNS.boss[0], PATTERNS.boss[1], PATTERNS.boss[4]]);
      }
    }
    if (!chosen) {
      // Thrusts answer distance; wide side cuts are saved for close pressure.
      const thrusts = list.filter((p) => firstStyle(p) === 'thrust');
      const sides = list.filter((p) => firstStyle(p) !== 'thrust');
      if (dist > 72 && thrusts.length && Math.random() < 0.7) {
        chosen = pick(thrusts);
      } else if (dist < 54 && sides.length && Math.random() < 0.68) {
        chosen = pick(sides);
      } else {
        chosen = pick(list);
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

    this.updateChargeFx(worldDt);
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

  updateChargeFx(dt) {
    const fighters = [this.player, ...this.enemies];
    for (const f of fighters) {
      const charging = f.alive && f.state === 'attack' && f.attack && f.attack.charged &&
        f.stateT < f.attack.windup;
      if (!charging) {
        f.chargeFx = 0;
        continue;
      }
      f.chargeFx = (f.chargeFx || 0) - dt;
      if (f.chargeFx > 0) continue;
      f.chargeFx = 0.055;
      const k = clamp(f.stateT / Math.max(0.001, f.attack.windup), 0, 1);
      const a = rnd(0, TAU);
      const r = rnd(10, 18 + k * 12);
      this.addParticle({
        type: 'spark',
        x: f.x + Math.cos(a) * r,
        y: f.y - 30 + Math.sin(a) * r * 0.65,
        vx: -Math.cos(a) * rnd(18, 44),
        vy: -Math.sin(a) * rnd(12, 30) - 10,
        grav: -12, drag: 1.2, life: rnd(0.18, 0.38), max: 0.38, size: 1,
        color: f.isPlayer ? '#ffe6a4' : '#ffc27a',
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

const UI_FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", system-ui, sans-serif';
const DISPLAY_FONT = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';

function drawText(str, x, y, size, color, align = 'left', weight = '600', shadow = 'rgba(0,0,0,0.82)') {
  const family = size >= 14 ? DISPLAY_FONT : UI_FONT;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(str, x + 0.8, y + 1.1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Rounded-rectangle helper shared by panels, bars, and buttons drawn on canvas.
function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function softEllipse(x, y, rx, ry, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
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
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size > 1 ? 1.15 : 0.7, 0, TAU);
    ctx.fill();
    if (s.size > 1) {
      ctx.globalAlpha = s.alpha * twinkle * 0.18;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.4, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Moon glow.
  const mx = 506;
  const my = 72;
  const glow = ctx.createRadialGradient(mx, my, 18, mx, my, 118);
  glow.addColorStop(0, 'rgba(255,239,201,0.3)');
  glow.addColorStop(0.14, 'rgba(255,229,176,0.17)');
  glow.addColorStop(0.5, 'rgba(238,196,141,0.06)');
  glow.addColorStop(1, 'rgba(238,196,141,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - 122, my - 122, 244, 244);

  ctx.fillStyle = '#f3e3be';
  ctx.beginPath();
  ctx.arc(mx, my, 42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff0ce';
  ctx.beginPath();
  ctx.arc(mx - 5, my - 6, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(199,175,141,0.2)';
  ctx.beginPath();
  ctx.arc(mx - 15, my - 5, 8, 0, TAU);
  ctx.arc(mx + 12, my + 14, 6, 0, TAU);
  ctx.arc(mx + 4, my - 20, 4, 0, TAU);
  ctx.arc(mx - 24, my + 18, 3, 0, TAU);
  ctx.fill();

  // Soft drifting cloud bands across the moon.
  for (const c of BG.clouds) {
    const x = ((c.x + t * c.speed * (c.layer ? 1.5 : 0.7)) % (VW + c.w + 60)) - c.w - 30;
    const cy = c.y + c.h * 0.5;
    const cloud = ctx.createLinearGradient(0, cy - c.h * 2.2, 0, cy + c.h * 2.2);
    cloud.addColorStop(0, 'rgba(37,23,49,0)');
    cloud.addColorStop(0.46, c.layer ? 'rgba(55,34,68,0.92)' : 'rgba(34,21,47,0.92)');
    cloud.addColorStop(0.68, c.layer ? 'rgba(46,29,59,0.6)' : 'rgba(28,17,40,0.6)');
    cloud.addColorStop(1, 'rgba(27,16,38,0)');
    ctx.globalAlpha = Math.min(1, c.alpha * 2.4);
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(x + c.w * 0.5, cy, c.w * 0.58, c.h * 1.75, 0, 0, TAU);
    ctx.ellipse(x + c.w * 0.27, cy - c.h * 0.5, c.w * 0.29, c.h * 1.5, 0, 0, TAU);
    ctx.ellipse(x + c.w * 0.73, cy + c.h * 0.35, c.w * 0.27, c.h * 1.2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function smoothRidge(points, offsetX, offsetY) {
  ctx.beginPath();
  const first = points[0];
  ctx.moveTo(first.x + offsetX, first.y + offsetY);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const n = points[i + 1];
    const mx = (p.x + n.x) / 2 + offsetX;
    const my = (p.y + n.y) / 2 + offsetY;
    ctx.quadraticCurveTo(p.x + offsetX, p.y + offsetY, mx, my);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x + offsetX, last.y + offsetY);
  ctx.lineTo(VW + 100, GROUND);
  ctx.lineTo(-100, GROUND);
  ctx.closePath();
}

function drawParallax(game) {
  const cam = game.camX;
  const t = game.ambientTime;

  // Far mountains.
  ctx.fillStyle = '#140e20';
  smoothRidge(BG.far, -cam * 0.08, 0);
  ctx.fill();

  ctx.fillStyle = '#1b1227';
  smoothRidge(BG.mid, -cam * 0.16, 5);
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
    ctx.lineCap = 'round';
    for (let s = 1; s < 4; s++) {
      const yy = GROUND - (b.h * s) / 4;
      ctx.beginPath();
      ctx.moveTo(x + sway * 0.25, yy);
      ctx.quadraticCurveTo(x + sway * 0.25 + 3, yy - 2.4, x + sway * 0.25 + 6, yy - 3);
      ctx.stroke();
    }
    if (b.leaf > 0.42) {
      ctx.strokeStyle = '#1b2d21';
      ctx.lineWidth = 1.1;
      for (let l = 0; l < 3; l++) {
        const ly = GROUND - b.h + l * 8;
        const dir = l % 2 ? 1 : -1;
        const reach = 7 + b.leaf * 8;
        ctx.beginPath();
        ctx.moveTo(topX, ly);
        ctx.quadraticCurveTo(topX + dir * reach * 0.5, ly - 1.2, topX + dir * reach, ly - 3.6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(96,132,88,0.28)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(topX, ly + 0.8);
        ctx.quadraticCurveTo(topX + dir * reach * 0.42, ly + 3.2, topX + dir * reach * 0.86, ly - 1.2);
        ctx.stroke();
        ctx.strokeStyle = '#1b2d21';
        ctx.lineWidth = 1.1;
      }
    }
  }

  // Last ridge, very near, dark.
  ctx.fillStyle = '#100c18';
  smoothRidge(BG.near, -cam * 0.25, 8);
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

// Smooth tapered limb with round joints, used for arms and legs.
function localLimb(x1, y1, x2, y2, w, color, w2 = w * 0.78) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (w2 < w - 0.4) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.lineWidth = (w + w2) / 2;
    ctx.beginPath();
    ctx.moveTo(mx - Math.cos(a) * 0.5, my - Math.sin(a) * 0.5);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function limbJoint(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// A two-bone limb that bends naturally at a knee or elbow.
function jointedLimb(hx, hy, fx, fy, width, color, bend = 1) {
  const dx = fx - hx;
  const dy = fy - hy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const mx = hx + dx * 0.5 - (dy / len) * bend * 2.4;
  const my = hy + dy * 0.5 + (dx / len) * bend * 0.6 - 1.4;
  localLimb(hx, hy, mx, my, width, color, width * 0.82);
  localLimb(mx, my, fx, fy, width * 0.86, color, width * 0.64);
  limbJoint(mx, my, width * 0.42, color);
  return { x: mx, y: my };
}

function swordPose(f) {
  const t = f.stateT;
  const st = f.state;
  if (st === 'attack' && f.attack) {
    const a = f.attack;
    if (a.style === 'thrust') {
      const wind = Math.max(0.001, a.windup);
      const activeEnd = a.windup + a.active;
      let handX;
      if (t < a.windup) {
        handX = lerp(3, -2, easeOut(t / wind));
      } else if (t < activeEnd) {
        handX = lerp(-2, 19, easeInOut((t - a.windup) / Math.max(0.001, a.active)));
      } else {
        const k = clamp((t - activeEnd) / Math.max(0.001, a.recover), 0, 1);
        handX = lerp(19, 3, easeOut(k));
      }
      const active = t >= a.windup - 0.02 && t <= activeEnd + 0.035;
      return {
        handX, handY: -29, angle: 0.04,
        glow: active ? 1 : t < a.windup ? 0.35 : 0.15,
        glowColor: a.unblockable ? '#ff6b58' : a.heavy ? '#f3d18a' : '#c8f4ee',
        trail: active, thrust: true,
        trailStart: 0, trailEnd: 0,
        trailColor: a.unblockable ? 'rgba(255,92,78,' : 'rgba(230,255,249,',
        trailWidth: a.heavy ? 4 : 2.5,
        charging: !!a.charged && t < a.windup,
        chargeProgress: a.charged ? clamp(t / Math.max(0.001, a.windup), 0, 1) : 0,
      };
    }
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
    const chargeProgress = a.charged ? clamp(t / Math.max(0.001, a.windup), 0, 1) : 0;
    return {
      handX, handY, angle,
      glow: active ? 1 : t < a.windup ? (a.charged ? 0.35 + chargeProgress * 0.6 : 0.4) : 0.15,
      glowColor: a.unblockable ? '#ff6b58' : a.heavy ? '#f3d18a' : '#c8f4ee',
      trail: active,
      trailStart: a.swingStart,
      trailEnd: angle,
      trailColor: a.unblockable ? 'rgba(255,92,78,' : 'rgba(230,255,249,',
      trailWidth: a.heavy ? 4 : 2.5,
      charging: !!a.charged && t < a.windup,
      chargeProgress,
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
    ctx.globalAlpha *= pose.glow * 0.5;
    ctx.strokeStyle = pose.glowColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(16, -0.8, 31, 0);
    ctx.stroke();
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(angle);

  // Wrapped hilt.
  ctx.fillStyle = '#2a1915';
  roundRectPath(-6, -1.35, 6, 2.7, 1.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(218,196,156,0.35)';
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-5.4 + i * 1.7, -1.2);
    ctx.lineTo(-4.6 + i * 1.7, 1.2);
    ctx.stroke();
  }

  // Guard and pommel.
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.ellipse(0.5, 0, 1, 2.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,214,0.4)';
  ctx.beginPath();
  ctx.ellipse(0.2, -0.9, 0.4, 1.1, 0, 0, TAU);
  ctx.fill();

  // Curved katana blade with a soft steel gradient.
  const steel = ctx.createLinearGradient(0, -1.2, 0, 1.2);
  steel.addColorStop(0, pal.edge);
  steel.addColorStop(0.45, pal.steel);
  steel.addColorStop(1, 'rgba(118,137,143,0.95)');
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.moveTo(1.6, -1.15);
  ctx.quadraticCurveTo(17, -1.45, 30, -0.5);
  ctx.quadraticCurveTo(33, -0.1, 30.4, 0.35);
  ctx.quadraticCurveTo(17, 1.2, 1.6, 1.15);
  ctx.quadraticCurveTo(0.6, 0, 1.6, -1.15);
  ctx.closePath();
  ctx.fill();

  // Hamon and edge highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(3, -0.7);
  ctx.quadraticCurveTo(17, -0.95, 29.4, -0.25);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(52,68,74,0.5)';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(3, 0.55);
  ctx.quadraticCurveTo(16, 0.8, 28.6, 0.25);
  ctx.stroke();

  ctx.restore();
}

function drawScarf(f, pal, bob, st, time = 0) {
  const phase = f.scarfPhase || 0;
  const flap = Math.sin(time * 5.4 + phase) * 1.7;
  const drift = st === 'run' ? 5 : st === 'dodge' ? 9 : st === 'jump' ? 6 : 0;
  const gust = Math.sin(time * 7 + phase * 1.7) * (1 + drift * 0.22);
  const neckX = -2.6;
  const neckY = -35 + bob;
  const tailX = -14 - drift;
  const tailY = -23 + bob + flap * 1.5 + drift * 0.35;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = pal.scarf2;
  ctx.lineWidth = 4.1;
  ctx.beginPath();
  ctx.moveTo(neckX - 1, neckY + 1.2);
  ctx.bezierCurveTo(-7, neckY - 1.6 + flap, tailX * 0.62, tailY + 5 - gust, tailX, tailY + 3);
  ctx.stroke();

  ctx.strokeStyle = pal.scarf;
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(neckX, neckY);
  ctx.bezierCurveTo(-6.5, neckY - 2.8 + flap, tailX * 0.55, tailY + 2 - gust * 0.7, tailX + 1.4, tailY - 0.6);
  ctx.stroke();

  // Pale leading edge catches the moonlight.
  ctx.strokeStyle = 'rgba(255,238,224,0.26)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(neckX + 0.5, neckY - 1.2);
  ctx.bezierCurveTo(-6.2, neckY - 4, tailX * 0.5, tailY - gust * 0.75, tailX + 1.6, tailY - 1.8);
  ctx.stroke();
  ctx.restore();
}

function drawCape(f, pal, bob, st, time = 0) {
  const wave = Math.sin(time * 2.6 + (f.scarfPhase || 0)) * 2.6;
  const lift = st === 'run' ? 3 : st === 'jump' ? 4 : st === 'dodge' ? 6 : 0;
  ctx.save();
  ctx.fillStyle = pal.scarf2;
  ctx.beginPath();
  ctx.moveTo(-3.5, -36 + bob);
  ctx.bezierCurveTo(-11, -35 + bob, -15, -22 + bob, -18 - lift + wave, -3 + bob);
  ctx.quadraticCurveTo(-11, -6 + bob + wave * 0.4, -7 - lift * 0.4, -18 + bob);
  ctx.quadraticCurveTo(-6, -27 + bob, -2, -31 + bob);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.scarf;
  ctx.beginPath();
  ctx.moveTo(-3, -35 + bob);
  ctx.bezierCurveTo(-8.5, -33 + bob, -11.5, -23 + bob, -13.4 - lift * 0.7 + wave * 0.7, -7 + bob);
  ctx.quadraticCurveTo(-8.4, -10 + bob, -5.8, -20 + bob);
  ctx.quadraticCurveTo(-5, -27 + bob, -2, -31 + bob);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,235,206,0.22)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-4, -33.5 + bob);
  ctx.bezierCurveTo(-9, -28 + bob, -11, -18 + bob, -13 + wave * 0.6, -8 + bob);
  ctx.stroke();

  ctx.fillStyle = pal.accent;
  ctx.globalAlpha *= 0.8;
  ctx.beginPath();
  ctx.ellipse(-18 - lift + wave, -3.2 + bob, 2.1, 1.1, -0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFighterHead(f, pal, bob) {
  const hy = -45 + bob;

  // Neck.
  ctx.fillStyle = pal.skin2;
  roundRectPath(-2.1, hy + 4.4, 4.2, 4.8, 1.6);
  ctx.fill();

  // Hair mass behind the face.
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.ellipse(-0.5, hy - 0.3, 5.7, 6.3, -0.08, 0, TAU);
  ctx.fill();

  // Face with a soft vertical skin gradient.
  const face = ctx.createLinearGradient(0, hy - 5, 0, hy + 5.5);
  face.addColorStop(0, pal.skin);
  face.addColorStop(0.72, pal.skin);
  face.addColorStop(1, pal.skin2);
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(1.1, hy + 0.2, 4.6, 5.2, 0.03, 0, TAU);
  ctx.fill();

  // Cheek and jaw shading.
  ctx.fillStyle = 'rgba(80,45,43,0.16)';
  ctx.beginPath();
  ctx.ellipse(1.5, hy + 3.4, 3.2, 1.9, 0, 0, TAU);
  ctx.fill();

  // Ear.
  ctx.fillStyle = pal.skin2;
  ctx.beginPath();
  ctx.ellipse(-2.7, hy + 0.5, 1.25, 1.7, 0.1, 0, TAU);
  ctx.fill();

  // Nose and mouth.
  ctx.strokeStyle = 'rgba(92,54,44,0.5)';
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4.2, hy - 0.4);
  ctx.lineTo(4.9, hy + 1.1);
  ctx.lineTo(4.1, hy + 1.35);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(77,42,40,0.55)';
  ctx.beginPath();
  if (f.dead) {
    ctx.moveTo(2.1, hy + 3.3);
    ctx.lineTo(4.4, hy + 3.1);
  } else {
    ctx.moveTo(2.5, hy + 3.35);
    ctx.quadraticCurveTo(3.4, hy + 3.7, 4.4, hy + 3.2);
  }
  ctx.stroke();

  // Eye.
  if (f.dead) {
    ctx.strokeStyle = 'rgba(40,27,27,0.8)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(2.1, hy - 0.7);
    ctx.lineTo(4.2, hy + 0.2);
    ctx.moveTo(4.2, hy - 0.7);
    ctx.lineTo(2.1, hy + 0.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,249,235,0.9)';
    ctx.beginPath();
    ctx.ellipse(3.15, hy - 0.35, 1.25, 0.85, 0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.eye;
    ctx.beginPath();
    ctx.ellipse(3.45, hy - 0.3, 0.62, 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#171218';
    ctx.beginPath();
    ctx.ellipse(3.55, hy - 0.28, 0.32, 0.58, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(3.38, hy - 0.55, 0.18, 0, TAU);
    ctx.fill();
    // Fierce brow.
    ctx.strokeStyle = pal.hair;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(1.9, hy - 2.1);
    ctx.quadraticCurveTo(3.2, hy - 2.55, 4.4, hy - 1.9);
    ctx.stroke();
  }

  if (f.kind === 'player') {
    // Swept hair, headband, and short topknot.
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(-5.4, hy - 2.4);
    ctx.bezierCurveTo(-7.4, hy - 5.5, -4, hy - 7.4, -0.6, hy - 6.4);
    ctx.bezierCurveTo(1.6, hy - 7.6, 4.4, hy - 5.6, 3.8, hy - 3.6);
    ctx.quadraticCurveTo(0.4, hy - 5.4, -5.4, hy - 2.4);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-1.1, hy - 7.6, 1.6, 2.5, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(-4.9, hy - 2.3);
    ctx.quadraticCurveTo(0.1, hy - 3.5, 4.8, hy - 2.2);
    ctx.stroke();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1.2, hy - 6.1);
    ctx.lineTo(-0.4, hy - 7.8);
    ctx.stroke();
    // Loose strand.
    ctx.strokeStyle = pal.hair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4.2, hy - 2.8);
    ctx.quadraticCurveTo(-6.6, hy + 0.2, -6.2, hy + 3.2);
    ctx.stroke();
  } else if (f.kind === 'ronin') {
    // Wide conical straw hat.
    ctx.fillStyle = '#5f4f34';
    ctx.beginPath();
    ctx.ellipse(0.4, hy - 4.1, 11.2, 2.4, -0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a6845';
    ctx.beginPath();
    ctx.moveTo(-6.6, hy - 4.7);
    ctx.quadraticCurveTo(-3.6, hy - 11.4, 0.4, hy - 13.2);
    ctx.quadraticCurveTo(4.6, hy - 11.2, 7.2, hy - 4.5);
    ctx.quadraticCurveTo(0.4, hy - 2.6, -6.6, hy - 4.7);
    ctx.fill();
    ctx.fillStyle = '#8d7a53';
    ctx.beginPath();
    ctx.ellipse(-0.4, hy - 8.9, 3.1, 0.7, -0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3f3324';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-6.3, hy - 4.4);
    ctx.quadraticCurveTo(0.4, hy - 3.1, 6.9, hy - 4.3);
    ctx.stroke();
    // Shadow beneath the brim.
    ctx.fillStyle = 'rgba(20,12,14,0.32)';
    ctx.beginPath();
    ctx.ellipse(1.2, hy - 1.2, 4.2, 2, 0, 0, Math.PI);
    ctx.fill();
    // Stubble.
    ctx.fillStyle = 'rgba(50,36,30,0.28)';
    ctx.beginPath();
    ctx.ellipse(1.6, hy + 3.7, 3, 1.3, 0, 0, TAU);
    ctx.fill();
  } else if (f.kind === 'ninja') {
    // Hood and face mask.
    ctx.fillStyle = pal.robe2;
    ctx.beginPath();
    ctx.ellipse(0.1, hy - 0.5, 6, 6.7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.robe;
    ctx.beginPath();
    ctx.ellipse(1.5, hy + 2.7, 4.7, 3.2, 0.02, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-3.6, hy + 1.8);
    ctx.quadraticCurveTo(0, hy + 2.6, 4.4, hy + 1.6);
    ctx.stroke();
    // Eye slit.
    ctx.fillStyle = 'rgba(9,9,14,0.92)';
    ctx.beginPath();
    ctx.ellipse(1.9, hy - 0.9, 3, 1.2, 0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.eye;
    ctx.beginPath();
    ctx.ellipse(3, hy - 0.85, 0.9, 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#15121c';
    ctx.beginPath();
    ctx.ellipse(3.15, hy - 0.83, 0.34, 0.45, 0, 0, TAU);
    ctx.fill();
    // Headband tails.
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4.9, hy - 2);
    ctx.quadraticCurveTo(-8.4, hy - 1.4, -10, hy + 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.6, hy - 1.2);
    ctx.quadraticCurveTo(-7.6, hy + 0.6, -8.4, hy + 3.4);
    ctx.stroke();
  } else if (f.kind === 'brute') {
    // Iron helmet with side horns.
    ctx.fillStyle = '#3b3439';
    ctx.beginPath();
    ctx.ellipse(0.4, hy - 2.2, 6.5, 5.2, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#4a4147';
    ctx.beginPath();
    ctx.ellipse(-0.4, hy - 3, 3.6, 2.2, -0.1, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    roundRectPath(-6.4, hy - 2.9, 13.4, 1.5, 0.7);
    ctx.fill();
    ctx.fillStyle = '#2a2528';
    ctx.beginPath();
    ctx.moveTo(-5.2, hy - 4.4);
    ctx.quadraticCurveTo(-9.4, hy - 7.8, -10.4, hy - 11.6);
    ctx.quadraticCurveTo(-8.2, hy - 8.8, -4.4, hy - 6.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.6, hy - 4.6);
    ctx.quadraticCurveTo(9.4, hy - 7.6, 10.2, hy - 11.4);
    ctx.quadraticCurveTo(8.2, hy - 8.6, 4.8, hy - 6.4);
    ctx.fill();
    // Scar.
    ctx.strokeStyle = 'rgba(150,80,72,0.5)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0.4, hy + 0.9);
    ctx.lineTo(2.2, hy + 3.4);
    ctx.stroke();
  } else if (f.kind === 'boss') {
    // Long hair, gold crown, and burning eyes.
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(-5.6, hy - 3.2);
    ctx.bezierCurveTo(-9.4, hy - 1.2, -9.8, hy + 5.4, -7.6, hy + 9.2);
    ctx.bezierCurveTo(-5.4, hy + 6.2, -4.6, hy + 1.6, -3.6, hy - 1.4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4.6, hy - 3.6);
    ctx.bezierCurveTo(7.6, hy - 1.4, 8.2, hy + 4.4, 6.8, hy + 8.2);
    ctx.bezierCurveTo(5.4, hy + 5, 4.8, hy + 1.2, 3.6, hy - 1.6);
    ctx.fill();
    ctx.fillStyle = '#c8a04f';
    ctx.beginPath();
    ctx.ellipse(0.6, hy - 5.1, 6.2, 1.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8c57a';
    ctx.beginPath();
    ctx.moveTo(-5.2, hy - 5.6);
    ctx.quadraticCurveTo(-8.2, hy - 8.8, -6.8, hy - 12.6);
    ctx.quadraticCurveTo(-5.4, hy - 8.8, -3.8, hy - 6.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4.6, hy - 5.7);
    ctx.quadraticCurveTo(7.8, hy - 8.8, 6.2, hy - 12.4);
    ctx.quadraticCurveTo(5.2, hy - 8.6, 3.4, hy - 6.6);
    ctx.fill();
    ctx.fillStyle = '#8d2f2c';
    ctx.beginPath();
    ctx.ellipse(0.6, hy - 4.9, 0.8, 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffb07a';
    ctx.beginPath();
    ctx.ellipse(3.5, hy - 0.28, 0.44, 0.52, 0, 0, TAU);
    ctx.fill();
  }
}

function drawFighter(f, game, opts = {}) {
  const pal = PALETTES[f.kind];
  const st = f.state;
  const t = f.stateT;
  const time = game.time;
  let alpha = opts.alpha !== undefined ? opts.alpha : 1;
  if (f.spawnT > 0) alpha *= clamp(1 - f.spawnT / 0.9, 0.2, 1);
  if (f.dead) alpha *= clamp(1 - f.deathT / 1.45, 0, 1);
  if (alpha <= 0.01) return;

  const scale = f.scale;
  const dead = f.dead;

  // Boss phase-two aura.
  if (f.kind === 'boss' && f.phase === 2 && !dead) {
    const auraPulse = 0.9 + Math.sin(time * 3.4) * 0.1;
    const glow = ctx.createRadialGradient(f.x, f.y - 28, 5, f.x, f.y - 28, 54 * auraPulse);
    glow.addColorStop(0, 'rgba(232,86,68,0.26)');
    glow.addColorStop(0.45, 'rgba(196,58,62,0.1)');
    glow.addColorStop(1, 'rgba(196,58,62,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - 58, f.y - 88, 116, 108);
  }

  if (!opts.ghost) {
    ctx.save();
    ctx.globalAlpha = alpha * (dead ? 0.42 : 0.5);
    const sh = ctx.createRadialGradient(f.x, GROUND + 2, 1, f.x, GROUND + 2, 22 * scale);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(f.x, GROUND + 2, 22 * scale * (dead ? 1.4 : 1), 5.5 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(f.x, f.y);

  if (dead) {
    const fall = clamp(t * 3.2, 0, 1);
    ctx.translate(0, -7);
    ctx.rotate(fall * 1.5);
    ctx.translate(-5, 4);
  }

  ctx.scale(f.facing * scale, scale);

  let bob = Math.sin(time * 2.3 + f.id * 0.7) * 0.5;
  let lean = 0;
  let crouch = 0;
  if (dead) {
    bob = 0;
  } else if (st === 'run') {
    bob = Math.abs(Math.sin(t * 15)) * 1.5;
    lean = 0.055;
  } else if (st === 'jump') {
    lean = 0.045;
  } else if (st === 'dodge') {
    lean = 0.3;
    crouch = 2.4;
  } else if (st === 'hurt') {
    lean = -0.24;
    crouch = 1.2;
  } else if (st === 'stagger') {
    lean = 0.18;
    crouch = 5.2;
  } else if (st === 'parry') {
    lean = -0.045;
  }
  if (f.state === 'attack' && f.attack && f.attack.charged &&
      f.stateT < f.attack.windup) {
    crouch += 0.8;
    lean -= 0.03;
  }

  if (!dead) drawScarf(f, pal, bob, st, time);
  if (f.kind === 'boss' && !dead) drawCape(f, pal, bob, st, time);

  // ---------------------------------------------------------------------
  // Legs: two articulated bones with soft shoes.
  // ---------------------------------------------------------------------
  const hipY = -18 + bob * 0.2 + crouch * 0.35;
  let footA = { x: -4.2, y: 0 };
  let footB = { x: 4.2, y: 0 };
  let bendA = 0.55;
  let bendB = -0.75;
  if (dead) {
    footA = { x: -3.4, y: 0 };
    footB = { x: 8.2, y: -1 };
  } else if (st === 'run') {
    const swing = Math.sin(t * 15);
    footA = { x: -3.2 + swing * 7, y: -Math.max(0, -swing) * 4.2 };
    footB = { x: 3.4 - swing * 7, y: -Math.max(0, swing) * 4.2 };
    bendA = 0.55 + swing * 0.45;
    bendB = -0.55 + swing * 0.45;
  } else if (st === 'jump') {
    footA = { x: -6.4, y: -6.4 };
    footB = { x: 6.8, y: -4.2 };
    bendA = -0.35;
    bendB = -1.15;
  } else if (st === 'dodge') {
    footA = { x: -9.6, y: -0.4 };
    footB = { x: 7.4, y: -2.6 };
    bendA = -0.2;
    bendB = -1.35;
  } else if (st === 'stagger') {
    footA = { x: -7.2, y: 0 };
    footB = { x: 3.2, y: 0 };
    bendA = 0.9;
    bendB = -0.4;
  } else if (st === 'attack') {
    footA = { x: -6.6, y: 0 };
    footB = { x: 6.6, y: 0 };
    bendA = 0.35;
    bendB = -0.95;
  }

  const drawLeg = (hx, foot, bend, robeColor, shoeColor) => {
    const knee = jointedLimb(hx, hipY, foot.x, foot.y - 1, 5.2, robeColor, bend);
    // Shin wrap and sandal.
    ctx.save();
    ctx.translate(foot.x, foot.y - 0.9);
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(1.1, 0.4, 3.5, 1.55, -0.06, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,238,214,0.16)';
    ctx.beginPath();
    ctx.ellipse(0.8, -0.35, 2.4, 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return knee;
  };

  drawLeg(-2.2, footA, bendA, pal.robe2, '#151118');
  drawLeg(2.2, footB, bendB, pal.robe, '#1b161d');

  // ---------------------------------------------------------------------
  // Torso, belt, collar, and shoulders.
  // ---------------------------------------------------------------------
  ctx.save();
  ctx.translate(0, bob + crouch);
  ctx.rotate(lean);

  const robeGrad = ctx.createLinearGradient(-8, -36, 8, -16);
  robeGrad.addColorStop(0, pal.robe3);
  robeGrad.addColorStop(0.48, pal.robe);
  robeGrad.addColorStop(1, pal.robe2);
  ctx.fillStyle = robeGrad;
  ctx.beginPath();
  ctx.moveTo(-5.4, -35);
  ctx.bezierCurveTo(-8.2, -31, -8.4, -24, -7.1, -17.2);
  ctx.quadraticCurveTo(0, -14.4, 7.1, -17.2);
  ctx.bezierCurveTo(8.2, -24, 8, -30.5, 5.4, -35);
  ctx.quadraticCurveTo(0, -38, -5.4, -35);
  ctx.closePath();
  ctx.fill();

  // Under-robe skirt.
  ctx.fillStyle = pal.robe2;
  ctx.beginPath();
  ctx.moveTo(-7, -21);
  ctx.quadraticCurveTo(0, -18.4, 7, -21);
  ctx.lineTo(5.6, -14.4);
  ctx.quadraticCurveTo(0, -12.4, -5.6, -14.4);
  ctx.closePath();
  ctx.fill();

  // Robe folds.
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.4, -33);
  ctx.quadraticCurveTo(-4.6, -25, -4, -18);
  ctx.moveTo(3.4, -33);
  ctx.quadraticCurveTo(4.6, -25, 4, -18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,244,220,0.12)';
  ctx.beginPath();
  ctx.moveTo(5.6, -32);
  ctx.quadraticCurveTo(6.6, -25, 5.8, -19);
  ctx.stroke();

  // Collar.
  ctx.fillStyle = pal.robe3;
  ctx.beginPath();
  ctx.moveTo(-5.2, -35.2);
  ctx.lineTo(-1.4, -28.8);
  ctx.lineTo(0, -31.6);
  ctx.lineTo(1.8, -28.5);
  ctx.lineTo(5.2, -35.2);
  ctx.quadraticCurveTo(0, -37.2, -5.2, -35.2);
  ctx.fill();
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4.6, -34.6);
  ctx.lineTo(-1.1, -29.6);
  ctx.moveTo(4.6, -34.6);
  ctx.lineTo(1.5, -29.4);
  ctx.stroke();

  // Shoulder pads.
  ctx.fillStyle = pal.robe3;
  ctx.beginPath();
  ctx.ellipse(-5.4, -33.4, 3.4, 2.4, 0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5.4, -33.4, 3.4, 2.4, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,242,218,0.14)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(-5.4, -34.2, 2.6, 1.4, 0.2, Math.PI, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(5.4, -34.2, 2.6, 1.4, -0.2, Math.PI, TAU);
  ctx.stroke();

  // Belt / obi.
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.moveTo(-7.4, -23.4);
  ctx.quadraticCurveTo(0, -21.4, 7.4, -23.4);
  ctx.lineTo(7.1, -20.1);
  ctx.quadraticCurveTo(0, -18.2, -7.1, -20.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,216,0.22)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-7, -22.1);
  ctx.quadraticCurveTo(0, -20.2, 7, -22.1);
  ctx.stroke();
  // Sash knot.
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.ellipse(-6.4, -21.4, 1.3, 1.7, -0.3, 0, TAU);
  ctx.fill();

  drawFighterHead(f, pal, bob + crouch);

  // ---------------------------------------------------------------------
  // Back arm.
  // ---------------------------------------------------------------------
  let backHand = { x: -7.4, y: -24.2 + Math.sin(time * 2.3 + f.id) * 0.4 };
  if (st === 'run') {
    const s = Math.sin(t * 15);
    backHand = { x: -7.2 + s * 3.6, y: -25.4 + Math.abs(s) * 1.2 };
  } else if (st === 'attack') {
    backHand = { x: -8.4, y: -23.2 };
  } else if (st === 'jump') {
    backHand = { x: -9.2, y: -28.4 };
  } else if (st === 'dodge') {
    backHand = { x: -10.4, y: -21.6 };
  } else if (st === 'stagger' || st === 'hurt') {
    backHand = { x: -9.4, y: -20.4 };
  } else if (st === 'parry') {
    backHand = { x: -6.4, y: -28.4 };
  }
  const backElbow = { x: (-4 + backHand.x) / 2 - 1.4, y: (-32 + backHand.y) / 2 - 1.6 };
  localLimb(-4, -33, backElbow.x, backElbow.y, 3.6, pal.robe2, 3.1);
  localLimb(backElbow.x, backElbow.y, backHand.x, backHand.y, 2.7, pal.skin2, 2.2);
  limbJoint(backHand.x, backHand.y, 1.45, pal.skin2);

  // ---------------------------------------------------------------------
  // Front arm, sword, trail.
  // ---------------------------------------------------------------------
  const pose = swordPose(f);
  const handY = pose.handY + bob + crouch;

  if (pose.trail) {
    const a = f.attack;
    const progress = clamp((t - a.windup) / Math.max(0.001, a.active), 0, 1);
    const alphaTrail = 0.3 + (1 - progress) * 0.42;
    ctx.save();
    ctx.lineCap = 'round';
    if (pose.thrust) {
      const y = handY;
      const tip = pose.handX + 30;
      ctx.strokeStyle = pose.trailColor + alphaTrail * 0.28 + ')';
      ctx.lineWidth = pose.trailWidth + 7;
      ctx.beginPath();
      ctx.moveTo(pose.handX - 5, y);
      ctx.lineTo(tip + 10, y);
      ctx.stroke();
      ctx.strokeStyle = pose.trailColor + alphaTrail + ')';
      ctx.lineWidth = pose.trailWidth + 1.5;
      ctx.beginPath();
      ctx.moveTo(pose.handX - 3, y);
      ctx.lineTo(tip + 4, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + alphaTrail * 0.85 + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(pose.handX, y - 0.8);
      ctx.lineTo(tip, y - 0.8);
      ctx.stroke();
    } else {
      const end = lerp(a.swingStart, a.swingEnd, easeInOut(progress));
      const cx = 3;
      const cy = -31 + bob + crouch;
      const radius = 29;
      ctx.strokeStyle = pose.trailColor + alphaTrail * 0.26 + ')';
      ctx.lineWidth = pose.trailWidth + 5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, a.swingStart, end);
      ctx.stroke();
      ctx.strokeStyle = pose.trailColor + alphaTrail + ')';
      ctx.lineWidth = pose.trailWidth + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, a.swingStart, end);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + alphaTrail * 0.82 + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 1.4, a.swingStart, end);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Upper arm and forearm.
  const shoulder = { x: 4.2, y: -33 };
  const hand = { x: pose.handX, y: handY };
  const frontElbow = {
    x: (shoulder.x + hand.x) / 2 - 1.2,
    y: (shoulder.y + hand.y) / 2 - 2.6,
  };
  localLimb(shoulder.x, shoulder.y, frontElbow.x, frontElbow.y, 3.6, pal.robe, 3.1);
  localLimb(frontElbow.x, frontElbow.y, hand.x, hand.y, 2.7, pal.skin, 2.2);
  limbJoint(hand.x, hand.y, 1.55, pal.skin);
  ctx.strokeStyle = 'rgba(255,242,220,0.14)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(frontElbow.x, frontElbow.y - 0.8);
  ctx.lineTo(hand.x, hand.y - 0.8);
  ctx.stroke();

  drawSwordLocal(pal, {
    ...pose,
    handX: hand.x,
    handY: hand.y,
  });

  // Idle blade glint.
  if (!dead && !pose.trail && pose.glow < 0.2) {
    const gl = 0.12 + Math.max(0, Math.sin(time * 2.1 + f.id)) * 0.5;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(pose.angle);
    ctx.globalAlpha = alpha * gl * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(24, -0.8, 1.6, 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Golden charge vortex.
  if (pose.charging) {
    const k = pose.chargeProgress;
    const pulse = 0.5 + Math.sin(time * 24) * 0.5;
    const cx = 3;
    const cy = -30 + bob + crouch;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 15 + k * 15);
    g.addColorStop(0, `rgba(255,244,196,${0.42 + k * 0.3})`);
    g.addColorStop(0.42, `rgba(255,203,106,${0.16 + k * 0.2})`);
    g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 15 + k * 15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(243,209,138,${0.45 + k * 0.5})`;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1 + k * 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 17 + k * 10 + pulse * 2, -2.65, 0.55);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,244,196,${0.3 + k * 0.5})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 13 + k * 7 + pulse, -2.3, 0.3);
    ctx.stroke();
    ctx.fillStyle = '#fff2c4';
    for (let i = 0; i < 5; i++) {
      const orbit = time * (3.2 + i * 0.45) + i * 1.7;
      const r = 9 + k * 15 + (i % 2) * 4;
      const sx = cx + Math.cos(orbit) * r;
      const sy = cy + Math.sin(orbit) * r * 0.72;
      ctx.globalAlpha = alpha * (0.55 + k * 0.4);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.85 + (i % 3) * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Parry crescent.
  if (st === 'parry') {
    const strong = f.stateT <= f.parryWindow;
    const pulse = 0.55 + Math.sin(time * 18) * 0.2;
    const cy = -27 + bob + crouch;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(142,244,234,${0.2 * pulse})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(9, cy, 18, -1.3, 1.2);
    ctx.stroke();
    ctx.strokeStyle = strong ? '#b8fff8' : 'rgba(142,244,234,0.7)';
    ctx.lineWidth = strong ? 2.2 : 1.5;
    ctx.beginPath();
    ctx.arc(9, cy, 18, -1.3, 1.2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * pulse})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(9, cy, 20, -1.15, 0.95);
    ctx.stroke();
    ctx.restore();
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
    } else if (f.attack.style === 'thrust') {
      // A long amber line reads as a straight thrust; the white diamond is a side cut.
      ctx.globalAlpha = 0.35 + k * 0.65;
      ctx.fillStyle = 'rgba(255,226,158,0.92)';
      ctx.fillRect(x - 8, iy - 0.5, 16, 1);
      pixelDiamond(x, iy, 2.5, 'rgba(255,236,184,0.95)');
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
      const text = 'A D  MOVE    SPACE  JUMP    J J J  COMBO    K  PARRY    L  DODGE';
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
  // Draw the whole game in 640×360 logical coordinates, then let the
  // high-DPI backing store resolve it at 2× with smooth antialiasing.
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
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

