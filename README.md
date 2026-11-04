# Blade Wind — Moonlit Samurai Duel

A complete pixel-art, side-view samurai fighting game built with plain HTML, CSS, and JavaScript. No external assets, libraries, or build step are required.

Fight through **five waves** of ronin, ninja, and the Iron Monk before facing the final boss, the **Lord of Ash**. Reading attacks and timing your defense matters more than mashing: white glints can be parried, while red-marked attacks must be dodged or jumped.

## Features

- **Parry system** — a well-timed parry staggers the attacker and builds posture damage; break an enemy's guard for a free punish.
- **Dodge and jump** — dodge with invincibility frames and perfect-dodge rewards; jump over sweeping red attacks.
- **Enemies play by the same rules** — opponents attack, block, parry, dodge, jump, and punish openings.
- **Five-wave campaign** — escalating duels, a two-phase boss, wave banners, healing between waves, score, best score, and victory/defeat screens.
- **Responsive controls** — keyboard on desktop, on-screen touch buttons on phones and tablets, and gamepad support.
- **Pixel presentation** — procedurally drawn characters and scenery, sword trails, particles, screen shake, hit-stop, and procedural WebAudio music and sound effects.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `A` / `D` or `←` / `→` | ◀ / ▶ |
| Jump | `Space` or `W` | ↑ |
| Attack | `J` | STRIKE |
| Parry | `K` | PARRY |
| Dodge | `L` | DODGE |
| Pause | `P` or `Esc` | Pause button |
| Mute | `M` | ♪ button |

Gamepads are supported through the standard Gamepad API: left stick / D-pad to move, face buttons to jump, attack, parry, and dodge, and Start to pause.

## Run it

Open `index.html` directly, or serve the folder over HTTP:

```bash
python3 -m http.server 3002
```

Then visit `http://localhost:3002`.

## Project files

- `index.html` — page shell, overlays, and touch controls.
- `styles.css` — responsive layout and menu styling.
- `game.js` — game loop, fighter state machines, enemy AI, rendering, audio, input, and wave flow.

## Tips

- A **white glint** means the attack can be parried. A **red mark** means it cannot — dodge or jump instead.
- Parrying at the last moment is stronger and counts as a perfect parry.
- Watch enemy posture: when it fills, their guard breaks and they are open to a heavy combo.
- Preserve health between waves; a small heal is granted after each clear.

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
