// Style 09: Anime Penitents (unjust architect, anime).
// Slim, long-legged figures with slightly large heads and big glossy painted eyes
// (kit.paintedEye), sharp 2-step cel shading with a hard rim light (a small shader patch
// on MeshToonMaterial), clean dark outlines and a slate-blue dusk. The cardinal's cape
// ripples, and the headband tails, rope ends, sash, ponytail and hat cords sway.

import * as THREE from 'three';
import {
  torch, embers, blobShadow, outlineAll, toonGradient, lathe, raggedHem, mergeMeshes,
  eyePair, paintedEye, canvasTexture, gradientBackground, pointIn,
} from '../kit.js';

const LINE = 0x161829;
const LINE_CSS = '#161829';
const R = 0.074;        // head radius
const HEAD_Y = 0.905;   // head centre
const NECK = 0.835;     // head pivots here
const SH_Y = 0.752;     // shoulder joints
const SH_X = 0.08;
const HIP = 0.5;        // upper body pivots here; legs hang from here
const FLAT = 0.78;      // front-to-back squash of torsos and robes
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- materials

// MeshToonMaterial with 2-step cel shading plus a hard rim light. The rim is worked out
// in view space (upper-right edges, as if lit from behind), so it stays on the
// silhouette while the figures turn.
const RIM_DIR = new THREE.Vector3(0.78, 0.5, -0.38).normalize();
const RIM_COLOR = new THREE.Color(0xb4ccff);
function cel(color, { rim = 0.55, ...rest } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(2), ...rest });
  const uRim = { value: RIM_COLOR.clone().multiplyScalar(rim) };
  const uRimDir = { value: RIM_DIR };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = uRim;
    sh.uniforms.uRimDir = uRimDir;
    sh.fragmentShader = 'uniform vec3 uRim;\nuniform vec3 uRimDir;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += uRim * step(0.64, 1.0 - rimFacing) * step(0.08, dot(normal, uRimDir));
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'anime-penitents-rim';
  return m;
}

// Cape cloth: crimson with a gold trim down both edges and along the hem.
function capeTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#a3172d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2b84e';
    ctx.fillRect(0, 0, 5, h); ctx.fillRect(w - 5, 0, 5, h); ctx.fillRect(0, h - 9, w, 9);
    ctx.fillStyle = '#5c0c1a';
    ctx.fillRect(6, 0, 1.5, h - 10); ctx.fillRect(w - 7.5, 0, 1.5, h - 10); ctx.fillRect(6, h - 11.5, w - 12, 1.5);
  });
}

const D2 = { side: THREE.DoubleSide };
const M = {
  skin: cel(0xf4d9c8),
  hairP: cel(0x55301f, D2),
  hairM: cel(0x8c6a4d, D2),
  hairPr: cel(0xc9c6dc, D2),
  hairC: cel(0xeeeaf0, D2),
  tunic: cel(0x8f6b45),
  trousers: cel(0x3b4258),
  wrap: cel(0xd2c7b0),
  boot: cel(0x2b2424),
  band: cel(0xe4dccb),
  habit: cel(0x5f4c3f),
  habitShell: cel(0x5f4c3f, D2),
  rope: cel(0xc4aa76),
  cassock: cel(0x1c2030, { rim: 0.75 }),
  white: cel(0xf0f2f6),
  sash: cel(0x4c3a6c),
  silver: cel(0xc3cad8),
  crimson: cel(0xa3172d),
  cape: cel(0xffffff, { map: capeTexture(), side: THREE.DoubleSide }),
  gold: cel(0xe2b84e),
  wood: cel(0x5c3d28),
  book: cel(0x2a1f1d),
  page: cel(0xe8dfca),
  ink: new THREE.MeshBasicMaterial({ color: LINE }),
};

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

