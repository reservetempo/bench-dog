// Style 03: Rust Scavengers (post-apocalypse, grim).
// Survivors in tarp, canvas and rusted scrap under a smog sky. MeshStandardMaterial
// throughout (rough cloth, rusty pipe, a little brass), goggles and gas masks with round
// filters, olive and khaki tarps, the cardinal in red tarp with a rebar crown.

import * as THREE from 'three';
import {
  torch, embers, blobShadow, lathe, raggedHem, jitter, mergeMeshes, pointIn, eyePair,
  canvasTexture, gradientBackground, rng,
} from '../kit.js';

const HIP = 0.47;      // upper body pivots here
const NECK = 0.8;      // head pivots here
const HEAD_Y = 0.875;  // head centre
const HEAD_R = 0.07;
const DS = THREE.DoubleSide;

// ---------------------------------------------------------------- textures

function blot(ctx, r, w, h, n, color, min, max) {
  for (let i = 0; i < n; i++) {
    const s = min + r() * (max - min);
    ctx.fillStyle = typeof color === 'function' ? color() : color;
    ctx.beginPath();
    ctx.ellipse(r() * w, r() * h, s, s * (0.35 + r() * 0.8), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Greyish grime: stains and specks, multiplied with each material's colour.
const grimeTex = canvasTexture(128, 128, (ctx, w, h) => {
  const r = rng(11);
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, w, h);
  blot(ctx, r, w, h, 90, () => `rgba(${45 + r() * 30 | 0},${34 + r() * 20 | 0},22,${0.06 + r() * 0.16})`, 2, 13);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.14)';
    ctx.fillRect(r() * w | 0, r() * h | 0, 1, 1);
  }
}, { repeat: [2, 2] });

// Tarp and canvas: coarse weave, stains and a stitched seam.
const tarpTex = canvasTexture(128, 128, (ctx, w, h) => {
  const r = rng(23);
  ctx.fillStyle = '#e2e2e2'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
  blot(ctx, r, w, h, 16, () => `rgba(48,38,22,${0.08 + r() * 0.16})`, 6, 24);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, h * 0.56, w, 4);
  ctx.strokeStyle = 'rgba(245,235,205,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(0, h * 0.56 + 8); ctx.lineTo(w, h * 0.56 + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.7, 0); ctx.lineTo(w * 0.7, h * 0.56); ctx.stroke();
}, { repeat: [3, 1] });

// Rust: orange-brown base with dark pits, bright flakes and bare grey metal.
const rustTex = canvasTexture(128, 128, (ctx, w, h) => {
  const r = rng(5);
  ctx.fillStyle = '#7b4528'; ctx.fillRect(0, 0, w, h);
  const cols = ['#43261a', '#9c5629', '#bf6d2e', '#5d5852', '#2f1c12', '#86624a'];
  ctx.globalAlpha = 0.6;
  blot(ctx, r, w, h, 230, () => cols[r() * cols.length | 0], 1, 7);
  ctx.globalAlpha = 1;
}, { repeat: [1, 3] });

// ---------------------------------------------------------------- materials

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
const M = {
  skin: std(0x9c7a62, { map: grimeTex, roughness: 0.75 }),
  pale: std(0xb4a496, { map: grimeTex, roughness: 0.7 }),
  olive: std(0x5d6335, { map: tarpTex, flatShading: true, side: DS }),
  khaki: std(0x857452, { map: grimeTex }),
  khakiDark: std(0x4c4433, { map: grimeTex }),
  habit: std(0x614d3a, { map: tarpTex }),
  habitDS: std(0x614d3a, { map: tarpTex, flatShading: true, side: DS }),
  oil: std(0x1c1b1d, { map: grimeTex, roughness: 0.45, metalness: 0.2 }),
  oilDS: std(0x1c1b1d, { map: grimeTex, roughness: 0.5, metalness: 0.2, side: DS }),
  white: std(0xd2cab5, { map: grimeTex, roughness: 0.85 }),
  red: std(0x97231a, { map: tarpTex, roughness: 0.6, flatShading: true, side: DS }),
  redDark: std(0x58170f, { map: tarpTex }),
  rubber: std(0x262624, { roughness: 0.55 }),
  leather: std(0x3c2b1e, { map: grimeTex, roughness: 0.7 }),
  rust: std(0xffffff, { map: rustTex, roughness: 0.85, metalness: 0.3 }),
  steel: std(0x7a7c7c, { map: grimeTex, roughness: 0.38, metalness: 0.7 }),
  drab: std(0x4c5230, { map: grimeTex, roughness: 0.55, metalness: 0.35 }),
  brass: std(0xd29b3e, { map: grimeTex, roughness: 0.35, metalness: 0.65, emissive: 0x2e1a00 }),
  glass: std(0x15211d, { roughness: 0.1, metalness: 0.5, emissive: 0x1f2c15 }),
  rope: std(0x988357),
  rag: std(0x3a2d23, { map: grimeTex }),
  scarf: std(0x56605e, { map: tarpTex }),
  capRed: std(0xb0281c, { roughness: 0.3, metalness: 0.6 }),
  visor: std(0x2c322d, { map: grimeTex, roughness: 0.5, metalness: 0.45 }),
  visorDS: std(0x2c322d, { map: grimeTex, roughness: 0.5, metalness: 0.45, side: DS }),
  weld: new THREE.MeshBasicMaterial({ color: 0xb6d86a }),
  coal: new THREE.MeshBasicMaterial({ color: 0xff7a26 }),
  ink: new THREE.MeshBasicMaterial({ color: 0x0d0b09 }),
};

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

