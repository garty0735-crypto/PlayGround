import * as THREE from 'three';
import { glowSprite, makeCanvasTexture, seededRandom } from './utils.js';

const CITY_BACK = -238;
const WORLD_NEAR = 30;

function neon(color) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function makeBallastTexture() {
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const random = seededRandom(42);
      ctx.fillStyle = '#10111e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3600; i += 1) {
        const x = random() * w;
        const y = random() * h;
        const r = 1 + random() * 5;
        const shade = Math.floor(20 + random() * 38);
        ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 13})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.5, r, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#6d7395';
      for (let i = 0; i < 120; i += 1) {
        ctx.beginPath();
        const y = random() * h;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + random() * 4);
        ctx.stroke();
      }
    },
    { repeat: [5, 90] }
  );
}

function makePlatformTexture() {
  return makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const random = seededRandom(9);
      ctx.fillStyle = '#252536';
      ctx.fillRect(0, 0, w, h);
      const tile = 64;
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          const shade = 28 + random() * 16;
          ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 13})`;
          ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
          ctx.strokeStyle = 'rgba(100,105,135,0.13)';
          ctx.strokeRect(x + 2.5, y + 2.5, tile - 5, tile - 5);
        }
      }
      ctx.fillStyle = 'rgba(6,6,15,0.23)';
      for (let i = 0; i < 40; i += 1) {
        ctx.beginPath();
        ctx.arc(random() * w, random() * h, 4 + random() * 28, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { repeat: [2, 40] }
  );
}

function makeWallTexture() {
  return makeCanvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      const random = seededRandom(118);
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#171a2c');
      gradient.addColorStop(0.55, '#111322');
      gradient.addColorStop(1, '#191827');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Tile grid.
      for (let y = 0; y < h; y += 64) {
        for (let x = 0; x < w; x += 96) {
          const shade = 19 + random() * 13;
          ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 17},0.55)`;
          ctx.fillRect(x + 2, y + 2, 92, 60);
        }
      }
      ctx.strokeStyle = 'rgba(90,96,125,0.15)';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 96) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Concrete panels and scuffs.
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 60; i += 1) {
        ctx.fillStyle = random() > 0.5 ? '#06070e' : '#4a465c';
        ctx.fillRect(random() * w, random() * h, 15 + random() * 80, 2 + random() * 12);
      }
      ctx.globalAlpha = 1;

      // Hand-painted graffiti.
      const tags = [
        { x: 90, y: 285, text: 'NITE', color: '#22d9e9', angle: -0.06 },
        { x: 510, y: 330, text: '88', color: '#ff9d2e', angle: 0.045 },
        { x: 820, y: 245, text: 'RUSH', color: '#ff3d86', angle: -0.035 },
      ];
      tags.forEach((tag) => {
        ctx.save();
        ctx.translate(tag.x, tag.y);
        ctx.rotate(tag.angle);
        ctx.font = '900 92px "Bebas Neue", Impact, sans-serif';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(5,6,14,0.85)';
        ctx.lineWidth = 18;
        ctx.strokeText(tag.text, 0, 0);
        ctx.strokeStyle = tag.color;
        ctx.lineWidth = 7;
        ctx.strokeText(tag.text, 0, 0);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = tag.color;
        ctx.fillText(tag.text, 0, 0);
        ctx.restore();
      });

      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = '#ff3d86';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(720, 100, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(690, 100);
      ctx.lineTo(750, 100);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Grime along the bottom.
      const grime = ctx.createLinearGradient(0, h * 0.7, 0, h);
      grime.addColorStop(0, 'rgba(0,0,0,0)');
      grime.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = grime;
      ctx.fillRect(0, 0, w, h);
    },
    { repeat: [16, 1] }
  );
}

