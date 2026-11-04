# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/garty0735-crypto/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/garty0735-crypto/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/garty0735-crypto/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/garty0735-crypto/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/garty0735-crypto/PlayGround).
- 🛠️ [Check build runs](https://github.com/garty0735-crypto/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/garty0735-crypto/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/garty0735-crypto).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

# RAIL RUSH — Night Line 88

A complete, self-contained 3D endless runner built with **Vite + Three.js**.
Sprint down a neon subway line, switch between three tracks, jump barriers,
slide under low-clearance signs, dodge trains, and chain coins for a score
multiplier. Magnet and shield pickups keep the run alive.

Everything in the scene is procedural: geometry, canvas-drawn signage and
textures, city blocks, particles, and the runner. Sound effects and the music
loop are synthesized with WebAudio, so there are no external audio files.

## Run it

```bash
npm install
npm run dev        # http://localhost:3002
```

Production build:

```bash
npm run build
npm run preview    # http://localhost:3002
```

Pure-logic helpers have a small regression suite:

```bash
npm test
```

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Change lane | `A` / `D` or arrow keys | Swipe left / right, or tap the on-screen arrows |
| Jump | `W`, `↑`, or `Space` | Swipe up, or tap the up arrow |
| Slide | `S` / `↓` | Swipe down, or tap the down arrow |
| Pause | `P` / `Esc` | Pause button |
| Restart | `R` / `Enter` on game over | Run It Back |
| Mute | `M` | Speaker button |

Tap the station behind the menu to begin on mobile, or press the main button.

## Notes and assumptions

- One life per run. A shield absorbs one crash and briefly grants invincibility.
- Best score, banked coins, and total runs are stored in `localStorage`
  (`railrush-save-v1`); mute preference is stored separately.
- The game uses a fixed chase-camera view and world movement rather than moving
  the player down an infinite track, which keeps collisions and spawning stable.
- Layouts target phones, tablets, and desktop, including safe-area insets. Sound
  starts only after a user gesture, as required by mobile browsers.
- Software-rendered browsers (SwiftShader) are supported but run at a low frame
  rate; a GPU-backed browser is recommended for smooth play.