const sphere = (r, w = 10, h = 8) => geo(`s${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
// Cylinder hanging down from its origin (limbs, cords, tails).
const limbGeo = (len, r0, r1, seg = 7) => geo(`l${len}:${r0}:${r1}:${seg}`,
  () => new THREE.CylinderGeometry(r0, r1, len, seg, 1).translate(0, -len / 2, 0));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
// Open cone with its base at the origin, pointing up +y (hair spikes and strands).
const cone = (r, len, seg = 5) => geo(`c${r}:${len}:${seg}`,
  () => new THREE.ConeGeometry(r, len, seg, 1, true).translate(0, len / 2, 0));
// Sphere shell with an opening at the front (hoods).
const shell = (r, open, thetaEnd, w = 14, h = 9) => geo(`h${r}:${open}:${thetaEnd}`,
  () => new THREE.SphereGeometry(r, w, h, Math.PI / 2 + open / 2, Math.PI * 2 - open, 0, thetaEnd));
const torus = (r, tube, seg = 14) => geo(`t${r}:${tube}:${seg}`,
  () => new THREE.TorusGeometry(r, tube, 3, seg).rotateX(Math.PI / 2));

// Anime head: a sphere whose lower half narrows to a small pointed chin. The normals
// stay the sphere's, so shading and outlines stay smooth.
const headGeo = () => geo('head', () => {
  const g = new THREE.SphereGeometry(R, 14, 11);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.max(0, (-y / R - 0.2) / 0.8);
    const k2 = k * k, front = Math.max(0, z / R);
    p.setXYZ(i, x * (1 - 0.36 * k2), y * (1 + 0.2 * k2 * front), z * (1 - 0.12 * k2) + 0.12 * R * k2 * front);
  }
  return g;
});

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

// Pivot group at (0, y, 0) whose children can use absolute figure heights.
function pivot(parent, y) {
  const p = new THREE.Group();
  p.position.y = y;
  const inner = new THREE.Group();
  inner.position.y = -y;
  p.add(inner);
  parent.add(p);
  return [p, inner];
}

// Point at (yaw, elevation) on a sphere of radius r around the head centre.
function sp(yaw, el, r) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(el) * r, HEAD_Y + Math.sin(el) * r, Math.cos(yaw) * Math.cos(el) * r);
}

// A cone from a to b (base radius rad at a, tip at b).
function strand(a, b, rad, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = part(cone(rad, Math.round(dir.length() * 1000) / 1000), mat);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  m.position.copy(a);
  return m;
}

// Spiky hair: cones pushed out from the head along [yaw, elevation, length, radius],
// swept back a little by `bias`.
function spikes(list, mat, bias = [0, 0.2, -0.45]) {
  const b = new THREE.Vector3(...bias);
  return list.map(([yaw, el, len, rad]) => {
    const out = sp(yaw, el, 1); out.y -= HEAD_Y;
    const d = out.clone().add(b).normalize();
    const m = part(cone(rad, len), mat);
    m.quaternion.setFromUnitVectors(UP, d);
    m.position.copy(out).multiplyScalar(R * 0.92);
    m.position.y += HEAD_Y;
    return m;
  });
}

// Fringe: strands down the forehead, from elevation el0 to el1 (tips stop above the eyes).
function fringe(yaws, mat, { el0 = 0.66, el1 = 0.27, rad = 0.017, drift = 1.08 } = {}) {
  return yaws.map((y, i) => strand(sp(y, el0, R * 1.07), sp(y * drift, el1 + (i % 2) * 0.05, R * 1.05), rad, mat));
}

// Hair cap: a dome tilted back, so it sits high on the forehead and low at the nape.
function hairCap(mat, tilt = 0.4) {
  const cap = part(geo('cap', () => new THREE.SphereGeometry(R * 1.08, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5)), mat, 0, HEAD_Y, 0);
  cap.rotation.x = -tilt;
  return cap;
}

// Puts `obj` on the face at (yaw, pitch), `rad` from the head centre, rolled by `roll`.
function onFace(H, obj, yaw, pitch, rad, roll = 0) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.rotation.set(-pitch, yaw, roll);
  g.position.y = HEAD_Y;
  obj.position.z = rad;
  obj.userData.noOutline = true;
  g.add(obj);
  g.userData.noFit = true;
  H.add(g);
  return g;
}

// ---------------------------------------------------------------- face

const EYE = {
  headRadius: R, w: 0.036, h: 0.04, sclera: '#eef0f7', pupil: '#0c0f1c', irisSize: 0.62, irisH: 1.3, irisY: 0.08,
  irisRim: '#0c0f1c', shadow: 'rgba(52,60,118,0.4)', lash: 0.12, wing: 0.9, lower: 0.035, line: LINE_CSS,
  highlights: [[-0.28, -0.24, 0.22], [0.24, 0.36, 0.1]],
};

// Big glossy eyes; `tilt` slants the outer corners up. Highlights stay on the same side
// for both eyes (the left eye's texture is mirrored, so its highlights are pre-mirrored).
function eyes(H, opts = {}, { yaw = 0.43, pitch = -0.05, tilt = 0.06 } = {}) {
  const o = { ...EYE, ...opts };
  const pair = eyePair((side) => {
    const hl = side < 0 && Array.isArray(o.highlights) ? o.highlights.map(([x, y, r]) => [-x, y, r]) : o.highlights;
    const e = paintedEye({ ...o, highlights: hl, flip: side < 0 });
    e.rotation.z = side * tilt;
    return e;
  }, { yaw, pitch });
  pair.position.y = HEAD_Y;
  H.add(pair);
  return pair;
}

// Thin brows; positive roll lifts the outer ends (stern), negative lifts the inner ends.
function brows(H, { yaw = 0.42, pitch = 0.31, roll = 0.08, len = 0.028 } = {}) {
  for (const s of [-1, 1]) onFace(H, part(box(len, 0.0045, 0.003), M.ink), s * yaw, pitch, R * 1.02, s * roll);
}

function mouth(H, { w = 0.012, pitch = -0.5, roll = 0 } = {}) {
  onFace(H, part(box(w, 0.0026, 0.003), M.ink), 0, pitch, R * 1.025, roll);
}

// ---------------------------------------------------------------- body

function body({ skirt = null, skirtMat, torso, torsoMat, hem = 0, seed = 1 }) {
  const root = new THREE.Group();
  if (skirt) {
    const sk = lathe(skirt, 14);
    if (hem) raggedHem(sk, hem, seed);
    const s = part(sk, skirtMat);
    s.scale.z = FLAT;
    root.add(s);
  }
  const [upper, U] = pivot(root, HIP);
  const t = part(lathe(torso, 14), torsoMat);
  t.scale.z = FLAT;
  U.add(t);
  U.add(part(limbGeo(0.075, 0.018, 0.021), M.skin, 0, NECK + 0.03, -0.004));
  const [head, H] = pivot(U, NECK);
  H.add(part(headGeo(), M.skin, 0, HEAD_Y, 0));
  root.add(blobShadow({ radius: 0.2, opacity: 0.5, color: 0x0b0d18 }));
  return { root, upper, U, head, H, swings: [] };
}

// Arm with a shoulder and an elbow pivot; `grip` is where the hand holds things.
function arm(parent, side, { sleeve, fore = sleeve, hand = M.skin, upper = 0.165, foreLen = 0.15, r = 0.018, cuff = 0.02, showHand = true }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * SH_X, SH_Y, 0);
  shoulder.add(part(limbGeo(upper, r, r * 0.9), sleeve));
  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  elbow.add(part(limbGeo(foreLen, r * 0.85, cuff), fore));
  if (showHand) {
    const h = part(sphere(0.016, 6, 5), hand, 0, -foreLen - 0.012, 0);
    h.scale.set(0.85, 1.15, 0.9);
    elbow.add(h);
  }
  const grip = new THREE.Object3D();
  grip.position.y = -foreLen - 0.014;
  elbow.add(grip);
  parent.add(shoulder);
  return { shoulder, elbow, grip };
}

// Long legs in trousers (or just boots under a robe).
function legs(root, { mat, boot = M.boot, wraps = null, show = true }) {
  const list = [];
  for (const s of [-1, 1]) {
    if (show) {
      const thigh = part(limbGeo(0.26, 0.027, 0.021), mat, s * 0.034, HIP + 0.01, 0);
      thigh.rotation.z = s * 0.02;
      list.push(thigh, part(limbGeo(0.235, 0.02, 0.015), mat, s * 0.039, 0.252, 0));
      if (wraps) for (const y of [0.085, 0.14]) list.push(part(geo('wrap', () => new THREE.CylinderGeometry(0.0205, 0.0215, 0.026, 7, 1, true)), wraps, s * 0.039, y, 0));
    }
    const b = part(sphere(0.026, 8, 6), boot, s * 0.04, 0.02, show ? 0.016 : 0.068);
    b.scale.set(0.78, 0.68, 1.55);
    list.push(b);
  }
  root.add(mergeMeshes(list));
}

// Something that sways: base rotation (bx, bz) plus swing amplitudes.
function swing(rig, obj, { bx = 0, bz = 0, ax = 0.12, az = 0.08, speed = 2, ph = 0 } = {}) {
  obj.rotation.x = bx; obj.rotation.z = bz;
  rig.swings.push({ obj, bx, bz, ax, az, speed, ph });
}

// Rotate `obj` (already in the tree) so it stands upright in `root`, then tilt it.
function standUpright(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

// ---------------------------------------------------------------- cape

// A cloth sheet hanging behind the shoulders, flaring towards the hem. update() ripples it
// by moving its vertices (the outline hull shares the geometry, so it ripples too).
function cape({ top = 0.775, bottom = 0.03, r0 = 0.088, r1 = 0.17, span0 = Math.PI * 1.08, span1 = Math.PI * 1.22, cols = 8, rows = 8 }) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = top + (bottom - top) * v;
    const r = r0 + (r1 - r0) * Math.pow(v, 0.75);
    const span = span0 + (span1 - span0) * v;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const a = Math.PI + (u - 0.5) * span;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r * FLAT * 1.15);
      uv.push(u, 1 - v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, M.cape);
  mesh.userData.wave = { base: Float32Array.from(pos), cols, rows };
  return mesh;
}

function rippleCape(mesh, t) {
  const { base, cols, rows } = mesh.userData.wave;
  const attr = mesh.geometry.attributes.position;
  const arr = attr.array;
  for (let j = 0, k = 0; j <= rows; j++) {
    const v = j / rows;
    const amp = 0.026 * v * v;
    const trail = v * v * (0.012 + 0.01 * Math.sin(t * 0.9));
    for (let i = 0; i <= cols; i++, k++) {
      const u = i / cols;
      const w = Math.sin(t * 1.8 - v * 3.4 + u * 2.6) * amp + Math.sin(t * 1.15 + u * 5.2) * amp * 0.35;
      const bx = base[k * 3], bz = base[k * 3 + 2];
      const len = Math.hypot(bx, bz) || 1;
      arr[k * 3] = bx + (bx / len) * w + Math.sin(t * 0.7) * trail * 0.6;
      arr[k * 3 + 2] = bz + (bz / len) * w - trail;
    }
  }
  attr.needsUpdate = true;
}

// ---------------------------------------------------------------- roles

function peasant() {
  const b = body({
    skirt: [[0.092, 0.36], [0.082, 0.42], [0.064, 0.5], [0.057, 0.54]], skirtMat: M.tunic, hem: 0.03, seed: 4,
    torso: [[0.054, 0.48], [0.058, 0.58], [0.068, 0.67], [0.074, 0.73], [0.07, 0.76], [0.045, 0.785], [0.022, 0.8]], torsoMat: M.tunic,
  });
  const { root, U, H } = b;
  legs(root, { mat: M.trousers, wraps: M.wrap });
  const belt = part(torus(0.059, 0.007), M.rope, 0, 0.5, 0);
  belt.scale.z = FLAT;
  U.add(belt);
  // Messy spiky hair, a fringe stopping above the eyes, and a headband with two tails.
  const hair = [hairCap(M.hairP)];
  hair.push(...spikes([
    [0, 1.3, 0.07, 0.026], [0.85, 1.0, 0.075, 0.025], [-0.85, 1.0, 0.075, 0.025], [0.35, 0.9, 0.06, 0.022], [-0.4, 0.88, 0.065, 0.022],
    [1.6, 0.5, 0.07, 0.024], [-1.6, 0.5, 0.07, 0.024], [2.3, 0.55, 0.08, 0.026], [-2.3, 0.55, 0.08, 0.026],
    [3.14, 0.7, 0.085, 0.027], [2.75, 0.1, 0.07, 0.024], [-2.75, 0.1, 0.07, 0.024],
  ], M.hairP));
  hair.push(...fringe([-0.62, -0.3, 0.02, 0.32, 0.62], M.hairP));
  H.add(mergeMeshes(hair));
  const band = part(geo('band', () => new THREE.TorusGeometry(R * 1.1, 0.0075, 3, 16).rotateX(Math.PI / 2)), M.band, 0, HEAD_Y, 0);
  band.rotation.x = -0.4;
  H.add(band);
  for (const s of [-1, 1]) {
    const tail = new THREE.Group();
    tail.position.set(s * 0.012, HEAD_Y - 0.032, -0.078);
    const rib = part(geo('ribbon', () => new THREE.BoxGeometry(0.018, 0.1, 0.004).translate(0, -0.05, 0)), M.band);
    tail.add(rib);
    H.add(tail);
    swing(b, tail, { bx: 0.65, bz: s * 0.25, ax: 0.16, az: 0.1, speed: 2.4, ph: s });
  }
  eyes(H, { iris: '#d0862c', irisTop: '#3c1a08' });
  brows(H, { roll: 0.02 });
  mouth(H);
  // Left arm hangs; right arm holds the torch up and out.
  const armL = arm(U, -1, { sleeve: M.tunic, fore: M.skin });
  armL.shoulder.rotation.set(0.06, 0, -0.12);
  armL.elbow.rotation.x = -0.22;
  const armR = arm(U, 1, { sleeve: M.tunic, fore: M.skin });
  armR.shoulder.rotation.set(-0.2, 0, 0.2);
  armR.elbow.rotation.x = -2.05;
  const t = torch({ handleMaterial: M.wood, wrapMaterial: M.boot, length: 0.3, intensity: 1.25, distance: 2.0 });
  armR.grip.add(t);
  standUpright(root, t, 0.08, -0.1);
  root.add(embers({ source: t.userData.flameTip, count: 8, size: 0.022, rise: 0.4, spread: 0.05 }));
  outlineAll(root, { color: LINE, thickness: 0.0065 });
  root.userData.rig = { ...b, armL, armR, hunch: 0.04, headTilt: 0.02, look: -0.1, phase: 0.4 };
  return root;
}

function monk() {
  const b = body({
    skirt: [[0.118, 0.0], [0.113, 0.03], [0.094, 0.2], [0.074, 0.4], [0.064, 0.52]], skirtMat: M.habit,
    torso: [[0.062, 0.48], [0.066, 0.6], [0.074, 0.7], [0.078, 0.745], [0.05, 0.78], [0.024, 0.8]], torsoMat: M.habit,
  });
  const { root, U, H } = b;
  legs(root, { mat: M.habit, show: false });
  // Cowl over the shoulders, and the hood up, its point falling back.
  const cowl = part(lathe([[0.09, 0.68], [0.088, 0.725], [0.074, 0.77], [0.052, 0.81]], 14), M.habit);
  cowl.scale.z = FLAT * 1.08;
  U.add(cowl);
  const hood = part(shell(R * 1.3, 1.5, Math.PI * 0.8), M.habitShell, 0, HEAD_Y + 0.006, -0.008);
  hood.scale.set(1, 1.1, 1.08);
  H.add(hood);
  const peak = part(geo('peak', () => new THREE.ConeGeometry(0.04, 0.09, 7)), M.habit, 0, HEAD_Y + 0.05, -0.1);
  peak.rotation.x = -1.9;
  H.add(peak);
  H.add(mergeMeshes(fringe([-0.38, -0.1, 0.18, 0.42], M.hairM, { el0: 0.7, el1: 0.3 })));
  // Serene closed eyes.
  eyes(H, { closed: true, lash: 0.1, h: 0.034 }, { pitch: -0.12, tilt: -0.04 });
  brows(H, { roll: -0.06, pitch: 0.28 });
  mouth(H, { w: 0.01 });
  // Rope belt with two knotted ends that swing.
  const belt = part(torus(0.067, 0.008), M.rope, 0, 0.5, 0);
  belt.scale.z = FLAT;
  U.add(belt);
  for (const [x, len, ph] of [[-0.03, 0.2, 0], [-0.012, 0.15, 1.1]]) {
    const end = new THREE.Group();
    end.position.set(x, 0.495, 0.056);
    end.add(mergeMeshes([part(limbGeo(len, 0.0055, 0.0055, 5), M.rope), part(sphere(0.011, 6, 5), M.rope, 0, -len * 0.55, 0), part(sphere(0.011, 6, 5), M.rope, 0, -len, 0)]));
    root.add(end);
    swing(b, end, { bx: -0.08, bz: 0, ax: 0.07, az: 0.12, speed: 1.6, ph });
  }
  // Hands together in prayer, wide sleeves.
  const sleeve = { sleeve: M.habit, r: 0.021, cuff: 0.034, showHand: false };
  const armL = arm(U, -1, sleeve);
  const armR = arm(U, 1, sleeve);
  armL.shoulder.rotation.set(-0.3, 0, 0.32);
  armR.shoulder.rotation.set(-0.3, 0, -0.32);
  armL.elbow.rotation.set(-1.45, 0, 0);
  armR.elbow.rotation.set(-1.45, 0, 0);
  const g = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  const hands = mergeMeshes([-1, 1].map((s) => {
    const h = part(sphere(0.016, 7, 5), M.skin, s * 0.008, 0, 0);
    h.scale.set(0.55, 1.5, 1);
    h.rotation.z = -s * 0.15;
    return h;
  }));
  hands.position.set(g.x, g.y + 0.03, g.z + 0.004);
  hands.rotation.x = 0.25;
  U.add(hands);
  outlineAll(root, { color: LINE, thickness: 0.0065 });
  root.userData.rig = { ...b, armL, armR, hunch: 0.07, headTilt: 0.16, look: 0, phase: 1.8 };
  return root;
}

function priest() {
  const b = body({
    skirt: [[0.106, 0.0], [0.101, 0.03], [0.086, 0.25], [0.066, 0.52]], skirtMat: M.cassock,
    torso: [[0.062, 0.48], [0.064, 0.6], [0.072, 0.7], [0.076, 0.745], [0.05, 0.78], [0.024, 0.8]], torsoMat: M.cassock,
  });
  const { root, U, H } = b;
  legs(root, { mat: M.cassock, show: false });
  // White clerical collar with a front tab, violet sash with tails, silver cross.
  U.add(part(geo('collar', () => new THREE.CylinderGeometry(0.025, 0.027, 0.02, 10)), M.white, 0, 0.8, -0.002));
  U.add(part(box(0.014, 0.012, 0.004), M.white, 0, 0.792, 0.025));
  const sash = part(torus(0.066, 0.011), M.sash, 0, 0.5, 0);
  sash.scale.z = FLAT;
  U.add(sash);
  for (const [x, len, ph] of [[-0.052, 0.17, 0], [-0.038, 0.13, 0.9]]) {
    const tail = new THREE.Group();
    tail.position.set(x, 0.49, 0.03);
    tail.add(part(geo(`sasht${len}`, () => new THREE.BoxGeometry(0.02, len, 0.005).translate(0, -len / 2, 0)), M.sash));
    root.add(tail);
    swing(b, tail, { bx: 0, bz: 0.1, ax: 0.08, az: 0.1, speed: 1.7, ph });
  }
  const cross = mergeMeshes([part(box(0.007, 0.034, 0.004), M.silver), part(box(0.022, 0.007, 0.004), M.silver, 0, 0.007, 0)]);
  cross.position.set(0, 0.69, 0.06);
  cross.rotation.x = -0.15;
  U.add(cross);
  // Long silver hair, parted fringe, locks framing the face, ponytail down the back.
  const hair = [hairCap(M.hairPr, 0.34)];
  hair.push(...fringe([-0.6, -0.38, 0.36, 0.6], M.hairPr, { el0: 0.75, el1: 0.3, drift: 1.25 }));
  for (const s of [-1, 1]) hair.push(strand(sp(s * 1.05, 0.35, R * 1.06), sp(s * 0.98, -0.9, R * 1.02), 0.02, M.hairPr));
  H.add(mergeMeshes(hair));
  let link = new THREE.Group();
  link.position.set(0, HEAD_Y - 0.026, -0.078);
  link.add(part(torus(0.016, 0.005, 10), M.sash));
  H.add(link);
  [[0.1, 0.021, 0.017], [0.1, 0.017, 0.011], [0.08, 0.011, 0.003]].forEach(([len, r0, r1], i) => {
    const seg = new THREE.Group();
    seg.add(part(limbGeo(len, r0, r1, 7), M.hairPr));
    link.add(seg);
    swing(b, seg, { bx: i === 0 ? 0.35 : -0.08, bz: 0, ax: 0.05 + i * 0.03, az: 0.06 + i * 0.04, speed: 1.5, ph: -i * 0.7 });
    const next = new THREE.Group();
    next.position.y = -len;
    seg.add(next);
    link = next;
  });
  eyes(H, { iris: '#7e64b6', irisTop: '#241640', lid: 0.12, lidColor: null }, { tilt: 0.03 });
  brows(H, { roll: -0.02 });
  mouth(H, { w: 0.011 });
  // Both hands hold a small book at the chest.
  const armL = arm(U, -1, { sleeve: M.cassock });
  const armR = arm(U, 1, { sleeve: M.cassock });
  armL.shoulder.rotation.set(-0.25, 0, 0.3);
  armR.shoulder.rotation.set(-0.25, 0, -0.3);
  armL.elbow.rotation.x = -1.3;
  armR.elbow.rotation.x = -1.3;
  const book = new THREE.Group();
  book.add(part(box(0.075, 0.062, 0.012), M.book), part(box(0.068, 0.056, 0.008), M.page, 0, 0, 0.007));
  const hands = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  book.position.set(0, hands.y + 0.012, hands.z + 0.006);
  book.rotation.x = -0.85;
  U.add(book);
  outlineAll(root, { color: LINE, thickness: 0.0065 });
  root.userData.rig = { ...b, armL, armR, book, hunch: 0.05, headTilt: 0.2, look: 0.05, phase: 3.0 };
  return root;
}

function cardinal() {
  const b = body({
    skirt: [[0.11, 0.0], [0.105, 0.03], [0.088, 0.25], [0.068, 0.52]], skirtMat: M.crimson,
    torso: [[0.064, 0.48], [0.066, 0.6], [0.074, 0.7], [0.078, 0.745], [0.05, 0.78], [0.024, 0.8]], torsoMat: M.crimson,
  });
  const { root, U, H } = b;
  legs(root, { mat: M.crimson, show: false });
  // Shoulder cape with a gold hem, the long flowing cape, a gold pectoral cross.
  const moz = part(lathe([[0.1, 0.64], [0.098, 0.68], [0.088, 0.73], [0.064, 0.77], [0.03, 0.797]], 16), M.crimson);
  moz.scale.z = FLAT * 1.05;
  U.add(moz);
  const trim = part(torus(0.1, 0.005, 20), M.gold, 0, 0.64, 0);
  trim.scale.z = FLAT * 1.05;
  U.add(trim);
  const cloak = cape({});
  U.add(cloak);
  const pect = mergeMeshes([part(box(0.008, 0.04, 0.006), M.gold), part(box(0.026, 0.008, 0.006), M.gold, 0, 0.008, 0)]);
  pect.position.set(0, 0.69, 0.068);
  pect.rotation.x = -0.2;
  U.add(pect);
  // Platinum hair falling past the shoulders.
  const hair = [hairCap(M.hairC, 0.3)];
  hair.push(...fringe([-0.55, -0.2, 0.25, 0.58], M.hairC, { el0: 0.72, el1: 0.3, drift: 1.15 }));
  for (const s of [-1, 1]) {
    hair.push(strand(sp(s * 1.1, 0.3, R * 1.06), sp(s * 1.05, -1.25, R * 1.25), 0.022, M.hairC));
    hair.push(strand(sp(s * 2.2, 0.2, R * 1.04), sp(s * 2.4, -1.35, R * 1.4), 0.026, M.hairC));
  }
  hair.push(strand(sp(Math.PI, 0.2, R * 1.04), sp(Math.PI, -1.35, R * 1.45), 0.03, M.hairC));
  H.add(mergeMeshes(hair));
  // Galero: wide flat brim, low crown, cords with gold tassels.
  const hat = new THREE.Group();
  hat.position.y = HEAD_Y + 0.058;
  hat.rotation.x = -0.08;
  hat.add(part(geo('brim', () => new THREE.CylinderGeometry(0.135, 0.135, 0.009, 22)), M.crimson));
  hat.add(part(geo('crown', () => new THREE.CylinderGeometry(0.056, 0.07, 0.042, 14)), M.crimson, 0, 0.025, 0));
  H.add(hat);
  for (const s of [-1, 1]) {
    const cord = new THREE.Group();
    cord.position.set(s * 0.105, HEAD_Y + 0.052, 0.01);
    cord.add(mergeMeshes([
      part(limbGeo(0.2, 0.003, 0.003, 4), M.crimson),
      part(geo('tassel', () => new THREE.ConeGeometry(0.012, 0.032, 6)), M.gold, 0, -0.21, 0),
    ]));
    H.add(cord);
    swing(b, cord, { bx: 0.05, bz: -s * 0.05, ax: 0.05, az: 0.06, speed: 1.5, ph: s * 0.8 });
  }
  // Cold, narrow eyes under stern brows; a thin flat mouth.
  eyes(H, { iris: '#a9c2d3', irisTop: '#3a4c66', irisSize: 0.5, irisH: 1.15, lid: 0.36, lidColor: null, lash: 0.13, highlights: [[-0.18, 0.02, 0.14]] }, { tilt: 0.16, pitch: -0.07 });
  brows(H, { roll: 0.2, pitch: 0.25 });
  mouth(H, { w: 0.014 });
  // Right hand on a gold cross staff; left hand at rest.
  const armL = arm(U, -1, { sleeve: M.crimson });
  armL.shoulder.rotation.set(-0.08, 0, -0.16);
  armL.elbow.rotation.x = -0.45;
  const armR = arm(U, 1, { sleeve: M.crimson });
  armR.shoulder.rotation.set(-0.2, 0, 0.26);
  armR.elbow.rotation.x = -1.05;
  const g = pointIn(root, armR.grip);
  const staff = new THREE.Group();
  staff.position.set(g.x, 0, g.z);
  staff.add(mergeMeshes([
    part(geo('staff', () => new THREE.CylinderGeometry(0.008, 0.01, 1.02, 6).translate(0, 0.51, 0)), M.gold),
    part(sphere(0.016, 8, 6), M.gold, 0, 1.0, 0),
    part(box(0.016, 0.12, 0.016), M.gold, 0, 1.08, 0),
    part(box(0.085, 0.016, 0.016), M.gold, 0, 1.095, 0),
  ]));
  root.add(staff);
  root.scale.setScalar(1.07);
  outlineAll(root, { color: LINE, thickness: 0.0065 });
  root.userData.rig = { ...b, armL, armR, cloak, hunch: -0.02, headTilt: -0.04, look: 0, phase: 4.6 };
  return root;
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- style

export default {
  id: '09-anime-penitents',
  name: 'Anime Penitents',
  blurb: 'Cel-shaded penitents with glossy eyes and hard rim light at dusk.',
  vibe: 'unjust architect',
  look: 'anime',
  tileColor: 0x3c4560,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#1a2236'], [0.5, '#33405c'], [0.84, '#5a5976'], [1, '#6c6180']], { vignette: 0.45 });
    scene.fog = new THREE.Fog(0x3a445f, 8, 22);
    scene.add(new THREE.HemisphereLight(0xa2b4dc, 0x2a2436, 1.0));
    const key = new THREE.DirectionalLight(0xffdcc6, 2.4);
    key.position.set(-2.5, 3, 3);
    scene.add(key);
    const back = new THREE.DirectionalLight(0x8fb0ff, 0.9);
    back.position.set(2, 2, -3);
    scene.add(back);
  },

  build(role) {
    const fig = BUILDERS[role]();
    const r = fig.userData.rig;
    r.upper.rotation.x = r.hunch;
    r.head.rotation.x = r.headTilt;
    r.head.rotation.y = r.look;
    return fig;
  },

  // Breathing, slow head turns, swaying cloth tails, the cape rippling.
  update(fig, role, t) {
    const r = fig.userData.rig;
    const p = r.phase;
    r.upper.rotation.x = r.hunch + Math.sin(t * 1.5 + p) * 0.012;
    r.upper.rotation.z = Math.sin(t * 0.7 + p) * 0.012;
    r.head.rotation.y = r.look + Math.sin(t * 0.45 + p) * 0.2;
    r.head.rotation.x = r.headTilt + Math.sin(t * 0.8 + p) * 0.03;
    const sw = r.swings;
    for (let i = 0; i < sw.length; i++) {
      const s = sw[i];
      s.obj.rotation.x = s.bx + Math.sin(t * s.speed + s.ph) * s.ax;
      s.obj.rotation.z = s.bz + Math.sin(t * s.speed * 0.8 + s.ph + 1.3) * s.az;
    }
    if (role === 'peasant') {
      r.armR.shoulder.rotation.z = 0.2 + Math.sin(t * 0.9 + p) * 0.03;
      r.armL.shoulder.rotation.x = 0.06 + Math.sin(t * 1.1 + p) * 0.05;
    } else if (role === 'priest') {
      r.head.rotation.y *= 0.4;
      r.book.rotation.x = -0.85 + Math.sin(t * 0.8 + p) * 0.04;
    } else if (role === 'cardinal') {
      r.head.rotation.y *= 0.5;
      rippleCape(r.cloak, t);
    }
  },
};
