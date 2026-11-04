import * as THREE from 'three';
import { glowSprite, makeCanvasTexture, seededRandom } from './utils.js';

export const LANES = [-3, 0, 3];

function addBox(parent, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

function barrierTexture() {
  return makeCanvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#15151f';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    const stripeWidth = 58;
    for (let x = -h; x < w + h; x += stripeWidth * 2) {
      ctx.fillStyle = '#f5a82b';
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + stripeWidth, h);
      ctx.lineTo(x + stripeWidth + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#171720';
      ctx.beginPath();
      ctx.moveTo(x + stripeWidth, h);
      ctx.lineTo(x + stripeWidth * 2, h);
      ctx.lineTo(x + stripeWidth * 2 + h, 0);
      ctx.lineTo(x + stripeWidth + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(6,7,13,0.75)';
    ctx.fillRect(0, 0, w, 23);
    ctx.fillRect(0, h - 23, w, 23);
    ctx.fillStyle = '#fff4dc';
    ctx.font = '400 51px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JUMP  /  LINE CLOSED', w / 2, 117);
  });
}

function lowbarTexture() {
  return makeCanvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#11121e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffb13a';
    ctx.fillRect(0, 0, w, 15);
    ctx.fillRect(0, h - 15, w, 15);
    for (let x = -80; x < w + 80; x += 60) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-0.42);
      ctx.fillStyle = 'rgba(255,177,58,0.42)';
      ctx.fillRect(0, -40, 17, h + 100);
      ctx.restore();
    }
    ctx.fillStyle = '#fff2db';
    ctx.textAlign = 'center';
    ctx.font = '400 77px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('LOW CLEARANCE', w / 2, 109);
    ctx.fillStyle = '#ffb13a';
    ctx.font = '800 20px Manrope, sans-serif';
    ctx.fillText('SLIDE  ↓  SLIDE  ↓  SLIDE', w / 2, 147);
  });
}

function windowStripTexture(accent, seed) {
  return makeCanvasTexture(768, 160, (ctx, w, h) => {
    const random = seededRandom(seed);
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, w, h);
    const count = 8;
    const gap = 10;
    const windowWidth = (w - gap * (count + 1)) / count;
    for (let i = 0; i < count; i += 1) {
      const x = gap + i * (windowWidth + gap);
      const lit = random() > 0.26;
      ctx.fillStyle = lit ? 'rgba(176,239,255,0.86)' : 'rgba(34,45,64,0.7)';
      ctx.fillRect(x, 20, windowWidth, h - 40);
      if (lit) {
        const glow = ctx.createLinearGradient(x, 0, x + windowWidth, 0);
        glow.addColorStop(0, 'rgba(120,230,255,0.28)');
        glow.addColorStop(0.5, 'rgba(180,250,255,0.52)');
        glow.addColorStop(1, 'rgba(120,230,255,0.28)');
        ctx.fillStyle = glow;
        ctx.fillRect(x + 4, 26, windowWidth - 8, h - 52);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + 5, 27, windowWidth - 10, 2);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 12, w, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, h - 17, w, 3);
  });
}

function trainRearTexture(color, route) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#0b0d16');
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // Rear window.
    ctx.fillStyle = 'rgba(108,214,238,0.68)';
    ctx.fillRect(74, 55, w - 148, 145);
    ctx.fillStyle = 'rgba(7,10,18,0.62)';
    ctx.fillRect(88, 68, w - 176, 119);
    ctx.fillStyle = 'rgba(203,251,255,0.45)';
    ctx.fillRect(102, 78, 80, 18);

    // Route plate.
    ctx.fillStyle = '#05060b';
    ctx.fillRect(80, 228, 190, 76);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 228, 190, 76);
    ctx.fillStyle = color;
    ctx.font = '400 62px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(route, 101, 286);
    ctx.fillStyle = '#f7f2e5';
    ctx.font = '800 19px Manrope, sans-serif';
    ctx.fillText('NIGHT EXPRESS', 226, 265);

    // Door seam.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w - 58, 48);
    ctx.lineTo(w - 58, h - 80);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '700 16px Manrope, sans-serif';
    ctx.fillText('MIND THE GAP', 80, h - 67);

    // Little orange callout sticker.
    ctx.fillStyle = '#ff9d2e';
    ctx.fillRect(w - 178, h - 122, 105, 34);
    ctx.fillStyle = '#180b05';
    ctx.font = '800 16px Manrope, sans-serif';
    ctx.fillText('LINE 88', w - 157, h - 99);
  });
}

