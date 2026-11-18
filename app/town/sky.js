// Light and weather: the sun (or moon) with shadows, the hazy sky colour, rain, snow,
// lightning, cloud shadows drifting with the wind, snow on the ground and lamp glow at night.
// Everything eases toward the latest conditions, so changes fade in rather than jump.

import * as THREE from 'three';
import { voxelUniforms, meshVoxels } from './voxels';
import { cloudVoxels } from './buildings';
import { GROUND_Y } from './layout';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const col = (hex) => new THREE.Color(hex);
const RAD = Math.PI / 180;

function dirFrom(azimuthDeg, elevationDeg) {
  const az = azimuthDeg * RAD;
  const el = elevationDeg * RAD;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}
const MOON_DIR = dirFrom(205, 48);

function softDot(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// What the scene should look like for a set of conditions (see conditions.js).
function goalsFor(c) {
  const elev = c.sun.elevation;
  const day = smooth(-6, 4, elev);
  const golden = day * (1 - smooth(4, 18, elev));
  const twilight = smooth(-9, -1, elev) * (1 - smooth(-1, 6, elev));
  const overcast = smooth(0.55, 0.95, c.cloud);
  const wet = c.precip ? c.precip.intensity : 0;

  const horizon = col(0x131c32);
  horizon.lerp(col(0xc27a66), twilight * 0.7);
  horizon.lerp(col(0xbfdcf2), day);
  horizon.lerp(col(0xf5c08c), golden * 0.75);
  horizon.lerp(col(0x1e232b).lerp(col(0xaab3bb), day), overcast * 0.85);
  horizon.multiplyScalar(1 - 0.22 * wet);
  horizon.lerp(col(0x2a2e35).lerp(col(0xcbd0d4), day), c.fog * 0.85);

  // The sun fades out just after sunset and the moonlight fades in, so swapping
  // the light's direction at -2 degrees happens while both are dim.
  const sunUp = smooth(-1.5, 5, elev);
  const moonUp = 1 - smooth(-6, -1.5, elev);
  const sunDir = elev > -2 ? dirFrom(c.sun.azimuth, Math.max(elev, 3)) : MOON_DIR.clone();
  const sunColor = elev > -2 ? col(0xfff2dc).lerp(col(0xffa25a), golden) : col(0x9fb6e6);
  const sunInt = elev > -2 ? sunUp * 3.1 * (1 - 0.85 * overcast) * (1 - 0.3 * wet) : moonUp * 0.9 * (1 - 0.6 * overcast);

  const hemiSky = col(0x4a62a0).lerp(col(0xd2e7ff), day).lerp(col(0xffdcb6), golden * 0.5);
  hemiSky.lerp(col(0x2c3138).lerp(col(0xc9d0d6), day), overcast * 0.7);
  const hemiGround = col(0x1c2029).lerp(col(0x8b7a5c), day).lerp(col(0xdfe4ea).multiplyScalar(0.3 + 0.7 * day), c.snowCover * 0.6);
  const hemiInt = (1.75 - 0.15 * day) * (1 + 0.45 * overcast * day);

  const water = col(0x16263e).lerp(col(0x3b8fd0), day).lerp(col(0x22303d).lerp(col(0x5b8299), day), overcast * 0.7);
  if (c.temp != null && c.temp < -8) water.lerp(col(0xbcd3de).multiplyScalar(0.3 + 0.7 * day), 0.3);

  return {
    horizon,
    sunDir,
    sunColor,
    sunInt,
    hemiSky,
    hemiGround,
    hemiInt,
    water,
    night: Math.max(1 - smooth(-2, 7, elev), 0.5 * overcast * wet),
    snow: c.snowCover,
    fogNear: (1.15 - 0.45 * wet) * (1 - 0.8 * c.fog),
    fogFar: (3.4 - 1.2 * wet) * (1 - 0.6 * c.fog),
    rain: c.precip?.kind === 'rain' ? wet : c.precip?.kind === 'sleet' ? wet * 0.6 : 0,
    snowfall: c.precip?.kind === 'snow' ? wet : c.precip?.kind === 'sleet' ? wet * 0.5 : 0,
    clouds: overcast < 0.6 ? clamp(c.cloud, 0, 0.8) : 0,
  };
}

const COLOR_KEYS = ['horizon', 'sunColor', 'hemiSky', 'hemiGround', 'water'];
const NUM_KEYS = ['sunInt', 'hemiInt', 'night', 'snow', 'fogNear', 'fogFar', 'rain', 'snowfall', 'clouds'];

export function createSky({ scene, world, reducedMotion, shadowSize = 2048, center }) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xd2e7ff, 0x8b7a5c, 1.5);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xbfdcf2, 80, 240);
  scene.background = new THREE.Color(0xbfdcf2);

  // Rain: short falling streaks in a box that follows the view.
  const RAIN = 2400;
  const rainSeed = new Float32Array(RAIN * 3).map(() => Math.random());
  const rainPos = new Float32Array(RAIN * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xb7cbe0, transparent: true, opacity: 0.55, depthWrite: false })
  );
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // Snow: soft flakes drifting down.
  const SNOW = 3000;
  const snowSeed = new Float32Array(SNOW * 4).map(() => Math.random());
  const snowPos = new Float32Array(SNOW * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  const flakeMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.2,
    map: softDot('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    transparent: true,
    depthWrite: false,
  });
  const snow = new THREE.Points(snowGeo, flakeMat);
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);

  // Lamp glow at night.
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(world.halos, 3));
  const haloMat = new THREE.PointsMaterial({
    color: 0xffd58a,
    size: 1.6,
    map: softDot('rgba(255,236,190,0.9)', 'rgba(255,200,120,0)'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.visible = false;
  scene.add(halos);

  // Clouds you never see, only their shadows sliding over the town.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const CLOUD_TYPES = 4;
  const PER_TYPE = 8;
  const clouds = [];
  for (let k = 0; k < CLOUD_TYPES; k += 1) {
    const mesh = new THREE.InstancedMesh(meshVoxels(cloudVoxels(11 + k * 7), { size: [1.5, 1.2, 1.5], origin: [0, 0, 0] }), shadowOnly, PER_TYPE);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    const spots = Array.from({ length: PER_TYPE }, () => ({ x: (Math.random() - 0.5) * 160, z: (Math.random() - 0.5) * 120, y: 24 + Math.random() * 6 }));
    clouds.push({ mesh, spots });
  }
  const cloudMatrix = new THREE.Matrix4();

  let cur = null;
  let goal = null;
  let wind = { x: 0.8, z: -0.3, speed: 8 };
  let storm = false;
  let flash = 0;
  let nextFlash = 4;

  function setConditions(c) {
    goal = goalsFor(c);
    wind = c.wind;
    storm = c.storm && !reducedMotion;
    if (!cur) {
      cur = { ...goal, sunDir: goal.sunDir.clone() };
      for (const k of COLOR_KEYS) cur[k] = goal[k].clone();
    }
  }

  const tmp = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  let cloudClock = 0;

  function update(dt, view) {
    if (!cur) return;
    const k = 1 - Math.exp(-dt * 1.5);
    for (const key of COLOR_KEYS) cur[key].lerp(goal[key], k);
    for (const key of NUM_KEYS) cur[key] += (goal[key] - cur[key]) * k;
    cur.sunDir.lerp(goal.sunDir, k).normalize();

    // Lightning: a double flash now and then.
    let boost = 0;
    if (storm) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 1;
        nextFlash = 5 + Math.random() * 11;
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 3.2);
        boost = flash > 0.75 || (flash > 0.35 && flash < 0.5) ? 2.2 : 0;
      }
    }

    scene.background.copy(cur.horizon);
    scene.fog.color.copy(cur.horizon);
    if (boost) {
      scene.background.lerp(col(0xdfe6ff), 0.5);
      scene.fog.color.copy(scene.background);
    }
    scene.fog.near = view.dist * cur.fogNear;
    scene.fog.far = view.dist * Math.max(cur.fogFar, cur.fogNear + 0.4);

    sun.color.copy(cur.sunColor);
    sun.intensity = cur.sunInt;
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = cur.hemiInt + boost;
    world.water.material.color.copy(cur.water);
    world.bankMat.color.setHex(world.bankBase).lerp(col(0xeef2f6), cur.snow * 0.9);
    voxelUniforms.uSnow.value = cur.snow;
    voxelUniforms.uNight.value = cur.night;
    haloMat.opacity = cur.night * 0.85;
    halos.visible = cur.night > 0.02;

    // Fit the shadow box around what's on screen, snapped to whole shadow-map texels so
    // shadows don't shimmer while the view pans.
    const S = clamp(view.dist * 0.8, 18, 80);
    const cam = sun.shadow.camera;
    cam.left = -S;
    cam.right = S;
    cam.top = S;
    cam.bottom = -S;
    cam.updateProjectionMatrix();
    const texel = (2 * S) / sun.shadow.mapSize.x;
    right.crossVectors(Y, cur.sunDir).normalize();
    up.crossVectors(cur.sunDir, right).normalize();
    tmp.copy(view.target);
    const a = tmp.dot(right);
    const b = tmp.dot(up);
    tmp.addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(up, Math.round(b / texel) * texel - b);
    sun.target.position.copy(tmp);
    sun.position.copy(tmp).addScaledVector(cur.sunDir, 150);
    sun.target.updateMatrixWorld();

    // Drifting cloud shadows.
    if (!reducedMotion) cloudClock += dt;
    const drift = (0.25 + wind.speed * 0.03) * cloudClock;
    let budget = Math.round(cur.clouds * CLOUD_TYPES * PER_TYPE);
    for (const c of clouds) {
      const n = Math.min(PER_TYPE, Math.ceil(budget / CLOUD_TYPES));
      c.mesh.count = Math.max(0, Math.min(n, budget));
      budget -= c.mesh.count;
      for (let i = 0; i < c.mesh.count; i += 1) {
        const s = c.spots[i];
        const x = ((((s.x + wind.x * drift + 80) % 160) + 160) % 160) - 80 + center.x;
        const z = ((((s.z + wind.z * drift + 60) % 120) + 120) % 120) - 60 + center.z;
        cloudMatrix.makeTranslation(x, s.y, z);
        c.mesh.setMatrixAt(i, cloudMatrix);
      }
      c.mesh.instanceMatrix.needsUpdate = true;
    }

    // Rain and snow fall in a box around the view's centre.
    const half = clamp(view.dist * 0.5, 12, 45);
    const height = half * 1.3;
    const cx = view.target.x;
    const cz = view.target.z;
    const windK = Math.min(1, wind.speed / 40) * 0.5;

    const rainCount = reducedMotion ? 0 : Math.round(RAIN * clamp(cur.rain, 0, 1));
    rain.visible = rainCount > 0;
    if (rain.visible) {
      const len = 0.6;
      for (let i = 0; i < rainCount; i += 1) {
        let y = rainSeed[i * 3 + 2] - (dt * 18) / height;
        if (y < 0) y += 1;
        rainSeed[i * 3 + 2] = y;
        const x = cx + (rainSeed[i * 3] * 2 - 1) * half;
        const z = cz + (rainSeed[i * 3 + 1] * 2 - 1) * half;
        const wy = GROUND_Y + y * height;
        const o = i * 6;
        rainPos[o] = x;
        rainPos[o + 1] = wy;
        rainPos[o + 2] = z;
        rainPos[o + 3] = x - wind.x * windK * len;
        rainPos[o + 4] = wy + len;
        rainPos[o + 5] = z - wind.z * windK * len;
      }
      rainGeo.setDrawRange(0, rainCount * 2);
      rainGeo.attributes.position.needsUpdate = true;
    }

    const snowCount = reducedMotion ? 0 : Math.round(SNOW * clamp(cur.snowfall, 0, 1));
    snow.visible = snowCount > 0;
    if (snow.visible) {
      flakeMat.size = 0.12 + view.dist * 0.004;
      const t = performance.now() / 1000;
      for (let i = 0; i < snowCount; i += 1) {
        const o = i * 4;
        let y = snowSeed[o + 2] - (dt * 1.5) / height;
        if (y < 0) y += 1;
        snowSeed[o + 2] = y;
        snowSeed[o] = (snowSeed[o] + (wind.x * windK * dt * 2) / (2 * half) + 1) % 1;
        snowSeed[o + 1] = (snowSeed[o + 1] + (wind.z * windK * dt * 2) / (2 * half) + 1) % 1;
        const sway = Math.sin(t * 0.9 + snowSeed[o + 3] * 20) * 0.25;
        snowPos[i * 3] = cx + (snowSeed[o] * 2 - 1) * half + sway;
        snowPos[i * 3 + 1] = GROUND_Y + y * height;
        snowPos[i * 3 + 2] = cz + (snowSeed[o + 1] * 2 - 1) * half;
      }
      snowGeo.setDrawRange(0, snowCount);
      snowGeo.attributes.position.needsUpdate = true;
    }
  }

  function dispose() {
    rainGeo.dispose();
    snowGeo.dispose();
    haloGeo.dispose();
    flakeMat.map.dispose();
    haloMat.map.dispose();
    for (const c of clouds) c.mesh.geometry.dispose();
  }

  return { setConditions, update, dispose };
}