function makeWindowTexture(seed, palette) {
  return makeCanvasTexture(256, 512, (ctx, w, h) => {
    const random = seededRandom(seed);
    ctx.fillStyle = '#080a16';
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 16;
    const padX = 8;
    const padY = 7;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const lit = random() > 0.6;
        if (!lit) {
          ctx.fillStyle = 'rgba(22,26,45,0.8)';
        } else {
          const color = palette[Math.floor(random() * palette.length)];
          ctx.globalAlpha = 0.35 + random() * 0.65;
          ctx.fillStyle = color;
        }
        ctx.fillRect(x * cw + padX, y * ch + padY, cw - padX * 2, ch - padY * 2);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    for (let x = 0; x < w; x += cw) ctx.fillRect(x, 0, 1, h);
  });
}

function makeSignTexture(main, sub, a, b, variant = 0) {
  return makeCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#070912';
    ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, a);
    gradient.addColorStop(1, b);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = a;
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, w - 68, h - 68);

    if (variant === 1) {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, w, 20);
      ctx.fillRect(0, h - 20, w, 20);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f7f2e5';
    ctx.font = '400 204px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(main, 67, 255);
    ctx.fillStyle = a;
    ctx.font = '800 38px Manrope, sans-serif';
    ctx.letterSpacing = '11px';
    ctx.fillText(sub, 72, 332);

    ctx.fillStyle = 'rgba(255,255,255,0.63)';
    ctx.font = '700 23px Manrope, sans-serif';
    ctx.fillText('NIGHT LINE 88  /  AFTER HOURS ONLY', 72, 402);

    // Transit stripe.
    ctx.fillStyle = b;
    ctx.fillRect(68, 428, 240, 5);
    ctx.fillStyle = a;
    ctx.fillRect(316, 428, 96, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(420, 428, 62, 5);

    // Barcode corner.
    for (let i = 0; i < 18; i += 1) {
      ctx.fillStyle = i % 3 === 0 ? a : 'rgba(255,255,255,0.28)';
      ctx.fillRect(w - 160 + i * 6, h - 72, i % 2 === 0 ? 3 : 2, 30);
    }
  });
}

