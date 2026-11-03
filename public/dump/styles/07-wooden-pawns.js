// Style 07: Wooden Pawns (unjust architect, cartoony, big painted eyes).
// Lathe-turned board pieces on round weighted bases: varnished wood grain, chipped
// paint, big painted oval eyes, tiny peg arms. Now and then an unseen hand lifts one
// for a little hop or tips it onto its rim, and it rocks back to rest on its base.

import * as THREE from 'three';
import { torch, blobShadow, lathe, mergeMeshes, canvasTexture, gradientBackground, rng, REDUCED_MOTION } from '../kit.js';

const TAU = Math.PI * 2;
const INK = '#21160e';

// ---------------------------------------------------------------- textures

const WOODS = {
  pale: { base: '#d2ae7e', dark: '#93683f', light: '#ecd3a6' },
  mid: { base: '#a26d3d', dark: '#653f20', light: '#c8915a' },
  dark: { base: '#4a2c19', dark: '#1f1109', light: '#70482b' },
};

// Long wavy grain running along the turning axis (u goes around a lathe, v up it).
function drawGrain(ctx, w, h, wood, seed) {
  const r = rng(seed);
  ctx.fillStyle = wood.base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const x = r() * w, bw = w * (0.04 + r() * 0.1);
    ctx.globalAlpha = 0.08 + r() * 0.1;
    ctx.fillStyle = r() < 0.6 ? wood.dark : wood.light;
    ctx.fillRect(x, 0, bw, h);
    if (x + bw > w) ctx.fillRect(x - w, 0, bw, h);
  }
  const n = Math.round(w * 0.2);
  for (let i = 0; i < n; i++) {
    const x0 = r() * w, amp = 1 + r() * w * 0.018, f = ((0.6 + r() * 1.6) * TAU) / h, ph = r() * TAU;
    ctx.globalAlpha = 0.12 + r() * 0.34;
    ctx.strokeStyle = r() < 0.75 ? wood.dark : wood.light;
    ctx.lineWidth = 0.5 + r() * 1.5;
    const offs = [0];
    if (x0 < amp * 1.4 + 3) offs.push(w);
    if (x0 > w - amp * 1.4 - 3) offs.push(-w);
    for (const o of offs) {
      ctx.beginPath();
      for (let y = 0; y <= h; y += 6) {
        const x = x0 + o + Math.sin(y * f + ph) * amp + Math.sin(y * f * 2.7 + ph * 2) * amp * 0.3;
        if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function polyPath(c, pts) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}

// Faint brush strokes around the piece (horizontal on the canvas).
function brush(p, w, h, seed, alpha = 0.07) {
  const r = rng(seed);
  for (let i = 0; i < 60; i++) {
    p.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha * r()})` : `rgba(0,0,0,${alpha * 1.4 * r()})`;
    p.fillRect(r() * w - 20, r() * h, 20 + r() * w * 0.5, 1 + r() * 2);
  }
}

// Grain under a paint layer drawn by paint(p, w, h, r); chips knocked out of the paint
// show the wood. `band` = [v0, v1] crowds extra chips onto a worn rim.
function paintTex(wood, seed, paint, { chips = 14, rim = 10, band = [0, 0.15], size = 1, w = 256, h = 128 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    drawGrain(ctx, w, h, wood, seed);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const p = c.getContext('2d');
    const r = rng(seed * 7 + 1);
    paint(p, w, h, r);
    const blobs = [];
    for (let i = 0; i < chips + rim; i++) {
      const x = r() * w;
      const v = i < chips ? r() : band[0] + r() * (band[1] - band[0]);
      const y = (1 - v) * h;
      const s = (2 + r() * 4.5) * size * (i < chips ? 1 : 1.3);
      const n = 6 + Math.floor(r() * 4), pts = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU + r() * 0.5, rr = s * (0.45 + r() * 0.75);
        pts.push(x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.8);
      }
      blobs.push(pts);
    }
    p.globalCompositeOperation = 'destination-out';
    for (const b of blobs) { polyPath(p, b); p.fill(); }
    ctx.drawImage(c, 0, 0);
    ctx.strokeStyle = 'rgba(28,16,8,0.5)'; ctx.lineWidth = 0.8;
    for (const b of blobs) { polyPath(ctx, b); ctx.stroke(); }
  });
}

const solid = (color, seed) => (p, w, h) => { p.fillStyle = color; p.fillRect(0, 0, w, h); brush(p, w, h, seed); };

function woodTex(wood, seed) {
  return canvasTexture(256, 128, (ctx, w, h) => drawGrain(ctx, w, h, wood, seed), { repeat: [2, 1] });
}

// Gold leaf: slightly mismatched squares, worn through to red bole here and there.
function goldTex() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const r = rng(41);
    ctx.fillStyle = '#d4a548'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = -8; x < w; x += 16) {
        ctx.fillStyle = r() < 0.5 ? `rgba(255,236,170,${0.25 * r()})` : `rgba(110,70,20,${0.3 * r()})`;
        ctx.fillRect(x + ((y / 16) % 2) * 8, y, 16, 16);
      }
    }
    ctx.fillStyle = '#6e2a1a';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2, 0, 0, TAU); ctx.fill(); }
  }, { repeat: [3, 1] });
}

// ---------------------------------------------------------------- painted faces

// Head texture for a sphere: u = 0.25 is the front. P(yaw, pitch) gives canvas pixels
// for an angle toward the figure's left (viewer's right) and up.
function headTex(wood, seed, face) {
  return canvasTexture(768, 384, (ctx, w, h) => {
    drawGrain(ctx, w, h, wood, seed);
    const P = (yaw, pitch) => [(0.25 + yaw / TAU) * w, (0.5 - pitch / Math.PI) * h];
    face(ctx, P, w / TAU, rng(seed + 5));
  });
}

function paintEye(ctx, x, y, rx, ry, { look = [0, 0], pupil = 0.5, lid = 0, low = 0, lidColor = '#a07040' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = '#f2e7cf'; ctx.fill();
  ctx.save(); ctx.clip();
  const px = look[0] * rx * 0.42, py = look[1] * ry * 0.42, pr = rx * pupil;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 1.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath(); ctx.arc(px - pr * 0.36, py - pr * 0.5, pr * 0.33, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pr * 0.38, py + pr * 0.45, pr * 0.13, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = rx * 0.15;
  if (lid > 0) {
    const ly = -ry + 2 * ry * lid;
    ctx.fillStyle = lidColor;
    ctx.beginPath(); ctx.moveTo(-rx - 4, -ry - 4); ctx.lineTo(rx + 4, -ry - 4); ctx.lineTo(rx + 4, ly - ry * 0.1);
    ctx.quadraticCurveTo(0, ly + ry * 0.22, -rx - 4, ly - ry * 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx + 4, ly - ry * 0.1); ctx.quadraticCurveTo(0, ly + ry * 0.22, -rx - 4, ly - ry * 0.1); ctx.stroke();
  }
  if (low > 0) {
    const ly = ry - 2 * ry * low;
    ctx.fillStyle = lidColor;
    ctx.beginPath(); ctx.moveTo(-rx - 4, ry + 4); ctx.lineTo(rx + 4, ry + 4); ctx.lineTo(rx + 4, ly);
    ctx.quadraticCurveTo(0, ly - ry * 0.15, -rx - 4, ly); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = rx * 0.15; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

function stroke(ctx, pts, width, color = INK) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = width; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

function blush(ctx, x, y, rad, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

// Two big oval eyes, brows, mouth, cheeks. brows: 'worried' | 'soft' | 'stern' | 'arched'.
function face(spec) {
  return (ctx, P, k, r) => {
    const rx = 0.265 * k, ry = 0.35 * k;
    const [mx, my] = P(0, -0.42);
    if (spec.cheeks) for (const s of [-1, 1]) { const [cx, cy] = P(s * 0.6, -0.24); blush(ctx, cx, cy, 0.17 * k, spec.cheeks, 0.5); }
    if (spec.dirt) for (let i = 0; i < 5; i++) { const [dx, dy] = P((r() - 0.5) * 1.3, -0.2 - r() * 0.5); blush(ctx, dx, dy, 0.06 * k + r() * 8, '50,36,24', 0.35); }
    for (const s of [-1, 1]) {
      const [ex, ey] = P(s * 0.42, 0.04);
      paintEye(ctx, ex, ey, rx, ry, spec);
      const o = s, i = -s; // outer and inner directions on the canvas
      const b = {
        worried: [ex + o * rx * 0.95, ey - ry * 1.28, ex, ey - ry * 1.62, ex + i * rx * 0.85, ey - ry * 1.72],
        soft: [ex + o * rx * 0.95, ey - ry * 1.22, ex, ey - ry * 1.55, ex + i * rx * 0.85, ey - ry * 1.3],
        stern: [ex + o * rx * 1.05, ey - ry * 1.62, ex, ey - ry * 1.48, ex + i * rx * 0.9, ey - ry * 1.18],
        arched: [ex + o * rx * 1.1, ey - ry * 1.3, ex + o * rx * 0.2, ey - ry * 2.05, ex + i * rx * 0.75, ey - ry * 1.5],
      }[spec.brows];
      stroke(ctx, b, spec.brows === 'arched' ? 0.05 * k : 0.075 * k);
    }
    const m = {
      wobble: [mx - 18, my + 2, mx - 9, my - 4, mx, my + 2, mx + 9, my + 7, mx + 18, my + 1],
      calm: [mx - 13, my, mx, my + 7, mx + 13, my],
      flat: [mx - 17, my + 4, mx - 13, my, mx + 13, my, mx + 17, my + 4],
      smirk: [mx - 18, my + 1, mx + 2, my + 9, mx + 21, my - 7],
    }[spec.mouth];
    stroke(ctx, m, 0.045 * k);
    // A few paint chips on the eyes.
    ctx.fillStyle = spec.wood.base;
    for (let i = 0; i < 3; i++) {
      const s = r() < 0.5 ? -1 : 1, a = r() * TAU;
      const [ex, ey] = P(s * 0.42, 0.04);
      ctx.beginPath(); ctx.ellipse(ex + Math.cos(a) * rx * 0.9, ey + Math.sin(a) * ry * 0.9, 2 + r() * 2.5, 1.5 + r() * 2, a, 0, TAU); ctx.fill();
    }
  };
}

// ---------------------------------------------------------------- materials

const varnish = (map, o = {}) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.24, ...o });
const lacquer = (map, o = {}) => varnish(map, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, ...o });

const darkWood = woodTex(WOODS.dark, 7);
const M = {
  pale: varnish(woodTex(WOODS.pale, 3)),
  mid: varnish(woodTex(WOODS.mid, 5)),
  dark: varnish(darkWood),
  darkShell: varnish(darkWood, { side: THREE.DoubleSide }),
  rags: varnish(paintTex(WOODS.pale, 21, (p, w, h, r) => {
    const top = h * 0.38, hem = h * 0.8;
    p.fillStyle = '#6c4f33';
    p.beginPath(); p.moveTo(0, top); p.lineTo(w, top); p.lineTo(w, hem);
    for (let x = w; x >= 0; x -= 7) p.lineTo(x, hem + (r() < 0.5 ? r() * 11 : -r() * 4));
    p.closePath(); p.fill();
    brush(p, w, h, 22);
    const patches = [[0.44, 0.5, 0.11, 0.14, '#55603d', -0.12], [0.6, 0.31, 0.1, 0.1, '#8a3f28', 0.18],
      [0.12, 0.47, 0.12, 0.16, '#4b4740', 0.06], [0.82, 0.38, 0.1, 0.13, '#8d6c37', -0.15]];
    for (const [u, v, pw, ph, col, rot] of patches) {
      const ww = pw * w, hh = ph * h;
      p.save(); p.translate(u * w, (1 - v) * h); p.rotate(rot);
      p.fillStyle = col; p.fillRect(-ww / 2, -hh / 2, ww, hh);
      p.strokeStyle = INK; p.lineWidth = 1.3; p.setLineDash([3, 3]);
      p.strokeRect(-ww / 2 + 3, -hh / 2 + 3, ww - 6, hh - 6); p.setLineDash([]);
      p.restore();
    }
    p.fillStyle = '#c4a46a'; p.fillRect(0, (1 - 0.417) * h - 3, w, 6); // painted rope belt
    p.fillStyle = 'rgba(20,12,6,0.6)'; p.fillRect(0, (1 - 0.417) * h + 3, w, 1);
  }, { chips: 22, band: [0.62, 0.72] })),
  straw: varnish(paintTex(WOODS.pale, 23, (p, w, h, r) => {
    p.fillStyle = '#b48c3c'; p.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { p.fillStyle = r() < 0.5 ? 'rgba(255,230,160,0.18)' : 'rgba(80,50,10,0.2)'; p.fillRect(0, y, w, 1.5); }
    p.fillStyle = '#4a2a18'; p.fillRect(0, (1 - 0.56) * h, w, 9); // hat band
  }, { chips: 18, band: [0.1, 0.3] })),
  blackBase: varnish(paintTex(WOODS.mid, 31, solid('#19161b', 32), { chips: 10, rim: 16, band: [0.25, 0.6] }), { roughness: 0.42 }),
  priestBody: varnish(paintTex(WOODS.mid, 33, (p, w, h) => {
    solid('#19161b', 34)(p, w, h);
    p.fillStyle = '#ece4d2';
    p.fillRect(w * 0.5 - 4, (1 - 0.75) * h, 8, 0.25 * h);
    p.fillRect(w * 0.5 - 13, (1 - 0.68) * h - 4, 26, 8);
  }, { chips: 16, band: [0, 0.2] }), { roughness: 0.42 }),
  white: varnish(paintTex(WOODS.mid, 35, solid('#ebe3d1', 36), { chips: 10, rim: 4, band: [0.3, 0.6] })),
  redBase: lacquer(paintTex(WOODS.pale, 41, solid('#a0161b', 42), { chips: 4, rim: 14, band: [0.25, 0.6] })),
  red: lacquer(paintTex(WOODS.pale, 43, solid('#a0161b', 44), { chips: 7, rim: 4, band: [0, 0.12] })),
  gold: new THREE.MeshStandardMaterial({ map: goldTex(), metalness: 0.9, roughness: 0.34, emissive: 0x4a3008 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xc0a576, roughness: 0.85 }),
  rag: new THREE.MeshStandardMaterial({ color: 0x2c2119, roughness: 1 }),
  stick: varnish(woodTex(WOODS.mid, 9), { roughness: 0.6 }),
};

const FACES = {
  peasant: { wood: WOODS.pale, look: [0.3, -0.55], pupil: 0.5, brows: 'worried', mouth: 'wobble', cheeks: '196,84,58', dirt: true },
  monk: { wood: WOODS.mid, look: [0, 0.6], pupil: 0.55, lid: 0.55, lidColor: '#8a5a30', brows: 'soft', mouth: 'calm' },
  priest: { wood: WOODS.pale, look: [0, 0.05], pupil: 0.4, lid: 0.22, lidColor: '#b98f5e', brows: 'stern', mouth: 'flat' },
  cardinal: { wood: WOODS.pale, look: [-0.5, 0.3], pupil: 0.5, lid: 0.5, low: 0.14, lidColor: '#c99c68', brows: 'arched', mouth: 'smirk', cheeks: '190,52,52' },
};
const HEADS = {};
for (const [role, spec] of Object.entries(FACES)) HEADS[role] = varnish(headTex(spec.wood, 50 + role.length, face(spec)));

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const ring = (R, tube, y = 0) => geo(`ring${R}:${tube}:${y}`, () => new THREE.TorusGeometry(R, tube, 4, 20).rotateX(Math.PI / 2).translate(0, y, 0));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

// Round weighted base: flat bottom, bevelled rim, a cove up into the body at radius `top`.
const baseProfile = (R, top) => [[0, 0], [R - 0.016, 0], [R, 0.012], [R + 0.004, 0.034], [R - 0.008, 0.056],
  [R - 0.04, 0.07], [R - 0.07, 0.082], [top, 0.098]];

// root (shadow) > tilt (rocks on the rim, hops) > yaw (nudged round by the hand) > parts.
function pawn({ R, top, baseMat, body, bodyMat, headR, headY, role }) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(tilt); tilt.add(yaw);
  yaw.add(part(lathe(baseProfile(R, top), 24), baseMat));
  yaw.add(part(lathe(body, 22), bodyMat));
  const head = part(geo(`head${headR}`, () => new THREE.SphereGeometry(headR, 22, 14)), HEADS[role], 0, headY, 0);
  yaw.add(head);
  const shadow = blobShadow({ radius: R * 1.3, opacity: 0.6 });
  root.add(shadow);
  return { root, tilt, yaw, head, shadow, shadowR: R * 1.3, Rb: R - 0.006 };
}

// Tiny peg arm: a dowel with a ball hand. rotZ swings it out, rotX forward (negative).
function pegArm(parent, side, { mat, x, y, z = 0, rotZ, rotX = 0, len = 0.12 }) {
  const sh = new THREE.Group();
  sh.position.set(side * x, y, z);
  sh.rotation.set(rotX, 0, side * rotZ);
  sh.add(part(geo(`peg${len}`, () => new THREE.CylinderGeometry(0.024, 0.027, len, 10).translate(0, -len / 2, 0)), mat));
  sh.add(part(geo('hand', () => new THREE.SphereGeometry(0.038, 10, 8)), mat, 0, -len - 0.012, 0));
  const grip = new THREE.Object3D();
  grip.position.y = -len - 0.012;
  sh.add(grip);
  parent.add(sh);
  return { sh, grip };
}

// Rotate `obj` (already in the tree) so it stands upright in `root`, then tilt it.
function standUpright(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

// ---------------------------------------------------------------- roles

function peasant() {
  const p = pawn({
    role: 'peasant', R: 0.25, top: 0.17, baseMat: M.pale, bodyMat: M.rags, headR: 0.165, headY: 0.742,
    body: [[0.17, 0.098], [0.178, 0.13], [0.174, 0.2], [0.16, 0.3], [0.143, 0.39], [0.127, 0.46], [0.118, 0.51],
      [0.124, 0.533], [0.138, 0.548], [0.134, 0.568], [0.105, 0.585], [0.05, 0.597], [0, 0.6]],
  });
  const { yaw } = p;
  // Straw hat pushed back on the head.
  const hat = part(lathe([[0.1, 0], [0.232, -0.004], [0.242, 0.008], [0.205, 0.02], [0.13, 0.03], [0.112, 0.06],
    [0.08, 0.1], [0.04, 0.122], [0, 0.128]], 22), M.straw, 0.008, 0.852, -0.012);
  hat.rotation.set(-0.16, 0, -0.13);
  yaw.add(hat);
  pegArm(yaw, -1, { mat: M.pale, x: 0.12, y: 0.47, rotZ: 0.5, rotX: -0.12 });
  const armR = pegArm(yaw, 1, { mat: M.pale, x: 0.118, y: 0.47, z: 0.03, rotZ: 0.95, rotX: -0.55, len: 0.13 });
  const t = torch({ handleMaterial: M.stick, wrapMaterial: M.rag, length: 0.36, flameSize: 1.15, intensity: 1.2, distance: 2.4 });
  armR.grip.add(t);
  standUpright(p.root, t, 0.12, -0.1);
  p.root.userData.rig = { ...p, phase: 2.6, period: 4.7, seed: 1 };
  return p.root;
}

function monk() {
  const p = pawn({
    role: 'monk', R: 0.265, top: 0.195, baseMat: M.dark, bodyMat: M.dark, headR: 0.155, headY: 0.79,
    body: [[0.195, 0.098], [0.205, 0.14], [0.2, 0.22], [0.183, 0.32], [0.163, 0.41], [0.15, 0.47], [0.146, 0.52],
      [0.158, 0.55], [0.17, 0.585], [0.15, 0.625], [0.1, 0.65], [0.04, 0.66], [0, 0.662]],
  });
  const { yaw } = p;
  // Carved hood open at the face, its peak falling back.
  const hood = part(geo('hood', () => new THREE.SphereGeometry(0.183, 22, 12, Math.PI / 2 + 0.95, TAU - 1.9, 0, Math.PI * 0.74)),
    M.darkShell, 0, 0.79, -0.008);
  hood.scale.set(1, 1.07, 1.05);
  yaw.add(hood);
  const peak = part(geo('peak', () => new THREE.ConeGeometry(0.06, 0.15, 12)), M.dark, 0, 0.9, -0.13);
  peak.rotation.x = -1.05;
  yaw.add(peak);
  // Rope belt, knot and two hanging cords.
  yaw.add(mergeMeshes([
    part(ring(0.152, 0.013), M.rope, 0, 0.47, 0),
    part(geo('knot', () => new THREE.SphereGeometry(0.022, 8, 6)), M.rope, 0.05, 0.465, 0.145),
    part(geo('cord', () => new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6)), M.rope, 0.05, 0.37, 0.165),
    part(geo('cord2', () => new THREE.CylinderGeometry(0.008, 0.008, 0.15, 6)), M.rope, 0.075, 0.395, 0.162),
    part(geo('knot2', () => new THREE.SphereGeometry(0.015, 8, 6)), M.rope, 0.05, 0.27, 0.17),
    part(geo('knot2', () => new THREE.SphereGeometry(0.015, 8, 6)), M.rope, 0.075, 0.32, 0.168),
  ]));
  p.root.userData.rig = { ...p, phase: 0.8, period: 6.3, seed: 7 };
  return p.root;
}

function priest() {
  const p = pawn({
    role: 'priest', R: 0.24, top: 0.165, baseMat: M.blackBase, bodyMat: M.priestBody, headR: 0.15, headY: 0.828,
    body: [[0.165, 0.098], [0.17, 0.13], [0.162, 0.2], [0.15, 0.3], [0.135, 0.4], [0.122, 0.5], [0.112, 0.58], [0.11, 0.63]],
  });
  const { yaw } = p;
  // White band (collar) and a black skullcap.
  yaw.add(part(lathe([[0.11, 0.628], [0.122, 0.636], [0.127, 0.66], [0.117, 0.676], [0.07, 0.686], [0, 0.69]], 22), M.white));
  yaw.add(part(geo('cap', () => new THREE.SphereGeometry(0.154, 20, 6, 0, TAU, 0, Math.PI * 0.27)), M.blackBase, 0, 0.828, -0.004));
  yaw.add(part(geo('capnub', () => new THREE.SphereGeometry(0.018, 8, 6)), M.blackBase, 0, 0.98, 0));
  p.root.userData.rig = { ...p, phase: 3.9, period: 5.5, seed: 13 };
  return p.root;
}

function cardinal() {
  const p = pawn({
    role: 'cardinal', R: 0.27, top: 0.19, baseMat: M.redBase, bodyMat: M.red, headR: 0.15, headY: 0.87,
    body: [[0.19, 0.098], [0.196, 0.135], [0.188, 0.24], [0.17, 0.36], [0.15, 0.48], [0.132, 0.58], [0.124, 0.66], [0.12, 0.7]],
  });
  const { yaw } = p;
  // Short cape over the shoulders, gold-leaf rims and collar, pectoral cross.
  yaw.add(part(lathe([[0.188, 0.562], [0.183, 0.6], [0.165, 0.65], [0.136, 0.69], [0.1, 0.712], [0.05, 0.72], [0, 0.722]], 22), M.red));
  yaw.add(mergeMeshes([
    part(ring(0.274, 0.011), M.gold, 0, 0.034, 0),
    part(ring(0.19, 0.009), M.gold, 0, 0.562, 0),
    part(ring(0.078, 0.015), M.gold, 0, 0.724, 0),
    part(box(0.016, 0.075, 0.012), M.gold, 0, 0.47, 0.152),
    part(box(0.05, 0.016, 0.012), M.gold, 0, 0.485, 0.152),
  ]));
  // Galero: wide brim, low crown, gold band, tasselled cords.
  const hat = new THREE.Group();
  hat.position.set(0, 0.975, -0.005);
  hat.rotation.set(-0.08, 0, 0.06);
  hat.add(part(lathe([[0.1, 0], [0.262, -0.004], [0.272, 0.008], [0.245, 0.02], [0.13, 0.03], [0.105, 0.04],
    [0.105, 0.072], [0.09, 0.09], [0.05, 0.1], [0, 0.102]], 24), M.red));
  hat.add(part(ring(0.107, 0.008), M.gold, 0, 0.046, 0));
  const tassels = [];
  for (const s of [-1, 1]) {
    const tg = new THREE.Group();
    tg.position.set(s * 0.205, 0, 0.03);
    const parts = [part(geo('tcord', () => new THREE.CylinderGeometry(0.005, 0.005, 0.2, 5).translate(0, -0.1, 0)), M.red)];
    let row = 0;
    for (const n of [1, 2]) {
      for (let k = 0; k < n; k++) {
        parts.push(part(geo('tassel', () => new THREE.ConeGeometry(0.016, 0.045, 7)), M.red, (k - (n - 1) / 2) * 0.03, -0.215 - row * 0.042, 0));
      }
      row++;
    }
    parts.push(part(geo('tknot', () => new THREE.SphereGeometry(0.012, 8, 6)), M.gold, 0, -0.196, 0));
    tg.add(mergeMeshes(parts));
    hat.add(tg);
    tassels.push(tg);
  }
  yaw.add(hat);
  // Peg arms: the right one holds a tall gold cross-staff.
  pegArm(yaw, -1, { mat: M.red, x: 0.13, y: 0.55, rotZ: 0.42, rotX: -0.1 });
  const armR = pegArm(yaw, 1, { mat: M.red, x: 0.13, y: 0.55, z: 0.02, rotZ: 0.75, rotX: -0.4 });
  p.root.updateMatrixWorld(true);
  const g = new THREE.Vector3();
  armR.grip.getWorldPosition(g);
  yaw.add(mergeMeshes([
    part(geo('staff', () => new THREE.CylinderGeometry(0.011, 0.013, 1.15, 8).translate(0, 0.575, 0)), M.gold, g.x, 0.02, g.z),
    part(geo('staffball', () => new THREE.SphereGeometry(0.024, 10, 8)), M.gold, g.x, 1.12, g.z),
    part(box(0.022, 0.15, 0.022), M.gold, g.x, 1.22, g.z),
    part(box(0.11, 0.022, 0.022), M.gold, g.x, 1.235, g.z),
  ]));
  p.root.userData.rig = { ...p, tassels, phase: 1.7, period: 7.1, seed: 19 };
  return p.root;
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- idle: the unseen hand

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const hash = (n) => { const s = Math.sin(n * 91.345 + 47.853) * 43758.5453; return s - Math.floor(s); };

// Lift, tilt (rotations about x and z, pivoting on the base rim) and yaw.
function pose(r, lift, ax, az, yaw) {
  const R = r.Rb;
  const sx = ax < 0 ? -1 : 1, sz = az < 0 ? -1 : 1;
  r.tilt.rotation.set(ax, 0, az);
  r.tilt.position.set(-sz * R * (1 - Math.cos(az)), lift + R * (Math.abs(Math.sin(ax)) + Math.abs(Math.sin(az))), sx * R * (1 - Math.cos(ax)));
  r.yaw.rotation.y = yaw;
  const s = r.shadowR * (1 - Math.min(0.5, lift * 2.5));
  r.shadow.scale.set(s, 1, s);
  if (r.tassels) for (let i = 0; i < r.tassels.length; i++) { r.tassels[i].rotation.z = -az * 0.9; r.tassels[i].rotation.x = -ax * 0.9; }
}

export default {
  id: '07-wooden-pawns',
  name: 'Wooden Pawns',
  blurb: 'Turned board pieces with painted eyes, nudged about by an unseen hand.',
  vibe: 'unjust architect',
  look: 'cartoony',
  tileColor: 0x4a3626,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#261c14'], [0.55, '#17110d'], [1, '#0b0807']], { vignette: 0.6, grain: 0.04 });
    scene.fog = new THREE.Fog(0x100c09, 9, 26);
    // Dim study: a warm desk lamp, a cold window rim behind, reflections for the varnish.
    const env = canvasTexture(256, 128, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2c2219'); g.addColorStop(0.5, '#17110c'); g.addColorStop(1, '#050403');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const spot = (x, y, rad, col) => {
        const s = ctx.createRadialGradient(x, y, 0, x, y, rad);
        s.addColorStop(0, col); s.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = s; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      };
      spot(0.836 * w, 0.2 * h, 26, 'rgba(255,232,190,1)');
      spot(0.343 * w, 0.34 * h, 30, 'rgba(110,135,190,0.8)');
      spot(0.75 * w, 0.48 * h, 44, 'rgba(120,80,48,0.5)');
    });
    env.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = env;
    scene.environmentIntensity = 0.7;
    scene.add(new THREE.HemisphereLight(0x9c8a72, 0x1c130d, 0.55));
    const lamp = new THREE.DirectionalLight(0xffd8a6, 2.5);
    lamp.position.set(-1.6, 4, 2.6);
    const rim = new THREE.DirectionalLight(0x89a3dc, 1.3);
    rim.position.set(2.2, 1.6, -3);
    scene.add(lamp, rim);
  },

  build(role) {
    const fig = BUILDERS[role]();
    pose(fig.userData.rig, 0, 0, 0, 0);
    return fig;
  },

  // Still most of the time; every few seconds the hand lifts the piece for a hop
  // (it lands with a clack and a wobble) or tips it onto its rim and lets go.
  update(fig, role, t) {
    const r = fig.userData.rig;
    if (REDUCED_MOTION) { pose(r, 0, 0, 0, 0); return; }
    const T = t + r.phase, k = Math.floor(T / r.period), L = T - k * r.period;
    const yaw0 = (hash(k - 1 + r.seed) - 0.5) * 0.8, yaw1 = (hash(k + r.seed) - 0.5) * 0.8;
    const kind = Math.floor(hash(k * 1.7 + r.seed * 3.1) * 3);
    const sgn = hash(k * 2.3 + r.seed) < 0.5 ? -1 : 1;
    let lift = 0, ax = 0, az = 0, yaw = yaw1;
    if (L < 2.2) {
      if (kind === 0) {
        const air = 0.44;
        if (L < air) {
          const u = L / air;
          lift = 0.09 * 4 * u * (1 - u);
          ax = -0.12 * Math.sin(Math.PI * u) * sgn;
          yaw = yaw0 + (yaw1 - yaw0) * smooth(u);
        } else {
          const s = L - air;
          ax = 0.075 * sgn * Math.exp(-5 * s) * Math.sin(17 * s);
        }
      } else {
        const A = (kind === 1 ? 0.25 : 0.18) * sgn;
        let a;
        if (L < 0.32) { a = A * smooth(L / 0.32); yaw = yaw0 + (yaw1 - yaw0) * smooth(L / 0.32); }
        else if (L < 0.62) a = A * (1 + 0.05 * Math.sin((L - 0.32) * 30));
        else { const s = L - 0.62; a = A * Math.exp(-4.2 * s) * Math.cos(12 * s); }
        if (kind === 1) az = a; else ax = a;
      }
    }
    pose(r, lift, ax, az, yaw);
  },
};