function powerupTexture(type) {
  const cyan = type === 'magnet';
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, cyan ? 'rgba(152,248,255,0.26)' : 'rgba(194,178,255,0.28)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = cyan ? '#20d9ee' : '#a28aff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = cyan ? '#d7fcff' : '#eee9ff';
    ctx.font = '400 160px "Bebas Neue", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cyan ? 'U' : 'S', w / 2, 174);
  });
}

export class AssetFactory {
  constructor() {
    this.trainTemplates = [
      this.makeTrain('#e2643c', '#ffb35f', '88'),
      this.makeTrain('#1c9aad', '#7ff0ff', 'N'),
      this.makeTrain('#6e50c9', '#c6b4ff', 'M'),
    ];
    this.barrierTemplate = this.makeBarrier();
    this.lowbarTemplate = this.makeLowbar();
    this.powerupTemplates = {
      magnet: this.makePowerup('magnet'),
      shield: this.makePowerup('shield'),
    };

    this.coinGeometry = new THREE.CylinderGeometry(0.26, 0.26, 0.075, 24);
    this.coinRimGeometry = new THREE.TorusGeometry(0.26, 0.045, 6, 24);
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcb4d,
      metalness: 0.85,
      roughness: 0.24,
      emissive: 0x8d4b00,
      emissiveIntensity: 0.7,
    });
    this.coinEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe28b,
      metalness: 0.8,
      roughness: 0.18,
      emissive: 0x8e5200,
      emissiveIntensity: 0.8,
    });
  }

  makeTrain(color, accent, route) {
    const root = new THREE.Group();
    root.name = 'train';
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.42,
      emissive: new THREE.Color(color).multiplyScalar(0.055),
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x171925,
      roughness: 0.48,
      metalness: 0.68,
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0x8f95a8,
      roughness: 0.3,
      metalness: 0.8,
    });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.55 });
    const accentMat = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
    const body = addBox(root, [2.38, 2.55, 8.15], [0, 1.65, 0], bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = addBox(root, [2.25, 0.17, 7.92], [0, 2.98, 0], darkMetal);
    roof.castShadow = true;
    addBox(root, [2.42, 0.44, 8.1], [0, 0.34, 0], darkMetal);
    addBox(root, [2.2, 0.055, 8], [0, 3.09, 0], metal);

    // Cream livery band.
    addBox(root, [2.395, 0.16, 8.16], [0, 1.16, 0], cream);
    addBox(root, [2.399, 0.055, 8.16], [0, 1.03, 0], accentMat);

    // Side windows.
    [-1, 1].forEach((side) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(7.35, 0.78),
        new THREE.MeshBasicMaterial({
          map: windowStripTexture(accent, side > 0 ? 21 : 42),
          toneMapped: false,
        })
      );
      plane.position.set(side * 1.195, 2.12, 0);
      plane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(plane);

      // Door panels.
      [-2.35, 2.35].forEach((z) => {
        addBox(root, [0.035, 1.35, 1.15], [side * 1.205, 1.36, z], darkMetal);
      });
    });

    // Rear face (the player sees this).
    const rear = new THREE.Mesh(
      new THREE.PlaneGeometry(2.16, 2.32),
      new THREE.MeshBasicMaterial({ map: trainRearTexture(color, route), toneMapped: false })
    );
    rear.position.set(0, 1.64, 4.083);
    root.add(rear);

    // Tail lights and bumper.
    addBox(root, [2.2, 0.18, 0.1], [0, 0.52, 4.08], metal);
    [-0.8, 0.8].forEach((x) => {
      const tail = addBox(root, [0.17, 0.1, 0.04], [x, 0.82, 4.12], accentMat);
      tail.castShadow = false;
      const glow = glowSprite(0xff354f, 1.15, 0.75);
      glow.position.set(x, 0.82, 4.17);
      root.add(glow);
    });

    // Wheels and undercarriage blocks.
    [-2.72, 2.72].forEach((z) => {
      [-1.02, 1.02].forEach((x) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.18, 14), darkMetal);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.34, z);
        root.add(wheel);
      });
      addBox(root, [2.1, 0.34, 0.55], [0, 0.28, z], darkMetal);
    });

    // Roof units.
    [-2.4, 0, 2.35].forEach((z) => {
      addBox(root, [1.3, 0.15, 0.74], [0, 3.16, z], metal);
    });

    // Side route marker near the rear.
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.42),
      new THREE.MeshBasicMaterial({ color: accent, toneMapped: false })
    );
    marker.position.set(1.21, 2.82, 3.25);
    marker.rotation.y = Math.PI / 2;
    root.add(marker);

    root.userData = { width: 2.4, depth: 8.3, type: 'train' };
    return root;
  }

  makeBarrier() {
    const root = new THREE.Group();
    root.name = 'barrier';
    const dark = new THREE.MeshStandardMaterial({ color: 0x262732, roughness: 0.55, metalness: 0.55 });
    const panelMat = new THREE.MeshBasicMaterial({ map: barrierTexture(), toneMapped: false });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffaa32, toneMapped: false });

    [-1.03, 1.03].forEach((x) => {
      addBox(root, [0.12, 0.95, 0.12], [x, 0.48, 0], dark);
      addBox(root, [0.42, 0.08, 0.42], [x, 0.04, 0], dark);
    });
    addBox(root, [2.26, 0.06, 0.1], [0, 0.93, 0], dark);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 0.6), panelMat);
    panel.position.set(0, 0.63, 0.065);
    root.add(panel);
    const backPanel = panel.clone();
    backPanel.rotation.y = Math.PI;
    backPanel.position.z = -0.065;
    root.add(backPanel);

    [-0.92, 0.92].forEach((x) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), lampMat);
      lamp.position.set(x, 0.97, 0);
      root.add(lamp);
      const glow = glowSprite(0xff9d2e, 0.8, 0.8);
      glow.position.set(x, 0.97, 0.08);
      root.add(glow);
    });

    root.userData = { width: 2.2, depth: 0.7, type: 'barrier' };
    return root;
  }

  makeLowbar() {
    const root = new THREE.Group();
    root.name = 'lowbar';
    const dark = new THREE.MeshStandardMaterial({ color: 0x222430, roughness: 0.5, metalness: 0.65 });
    const panelMat = new THREE.MeshBasicMaterial({ map: lowbarTexture(), toneMapped: false });

    [-1.24, 1.24].forEach((x) => {
      addBox(root, [0.11, 1.67, 0.11], [x, 0.835, 0], dark);
      addBox(root, [0.44, 0.08, 0.44], [x, 0.04, 0], dark);
    });
    addBox(root, [2.58, 0.12, 0.24], [0, 1.64, 0], dark);
    addBox(root, [2.4, 0.08, 0.18], [0, 1.89, 0], dark);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.58), panelMat);
    panel.position.set(0, 1.55, 0.14);
    root.add(panel);

    // Small blinking hazard beacons.
    [-1.14, 1.14].forEach((x) => {
      const glow = glowSprite(0xff7b2c, 0.85, 0.75);
      glow.position.set(x, 1.94, 0.1);
      root.add(glow);
    });

    root.userData = { width: 2.4, depth: 0.55, type: 'lowbar' };
    return root;
  }

  makePowerup(type) {
    const root = new THREE.Group();
    root.name = 'powerup';
    root.userData = { type, width: 1, depth: 1 };
    const cyan = type === 'magnet';
    const color = cyan ? 0x20d9ee : 0xa28aff;
    const coreMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.6,
      metalness: 0.2,
      roughness: 0.2,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), coreMat);
    core.position.y = 1.04;
    core.rotation.set(0.4, 0.2, 0);
    root.add(core);

    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44 + i * 0.07, 0.012, 4, 40), ringMat);
      ring.position.y = 1.04;
      ring.rotation.x = Math.PI / 2 + i * 0.55;
      ring.rotation.y = i * 0.7;
      root.add(ring);
    }

    const glow = glowSprite(color, 3.4, 0.55);
    glow.position.y = 1.04;
    root.add(glow);

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: powerupTexture(type),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
    );
    label.scale.set(0.95, 0.95, 1);
    label.position.y = 1.04;
    root.add(label);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.2, 2.1, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    beam.position.y = 0.35;
    root.add(beam);
    return root;
  }

  createObstacle(type) {
    const template =
      type === 'train'
        ? this.trainTemplates[Math.floor(Math.random() * this.trainTemplates.length)]
        : type === 'barrier'
          ? this.barrierTemplate
          : this.lowbarTemplate;
    const group = template.clone(true);
    group.userData = { ...template.userData };
    return group;
  }

  createPowerup(type) {
    const group = this.powerupTemplates[type].clone(true);
    group.userData = { type, width: 1, depth: 1 };
    return group;
  }

  createCoin() {
    const group = new THREE.Group();
    group.name = 'coin';
    const face = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
    face.rotation.x = Math.PI / 2;
    face.castShadow = false;
    group.add(face);
    const rim = new THREE.Mesh(this.coinRimGeometry, this.coinEdgeMaterial);
    rim.castShadow = false;
    group.add(rim);
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff2ae, toneMapped: false })
    );
    center.position.z = 0.045;
    group.add(center);
    const centerBack = center.clone();
    centerBack.position.z = -0.045;
    centerBack.rotation.y = Math.PI;
    group.add(centerBack);
    const glow = glowSprite(0xffc23c, 1.15, 0.38);
    group.add(glow);
    return group;
  }
}