function makeTrainSignTexture(label, color) {
  return makeCanvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 12, h);
    ctx.fillStyle = '#f5f1e7';
    ctx.font = '400 102px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(label, 35, 117);
    ctx.fillStyle = color;
    ctx.font = '800 19px Manrope, sans-serif';
    ctx.fillText('NIGHT EXPRESS', 37, 153);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(26, 22, w - 52, h - 44);
  });
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.movingGantries = [];
    this.movingProps = [];
    this.movingBillboards = [];
    this.time = 0;
    this.speed = 0;
    this.cityLights = [];
    this.neonSprites = [];

    this.ballastTexture = makeBallastTexture();
    this.platformTexture = makePlatformTexture();
    this.wallTexture = makeWallTexture();

    this.createSky();
    this.createLights();
    this.createTrack();
    this.createWalls();
    this.createCity();
    this.createOverhead();
    this.createPlatformProps();
    this.createDust();
    this.createOverheadWires();
  }

  createSky() {
    const geometry = new THREE.SphereGeometry(380, 32, 20);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x03040d) },
        midColor: { value: new THREE.Color(0x14122d) },
        horizonColor: { value: new THREE.Color(0x5a2a55) },
        glowColor: { value: new THREE.Color(0xff6f2e) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 glowColor;
        varying vec3 vPosition;
        void main() {
          float h = normalize(vPosition).y;
          float upper = smoothstep(0.02, 0.6, h);
          float midMask = smoothstep(-0.12, 0.18, h);
          vec3 color = mix(horizonColor, midColor, midMask);
          color = mix(color, topColor, upper);
          float haze = exp(-pow((h - 0.02) * 8.0, 2.0));
          color += glowColor * haze * 0.2;
          float low = smoothstep(-0.04, -0.65, h);
          color = mix(color, vec3(0.018, 0.02, 0.045), low);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(geometry, material));

    // Stars.
    const random = seededRandom(92);
    const positions = [];
    for (let i = 0; i < 500; i += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(0.18 + random() * 0.8);
      const radius = 290;
      positions.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xaab7ff,
      size: 1.2,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
      sizeAttenuation: false,
    });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // A low neon moon.
    const moon = glowSprite(0xffe1b0, 74, 0.18);
    moon.position.set(-92, 66, -260);
    moon.material.fog = false;
    this.scene.add(moon);
    const moonCore = new THREE.Mesh(
      new THREE.CircleGeometry(12, 36),
      new THREE.MeshBasicMaterial({ color: 0xffe4b8, fog: false, toneMapped: false })
    );
    moonCore.position.set(-92, 66, -259);
    this.scene.add(moonCore);

    // Fine cloud bands near the horizon.
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0x8c4d84,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < 7; i += 1) {
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(100 + i * 18, 5 + i), cloudMat);
      cloud.position.set((i - 3) * 34, 18 + i * 3, -250);
      cloud.rotation.z = (i - 3) * 0.01;
      this.scene.add(cloud);
    }
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0x7884d0, 0x17101e, 1.4));

    const moon = new THREE.DirectionalLight(0xa8b9ff, 2.1);
    moon.position.set(-26, 40, 24);
    moon.target.position.set(0, 0, -8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 24;
    moon.shadow.camera.bottom = -14;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 100;
    moon.shadow.bias = -0.001;
    moon.shadow.normalBias = 0.035;
    this.scene.add(moon, moon.target);
    this.moonLight = moon;

    // Warm bounce from the city.
    const cityFill = new THREE.DirectionalLight(0xff7f48, 0.28);
    cityFill.position.set(20, 8, -35);
    this.scene.add(cityFill);

    // Pool of cyan light ahead of the runner.
    const key = new THREE.PointLight(0x36dff4, 16, 33, 1.7);
    key.position.set(-3.5, 4.4, -18);
    this.scene.add(key);
    this.keyLight = key;

    const magenta = new THREE.PointLight(0xff3f96, 11, 27, 1.8);
    magenta.position.set(3.8, 3.1, -38);
    this.scene.add(magenta);
    this.magentaLight = magenta;
  }

  createTrack() {
    const trackGroup = new THREE.Group();
    this.scene.add(trackGroup);

    // Ballast bed.
    const ballast = new THREE.Mesh(
      new THREE.PlaneGeometry(15.5, 315),
      new THREE.MeshStandardMaterial({
        map: this.ballastTexture,
        color: 0x8d90a4,
        roughness: 1,
        metalness: 0.04,
      })
    );
    ballast.rotation.x = -Math.PI / 2;
    ballast.position.set(0, -0.015, -120);
    ballast.receiveShadow = true;
    trackGroup.add(ballast);

    // Sleepers.
    const tieGeometry = new THREE.BoxGeometry(11.4, 0.16, 0.34);
    const tieMaterial = new THREE.MeshStandardMaterial({
      color: 0x343341,
      roughness: 0.92,
      metalness: 0.04,
    });
    const tieCount = 260;
    const ties = new THREE.InstancedMesh(tieGeometry, tieMaterial, tieCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tieCount; i += 1) {
      dummy.position.set(0, 0.065, 28 - i * 1.16);
      dummy.updateMatrix();
      ties.setMatrixAt(i, dummy.matrix);
    }
    ties.receiveShadow = true;
    ties.frustumCulled = false;
    trackGroup.add(ties);
    this.ties = ties;
    this.tieSpacing = 1.16;

    // Steel rails.
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d94a9,
      roughness: 0.24,
      metalness: 0.92,
    });
    const railTopMaterial = new THREE.MeshStandardMaterial({
      color: 0xc6d4ef,
      roughness: 0.15,
      metalness: 1,
      emissive: 0x2b354c,
      emissiveIntensity: 0.32,
    });
    [-3, 0, 3].forEach((lane) => {
      [-0.62, 0.62].forEach((offset) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 310), railMaterial);
        rail.position.set(lane + offset, 0.17, -120);
        rail.receiveShadow = true;
        trackGroup.add(rail);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 310), railTopMaterial);
        top.position.set(lane + offset, 0.242, -120);
        trackGroup.add(top);
      });
    });

    // Glowing track edge lines.
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0x1597ad,
      toneMapped: false,
      transparent: true,
      opacity: 0.5,
    });
    [-5.2, 5.2].forEach((x) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 310), edgeMat);
      strip.position.set(x, 0.105, -120);
      trackGroup.add(strip);
    });

    // Scrolling service lights at the track edge.
    const markerGeo = new THREE.BoxGeometry(0.1, 0.035, 1.4);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xff9d2e,
      toneMapped: false,
      transparent: true,
      opacity: 0.7,
    });
    const markers = new THREE.InstancedMesh(markerGeo, markerMat, 28);
    for (let i = 0; i < 28; i += 1) {
      dummy.position.set(i % 2 === 0 ? -4.85 : 4.85, 0.1, 22 - i * 9.2);
      dummy.updateMatrix();
      markers.setMatrixAt(i, dummy.matrix);
    }
    markers.frustumCulled = false;
    trackGroup.add(markers);
    this.markers = markers;
    this.markerSpacing = 9.2;

    // Platforms.
    [-1, 1].forEach((side) => {
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.62, 310),
        new THREE.MeshStandardMaterial({
          map: this.platformTexture,
          color: 0x9b9bae,
          roughness: 0.74,
          metalness: 0.18,
        })
      );
      platform.position.set(side * 7.95, 0.3, -120);
      platform.receiveShadow = true;
      trackGroup.add(platform);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(5.24, 0.07, 310),
        new THREE.MeshStandardMaterial({
          color: 0x3c3d4c,
          roughness: 0.5,
          metalness: 0.38,
        })
      );
      cap.position.set(side * 7.95, 0.625, -120);
      trackGroup.add(cap);

      // Platform safety line.
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.035, 310),
        new THREE.MeshStandardMaterial({ color: 0xe1ae39, roughness: 0.55 })
      );
      line.position.set(side * 5.42, 0.67, -120);
      trackGroup.add(line);

      const tactile = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.02, 310),
        new THREE.MeshStandardMaterial({ color: 0x8e7854, roughness: 0.8 })
      );
      tactile.position.set(side * 5.72, 0.675, -120);
      trackGroup.add(tactile);

      // Cable trough.
      const trough = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.18, 310),
        new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: 0.75 })
      );
      trough.position.set(side * 4.6, 0.08, -120);
      trackGroup.add(trough);
    });
  }

  createWalls() {
    [-1, 1].forEach((side) => {
      const wallMat = new THREE.MeshStandardMaterial({
        map: this.wallTexture,
        color: 0x8a8da5,
        roughness: 0.87,
        metalness: 0.05,
        emissive: 0x0e1222,
        emissiveIntensity: 0.4,
      });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.46, 4.4, 310), wallMat);
      wall.position.set(side * 10.55, 2.85, -120);
      wall.receiveShadow = true;
      this.scene.add(wall);

      // Wall coping and underside grime.
      const coping = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.18, 310),
        new THREE.MeshStandardMaterial({ color: 0x3d3d4c, roughness: 0.6, metalness: 0.3 })
      );
      coping.position.set(side * 10.55, 5.08, -120);
      this.scene.add(coping);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.75, 310),
        new THREE.MeshStandardMaterial({ color: 0x10101c, roughness: 0.95 })
      );
      lower.position.set(side * 10.54, 0.78, -120);
      this.scene.add(lower);

      // Neon wall strip.
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.035, 310),
        new THREE.MeshBasicMaterial({
          color: side < 0 ? 0x24d8ea : 0xff3d86,
          toneMapped: false,
          transparent: true,
          opacity: 0.75,
        })
      );
      strip.position.set(side * 10.28, 3.92, -120);
      this.scene.add(strip);

      // Wall pillars scroll by.
      for (let i = 0; i < 13; i += 1) {
        const pillar = new THREE.Group();
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 4.3, 0.32),
          new THREE.MeshStandardMaterial({ color: 0x25263a, roughness: 0.6, metalness: 0.5 })
        );
        beam.position.y = 2.75;
        const light = glowSprite(side < 0 ? 0x2be0f4 : 0xff4d95, 1.6, 0.6);
        light.position.set(side * -0.33, 3.88, 0.1);
        pillar.add(beam, light);
        pillar.position.set(side * 10.24, 0, 19 - i * 23.5);
        this.scene.add(pillar);
        this.movingProps.push({ object: pillar, wrapped: true, span: 13 * 23.5 });
      }
    });
  }

  createCity() {
    const city = new THREE.Group();
    this.scene.add(city);
    const random = seededRandom(523);
    const palettes = [
      ['#ffbe5c', '#ff8d3d', '#ffe8b0'],
      ['#51e2ff', '#2b8fff', '#d1fbff'],
      ['#ff62a5', '#ffb1cc', '#7f63ff'],
      ['#c7d4ff', '#7c89c4', '#ffde9a'],
    ];
    const windowMaterials = palettes.map((palette, i) => {
      const texture = makeWindowTexture(80 + i * 33, palette);
      return new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.54,
        color: 0x596078,
        roughness: 0.8,
        metalness: 0.2,
      });
    });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x151726, roughness: 0.92 });

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 26; i += 1) {
        const width = 5 + random() * 9;
        const depth = 5 + random() * 10;
        const height = 8 + random() * 32;
        const x = side * (15 + random() * 23);
        const z = 18 - i * 10.4 - random() * 5;
        const material = windowMaterials[Math.floor(random() * windowMaterials.length)];
        const mats = [material, material, roofMaterial, roofMaterial, material, material];
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats);
        building.position.set(x, height / 2 - 0.5, z);
        building.rotation.y = (random() - 0.5) * 0.15;
        city.add(building);

        if (random() > 0.45) {
          const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.07, 2 + random() * 5, 5),
            new THREE.MeshStandardMaterial({ color: 0x353748, roughness: 0.6, metalness: 0.8 })
          );
          antenna.position.set(x + (random() - 0.5) * width * 0.6, height + 1.2, z);
          city.add(antenna);
          const beacon = glowSprite(0xff3b5d, 1.1, 0.85);
          beacon.position.copy(antenna.position).y += antenna.geometry.parameters.height / 2;
          city.add(beacon);
        }

        if (random() > 0.83) {
          // A distant rooftop sign.
          const color = side < 0 ? 0x20d9ee : 0xff9d2e;
          const sign = glowSprite(color, 7 + random() * 5, 0.35);
          sign.position.set(x, height + 1.2, z + 0.3);
          city.add(sign);
        }
      }
    }

    // Layered skyline silhouettes.
    const skylineMat = new THREE.MeshBasicMaterial({ color: 0x090b1b });
    for (let i = 0; i < 34; i += 1) {
      const width = 5 + random() * 11;
      const height = 10 + random() * 50;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 2), skylineMat);
      building.position.set(-145 + i * 9 + random() * 4, height / 2 - 2, CITY_BACK - random() * 24);
      city.add(building);
    }

    // A few aircraft warning lights.
    for (let i = 0; i < 8; i += 1) {
      const light = glowSprite(0xff4d64, 1.4, 0.9);
      light.position.set(-110 + i * 32, 35 + random() * 20, CITY_BACK - 10);
      city.add(light);
      this.cityLights.push(light);
    }
  }

  createOverhead() {
    const gantrySpan = 27;
    for (let i = 0; i < 11; i += 1) {
      const group = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({
        color: 0x272936,
        roughness: 0.48,
        metalness: 0.72,
      });
      const trim = new THREE.MeshStandardMaterial({
        color: 0x3b3d4b,
        roughness: 0.44,
        metalness: 0.65,
      });

      [-5.15, 5.15].forEach((x) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 5.8, 0.28), steel);
        post.position.set(x, 2.9, 0);
        post.castShadow = true;
        group.add(post);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.52), trim);
        base.position.set(x, 0.09, 0);
        group.add(base);
      });

      const beam = new THREE.Mesh(new THREE.BoxGeometry(10.7, 0.24, 0.3), steel);
      beam.position.set(0, 5.72, 0);
      beam.castShadow = true;
      group.add(beam);

      const beamTop = new THREE.Mesh(new THREE.BoxGeometry(10.7, 0.07, 0.12), trim);
      beamTop.position.set(0, 5.9, 0);
      group.add(beamTop);

      // Cross braces.
      for (let b = -1; b <= 1; b += 1) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), trim);
        brace.position.set(b * 2.8, 5.58, 0);
        brace.rotation.x = 0.55;
        group.add(brace);
      }

      // Hanging lamps.
      for (let l = -1; l <= 1; l += 1) {
        const lampHousing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.24, 0.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x15151f, roughness: 0.45, metalness: 0.6 })
        );
        lampHousing.position.set(l * 3.1, 5.32, 0.1);
        group.add(lampHousing);
        const glow = glowSprite(l === 0 ? 0xfff0cf : 0x9ceeff, l === 0 ? 2.2 : 1.5, 0.9);
        glow.position.set(l * 3.1, 5.16, 0.16);
        group.add(glow);
        this.neonSprites.push(glow);
      }

      // Route plate.
      if (i % 3 === 0) {
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 0.44),
          new THREE.MeshBasicMaterial({
            map: makeTrainSignTexture('88', i % 2 === 0 ? '#ff9d2e' : '#20d9ee'),
            transparent: false,
            toneMapped: false,
          })
        );
        plate.position.set(0, 5.52, 0.18);
        group.add(plate);
      }

      group.position.z = 22 - i * gantrySpan;
      this.scene.add(group);
      this.movingGantries.push({ object: group, wrapped: true, span: 11 * gantrySpan });
    }
  }

  createOverheadWires() {
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0x7b819e,
      transparent: true,
      opacity: 0.5,
    });
    [-3, 0, 3].forEach((lane) => {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 310, 4), wireMaterial);
      wire.rotation.x = Math.PI / 2;
      wire.position.set(lane, 5.42, -120);
      this.scene.add(wire);
    });
  }

  makeBillboard(text, sub, colorA, colorB, width = 5.4) {
    const group = new THREE.Group();
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(width, width / 2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0a0b15, roughness: 0.6, metalness: 0.45 })
    );
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.22, width / 2 - 0.22),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(text, sub, colorA, colorB),
        toneMapped: false,
      })
    );
    face.position.z = 0.1;
    group.add(backing, face);
    const glow = glowSprite(colorA, width * 0.9, 0.17);
    glow.position.z = 0.2;
    group.add(glow);
    return group;
  }

  createPlatformProps() {
    const random = seededRandom(317);
    const steel = new THREE.MeshStandardMaterial({ color: 0x282a38, roughness: 0.48, metalness: 0.64 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11121e, roughness: 0.8 });

    for (let i = 0; i < 20; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const group = new THREE.Group();

      // Base mounting pad.
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 1.1), dark);
      pad.position.y = 0.04;
      group.add(pad);

      if (i % 3 === 0) {
        const billboard = this.makeBillboard(
          ['RUSH', 'NIGHT', '88', 'LINE'][i % 4],
          ['NO SLEEP', 'EXPRESS', 'LAST TRAIN', 'NIGHT MARKET'][i % 4],
          ['#20d9ee', '#ff9d2e', '#ff3d86', '#8d6bff'][i % 4],
          ['#ff3d86', '#20d9ee', '#ff9d2e', '#20d9ee'][i % 4],
          3.8
        );
        billboard.position.set(0, 3.65, 0);
        billboard.rotation.y = side < 0 ? Math.PI / 2 - 0.17 : -Math.PI / 2 + 0.17;
        group.add(billboard);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.2, 6), steel);
        pole.position.y = 1.75;
        group.add(pole);
      } else if (i % 3 === 1) {
        // Vending machine.
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.8, 0.55), steel);
        box.position.y = 0.92;
        group.add(box);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.54, 0.68),
          new THREE.MeshBasicMaterial({ color: 0xffbd5d, toneMapped: false })
        );
        screen.position.set(0, 1.2, 0.29);
        screen.rotation.y = side < 0 ? 0.1 : -0.1;
        group.add(screen);
        const glow = glowSprite(0xffb95f, 1.7, 0.24);
        glow.position.set(0, 1.2, 0.6);
        group.add(glow);
      } else {
        // Bench and uprights.
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.55), steel);
        seat.position.set(0.1, 0.66, 0);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.07), steel);
        back.position.set(0.1, 0.92, 0.26);
        back.rotation.x = -0.08;
        const legA = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.64, 0.5), dark);
        legA.position.set(-0.64, 0.33, 0);
        const legB = legA.clone();
        legB.position.x = 0.84;
        group.add(seat, back, legA, legB);
      }

      // Little maintenance cone.
      if (random() > 0.68) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.42, 10),
          new THREE.MeshStandardMaterial({ color: 0xff7135, roughness: 0.7 })
        );
        cone.position.set(-0.8, 0.22, 0.2);
        group.add(cone);
      }

      group.position.set(side * (7.3 + random() * 1.5), 0.65, 14 - i * 14.8 + random() * 4);
      group.rotation.y = side < 0 ? 0 : Math.PI;
      this.scene.add(group);
      this.movingProps.push({ object: group, wrapped: true, span: 20 * 14.8 });
    }

    // A couple of oversized station signs.
    [-1, 1].forEach((side, index) => {
      const board = this.makeBillboard('NIGHT LINE', 'PLATFORM 88', '#20d9ee', '#ff3d86', 5.8);
      board.position.set(side * 10.18, 4.2, 3 - index * 14);
      board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(board);
      this.movingBillboards.push({ object: board, wrapped: true, span: 2 * 28, speedScale: 1 });
    });
  }

  createDust() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(71);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.5) * 16;
      positions[i * 3 + 1] = 0.3 + random() * 6;
      positions[i * 3 + 2] = 20 - random() * 180;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xbfd7ff,
      size: 0.042,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.dustPositions = positions;
  }

  update(dt, speed) {
    this.time += dt;
    this.speed = speed;

    // Ballast texture drift.
    this.ballastTexture.offset.y -= (speed * dt) / 22;
    this.platformTexture.offset.y -= (speed * dt) / 16;
    this.wallTexture.offset.x -= (speed * dt) / 26;

    // Periodic track parts can be moved as one piece because they repeat.
    this.ties.position.z = (this.ties.position.z + speed * dt) % this.tieSpacing;
    this.markers.position.z = (this.markers.position.z + speed * dt) % this.markerSpacing;

    // Overhead gantries.
    this.movingGantries.forEach(({ object, span }) => {
      object.position.z += speed * dt;
      if (object.position.z > WORLD_NEAR) object.position.z -= span;
    });

    // Platform furniture and wall pillars.
    this.movingProps.forEach(({ object, span }) => {
      object.position.z += speed * dt;
      if (object.position.z > WORLD_NEAR) object.position.z -= span;
    });

    this.movingBillboards.forEach(({ object, span }) => {
      object.position.z += speed * dt;
      if (object.position.z > WORLD_NEAR) object.position.z -= span;
    });

    // Dust/cinders.
    const positions = this.dustPositions;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += speed * dt * 1.1;
      if (positions[i + 2] > 22) {
        positions[i + 2] -= 190;
        positions[i] = (Math.random() - 0.5) * 16;
        positions[i + 1] = 0.3 + Math.random() * 6;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    // City beacon twinkle.
    this.cityLights.forEach((light, index) => {
      light.material.opacity = 0.32 + Math.sin(this.time * 2.2 + index * 1.8) * 0.28;
    });

    // Moving key lights make the rails breathe.
    if (this.keyLight) {
      this.keyLight.position.z = -18 + Math.sin(this.time * 0.2) * 8;
      this.magentaLight.position.z = -38 + Math.cos(this.time * 0.16) * 10;
    }
    this.neonSprites.forEach((sprite, index) => {
      const pulse = 0.84 + Math.sin(this.time * 3.5 + index) * 0.12;
      sprite.material.opacity = pulse;
    });
  }
}