const sphere = (r, w = 12, h = 10) => geo(`s${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
// Cylinder hanging down from its origin (limbs, cords).
const limbGeo = (len, r0, r1, seg = 8) => geo(`l${len}:${r0}:${r1}:${seg}`,
  () => new THREE.CylinderGeometry(r0, r1, len, seg, 1).translate(0, -len / 2, 0));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (rt, rb, h, seg = 10) => geo(`c${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
// Cylinder whose axis points along +z (lenses, filters, caps facing out).
const disc = (r, h, seg = 12) => geo(`d${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2));
const ring = (r, tube, rs = 5, ts = 14) => geo(`t${r}:${tube}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, tube, rs, ts));
const flatRing = (r, tube, rs = 5, ts = 16) => geo(`f${r}:${tube}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, tube, rs, ts).rotateX(Math.PI / 2));
// Sphere shell with an opening at the front (hoods, coifs).
const shell = (r, open, thetaEnd, w = 14, h = 9) => geo(`h${r}:${open}:${thetaEnd}`,
  () => new THREE.SphereGeometry(r, w, h, Math.PI / 2 + open / 2, Math.PI * 2 - open, 0, thetaEnd));
const peakGeo = () => geo('peak', () => new THREE.ConeGeometry(0.045, 0.1, 6));
const ragTailGeo = () => geo('ragtail', () => new THREE.ConeGeometry(0.016, 0.08, 5).translate(0, -0.04, 0));
const strapGeo = () => geo('bedstrap', () => new THREE.TorusGeometry(0.045, 0.006, 4, 10).rotateY(Math.PI / 2));
const capXGeo = () => geo('capx', () => new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8).rotateZ(Math.PI / 2));
// Crumpled tarp: a lathe with a ragged hem and jittered vertices (flat-shaded material).
function tarpLathe(points, segs, theta, hem, seed) {
  const g = lathe(points, segs, theta);
  if (hem) raggedHem(g, hem, seed);
  return jitter(g, 0.008, seed);
}

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

// Place `m` at distance d from (x, y, z) along a direction turned `yaw` from +z, facing out.
function along(m, x, y, z, yaw, d, pitch = 0) {
  m.position.set(x + Math.sin(yaw) * Math.cos(pitch) * d, y + Math.sin(pitch) * d, z + Math.cos(yaw) * Math.cos(pitch) * d);
  m.rotation.set(-pitch, yaw, 0, 'YXZ');
  return m;
}

// Radius of a lathe profile at height y (to put buttons and patches on its surface).
function radiusAt(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return profile[y < profile[0][1] ? 0 : profile.length - 1][0];
}

function pivot(parent, y) {
  const p = new THREE.Group();
  p.position.y = y;
  const inner = new THREE.Group();
  inner.position.y = -y;
  p.add(inner);
  parent.add(p);
  return [p, inner];
}

function standUpright(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

// Arm with shoulder and elbow pivots; `grip` is where the hand holds things.
function arm(parent, side, { sleeve, hand = M.rubber, upper = 0.19, fore = 0.165, r = 0.026, cuff = 0.031 }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.115, 0.745, 0);
  shoulder.add(part(sphere(r * 1.25, 7, 5), sleeve));
  shoulder.add(part(limbGeo(upper, r, r * 0.92), sleeve));
  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  elbow.add(part(sphere(r * 0.95, 7, 5), sleeve));
  elbow.add(part(limbGeo(fore, r * 0.9, cuff), sleeve));
  const h = part(sphere(0.023, 7, 5), hand, 0, -fore - 0.016, 0);
  h.scale.set(1, 1.15, 0.85);
  elbow.add(h);
  const grip = new THREE.Object3D();
  grip.position.y = -fore - 0.018;
  elbow.add(grip);
  parent.add(shoulder);
  return { shoulder, elbow, grip };
}

// Shared body: robe (static), upper body pivoting at the hip, head pivoting at the neck.
function body({ robe, robeMat, hem = 0, seed = 1, torso, torsoMat, skin = M.skin }) {
  const root = new THREE.Group();
  if (robe) {
    const g = lathe(robe, 14);
    if (hem) raggedHem(g, hem, seed);
    root.add(part(g, robeMat));
  }
  const [upper, U] = pivot(root, HIP);
  U.add(part(lathe(torso, 14), torsoMat));
  U.add(part(limbGeo(0.07, 0.027, 0.031), skin, 0, NECK + 0.03, 0.004));
  const [head, H] = pivot(U, NECK);
  const skull = part(sphere(HEAD_R, 12, 9), skin, 0, HEAD_Y, 0.008);
  skull.scale.set(0.94, 1.1, 1);
  H.add(skull);
  root.add(blobShadow({ radius: 0.3, opacity: 0.55 }));
  return { root, upper, U, head, H };
}

// Boots: full boots with shafts, or just toes peeking from under a robe.
function boots(root, mat, peek) {
  const ps = [];
  for (const s of [-1, 1]) {
    if (!peek) ps.push(part(cyl(0.035, 0.037, 0.12, 8), mat, s * 0.05, 0.065, 0));
    const toe = part(sphere(0.037, 8, 6), mat, s * 0.052, 0.027, peek ? 0.105 : 0.025);
    toe.scale.set(0.95, 0.72, 1.5);
    ps.push(toe, part(box(0.068, 0.014, 0.12), M.rubber, s * 0.052, 0.007, peek ? 0.1 : 0.022));
  }
  root.add(mergeMeshes(ps));
}

// ---------------------------------------------------------------- props

function goggles() {
  const ps = [part(geo('strap', () => new THREE.TorusGeometry(0.077, 0.006, 3, 16).rotateX(Math.PI / 2)), M.rubber, 0, HEAD_Y + 0.014, 0.006)];
  ps[0].scale.set(0.97, 1, 1.07);
  for (const s of [-1, 1]) {
    const x = s * 0.029, y = HEAD_Y + 0.014, z = 0.062, yaw = s * 0.3;
    ps.push(along(part(disc(0.023, 0.026, 10), M.rubber), x, y, z, yaw, 0.008));
    ps.push(along(part(ring(0.021, 0.0055, 4, 12), M.brass), x, y, z, yaw, 0.022));
    ps.push(along(part(disc(0.0175, 0.004, 12), M.glass), x, y, z, yaw, 0.022));
  }
  ps.push(part(box(0.016, 0.008, 0.008), M.brass, 0, HEAD_Y + 0.014, 0.08));
  return mergeMeshes(ps);
}

// Gas mask: rubber face piece, two eyepieces and a round filter on the snout.
function gasMask() {
  const ps = [];
  const face = part(geo('maskface', () => new THREE.SphereGeometry(0.079, 14, 8, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.26, Math.PI * 0.52)), M.rubber, 0, HEAD_Y, 0.008);
  face.scale.set(0.97, 1.1, 1.07);
  ps.push(face);
  for (const s of [-1, 1]) {
    const x = s * 0.029, y = HEAD_Y + 0.016, z = 0.06, yaw = s * 0.32;
    ps.push(along(part(ring(0.02, 0.0065, 4, 12), M.steel), x, y, z, yaw, 0.028));
    ps.push(along(part(disc(0.017, 0.006, 12), M.glass), x, y, z, yaw, 0.026));
  }
  ps.push(along(part(geo('snout', () => new THREE.CylinderGeometry(0.02, 0.028, 0.04, 10).rotateX(Math.PI / 2)), M.rubber), 0, HEAD_Y - 0.036, 0.06, 0, 0.026, -0.55));
  const filter = [
    along(part(disc(0.036, 0.042, 14), M.drab), 0, HEAD_Y - 0.036, 0.06, 0, 0.066, -0.55),
    along(part(ring(0.036, 0.004, 3, 14), M.steel), 0, HEAD_Y - 0.036, 0.06, 0, 0.058, -0.55),
    along(part(ring(0.036, 0.004, 3, 14), M.steel), 0, HEAD_Y - 0.036, 0.06, 0, 0.076, -0.55),
    along(part(disc(0.026, 0.004, 12), M.ink), 0, HEAD_Y - 0.036, 0.06, 0, 0.088, -0.55),
    along(part(disc(0.008, 0.006, 8), M.steel), 0, HEAD_Y - 0.036, 0.06, 0, 0.089, -0.55),
  ];
  return { mask: mergeMeshes(ps), filter: mergeMeshes(filter) };
}

// Pipe-and-rag torch: kit torch with a rusty pipe handle, couplers and wire binding.
function pipeTorch() {
  const L = 0.36;
  const t = torch({ handleMaterial: M.rust, wrapMaterial: M.rag, length: L, radius: 0.017, flameSize: 1.2, intensity: 1.6, distance: 3, decay: 1.2 });
  const top = L * 0.62;
  const ps = [
    part(cyl(0.024, 0.024, 0.03, 10), M.steel, 0, top - L + 0.012, 0),
    part(cyl(0.022, 0.022, 0.026, 10), M.rust, 0, top - L * 0.48, 0),
    part(ring(0.036, 0.0035, 3, 10), M.steel, 0, top - L * 0.12, 0),
    part(ring(0.035, 0.0035, 3, 10), M.steel, 0, top - L * 0.02, 0),
  ];
  ps[2].rotation.x = Math.PI / 2;
  ps[3].rotation.x = Math.PI / 2;
  const tail = part(ragTailGeo(), M.rag, 0.03, top - L * 0.14, 0.012);
  tail.rotation.z = 0.35;
  const tail2 = part(ragTailGeo(), M.rag, -0.024, top - L * 0.16, -0.02);
  tail2.rotation.set(0.3, 0, -0.25);
  t.add(mergeMeshes([...ps, tail, tail2]));
  return t;
}

// Loop of bottle caps (red, steel, brass) with a nail cross, hanging from (0, 0, 0).
function capRosary() {
  const mats = [M.capRed, M.steel, M.brass];
  const capGeo = geo('cap', () => new THREE.CylinderGeometry(0.0125, 0.0125, 0.005, 8).rotateX(Math.PI / 2));
  const ps = [];
  const n = 13;
  for (let k = 0; k <= n; k++) {
    const a = (Math.PI * k) / n;
    const c = part(capGeo, mats[k % 3], 0.042 * Math.cos(a), -0.13 * Math.sin(a), 0.012 * Math.sin(a));
    c.rotation.z = k * 0.7;
    ps.push(c);
  }
  for (let k = 1; k <= 2; k++) ps.push(part(capGeo, mats[(k + 1) % 3], 0, -0.13 - k * 0.026, 0.014));
  const nail = (len) => geo(`nail${len}`, () => new THREE.CylinderGeometry(0.0035, 0.0035, len, 5));
  ps.push(part(nail(0.075), M.steel, 0, -0.218, 0.016));
  const bar = part(nail(0.05), M.steel, 0, -0.2, 0.018);
  bar.rotation.z = Math.PI / 2;
  ps.push(bar, part(cyl(0.007, 0.007, 0.004, 6), M.steel, 0, -0.18, 0.016));
  const g = new THREE.Group();
  g.add(mergeMeshes(ps));
  return g;
}

// Scrap censer: tin can with glowing slits and a cone lid on a chain. Returns the
// chain pivot (hangs along -y from its origin) and the smoke source.
function censer() {
  const pivotG = new THREE.Group();
  const L = 0.16, n = 9;
  const link = geo('link', () => new THREE.TorusGeometry(0.0078, 0.0022, 3, 6));
  const ps = [];
  for (let k = 0; k < n; k++) {
    const l = part(link, M.steel, 0, -((k + 0.5) * L) / n, 0);
    l.rotation.y = k % 2 ? Math.PI / 2 : 0;
    ps.push(l);
  }
  const y0 = -L - 0.004;
  ps.push(
    part(ring(0.008, 0.0025, 4, 8), M.steel, 0, y0, 0),
    part(geo('lid', () => new THREE.ConeGeometry(0.041, 0.04, 12, 1, true)), M.steel, 0, y0 - 0.026, 0),
    part(cyl(0.038, 0.038, 0.052, 12), M.rust, 0, y0 - 0.072, 0),
    part(flatRing(0.039, 0.004, 4, 14), M.steel, 0, y0 - 0.048, 0),
    part(flatRing(0.039, 0.004, 4, 14), M.steel, 0, y0 - 0.097, 0),
    part(cyl(0.02, 0.026, 0.016, 10), M.rust, 0, y0 - 0.106, 0),
  );
  for (const a of [0, 1.3, -1.3, 2.6, -2.6]) {
    const s = part(box(0.008, 0.03, 0.006), M.coal, Math.sin(a) * 0.037, y0 - 0.072, Math.cos(a) * 0.037);
    s.rotation.y = a;
    ps.push(s);
  }
  pivotG.add(mergeMeshes(ps));
  const tip = new THREE.Object3D();
  tip.position.y = y0 - 0.01;
  pivotG.add(tip);
  return { pivot: pivotG, tip };
}

// Crown of rebar: a ring with rods of different heights, two bent at the tip.
function rebarCrown() {
  const ps = [part(flatRing(0.074, 0.0085, 5, 16), M.rust), part(flatRing(0.077, 0.003, 4, 18), M.steel, 0, 0.022, 0)];
  const rods = [[0, 0.17], [0.8, 0.12], [-0.8, 0.13], [1.6, 0.1], [-1.6, 0.11], [2.4, 0.13], [-2.4, 0.12], [Math.PI, 0.09]];
  const up = new THREE.Vector3();
  for (const [a, h] of rods) {
    const rod = part(geo(`rod${h}`, () => new THREE.CylinderGeometry(0.0065, 0.0075, h, 6).translate(0, h / 2, 0)), M.rust,
      Math.sin(a) * 0.074, -0.01, Math.cos(a) * 0.074);
    rod.rotation.set(0.24, a, 0, 'YXZ');
    ps.push(rod);
    if (Math.abs(a) === 0.8 || Math.abs(a) === 2.4) {
      up.set(0, h, 0).applyEuler(rod.rotation).add(rod.position);
      const tip = part(geo('rodtip', () => new THREE.CylinderGeometry(0.006, 0.0065, 0.05, 6).translate(0, 0.025, 0)), M.rust, up.x, up.y, up.z);
      tip.rotation.set(1.1, a + (a > 0 ? 0.6 : -0.6), 0, 'YXZ');
      ps.push(tip);
    }
  }
  return mergeMeshes(ps);
}

// ---------------------------------------------------------------- roles

function peasant() {
  const b = body({
    torso: [[0.112, 0.42], [0.12, 0.58], [0.123, 0.68], [0.1, 0.745], [0.06, 0.785], [0.03, 0.8]], torsoMat: M.khaki,
  });
  const { root, U, H } = b;
  // Legs in dark canvas, rag wraps on the shins, boots.
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = part(limbGeo(0.36, 0.045, 0.036), M.khakiDark, s * 0.053, 0.46, 0);
    leg.rotation.z = s * 0.03;
    legs.push(leg, part(flatRing(0.04, 0.009, 3, 8), M.rag, s * 0.055, 0.15, 0), part(flatRing(0.041, 0.009, 3, 8), M.rag, s * 0.055, 0.19, 0));
  }
  root.add(mergeMeshes(legs));
  boots(root, M.leather, false);
  // Tarp poncho with hood, a bedroll strapped across the back.
  const poncho = new THREE.Group();
  poncho.add(part(tarpLathe([[0.24, 0.33], [0.228, 0.45], [0.204, 0.58], [0.178, 0.68], [0.156, 0.74], [0.112, 0.785], [0.062, 0.806], [0.036, 0.812]], 10, Math.PI * 2, 0.05, 4), M.olive));
  U.add(poncho);
  const bed = mergeMeshes([
    part(geo('bedroll', () => new THREE.CylinderGeometry(0.042, 0.042, 0.27, 9).rotateZ(Math.PI / 2)), M.khaki, 0, 0.705, -0.172),
    part(strapGeo(), M.leather, -0.07, 0.705, -0.172),
    part(strapGeo(), M.leather, 0.07, 0.705, -0.172),
  ]);
  U.add(bed);
  const hood = part(shell(0.094, 1.9, Math.PI * 0.78), M.olive, 0, HEAD_Y + 0.012, -0.006);
  hood.scale.set(1, 1.12, 1.1);
  H.add(hood);
  const peak = part(peakGeo(), M.olive, 0, HEAD_Y + 0.06, -0.075);
  peak.rotation.x = -1.25;
  H.add(peak);
  // Scarf over the lower face, goggles over the eyes.
  const scarf = part(geo('scarf', () => new THREE.SphereGeometry(0.08, 14, 6, 0, Math.PI * 2, Math.PI * 0.53, Math.PI * 0.42)), M.scarf, 0, HEAD_Y, 0.008);
  scarf.scale.set(0.98, 1.08, 1.08);
  H.add(scarf, goggles());
  // Left arm hangs; right arm holds the pipe torch up.
  const armL = arm(U, -1, { sleeve: M.khaki, hand: M.skin });
  armL.shoulder.rotation.set(0.1, 0, -0.12);
  armL.elbow.rotation.x = -0.3;
  const armR = arm(U, 1, { sleeve: M.khaki, hand: M.skin, fore: 0.16 });
  armR.shoulder.rotation.set(-0.4, 0, 0.32);
  armR.elbow.rotation.x = -1.5;
  const t = pipeTorch();
  armR.grip.add(t);
  standUpright(root, t, 0.12, -0.14);
  root.add(embers({ source: t.userData.flameTip, count: 10, rise: 0.5, spread: 0.06, size: 0.028 }));
  root.userData.rig = { ...b, armL, armR, poncho, hunch: 0.1, headTilt: 0.05, phase: 0.4 };
  return root;
}

function monk() {
  const robe = [[0.205, 0.0], [0.198, 0.025], [0.172, 0.16], [0.148, 0.33], [0.134, 0.5]];
  const b = body({
    robe, robeMat: M.habit, hem: 0.03, seed: 6,
    torso: [[0.134, 0.44], [0.138, 0.6], [0.135, 0.69], [0.112, 0.75], [0.07, 0.79], [0.035, 0.81]], torsoMat: M.habit,
  });
  const { root, U, H } = b;
  boots(root, M.rubber, true);
  // Olive tarp patches sewn on the habit.
  const patches = [];
  for (const [a, y, w, h] of [[-0.5, 0.22, 0.07, 0.06], [0.9, 0.36, 0.05, 0.07]]) {
    const p = part(box(w, h, 0.006), M.olive, Math.sin(a) * radiusAt(robe, y), y, Math.cos(a) * radiusAt(robe, y));
    p.rotation.set(-0.12, a, a * 0.2, 'YXZ');
    patches.push(p);
  }
  root.add(mergeMeshes(patches));
  // Shoulder cowl and hood up over the gas mask.
  U.add(part(tarpLathe([[0.172, 0.59], [0.168, 0.66], [0.152, 0.725], [0.108, 0.78], [0.052, 0.812]], 12, Math.PI * 2, 0.025, 8), M.habitDS));
  const hood = part(shell(0.099, 1.6, Math.PI * 0.82), M.habitDS, 0, HEAD_Y + 0.012, -0.006);
  hood.scale.set(1, 1.12, 1.1);
  H.add(hood);
  const peak = part(peakGeo(), M.habit, 0, HEAD_Y + 0.07, -0.08);
  peak.rotation.x = -1.15;
  H.add(peak);
  const { mask, filter } = gasMask();
  H.add(mask, filter);
  // Rope belt with knotted ends.
  root.add(mergeMeshes([
    part(flatRing(0.137, 0.011, 4, 14), M.rope, 0, 0.47, 0),
    part(limbGeo(0.2, 0.007, 0.007, 5), M.rope, -0.05, 0.47, 0.133),
    part(limbGeo(0.15, 0.007, 0.007, 5), M.rope, -0.028, 0.47, 0.137),
    part(sphere(0.014, 6, 5), M.rope, -0.05, 0.27, 0.138),
    part(sphere(0.014, 6, 5), M.rope, -0.028, 0.32, 0.142),
  ]));
  // Both hands at the chest holding the bottle-cap rosary.
  const armL = arm(U, -1, { sleeve: M.habit, upper: 0.18, fore: 0.15, r: 0.03, cuff: 0.042 });
  const armR = arm(U, 1, { sleeve: M.habit, upper: 0.18, fore: 0.15, r: 0.03, cuff: 0.042 });
  armL.shoulder.rotation.set(-0.25, 0, 0.32);
  armR.shoulder.rotation.set(-0.25, 0, -0.32);
  armL.elbow.rotation.x = -1.25;
  armR.elbow.rotation.x = -1.25;
  const rosary = capRosary();
  const hands = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  rosary.position.set(0, hands.y + 0.004, hands.z + 0.014);
  U.add(rosary);
  root.userData.rig = { ...b, armL, armR, rosary, filter, hunch: 0.14, headTilt: 0.2, phase: 1.9 };
  return root;
}

function priest() {
  const robe = [[0.17, 0.0], [0.164, 0.025], [0.148, 0.25], [0.13, 0.5]];
  const torso = [[0.128, 0.44], [0.132, 0.6], [0.13, 0.69], [0.107, 0.75], [0.06, 0.785], [0.033, 0.8]];
  const b = body({ robe, robeMat: M.oil, torso, torsoMat: M.oil, hem: 0.012, seed: 9 });
  const { root, U, H } = b;
  boots(root, M.rubber, true);
  // Hex nuts for buttons, white stole, collar band with a tab.
  const nut = disc(0.0085, 0.005, 6);
  const low = [], up = [];
  for (const y of [0.72, 0.65, 0.58, 0.51]) up.push(part(nut, M.steel, 0, y, radiusAt(torso, y) + 0.002));
  for (const y of [0.41, 0.32, 0.23, 0.14, 0.05]) low.push(part(nut, M.steel, 0, y, radiusAt(robe, y) + 0.002));
  for (const s of [-1, 1]) {
    const a = part(box(0.026, 0.3, 0.008), M.white, s * 0.04, 0.625, 0.127);
    a.rotation.x = -0.16;
    up.push(a);
    const c = part(box(0.026, 0.25, 0.008), M.white, s * 0.044, 0.385, 0.142);
    c.rotation.x = -0.1;
    low.push(c, part(box(0.03, 0.012, 0.01), M.rust, s * 0.044, 0.27, 0.152));
  }
  up.push(part(cyl(0.038, 0.042, 0.026, 12), M.white, 0, NECK - 0.012, 0.003), part(box(0.018, 0.02, 0.008), M.white, 0, NECK - 0.016, 0.044));
  U.add(mergeMeshes(up));
  root.add(mergeMeshes(low));
  // Black coif under a welding helmet with a cross cut into the visor.
  const coif = part(shell(0.078, 1.5, Math.PI * 0.86), M.oilDS, 0, HEAD_Y + 0.002, 0.002);
  coif.scale.set(0.98, 1.1, 1.05);
  const dome = part(geo('dome', () => new THREE.SphereGeometry(0.088, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)), M.visor, 0, HEAD_Y + 0.004, 0.002);
  dome.scale.set(0.98, 1.06, 1.1);
  const helmet = [coif, dome];
  for (const s of [-1, 1]) {
    const hub = part(geo('hub', () => new THREE.CylinderGeometry(0.02, 0.02, 0.014, 10).rotateZ(Math.PI / 2)), M.steel, s * 0.096, HEAD_Y + 0.01, 0.002);
    helmet.push(hub, part(geo('bolt', () => new THREE.CylinderGeometry(0.007, 0.007, 0.02, 6).rotateZ(Math.PI / 2)), M.brass, s * 0.098, HEAD_Y + 0.01, 0.002));
  }
  H.add(mergeMeshes(helmet));
  // Visor plate tilted chin-out; the glowing cross window sits on its surface.
  const visor = new THREE.Group();
  visor.position.set(0, HEAD_Y - 0.002, 0.004);
  visor.rotation.x = -0.1;
  visor.add(part(geo('plate', () => new THREE.CylinderGeometry(0.096, 0.104, 0.155, 12, 1, true, -1.05, 2.1)), M.visorDS));
  visor.add(mergeMeshes([
    part(box(0.017, 0.074, 0.01), M.weld, 0, 0.006, 0.1),
    part(box(0.066, 0.017, 0.01), M.weld, 0, 0.02, 0.098),
  ]));
  H.add(visor);
  // Right hand swings the censer on its chain; left hand holds a scrap-bound book.
  const armR = arm(U, 1, { sleeve: M.oil, upper: 0.18, fore: 0.16 });
  armR.shoulder.rotation.set(-0.42, 0, 0.14);
  armR.elbow.rotation.x = -0.95;
  const { pivot: chain, tip } = censer();
  armR.grip.add(chain);
  standUpright(root, chain);
  const armL = arm(U, -1, { sleeve: M.oil, upper: 0.18, fore: 0.15 });
  armL.shoulder.rotation.set(-0.2, 0, 0.3);
  armL.elbow.rotation.x = -1.3;
  const g = pointIn(root, armL.grip);
  const book = mergeMeshes([
    part(box(0.085, 0.105, 0.026), M.leather, 0, 0, 0),
    part(box(0.074, 0.095, 0.028), M.white, 0.006, 0, 0),
    part(box(0.016, 0.016, 0.03), M.steel, -0.036, 0.046, 0),
    part(box(0.016, 0.016, 0.03), M.steel, -0.036, -0.046, 0),
  ]);
  book.position.set(g.x + 0.02, g.y + 0.03, g.z - 0.012);
  book.rotation.set(-0.15, 0.5, 0.1);
  U.add(book);
  root.add(embers({ source: tip, count: 12, color: 0x6e6a5c, size: 0.085, rise: 0.48, spread: 0.05, speed: 0.26 }));
  root.userData.rig = { ...b, armL, armR, chain, chainRest: chain.quaternion.clone(), hunch: 0.07, headTilt: 0.12, phase: 3.2 };
  return root;
}

function cardinal() {
  const b = body({
    robe: [[0.176, 0.0], [0.168, 0.025], [0.152, 0.25], [0.132, 0.5]], robeMat: M.redDark, hem: 0.012, seed: 2,
    torso: [[0.13, 0.44], [0.134, 0.6], [0.132, 0.69], [0.109, 0.75], [0.06, 0.785], [0.033, 0.8]], torsoMat: M.redDark, skin: M.pale,
  });
  const { root, U, H } = b;
  boots(root, M.rubber, true);
  // Long red tarp cape open at the front, a shoulder mantle with grommets over it.
  const cape = new THREE.Group();
  cape.add(part(tarpLathe([[0.24, 0.04], [0.218, 0.25], [0.19, 0.45], [0.168, 0.6], [0.153, 0.68], [0.13, 0.745], [0.088, 0.78], [0.046, 0.8]], 14, Math.PI * 1.5, 0.05, 12), M.red));
  U.add(cape);
  const mantle = [part(tarpLathe([[0.184, 0.585], [0.176, 0.64], [0.148, 0.72], [0.106, 0.77], [0.05, 0.805]], 12, Math.PI * 2, 0.03, 3), M.red)];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const gr = part(ring(0.0085, 0.003, 3, 6), M.steel, Math.sin(a) * 0.188, 0.615, Math.cos(a) * 0.188);
    gr.rotation.y = a;
    mantle.push(gr);
  }
  // Brass cog on a chain as a pectoral.
  const cog = [part(disc(0.026, 0.008, 12), M.brass, 0, 0.64, 0.17), part(disc(0.009, 0.01, 8), M.ink, 0, 0.64, 0.172)];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tooth = part(box(0.011, 0.011, 0.008), M.brass, Math.sin(a) * 0.029, 0.64 + Math.cos(a) * 0.029, 0.17);
    tooth.rotation.z = -a;
    cog.push(tooth);
  }
  for (const s of [-1, 1]) {
    const c = part(limbGeo(0.13, 0.003, 0.003, 4), M.steel, s * 0.05, 0.775, 0.1);
    c.rotation.set(-0.45, 0, s * 0.42);
    cog.push(c);
  }
  U.add(mergeMeshes([...mantle, ...cog]));
  // Gaunt face: beady eyes, brass respirator with two round filters, crown of rebar.
  const eyes = eyePair(null, { yaw: 0.36, pitch: 0.13, dot: { headRadius: HEAD_R + 0.003, size: 0.009, color: 0x0d0b09 } });
  eyes.position.set(0, HEAD_Y, 0.008);
  H.add(eyes);
  const resp = [part(geo('resp', () => new THREE.SphereGeometry(0.08, 14, 6, Math.PI / 2 - 1.0, 2.0, Math.PI * 0.5, Math.PI * 0.3)), M.brass, 0, HEAD_Y + 0.002, 0.008)];
  resp[0].scale.set(0.98, 1.1, 1.08);
  for (const s of [-1, 1]) {
    resp.push(along(part(disc(0.026, 0.024, 12), M.brass), s * 0.02, HEAD_Y - 0.038, 0.045, s * 0.75, 0.04, -0.2));
    resp.push(along(part(disc(0.019, 0.004, 10), M.ink), s * 0.02, HEAD_Y - 0.038, 0.045, s * 0.75, 0.053, -0.2));
  }
  resp.push(part(box(0.07, 0.008, 0.01), M.ink, 0, HEAD_Y + 0.036, 0.07));
  H.add(mergeMeshes(resp));
  const crown = rebarCrown();
  crown.position.set(0, HEAD_Y + 0.058, 0.004);
  crown.scale.set(0.97, 1, 1.05);
  H.add(crown);
  // Right hand on the pipe staff with a brass cross; left hand half raised.
  const armL = arm(U, -1, { sleeve: M.redDark, upper: 0.19, fore: 0.16 });
  armL.shoulder.rotation.set(-0.15, 0, -0.16);
  armL.elbow.rotation.x = -0.75;
  const armR = arm(U, 1, { sleeve: M.redDark, upper: 0.19, fore: 0.16 });
  armR.shoulder.rotation.set(-0.2, 0, 0.42);
  armR.elbow.rotation.x = -1.05;
  const g = pointIn(root, armR.grip);
  const staff = new THREE.Group();
  staff.position.set(g.x, 0, g.z);
  const pipe = (len, r) => geo(`pipe${len}:${r}`, () => new THREE.CylinderGeometry(r, r, len, 8));
  const bar = part(pipe(0.15, 0.011), M.brass, 0, 1.215, 0);
  bar.rotation.z = Math.PI / 2;
  staff.add(mergeMeshes([
    part(geo('staffpipe', () => new THREE.CylinderGeometry(0.012, 0.013, 1.1, 7).translate(0, 0.55, 0)), M.rust),
    part(cyl(0.019, 0.019, 0.03, 8), M.steel, 0, 0.3, 0),
    part(cyl(0.019, 0.019, 0.03, 8), M.steel, 0, g.y + 0.05, 0),
    part(cyl(0.019, 0.019, 0.034, 8), M.brass, 0, 1.11, 0),
    part(pipe(0.17, 0.011), M.brass, 0, 1.2, 0),
    bar,
    part(box(0.032, 0.032, 0.032), M.brass, 0, 1.215, 0),
    part(cyl(0.016, 0.016, 0.02, 8), M.brass, 0, 1.29, 0),
    part(capXGeo(), M.brass, 0.076, 1.215, 0),
    part(capXGeo(), M.brass, -0.076, 1.215, 0),
  ]));
  root.add(staff);
  root.scale.setScalar(1.07);
  root.userData.rig = { ...b, armL, armR, cape, hunch: -0.02, headTilt: -0.08, phase: 4.6 };
  return root;
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- style

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

export default {
  id: '03-rust-scavengers',
  name: 'Rust Scavengers',
  blurb: 'Gas masks, tarp and rusted scrap under a smog sky.',
  vibe: 'post-apocalypse',
  look: 'grim',
  tileColor: 0x4e4736,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#6f6748'], [0.45, '#494431'], [1, '#181611']], { vignette: 0.55, grain: 0.07 });
    scene.fog = new THREE.Fog(0x4a4532, 6.5, 19);
    scene.add(new THREE.HemisphereLight(0xcbc193, 0x2b241b, 1.75));
    const sun = new THREE.DirectionalLight(0xf2dba2, 2.4);
    sun.position.set(-2.5, 3, 2.5);
    const rim = new THREE.DirectionalLight(0xa8c2b0, 1.7);
    rim.position.set(2.5, 2, -3);
    scene.add(sun, rim);
  },

  build(role) {
    const fig = BUILDERS[role]();
    const r = fig.userData.rig;
    r.upper.rotation.x = r.hunch;
    r.head.rotation.x = r.headTilt;
    return fig;
  },

  // Heavy breathing through masks, wary head turns, props moving.
  update(fig, role, t) {
    const r = fig.userData.rig;
    const p = r.phase;
    const breath = Math.sin(t * 1.5 + p);
    r.upper.rotation.x = r.hunch + breath * 0.016;
    r.upper.rotation.z = Math.sin(t * 0.5 + p) * 0.012;
    r.head.rotation.y = Math.sin(t * 0.37 + p) * 0.3 + Math.sin(t * 1.1 + p) * 0.03;
    r.head.rotation.x = r.headTilt + Math.sin(t * 0.7 + p) * 0.03;
    if (role === 'peasant') {
      r.armR.shoulder.rotation.z = 0.32 + Math.sin(t * 0.9 + p) * 0.03;
      r.armL.shoulder.rotation.x = 0.1 + Math.sin(t * 1.1 + p) * 0.05;
      r.poncho.rotation.y = Math.sin(t * 0.8 + p) * 0.04;
    } else if (role === 'monk') {
      r.filter.position.z = breath * 0.002;
      r.rosary.rotation.z = Math.sin(t * 1.2 + p) * 0.1;
      r.rosary.rotation.x = 0.1 + Math.sin(t * 0.9 + p) * 0.06;
      const bow = Math.max(0, Math.sin(t * 0.3 + p));
      r.upper.rotation.x += bow * bow * bow * 0.14;
    } else if (role === 'priest') {
      const swing = Math.sin(t * 2.1 + p);
      _q.setFromEuler(_e.set(swing * 0.42, 0, swing * 0.08));
      r.chain.quaternion.copy(r.chainRest).multiply(_q);
      r.armR.shoulder.rotation.x = -0.42 - swing * 0.08;
      r.head.rotation.y *= 0.4;
    } else if (role === 'cardinal') {
      r.cape.rotation.y = Math.sin(t * 0.6 + p) * 0.025;
      r.armL.elbow.rotation.x = -0.75 + Math.sin(t * 0.5 + p) * 0.12;
    }
  },
};
