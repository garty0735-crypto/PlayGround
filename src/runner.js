import * as THREE from 'three';
import { clamp, damp, glowSprite, makeCanvasTexture } from './utils.js';

const SKIN = 0xb97756;
const HOODIE = 0x18a9bd;
const HOODIE_DARK = 0x0d596c;
const PANTS = 0x232738;
const SHOE = 0xf4efe3;
const ACCENT = 0xff8f2d;
const PACK = 0xd9532f;
const BEANIE = 0xff7b2c;

function makeShadowTexture() {
  return makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(0,0,0,0.68)');
      gradient.addColorStop(0.55, 'rgba(0,0,0,0.34)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
    { srgb: false }
  );
}

function backpackTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#bf3f21';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#ffb044';
    ctx.fillRect(34, 34, w - 68, 8);
    ctx.fillStyle = '#f5eadc';
    ctx.font = '400 122px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('88', w / 2, 166);
    ctx.fillStyle = 'rgba(30,12,8,0.42)';
    ctx.font = '800 18px Manrope, sans-serif';
    ctx.letterSpacing = '7px';
    ctx.fillText('NIGHT RUNNER', w / 2, 203);
  });
}

export class Runner {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.avatar = new THREE.Group();
    this.group.add(this.avatar);
    this.group.scale.setScalar(1.08);
    scene.add(this.group);

