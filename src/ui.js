import { formatCompact, formatScore } from './utils.js';

const $ = (selector) => document.querySelector(selector);

export class UI {
  constructor() {
    this.body = document.body;
    this.el = {
      loading: $('#loading'),
      menu: $('#menu'),
      hud: $('#hud'),
      countdown: $('#countdown'),
      countdownNum: $('#countdown-num'),
      pause: $('#pause'),
      gameover: $('#gameover'),
      howto: $('#howto'),
      touch: $('#touch-controls'),
      flash: $('#flash'),
      hitVignette: $('#hit-vignette'),
      toastLayer: $('#toast-layer'),
      score: $('#score'),
      distance: $('#distance'),
      coins: $('#coins'),
      multiplier: $('#multiplier'),
      bestLive: $('#best-live'),
      bestMenu: $('#menu-best'),
      bestMenu2: $('#menu-best-2'),
      coinsMenu: $('#menu-coins'),
      runsMenu: $('#menu-runs'),
      speed: $('#speed-readout'),
      speedFill: $('#speed-fill'),
      comboBlock: $('#combo-block'),
      combo: $('#combo'),
      comboFill: $('#combo-fill'),
      tutorial: $('#tutorial-strip'),
      magnet: $('#powerup-magnet'),
      shield: $('#powerup-shield'),
      magnetFill: $('#powerup-magnet em'),
      shieldFill: $('#powerup-shield em'),
      finalScore: $('#final-score'),
      finalDistance: $('#final-distance'),
      finalCoins: $('#final-coins'),
      finalBest: $('#final-best'),
      newBest: $('#new-best'),
      gameoverTip: $('#gameover-tip'),
      btnPlay: $('#btn-play'),
      btnHow: $('#btn-how'),
      btnHowPlay: $('#btn-how-play'),
      btnCloseHow: $('#btn-close-how'),
      btnPause: $('#btn-pause'),
      btnResume: $('#btn-resume'),
      btnQuit: $('#btn-quit'),
      btnRetry: $('#btn-retry'),
      btnMenu: $('#btn-menu'),
      btnAudio: $('#btn-audio'),
      btnAudioMenu: $('#btn-audio-menu'),
    };
    this.tutorialHidden = false;
    this.toastCount = 0;
  }

  finishLoading() {
    this.el.loading.classList.add('is-done');
  }

  showMenu() {
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.remove('show');
    this.el.pause.classList.add('hidden');
    this.el.gameover.classList.add('hidden');
    this.el.howto.classList.add('hidden');
    this.body.dataset.state = 'menu';
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
  }

  showHud() {
    this.el.hud.classList.add('show');
  }

  hideHud() {
    this.el.hud.classList.remove('show');
  }

  setMenuStats(save) {
    this.el.bestMenu.textContent = formatScore(save.best);
    this.el.bestMenu2.textContent = formatCompact(save.best);
    this.el.coinsMenu.textContent = formatCompact(save.coins);
    this.el.runsMenu.textContent = formatCompact(save.runs);
  }

  setBestLive(best) {
    this.el.bestLive.textContent = `BEST ${formatScore(best)}`;
  }

  updateHud(state) {
    this.el.score.textContent = formatScore(state.score);
    this.el.distance.textContent = Math.floor(state.distance).toLocaleString('en-US');
    this.el.coins.textContent = state.coins.toLocaleString('en-US');
    this.el.multiplier.textContent = `x${state.multiplier}`;
    this.el.bestLive.textContent = `BEST ${formatScore(Math.max(state.best, state.score))}`;
    this.el.speed.innerHTML = `${Math.floor(state.speed * 3.6)}<small> km/h</small>`;
    this.el.speedFill.style.width = `${Math.round(state.speedFraction * 100)}%`;

    if (state.combo > 0) {
      this.el.comboBlock.classList.add('active');
      this.el.combo.textContent = state.combo;
      this.el.comboFill.style.transform = `scaleX(${Math.max(0, state.comboTime / 2.6)})`;
    } else {
      this.el.comboBlock.classList.remove('active');
    }

    this.updatePowerup(this.el.magnet, this.el.magnetFill, state.magnetTime, 10);
    this.updatePowerup(this.el.shield, this.el.shieldFill, state.shieldTime, 12);
  }

  updatePowerup(element, fill, time, total) {
    element.classList.toggle('active', time > 0);
    if (time > 0) fill.style.transform = `scaleX(${Math.min(1, time / total)})`;
  }

  hideTutorial() {
    if (this.tutorialHidden) return;
    this.tutorialHidden = true;
    this.el.tutorial.classList.add('hide');
  }

  resetTutorial() {
    this.tutorialHidden = false;
    this.el.tutorial.classList.remove('hide');
  }

  setCountdown(value, go = false) {
    this.el.countdown.classList.add('show');
    this.el.countdown.classList.toggle('go', go);
    this.el.countdownNum.textContent = value;
    this.el.countdownNum.classList.remove('pop');
    // Force a reflow so the pop animation can replay for each numeral.
    void this.el.countdownNum.offsetWidth;
    this.el.countdownNum.classList.add('pop');
  }

  hideCountdown() {
    this.el.countdown.classList.remove('show', 'go');
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  showGameOver(data) {
    this.el.finalScore.textContent = formatScore(data.score);
    this.el.finalDistance.innerHTML = `${Math.floor(data.distance).toLocaleString('en-US')}<small>m</small>`;
    this.el.finalCoins.textContent = data.coins.toLocaleString('en-US');
    this.el.finalBest.textContent = formatScore(data.best);
    this.el.newBest.classList.toggle('show', data.newBest);
    this.el.gameoverTip.textContent = data.tip;
    this.el.gameover.classList.remove('hidden');
    this.body.dataset.state = 'gameover';
  }

  hideGameOver() {
    this.el.gameover.classList.add('hidden');
  }

  showHowto() {
    this.el.howto.classList.remove('hidden');
  }

  hideHowto() {
    this.el.howto.classList.add('hidden');
  }

  setAudioMuted(muted) {
    this.el.btnAudio.classList.toggle('muted', muted);
    this.el.btnAudioMenu.classList.toggle('muted', muted);
    const label = muted ? 'Unmute sound' : 'Mute sound';
    this.el.btnAudio.setAttribute('aria-label', label);
    this.el.btnAudioMenu.setAttribute('aria-label', label);
  }

  flash() {
    this.el.flash.classList.remove('fire');
    void this.el.flash.offsetWidth;
    this.el.flash.classList.add('fire');
  }

  hitFlash() {
    this.el.hitVignette.classList.remove('fire');
    void this.el.hitVignette.offsetWidth;
    this.el.hitVignette.classList.add('fire');
  }

  toast(text, variant = '') {
    if (this.toastCount > 4) return;
    this.toastCount += 1;
    const node = document.createElement('div');
    node.className = `toast ${variant}`.trim();
    node.textContent = text;
    this.el.toastLayer.appendChild(node);
    window.setTimeout(() => {
      node.remove();
      this.toastCount -= 1;
    }, 1550);
  }

  setTouchVisible(visible) {
    const supported = window.matchMedia('(pointer: coarse), (max-width: 760px)').matches;
    this.el.touch.style.display = visible && supported ? 'flex' : 'none';
  }
}
