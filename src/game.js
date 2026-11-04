import * as THREE from 'three';
import { World } from './world.js';
import { Runner } from './runner.js';
import { SoundEngine } from './audio.js';
import { AssetFactory, LANES } from './templates.js';
import { UI } from './ui.js';
import {
  clamp,
  damp,
  formatScore,
  lerp,
  pick,
  rand,
  randInt,
  shuffle,
} from './utils.js';

const PLAYER_Z = 0;
const BASE_SPEED = 16;
const MAX_SPEED = 43;
const GRAVITY = 33;
const JUMP_VELOCITY = 10.8;
const SPAWN_Z = -148;
const SAVE_KEY = 'railrush-save-v1';
const POWERUP_DURATION = { magnet: 10, shield: 12 };

const TIPS = [
  'TIP / Slide under low signs. Jump the striped barriers.',
  'TIP / Chain coins quickly to raise your multiplier to x5.',
  'TIP / Thread past a train in the next lane for a near-miss bonus.',
  'TIP / A shield eats one crash. Save it for a double train.',
  'TIP / The magnet sweeps coins from every lane. Ride the trail.',
  'TIP / Don’t fight the speed. Learn the rhythm of the line.',
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu';
    this.time = 0;
    this.lastFrame = performance.now();
    this.countdownTimers = [];
    this.effects = [];
    this.obstacles = [];
    this.powerups = [];
    this.coins = [];
    this.coinPool = [];
    this.deathTimer = 0;
    this.gameOverTimer = null;
    this.hudTick = 0;
    this.menuTime = 0;
    this.pointer = new THREE.Vector2();
    this.speed = 8.5;
    this.playerX = 0;
    this.targetLane = 1;
    this.laneVelocity = 0;
    this.jumpY = 0;
    this.shake = 0;
    this.cameraRoll = 0;
    this.cameraFov = 61;
    this.magnetTime = 0;
    this.shieldTime = 0;
    this.invincible = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070813);
    this.scene.fog = new THREE.Fog(0x0a0b1d, 52, 205);

    this.camera = new THREE.PerspectiveCamera(61, window.innerWidth / window.innerHeight, 0.1, 520);
    this.camera.position.set(6.6, 5.2, 14.5);
    this.cameraLook = new THREE.Vector3(-2.6, 1.3, -25);
    this.cameraPosition = this.camera.position.clone();

    this.world = new World(this.scene);
    this.runner = new Runner(this.scene);
    this.assets = new AssetFactory();
    this.sound = new SoundEngine();
    this.ui = new UI();
    this.ui.setAudioMuted(this.sound.muted);

    this.save = this.loadSave();
    this.ui.setMenuStats(this.save);
    this.ui.setBestLive(this.save.best);

    this.buildCoinPool();
    this.bindUI();
    this.bindInput();
    this.resize();
    this.setupMenuScene();
    this.ui.showMenu();
    this.ui.finishLoading();
    this.sound.setMuted(this.sound.muted);

    // A tiny test/debug handle keeps the game inspectable without affecting play.
    window.__RAIL_RUSH__ = this;

    this.loop = this.loop.bind(this);
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);
  }

  loadSave() {
    const fallback = { best: 0, coins: 0, runs: 0 };
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return fallback;
      return {
        best: Number.isFinite(raw.best) ? raw.best : 0,
        coins: Number.isFinite(raw.coins) ? raw.coins : 0,
        runs: Number.isFinite(raw.runs) ? raw.runs : 0,
      };
    } catch {
      return fallback;
    }
  }

  saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Storage can be unavailable in private windows; the run still works.
    }
  }

  buildCoinPool() {
    for (let i = 0; i < 80; i += 1) {
      const coin = this.assets.createCoin();
      coin.visible = false;
      coin.userData.pooled = true;
      this.scene.add(coin);
      this.coinPool.push(coin);
    }
  }

  bindUI() {
    const click = (element, handler) => {
      element?.addEventListener('click', (event) => {
        event.preventDefault();
        this.sound.init();
        this.sound.click();
        handler(event);
      });
    };

    click(this.ui.el.btnPlay, () => this.startRun());
    click(this.ui.el.btnHow, () => this.ui.showHowto());
    click(this.ui.el.btnCloseHow, () => this.ui.hideHowto());
    click(this.ui.el.btnHowPlay, () => {
      this.ui.hideHowto();
      this.startRun();
    });
    click(this.ui.el.btnPause, () => this.pauseGame());
    click(this.ui.el.btnResume, () => this.resumeGame());
    click(this.ui.el.btnQuit, () => this.quitToMenu());
    click(this.ui.el.btnRetry, () => this.startRun());
    click(this.ui.el.btnMenu, () => this.quitToMenu());
    click(this.ui.el.btnAudio, () => this.toggleAudio());
    click(this.ui.el.btnAudioMenu, () => this.toggleAudio());

    // The menu art is mostly click-through, so listen at the app level. This
    // also makes the mobile "tap to start" hint work on the station backdrop.
    this.canvas.parentElement.addEventListener('click', (event) => {
      if (this.state !== 'menu') return;
      if (!this.ui.el.howto.classList.contains('hidden')) return;
      if (event.target.closest('button, a, input, #howto')) return;
      this.startRun();
    });

    this.ui.el.touch.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.doAction(button.dataset.action);
      });
    });
  }

  toggleAudio() {
    const muted = this.sound.toggleMuted();
    this.ui.setAudioMuted(muted);
    if (!muted) this.sound.click();
  }

  bindInput() {
    window.addEventListener('keydown', (event) => this.onKeyDown(event), { passive: false });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });

    const canvas = this.canvas;
    let touchStart = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      touchStart = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!touchStart || touchStart.id !== event.pointerId) return;
      const dx = event.clientX - touchStart.x;
      const dy = event.clientY - touchStart.y;
      const elapsed = performance.now() - touchStart.at;
      touchStart = null;
      const threshold = Math.max(18, Math.min(window.innerWidth, window.innerHeight) * 0.028);
      if (this.state !== 'playing' || elapsed > 800) return;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.doAction(dx > 0 ? 'right' : 'left');
      } else {
        this.doAction(dy > 0 ? 'slide' : 'jump');
      }
    });
    canvas.addEventListener('pointercancel', () => {
      touchStart = null;
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') {
        this.pointer.set(
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1
        );
      }
    });
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    const code = event.code;
    const isUiKey = [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key);
    if (isUiKey) event.preventDefault();
    if (event.repeat) return;

    if (this.state === 'playing') {
      if (key === 'a' || code === 'ArrowLeft') this.doAction('left');
      else if (key === 'd' || code === 'ArrowRight') this.doAction('right');
      else if (key === 'w' || code === 'ArrowUp' || code === 'Space') this.doAction('jump');
      else if (key === 's' || code === 'ArrowDown') this.doAction('slide');
      else if (key === 'p' || key === 'escape') this.pauseGame();
      else if (key === 'm') this.toggleAudio();
      return;
    }

    if (this.state === 'paused') {
      if (key === 'p' || key === 'escape') this.resumeGame();
      else if (key === 'm') this.toggleAudio();
      return;
    }

    if (this.state === 'menu') {
      if (!this.ui.el.howto.classList.contains('hidden')) {
        if (key === 'escape') this.ui.hideHowto();
        return;
      }
      if (key === 'enter' || key === ' ') this.startRun();
      else if (key === 'm') this.toggleAudio();
      return;
    }

    if (this.state === 'gameover') {
      if (key === 'r' || key === 'enter' || key === ' ') this.startRun();
      else if (key === 'escape') this.quitToMenu();
      else if (key === 'm') this.toggleAudio();
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  doAction(action) {
    if (this.state !== 'playing') return;
    if (action === 'left') this.switchLane(-1);
    else if (action === 'right') this.switchLane(1);
    else if (action === 'jump') this.jump();
    else if (action === 'slide') this.slide();
    if (this.travel > 8) this.ui.hideTutorial();
  }

  switchLane(direction) {
    const next = clamp(this.targetLane + direction, 0, 2);
    if (next === this.targetLane) {
      this.laneNudge = direction * 0.06;
      return;
    }
    this.targetLane = next;
    this.sound.lane();
    this.shake = Math.max(this.shake, 0.025);
  }

  jump() {
    if (!this.grounded) return;
    this.grounded = false;
    this.verticalVelocity = JUMP_VELOCITY;
    this.rollTimer = 0;
    this.jumpStretch = 1;
    this.sound.jump();
  }

  slide() {
    if (this.grounded) {
      this.rollTimer = 0.68;
      this.sound.slide();
    } else {
      this.verticalVelocity = Math.min(this.verticalVelocity, -13);
      this.rollTimer = 0.42;
    }
    this.ui.hideTutorial();
  }

  startRun() {
    if (this.state === 'countdown') return;
    this.cancelCountdown();
    this.sound.init();
    this.sound.startMusic();
    this.state = 'countdown';
    this.deathTimer = 0;
    this.resetRun();
    this.ui.hideMenu();
    this.ui.hideGameOver();
    this.ui.hidePause();
    this.ui.hideHowto();
    this.ui.showHud();
    this.ui.resetTutorial();
    this.ui.setTouchVisible(true);
    this.ui.setBestLive(this.save.best);
    this.bodyState('countdown');

    this.ui.setCountdown('3');
    this.sound.countdown();
    const sequence = [
      [650, '2', false],
      [1300, '1', false],
      [1950, 'GO', true],
      [2520, null, false],
    ];
    sequence.forEach(([delay, label, go], index) => {
      const timer = window.setTimeout(() => {
        if (this.state !== 'countdown') return;
        if (label) {
          this.ui.setCountdown(label, go);
          this.sound.countdown(go);
        }
        if (index === sequence.length - 1) {
          this.ui.hideCountdown();
          this.beginPlaying();
        }
      }, delay);
      this.countdownTimers.push(timer);
    });
  }

  cancelCountdown() {
    this.countdownTimers.forEach((timer) => window.clearTimeout(timer));
    this.countdownTimers = [];
  }

  beginPlaying() {
    if (this.state !== 'countdown') return;
    this.state = 'playing';
    this.bodyState('playing');
    this.ui.hideCountdown();
    this.speed = BASE_SPEED;
    this.seedCourse();
    this.ui.toast('RUN THE LINE // GOOD LUCK', 'cyan');
  }

  resetRun() {
    this.clearEntities();
    this.runner.reset();
    this.playerX = 0;
    this.targetLane = 1;
    this.currentLane = 1;
    this.jumpY = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.rollTimer = 0;
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.travel = 0;
    this.score = 0;
    this.bonusScore = 0;
    this.coinsCollected = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.magnetTime = 0;
    this.shieldTime = 0;
    this.invincible = 0;
    this.elapsed = 0;
    this.nextSpawnTravel = 55;
    this.waveIndex = 0;
    this.isNewBest = false;
    this.newBestAnnounced = false;
    this.lastNearMissAt = -10;
    this.shake = 0;
    this.cameraFov = 61;
    this.deathTimer = 0;
    this.hudTick = 0;
    this.ui.hideTutorial();
    this.ui.setBestLive(this.save.best);
    this.updateHud(true);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.bodyState('paused');
    this.ui.showPause();
    this.sound.setPaused(true);
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.bodyState('playing');
    this.ui.hidePause();
    this.sound.setPaused(false);
    this.lastFrame = performance.now();
  }

  quitToMenu() {
    this.cancelCountdown();
    this.state = 'menu';
    this.clearEntities();
    this.runner.reset();
    this.runner.group.position.set(0, 0, 0);
    this.ui.hideHud();
    this.ui.hidePause();
    this.ui.hideGameOver();
    this.ui.hideCountdown();
    this.ui.hideHowto();
    this.ui.setTouchVisible(false);
    this.ui.setMenuStats(this.save);
    this.ui.showMenu();
    this.bodyState('menu');
    this.sound.stopMusic();
    this.sound.setPaused(false);
    this.setupMenuScene();
    this.menuTime = 0;
  }

  bodyState(state) {
    document.body.dataset.state = state;
    this.state = state;
  }

  setupMenuScene() {
    const train = this.spawnObstacle('train', 2, -34, true);
    train.group.rotation.z = 0.008;
    const trainFar = this.spawnObstacle('train', 0, -82, true);
    trainFar.group.rotation.z = -0.006;
    this.spawnObstacle('barrier', 1, -54, true);
    this.spawnObstacle('lowbar', 1, -108, true);
    this.spawnCoinLine([2], -18, 8, 1.55, 'straight');
    this.spawnCoinLine([1], -63, 7, 1.65, 'arc');
    this.spawnPowerup(2, -74, 'magnet', true);
    this.menuDecorMoney = this.coins.slice();
  }

  clearEntities() {
    this.obstacles.forEach((entity) => this.scene.remove(entity.group));
    this.obstacles = [];
    this.powerups.forEach((entity) => this.scene.remove(entity.group));
    this.powerups = [];
    this.coins.forEach((entity) => {
      entity.group.visible = false;
      if (!this.coinPool.includes(entity.group)) this.coinPool.push(entity.group);
    });
    this.coins = [];
    this.effects.forEach((effect) => {
      this.scene.remove(effect.object);
      effect.object.geometry?.dispose();
      if (Array.isArray(effect.object.material)) {
        effect.object.material.forEach((material) => material.dispose());
      } else {
        effect.object.material?.dispose();
      }
    });
    this.effects = [];
  }

  acquireCoin() {
    let group = this.coinPool.pop();
    if (!group) {
      group = this.assets.createCoin();
      this.scene.add(group);
    }
    group.visible = true;
    return group;
  }

  releaseCoin(group) {
    group.visible = false;
    this.coinPool.push(group);
  }

  spawnCoin(x, y, z, phase = Math.random() * Math.PI * 2) {
    const group = this.acquireCoin();
    group.position.set(x, y, z);
    group.rotation.set(0, 0, 0);
    this.scene.add(group);
    const coin = {
      group,
      x,
      baseY: y,
      phase,
      prevZ: z,
    };
    this.coins.push(coin);
    return coin;
  }

  spawnCoinLine(lanes, centerZ, count, spacing, profile = 'straight') {
    for (let i = 0; i < count; i += 1) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      let lane = lanes[0];
      if (profile === 'zigzag') {
        lane = lanes[Math.floor(i / 3) % lanes.length];
      } else if (lanes.length > 1) {
        lane = lanes[Math.min(lanes.length - 1, Math.floor(t * lanes.length))];
      }
      let y = 1.03;
      if (profile === 'arc') y = 1.04 + Math.sin(t * Math.PI) * 1.32;
      else if (profile === 'low') y = 0.62;
      else if (profile === 'rising') y = 0.75 + t * 1.4;
      const z = centerZ + (i - (count - 1) / 2) * spacing;
      this.spawnCoin(LANES[lane], y, z);
    }
  }

  spawnObstacle(type, lane, z, decor = false) {
    const group = this.assets.createObstacle(type);
    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);
    const entity = {
      group,
      type,
      lane,
      x: LANES[lane],
      z,
      prevZ: z,
      width: group.userData.width || 2,
      depth: group.userData.depth || 1,
      collided: false,
      nearMissed: false,
      decor,
    };
    this.obstacles.push(entity);
    return entity;
  }

  spawnPowerup(lane, z, type, decor = false) {
    const group = this.assets.createPowerup(type);
    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);
    const entity = {
      group,
      type,
      lane,
      x: LANES[lane],
      z,
      baseY: 0,
      prevZ: z,
      decor,
      phase: Math.random() * Math.PI * 2,
    };
    this.powerups.push(entity);
    return entity;
  }

  seedCourse() {
    this.spawnCoinLine([1], -17, 7, 1.55, 'straight');
    this.spawnPowerup(2, -34, 'shield');
    this.spawnCoinLine([2], -45, 5, 1.55, 'straight');
    this.spawnWave(-78);
    this.nextSpawnTravel = 40;
    this.waveIndex = 1;
    this.ui.setBestLive(this.save.best);
  }

  spawnWave(z = SPAWN_Z) {
    this.waveIndex += 1;
    const danger = clamp(this.waveIndex / 20, 0, 1);
    const lanes = shuffle([0, 1, 2]);
    const safe = lanes[0];
    const blocked = [lanes[1], lanes[2]];
    const roll = Math.random();
    const jumpables = [];
    const slidables = [];

    const addBarrier = (lane, offset = 0) => {
      const entity = this.spawnObstacle('barrier', lane, z + offset);
      jumpables.push(entity);
      return entity;
    };
    const addLowbar = (lane, offset = 0) => {
      const entity = this.spawnObstacle('lowbar', lane, z + offset);
      slidables.push(entity);
      return entity;
    };

    if (roll < 0.1 && this.waveIndex > 1) {
      // A pure coin moment; the line breathes.
      this.spawnCoinLine(lanes, z, 10, 1.8, 'zigzag');
      if (this.waveIndex % 3 === 0) {
        this.spawnPowerup(lanes[1], z - 9, Math.random() > 0.5 ? 'magnet' : 'shield');
      }
      return;
    }

    if (roll < 0.3 || this.waveIndex <= 2) {
      // One action, one clear path.
      if (Math.random() > 0.48) addBarrier(blocked[0]);
      else addLowbar(blocked[0]);
    } else if (roll < 0.48) {
      // Two of the same action, leaving the safe lane open.
      if (Math.random() > 0.5) {
        blocked.forEach((lane) => addBarrier(lane));
      } else {
        blocked.forEach((lane) => addLowbar(lane));
      }
    } else if (roll < 0.64) {
      // A parked train. Respect it.
      this.spawnObstacle('train', blocked[0], z);
      if (danger > 0.42 && Math.random() > 0.55) addBarrier(blocked[1], 1.6);
    } else if (roll < 0.79) {
      // Train plus a different reaction in the other lane.
      this.spawnObstacle('train', blocked[0], z);
      if (Math.random() > 0.5) addBarrier(blocked[1], 1.2);
      else addLowbar(blocked[1], 1.2);
    } else if (roll < 0.91) {
      // Double train only once the player has warmed up.
      if (danger > 0.16) {
        this.spawnObstacle('train', blocked[0], z);
        this.spawnObstacle('train', blocked[1], z + (Math.random() > 0.5 ? 0 : 2.2));
      } else {
        this.spawnObstacle('train', blocked[0], z);
        addBarrier(blocked[1]);
      }
    } else {
      // Full gauntlet: thread the safe lane.
      this.spawnObstacle('train', blocked[0], z);
      if (Math.random() > 0.5) addBarrier(blocked[1], 1.4);
      else addLowbar(blocked[1], 1.4);
      if (danger > 0.55 && Math.random() > 0.5) addLowbar(safe, 4.5);
    }

    // Coins describe the safe route and reward the correct action.
    this.spawnCoinLine([safe], z - 1.8, 6, 1.7, 'straight');
    jumpables.forEach((entity) => {
      if (Math.random() > 0.4) {
        this.spawnCoinLine([entity.lane], entity.z - 1.5, 4, 1.2, 'arc');
      }
    });
    slidables.forEach((entity) => {
      if (Math.random() > 0.5) {
        this.spawnCoinLine([entity.lane], entity.z - 1.4, 3, 1.1, 'low');
      }
    });

    if (this.waveIndex % 7 === 4) {
      const powerType = Math.random() > 0.48 ? 'magnet' : 'shield';
      this.spawnPowerup(safe, z - 8, powerType);
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      this.menuTime += dt;
      this.speed = damp(this.speed || 8.5, 8.5, 1.2, dt);
      this.world.update(dt, this.speed);
      this.updateMenuEntities(dt);
      this.runner.group.position.set(0, 0, 0);
      this.runner.update(dt, {
        speed: 9.5,
        grounded: true,
        verticalVelocity: 0,
        rolling: false,
        laneVelocity: 0,
        gameOver: false,
      });
      this.updateEffects(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'countdown') {
      this.speed = damp(this.speed || 12, 13, 1.5, dt);
      this.world.update(dt, this.speed);
      this.runner.group.position.set(0, 0, 0);
      this.runner.update(dt, {
        speed: 17,
        grounded: true,
        verticalVelocity: 0,
        rolling: false,
        laneVelocity: 0,
        gameOver: false,
      });
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'paused') {
      return;
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt);
      return;
    }

    if (this.state === 'dying') {
      this.updateDying(dt);
      return;
    }

    if (this.state === 'gameover') {
      this.updateGameOver(dt);
    }
  }

  updateMenuEntities(dt) {
    this.obstacles.forEach((entity) => {
      entity.z += this.speed * dt;
      if (entity.z > 5) entity.z -= 146;
      entity.group.position.z = entity.z;
    });
    this.powerups.forEach((entity) => {
      entity.z += this.speed * dt;
      if (entity.z > 5) entity.z -= 132;
      entity.group.position.z = entity.z;
      entity.group.position.y = Math.sin(this.time * 1.8 + entity.phase) * 0.12;
      entity.group.rotation.y += dt * 0.7;
    });
    this.coins.forEach((entity) => {
      entity.z += this.speed * dt;
      if (entity.z > 5) entity.z -= 104;
      entity.group.position.z = entity.z;
      entity.group.position.y = entity.baseY + Math.sin(this.time * 2.8 + entity.phase) * 0.08;
      entity.group.rotation.y += dt * 3.6;
    });
  }

  updatePlaying(dt) {
    this.elapsed += dt;
    const targetSpeed = Math.min(
      MAX_SPEED,
      BASE_SPEED + this.elapsed * 0.23 + Math.min(8, this.distance / 760)
    );
    this.speed = damp(this.speed, targetSpeed, 0.7, dt);
    const travelStep = this.speed * dt;
    this.distance += travelStep;
    this.travel += travelStep;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

    if (this.magnetTime > 0) this.magnetTime = Math.max(0, this.magnetTime - dt);
    if (this.shieldTime > 0) this.shieldTime = Math.max(0, this.shieldTime - dt);
    if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);
    this.runner.setPowerups(this.shieldTime > 0, this.magnetTime > 0);

    this.updatePlayer(dt);
    this.updateWorldEntities(dt);

    if (this.travel >= this.nextSpawnTravel) {
      this.spawnWave();
      const gap = rand(29, 37);
      this.nextSpawnTravel = this.travel + gap;
    }

    this.score = Math.floor(this.distance * 8) + this.bonusScore;

    if (!this.newBestAnnounced && this.save.best > 0 && this.score > this.save.best) {
      this.newBestAnnounced = true;
      this.ui.toast('NEW PERSONAL BEST', 'big magenta');
      this.sound.powerup('shield');
    }

    if (this.elapsed > 5.5 || this.travel > 92) this.ui.hideTutorial();

    this.updateEffects(dt);
    this.world.update(dt, this.speed);
    this.updateCamera(dt);
    this.hudTick += dt;
    if (this.hudTick > 0.05) {
      this.hudTick = 0;
      this.updateHud();
    }
  }

  updatePlayer(dt) {
    const previousX = this.playerX;
    this.playerX = damp(this.playerX, LANES[this.targetLane], 14.5, dt);
    const laneVelocity = (this.playerX - previousX) / Math.max(dt, 0.001);
    this.laneVelocity = laneVelocity;

    if (!this.grounded) {
      this.verticalVelocity -= GRAVITY * dt;
      this.jumpY += this.verticalVelocity * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
        this.sound.land();
        this.shake = Math.max(this.shake, 0.05);
        this.spawnBurst(this.playerX, 0.1, 0.4, 0x8ce8ff, 7, 1.6);
      }
    }

    this.rollTimer = Math.max(0, this.rollTimer - dt);
    const rolling = this.rollTimer > 0 && this.grounded;

    this.runner.group.position.set(this.playerX, this.jumpY, 0);
    this.runner.update(dt, {
      speed: this.speed,
      grounded: this.grounded,
      verticalVelocity: this.verticalVelocity,
      rolling,
      laneVelocity,
      gameOver: false,
    });
  }

  updateWorldEntities(dt) {
    const canCollide = this.state === 'playing';

    for (let i = this.obstacles.length - 1; i >= 0; i -= 1) {
      const entity = this.obstacles[i];
      entity.prevZ = entity.z;
      entity.z += this.speed * dt;
      entity.group.position.z = entity.z;

      if (canCollide) this.checkObstacleCollision(entity);

      if (
        canCollide &&
        !entity.nearMissed &&
        entity.type === 'train' &&
        entity.z - entity.depth / 2 > 1.2
      ) {
        entity.nearMissed = true;
        const laneDistance = Math.abs(entity.x - this.playerX);
        if (laneDistance > 2.1 && laneDistance < 3.8 && this.invincible <= 0) {
          const bonus = 120 * this.multiplier;
          this.bonusScore += bonus;
          this.sound.nearMiss();
          if (this.time - this.lastNearMissAt > 0.7) {
            this.lastNearMissAt = this.time;
            this.ui.toast(`NEAR MISS  +${bonus}`, 'cyan');
          }
          this.shake = Math.max(this.shake, 0.06);
        }
      }

      // Pull objects off-screen before they drift between the runner and the
      // chase camera, where they would fill the whole frame.
      if (entity.z - entity.depth / 2 > 2.6) {
        this.scene.remove(entity.group);
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const entity = this.powerups[i];
      entity.prevZ = entity.z;
      entity.z += this.speed * dt;
      entity.group.position.z = entity.z;
      entity.group.position.y = Math.sin(this.time * 2.1 + entity.phase) * 0.13;
      entity.group.rotation.y += dt * 0.72;

      if (canCollide) {
        const dz = Math.abs(entity.z);
        const dx = Math.abs(entity.x - this.playerX);
        if (dz < 1.65 && dx < 1.2) {
          this.collectPowerup(entity);
          this.scene.remove(entity.group);
          this.powerups.splice(i, 1);
          continue;
        }
      }

      if (entity.z > 2.6) {
        this.scene.remove(entity.group);
        this.powerups.splice(i, 1);
      }
    }

    const magnetOn = this.magnetTime > 0;
    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const entity = this.coins[i];
      entity.prevZ = entity.group.position.z;

      if (magnetOn && entity.group.position.z > -14 && entity.group.position.z < 9) {
        const dx = this.playerX - entity.group.position.x;
        const dz = 0.4 - entity.group.position.z;
        const targetY = this.jumpY + 1.0;
        if (Math.abs(dx) < 10) {
          entity.group.position.x = damp(entity.group.position.x, this.playerX, 8, dt);
          entity.group.position.z = damp(entity.group.position.z, 0.4, 6, dt);
          entity.group.position.y = damp(entity.group.position.y, targetY, 7, dt);
        } else {
          entity.group.position.z += this.speed * dt;
        }
        if (Math.abs(dz) < 0.2) entity.group.position.z += this.speed * dt * 0.2;
      } else {
        entity.group.position.x = damp(entity.group.position.x, entity.x, 8, dt);
        entity.group.position.z += this.speed * dt;
        entity.group.position.y =
          entity.baseY + Math.sin(this.time * 3.2 + entity.phase) * 0.075;
      }

      entity.group.rotation.y += dt * 4.2;

      if (canCollide) {
        const z = entity.group.position.z;
        const crossed = Math.abs(z) < 1.65;
        const dx = Math.abs(entity.group.position.x - this.playerX);
        const dy = Math.abs(entity.group.position.y - (this.jumpY + 0.96));
        if (crossed && dx < 1.05 && dy < 1.25) {
          for (let spark = 0; spark < 7; spark += 1) {
            this.spawnBurst(
              entity.group.position.x,
              entity.group.position.y,
              entity.group.position.z,
              0xffd45e,
              1,
              1.4
            );
          }
          this.collectCoin(entity);
          this.releaseCoin(entity.group);
          this.coins.splice(i, 1);
          continue;
        }
      }

      if (entity.group.position.z > 2.7) {
        this.releaseCoin(entity.group);
        this.coins.splice(i, 1);
      }
    }
  }

  checkObstacleCollision(entity) {
    if (this.invincible > 0 || entity.collided || this.state !== 'playing') return;
    const dx = Math.abs(entity.x - this.playerX);
    if (dx > entity.width / 2 + 0.28) return;

    const sweepsPlayer =
      entity.z + entity.depth / 2 >= PLAYER_Z - 0.55 &&
      entity.prevZ - entity.depth / 2 <= PLAYER_Z + 0.55;
    if (!sweepsPlayer) return;

    let hit = false;
    if (entity.type === 'train') {
      hit = true;
    } else if (entity.type === 'barrier') {
      hit = this.jumpY < 0.88;
    } else if (entity.type === 'lowbar') {
      const playerTop = this.jumpY + (this.rollTimer > 0 ? 0.82 : 1.79);
      hit = playerTop > 1.22;
    }

    if (hit) this.handleHit(entity);
  }

  handleHit(entity) {
    if (this.invincible > 0 || this.state !== 'playing') return;

    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.invincible = 1.45;
      entity.collided = true;
      this.runner.setPowerups(false, this.magnetTime > 0);
      this.sound.shieldBreak();
      this.spawnRing(this.playerX, 0.9, 0, 0x9d8cff, 3.5);
      this.spawnBurst(this.playerX, 1.1, 0, 0x8cfeff, 26, 5.5);
      this.shake = Math.max(this.shake, 0.65);
      this.ui.hitFlash();
      this.ui.toast('SHIELD BROKEN // KEEP MOVING', 'big cyan');
      if (navigator.vibrate) navigator.vibrate(35);
      return;
    }

    this.endRun(entity);
  }

  collectCoin(entity) {
    this.coinsCollected += 1;
    this.combo += 1;
    this.comboTimer = 2.6;
    const nextMultiplier = 1 + Math.min(4, Math.floor(this.combo / 6));
    if (nextMultiplier > this.multiplier) {
      this.multiplier = nextMultiplier;
      this.ui.toast(`COMBO  x${this.multiplier}`, 'big');
      this.sound.powerup('magnet');
      this.shake = Math.max(this.shake, 0.08);
    } else {
      this.multiplier = nextMultiplier;
    }
    this.bonusScore += 45 * this.multiplier;
    this.sound.coin(this.combo);
    this.spawnRing(entity.group.position.x, entity.group.position.y, entity.group.position.z, 0xffcf58, 1.1);
    this.hudTick = 1;
    this.ui.hideTutorial();
  }

  collectPowerup(entity) {
    if (entity.type === 'magnet') {
      this.magnetTime = POWERUP_DURATION.magnet;
      this.sound.powerup('magnet');
      this.ui.toast('MAGNET ONLINE // COIN STORM', 'big cyan');
      this.spawnBurst(entity.group.position.x, 1.1, entity.group.position.z, 0x20d9ee, 24, 5);
    } else {
      this.shieldTime = POWERUP_DURATION.shield;
      this.sound.powerup('shield');
      this.ui.toast('SHIELD UP // ONE FREE HIT', 'big magenta');
      this.spawnBurst(entity.group.position.x, 1.1, entity.group.position.z, 0xa28aff, 24, 5);
    }
    this.runner.setPowerups(this.shieldTime > 0, this.magnetTime > 0);
    this.bonusScore += 150;
    this.shake = Math.max(this.shake, 0.12);
    this.spawnRing(entity.group.position.x, 1.0, entity.group.position.z, 0xffffff, 2.6);
  }

  spawnBurst(x, y, z, color, count = 14, force = 3.5) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      velocities[i * 3] = rand(-force, force);
      velocities[i * 3 + 1] = rand(0.2, force * 1.25);
      velocities[i * 3 + 2] = rand(-force, force);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.1,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.position.set(x, y, z);
    points.frustumCulled = false;
    this.scene.add(points);
    this.effects.push({
      object: points,
      velocities,
      life: 0.65,
      maxLife: 0.65,
      gravity: 8,
      kind: 'burst',
    });
  }

  spawnRing(x, y, z, color, maxScale = 2.5) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 4, 36), material);
    ring.position.set(x, y, z);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(0.7);
    this.scene.add(ring);
    this.effects.push({
      object: ring,
      life: 0.42,
      maxLife: 0.42,
      maxScale,
      kind: 'ring',
    });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.life -= dt;
      const t = 1 - effect.life / effect.maxLife;
      if (effect.kind === 'burst') {
        const positions = effect.object.geometry.attributes.position.array;
        for (let p = 0; p < positions.length; p += 3) {
          effect.velocities[p + 1] -= effect.gravity * dt;
          positions[p] += effect.velocities[p] * dt;
          positions[p + 1] += effect.velocities[p + 1] * dt;
          positions[p + 2] += effect.velocities[p + 2] * dt;
        }
        effect.object.geometry.attributes.position.needsUpdate = true;
        effect.object.material.opacity = Math.max(0, 1 - t);
      } else {
        effect.object.scale.setScalar(lerp(0.7, effect.maxScale, t));
        effect.object.material.opacity = Math.max(0, (1 - t) * 0.85);
      }

      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose();
        effect.object.material?.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  endRun() {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    document.body.dataset.state = 'dying';
    this.deathTimer = 0;
    this.shake = 1.2;
    this.sound.crash();
    this.sound.stopMusic(0.8);
    window.setTimeout(() => this.sound.gameOver(), 260);
    this.spawnBurst(this.playerX, 1.2, 0, 0xff5a52, 36, 7);
    this.spawnRing(this.playerX, 0.5, 0, 0xff3d86, 4.2);
    this.ui.hitFlash();
    this.ui.flash();
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
    this.isNewBest = this.score > this.save.best;
    this.ui.setTouchVisible(false);
  }

  updateDying(dt) {
    this.deathTimer += dt;
    this.speed = damp(this.speed, 2.5, 1.5, dt);
    this.deathTimerValue = this.deathTimer;
    this.runner.group.position.set(this.playerX, this.jumpY, 0);
    this.runner.update(dt, {
      speed: 0,
      grounded: true,
      verticalVelocity: 0,
      rolling: false,
      laneVelocity: 0,
      gameOver: true,
    });
    this.updateWorldEntities(dt);
    this.world.update(dt, this.speed);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateHud();

    if (this.deathTimer > 1.05) this.showGameOver();
  }

  showGameOver() {
    if (this.state !== 'dying') return;
    this.state = 'gameover';
    document.body.dataset.state = 'gameover';
    this.save.runs += 1;
    this.save.coins += this.coinsCollected;
    if (this.score > this.save.best) {
      this.save.best = this.score;
      this.isNewBest = true;
    }
    this.saveProgress();
    this.ui.setMenuStats(this.save);
    this.ui.showGameOver({
      score: this.score,
      distance: this.distance,
      coins: this.coinsCollected,
      best: this.save.best,
      newBest: this.isNewBest,
      tip: pick(TIPS),
    });
    this.ui.setTouchVisible(false);
    this.hudTick = 0;
  }

  updateGameOver(dt) {
    this.deathTimer += dt;
    this.speed = damp(this.speed, 1.5, 0.7, dt);
    this.updateWorldEntities(dt);
    this.world.update(dt, this.speed);
    this.updateEffects(dt);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    if (!this._desiredPos) {
      this._desiredPos = new THREE.Vector3();
      this._desiredLook = new THREE.Vector3();
    }

    const desiredPos = this._desiredPos;
    const desiredLook = this._desiredLook;
    let lambda = 5;

    if (this.state === 'menu') {
      const t = this.menuTime;
      desiredPos.set(
        6.75 + Math.sin(t * 0.11) * 0.55 + this.pointer.x * 0.4,
        5.15 + Math.sin(t * 0.18) * 0.16 - this.pointer.y * 0.15,
        14.8
      );
      desiredLook.set(
        -2.75 + Math.sin(t * 0.075) * 0.45 + this.pointer.x * 0.9,
        1.35 + Math.sin(t * 0.13) * 0.1,
        -26
      );
      lambda = 2.1;
    } else if (this.state === 'dying' || this.state === 'gameover') {
      const orbit = this.deathTimer * 0.2;
      const radius = 7.1;
      desiredPos.set(
        this.playerX + 2.4 + Math.cos(orbit) * radius,
        5.1 + Math.sin(orbit * 0.8) * 0.3,
        10.8 + Math.sin(orbit) * 1.2
      );
      desiredLook.set(this.playerX, 1.2, 0);
      lambda = 1.7;
    } else {
      const speedFactor = clamp((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
      const bob = Math.sin(this.time * 11.5) * 0.012 * (1 - speedFactor);
      // On narrow/portrait screens the horizontal field of view is tight. Let
      // the camera track the active lane more closely so the outside lanes do
      // not push the runner off the edge of the frame.
      const narrow = clamp((1.1 - this.camera.aspect) / 0.65, 0, 1);
      const follow = 0.36 + narrow * 0.37;
      const lookFollow = 0.13 + narrow * 0.62;
      desiredPos.set(
        this.playerX * follow,
        3.92 + this.jumpY * 0.16 + bob + speedFactor * 0.24,
        8.25 + speedFactor * 0.6
      );
      desiredLook.set(
        this.playerX * lookFollow,
        1.22 + this.jumpY * 0.34,
        -9.8
      );
      lambda = 7.4;
    }

    const alpha = 1 - Math.exp(-lambda * dt);
    this.cameraPosition.lerp(desiredPos, alpha);
    this.cameraLook.lerp(desiredLook, alpha);

    this.shake = damp(this.shake, 0, 6.2, dt);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.26;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.2;
    const shakeZ = (Math.random() - 0.5) * this.shake * 0.12;
    this.camera.position.set(
      this.cameraPosition.x + shakeX,
      this.cameraPosition.y + shakeY,
      this.cameraPosition.z + shakeZ
    );
    this.camera.lookAt(this.cameraLook);

    let targetRoll = 0;
    if (this.state === 'playing' || this.state === 'countdown') {
      targetRoll = clamp(-(this.laneVelocity || 0) * 0.0021, -0.035, 0.035);
    }
    this.cameraRoll = damp(this.cameraRoll || 0, targetRoll, 7, dt);
    this.camera.rotateZ(this.cameraRoll);

    const speedFactor = clamp((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
    const targetFov =
      this.state === 'menu' ? 58 : this.state === 'gameover' ? 51 : 60 + speedFactor * 7;
    this.cameraFov = damp(this.cameraFov || 61, targetFov, 3, dt);
    if (Math.abs(this.camera.fov - this.cameraFov) > 0.01) {
      this.camera.fov = this.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateHud(force = false) {
    if (!force && this.state !== 'playing' && this.state !== 'dying' && this.state !== 'paused') {
      return;
    }
    const speedFraction = clamp(
      (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED),
      0,
      1
    );
    this.ui.updateHud({
      score: this.score,
      distance: this.distance,
      coins: this.coinsCollected,
      multiplier: this.multiplier,
      best: this.save.best,
      speed: this.speed,
      speedFraction,
      combo: this.combo,
      comboTime: this.comboTimer,
      magnetTime: this.magnetTime,
      shieldTime: this.shieldTime,
    });
  }
}
