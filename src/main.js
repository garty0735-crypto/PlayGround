import { Game } from './game.js';

async function boot() {
  const canvas = document.querySelector('#game-canvas');
  try {
    // Textures used on in-game signage and the backpack are drawn with canvas
    // text, so wait for the display font before generating them.
    await document.fonts.ready;
  } catch {
    // Older browsers still get the system font fallback.
  }

  try {
    const game = new Game(canvas);
    game.camera.lookAt(game.cameraLook);
    window.addEventListener('contextmenu', (event) => {
      if (event.target === canvas) event.preventDefault();
    });
  } catch (error) {
    console.error(error);
    const loading = document.querySelector('#loading');
    if (loading) {
      loading.innerHTML = `
        <div class="loading-mark"><span>R</span><span>R</span></div>
        <div class="loading-text" style="max-width:320px;text-align:center;line-height:1.8">
          THIS LINE NEEDS WEBGL<br />
          <span style="opacity:.6">Enable hardware acceleration or try a modern browser.</span>
        </div>
      `;
      loading.classList.remove('is-done');
    }
  }
}

boot();