    this.time = 0;
    this.runCycle = 0;
    this.rollAmount = 0;
    this.laneLean = 0;
    this.airAmount = 0;
    this.lastGrounded = true;
    this.shieldActive = false;
    this.magnetActive = false;
    this.disposed = false;

    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.84 }),
      hoodie: new THREE.MeshStandardMaterial({
        color: HOODIE,
        roughness: 0.68,
        metalness: 0.04,
        emissive: 0x042c35,
        emissiveIntensity: 0.65,
      }),
      hoodieDark: new THREE.MeshStandardMaterial({ color: HOODIE_DARK, roughness: 0.7 }),
      pants: new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.9 }),
      shoe: new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.5, metalness: 0.05 }),
      accent: new THREE.MeshStandardMaterial({
        color: ACCENT,
        emissive: 0x8a2d00,
        emissiveIntensity: 0.35,
        roughness: 0.55,
      }),
      pack: new THREE.MeshStandardMaterial({ color: PACK, roughness: 0.62 }),
      beanie: new THREE.MeshStandardMaterial({
        color: BEANIE,
        roughness: 0.74,
        emissive: 0x5a1a00,
        emissiveIntensity: 0.25,
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x10121c, roughness: 0.68 }),
      glowCyan: new THREE.MeshBasicMaterial({ color: 0x6ef2ff, toneMapped: false }),
      glowOrange: new THREE.MeshBasicMaterial({ color: 0xffa740, toneMapped: false }),
      metal: new THREE.MeshStandardMaterial({ color: 0xb5b9c9, roughness: 0.28, metalness: 0.8 }),
    };

    this.buildBody();
    this.buildShadow();
    this.buildEffects();
  }

  addBox(parent, size, position, material, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    return mesh;
  }

  buildBody() {
    const m = this.materials;
    const body = this.avatar;

    // Hips and torso.
    this.addBox(body, [0.48, 0.2, 0.34], [0, 0.89, 0], m.pants);
    this.addBox(body, [0.6, 0.52, 0.38], [0, 1.22, 0], m.hoodie);
    this.addBox(body, [0.62, 0.1, 0.4], [0, 0.99, 0], m.hoodieDark);
    this.addBox(body, [0.38, 0.12, 0.02], [0, 1.34, -0.2], m.hoodieDark);

    // Chest zip / reflective piping.
    this.addBox(body, [0.045, 0.43, 0.02], [0, 1.23, -0.2], m.metal);
    const chestLight = this.addBox(body, [0.23, 0.028, 0.015], [-0.12, 1.43, -0.2], m.glowCyan);
    chestLight.castShadow = false;
    const shoulderStripe = this.addBox(body, [0.09, 0.03, 0.4], [-0.27, 1.42, 0], m.accent);
    shoulderStripe.castShadow = false;

    // Hood behind the neck.
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      m.hoodieDark
    );
    hood.position.set(0, 1.43, 0.15);
    hood.rotation.x = Math.PI;
    hood.scale.set(1, 0.85, 0.72);
    hood.castShadow = true;
    body.add(hood);

    // Neck and head.
    this.addBox(body, [0.16, 0.12, 0.16], [0, 1.54, 0], m.skin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 14), m.skin);
    head.position.set(0, 1.7, 0);
    head.scale.set(0.92, 1.05, 0.92);
    head.castShadow = true;
    body.add(head);

    // A sliver of face that reads in three-quarter views.
    const brow = this.addBox(body, [0.2, 0.035, 0.025], [0, 1.73, -0.188], m.dark);
    brow.castShadow = false;

    // Beanie with a folded rim.
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.218, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      m.beanie
    );
    beanie.position.set(0, 1.78, 0);
    beanie.scale.set(1.01, 0.95, 1.02);
    beanie.castShadow = true;
    body.add(beanie);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.065, 18), m.beanie);
    brim.position.set(0, 1.79, 0);
    brim.castShadow = true;
    body.add(brim);
    const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), m.accent);
    bobble.position.set(0, 1.965, 0);
    bobble.castShadow = true;
    body.add(bobble);

    // Headphones.
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 12), m.dark);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(side * 0.205, 1.7, 0);
      ear.castShadow = true;
      body.add(ear);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.036, 0.036), m.glowCyan);
      led.position.set(side * 0.238, 1.7, -0.01);
      led.castShadow = false;
      body.add(led);
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 20, Math.PI), m.dark);
    band.position.set(0, 1.71, 0.02);
    band.rotation.z = 0;
    band.rotation.y = 0;
    body.add(band);

    // Backpack.
    const pack = this.addBox(body, [0.48, 0.56, 0.2], [0, 1.23, 0.285], m.pack, [0.07, 0, 0]);
    pack.castShadow = true;
    const packFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: backpackTexture(), toneMapped: false })
    );
    packFace.position.set(0, 1.24, 0.392);
    body.add(packFace);
    this.addBox(body, [0.08, 0.54, 0.04], [-0.19, 1.21, 0.2], m.dark);
    this.addBox(body, [0.08, 0.54, 0.04], [0.19, 1.21, 0.2], m.dark);
    const packGlow = this.addBox(body, [0.3, 0.035, 0.02], [0, 1.47, 0.39], m.glowOrange);
    packGlow.castShadow = false;

    // Arms with pivots at the shoulders.
    this.arms = [];
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.38, 1.42, 0);
      body.add(pivot);

      this.addBox(pivot, [0.16, 0.34, 0.17], [0, -0.17, 0], m.hoodie);
      this.addBox(pivot, [0.135, 0.25, 0.14], [0, -0.42, 0], m.hoodieDark);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), m.skin);
      hand.position.set(0, -0.57, 0);
      hand.castShadow = true;
      pivot.add(hand);
      const cuff = this.addBox(pivot, [0.17, 0.035, 0.18], [0, -0.31, 0], m.glowCyan);
      cuff.castShadow = false;
      this.arms.push({ pivot, side });
    });

    // Legs with pivots at the hips.
    this.legs = [];
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.17, 0.84, 0);
      body.add(pivot);

      this.addBox(pivot, [0.2, 0.4, 0.2], [0, -0.2, 0], m.pants);
      this.addBox(pivot, [0.17, 0.37, 0.17], [0, -0.55, 0.01], m.pants);
      const stripe = this.addBox(pivot, [0.19, 0.035, 0.18], [0, -0.37, 0], m.glowOrange);
      stripe.castShadow = false;
      const shoe = this.addBox(pivot, [0.22, 0.13, 0.36], [0, -0.79, -0.08], m.shoe);
      shoe.rotation.x = -0.06;
      const sole = this.addBox(pivot, [0.23, 0.045, 0.37], [0, -0.86, -0.08], m.glowCyan);
      sole.castShadow = false;
      this.legs.push({ pivot, side });
    });

    // Small shoulder scout light.
    const scout = glowSprite(0x60efff, 0.8, 0.5);
    scout.position.set(-0.3, 1.4, 0.29);
    body.add(scout);
    this.scoutGlow = scout;
  }

  buildShadow() {
    const material = new THREE.MeshBasicMaterial({
      map: makeShadowTexture(),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      color: 0x000000,
    });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.35), material);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, 0.035, 0);
    this.scene.add(this.shadow);
  }

  buildEffects() {
    // Defensive shield.
    this.shield = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x7f8cff,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    shell.scale.y = 1.25;
    shell.position.y = 0.94;
    this.shield.add(shell);
    this.shieldRings = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9 + i * 0.065, 0.012, 5, 48),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? 0x20d9ee : 0x8a7bff,
          transparent: true,
          opacity: 0.58 - i * 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      ring.position.y = 0.94;
      ring.rotation.x = Math.PI / 2 + i * 0.5;
      ring.rotation.y = i * 0.7;
      this.shield.add(ring);
      this.shieldRings.push(ring);
    }
    this.shield.visible = false;
    this.group.add(this.shield);

    // Magnet aura on the ground.
    this.magnetAura = new THREE.Group();
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.72 + i * 0.2, 0.016, 4, 48),
        new THREE.MeshBasicMaterial({
          color: i === 0 ? 0x3ae4f4 : 0x9a7bff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      this.magnetAura.add(ring);
    }
    this.magnetAura.visible = false;
    this.group.add(this.magnetAura);
  }

  setPowerups(shield, magnet) {
    this.shieldActive = shield;
    this.magnetActive = magnet;
    this.shield.visible = shield;
    this.magnetAura.visible = magnet;
  }

  update(dt, options) {
    if (this.disposed) return;
    this.time += dt;
    const { speed = 16, grounded = true, verticalVelocity = 0, rolling = false, laneVelocity = 0, gameOver = false } = options;
    const runSpeed = clamp(speed / 20, 0.55, 2.2);
    this.runCycle += dt * (7.2 + runSpeed * 4.2);

    const rollTarget = rolling ? 1 : 0;
    this.rollAmount = damp(this.rollAmount, rollTarget, 18, dt);
    this.laneLean = damp(this.laneLean, clamp(-laneVelocity * 0.075, -0.26, 0.26), 9, dt);
    this.airAmount = damp(this.airAmount, grounded ? 0 : 1, 9, dt);

    const cycle = this.runCycle;
    const stride = Math.sin(cycle);
    const bounce = grounded ? Math.abs(Math.cos(cycle)) * 0.045 * runSpeed : 0;

    const bodyBob = bounce + Math.sin(this.time * 2.1) * 0.008;
    this.avatar.position.y = bodyBob - this.rollAmount * 0.22;
    this.avatar.position.z = this.rollAmount * 0.08;
    this.avatar.rotation.x = damp(this.avatar.rotation.x, this.rollAmount * -0.4 + this.airAmount * -0.1, 12, dt);
    this.avatar.rotation.z = this.laneLean;
    this.avatar.rotation.y = damp(this.avatar.rotation.y, this.laneLean * -0.4, 7, dt);
    this.avatar.scale.y = damp(this.avatar.scale.y, 1 - this.rollAmount * 0.34, 16, dt);

    // Leg animation: run, jump tuck, or slide.
    this.legs.forEach(({ pivot, side }, index) => {
      let target;
      if (this.rollAmount > 0.45) {
        target = side < 0 ? 0.9 : 1.2;
      } else if (!grounded) {
        target = side < 0 ? -0.72 : 0.45;
      } else {
        target = stride * 0.92 * (side < 0 ? 1 : -1);
      }
      pivot.rotation.x = damp(pivot.rotation.x, target, 18, dt);
      pivot.rotation.z = damp(
        pivot.rotation.z,
        this.rollAmount > 0.45 ? side * 0.13 : side * 0.02,
        12,
        dt
      );
    });

    // Arm animation.
    this.arms.forEach(({ pivot, side }) => {
      let target;
      if (this.rollAmount > 0.45) {
        target = 1.05;
      } else if (!grounded) {
        target = side < 0 ? -1.15 : -0.65;
      } else {
        target = stride * -0.82 * (side < 0 ? 1 : -1);
      }
      pivot.rotation.x = damp(pivot.rotation.x, target, 18, dt);
      pivot.rotation.z = damp(
        pivot.rotation.z,
        grounded ? side * 0.08 : side * 0.2,
        10,
        dt
      );
    });

    // Head counter-bob.
    if (this.scoutGlow) {
      this.scoutGlow.material.opacity = 0.25 + Math.sin(this.time * 5.5) * 0.08;
    }

    // Shadow stays on the floor.
    this.shadow.position.x = this.group.position.x;
    const height = this.group.position.y;
    const shadowScale = clamp(1 + height * 0.16, 0.7, 2.1);
    this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    this.shadow.material.opacity = clamp(0.44 - height * 0.11, 0.05, 0.46);

    // Powerup visuals.
    this.shieldRings.forEach((ring, index) => {
      ring.rotation.z += dt * (0.35 + index * 0.15);
      ring.rotation.y += dt * 0.24;
    });
    this.shield.children[0].material.opacity = 0.075 + Math.sin(this.time * 4) * 0.025;
    this.magnetAura.children.forEach((ring, index) => {
      ring.rotation.z += dt * (index === 0 ? 1.2 : -0.85);
      ring.scale.setScalar(1 + Math.sin(this.time * 3.4 + index) * 0.08);
    });

    if (gameOver) {
      this.avatar.rotation.x = damp(this.avatar.rotation.x, 1.1, 5, dt);
      this.avatar.rotation.z = damp(this.avatar.rotation.z, 0.4, 4, dt);
    }
  }

  reset() {
    this.runCycle = 0;
    this.rollAmount = 0;
    this.avatar.position.set(0, 0, 0);
    this.avatar.rotation.set(0, 0, 0);
    this.avatar.scale.set(1, 1, 1);
    this.group.position.set(0, 0, 0);
    this.shadow.position.set(0, 0.035, 0);
    this.shadow.scale.setScalar(1);
    this.shield.visible = false;
    this.magnetAura.visible = false;
  }
}
