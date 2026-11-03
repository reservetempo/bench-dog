// Style 08: Architect's Marionettes (unjust architect, big carved heads).
// Jointed wooden puppets with oversized heads behind cracked painted masks, ball
// joints at shoulders, elbows, wrists, knees and ankles, cloth costumes, and thin
// strings from head and hands up to a wooden control bar just above them. The bar
// rocks in an unseen hand; the body swings after it and the limbs lag behind.

import * as THREE from 'three';
import { torch, blobShadow, lathe, raggedHem, mergeMeshes, canvasTexture, rng, REDUCED_MOTION } from '../kit.js';

const TAU = Math.PI * 2;
const BAR = 1.32;      // control bar height (before the cardinal's scale)
const HEAD_Y = 0.815;  // head centre
const HEAD_R = 0.155;
const HEAD_SY = 1.1;   // heads are a little taller than wide
const MASK_R = HEAD_R * 1.035;
const PHI = 1.2, UP = 1.0, DOWN = 1.0; // mask patch: half width, extent above and below the eye line (radians)
const MK = 110;        // mask canvas pixels per radian

// ---------------------------------------------------------------- textures

function grainTex(base, dark, light, seed) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x0 = r() * w, amp = 1 + r() * 3, f = ((1 + r() * 2) * TAU) / h, ph = r() * TAU;
      ctx.globalAlpha = 0.15 + r() * 0.35;
      ctx.strokeStyle = r() < 0.7 ? dark : light;
      ctx.lineWidth = 0.5 + r() * 1.4;
      ctx.beginPath();
      for (let y = 0; y <= h; y += 8) {
        const x = x0 + Math.sin(y * f + ph) * amp;
        if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

// Coarse woven cloth with grime; optional sewn-on patches.
function clothTex(color, seed, { patches = null, repeat = [3, 2] } = {}) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const r = rng(seed);
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; ctx.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { ctx.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`; ctx.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h, rad = 6 + r() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(20,12,6,${0.12 + r() * 0.15})`); g.addColorStop(1, 'rgba(20,12,6,0)');
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    if (patches) {
      for (const [x, y, pw, ph, col, rot] of patches) {
        ctx.save(); ctx.translate(x * w, y * h); ctx.rotate(rot);
        ctx.fillStyle = col; ctx.fillRect(-pw * w / 2, -ph * h / 2, pw * w, ph * h);
        ctx.strokeStyle = '#1b120b'; ctx.lineWidth = 1.2; ctx.setLineDash([2.5, 2.5]);
        ctx.strokeRect(-pw * w / 2 + 2.5, -ph * h / 2 + 2.5, pw * w - 5, ph * h - 5);
        ctx.restore();
      }
    }
  }, { repeat });
}

// ---------------------------------------------------------------- masks

// Painted (or gilded) mask drawn on the patch canvas. In the metal pass (gilded only)
// gold is white and everything painted on top of it is black (metalnessMap).
function drawMask(ctx, W, H, s, metal) {
  const c = (col) => (metal ? '#000' : col);
  const r = rng(s.seed);
  const P = (yaw, pitch) => [(PHI + yaw) * MK, (UP - pitch) * MK];
  // Silhouette: broad brow, cheeks, narrow chin.
  const outline = [[0, 0.95], [0.6, 0.86], [0.98, 0.52], [1.08, 0.12], [1.0, -0.3], [0.74, -0.7], [0.36, -0.92], [0, -0.97]];
  const ring = outline.concat(outline.slice(1, -1).reverse().map(([y, p]) => [-y, p]));
  const pts = ring.map(([y, p]) => P(y, p));
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a[0], a[1], mx, my);
  }
  const a0 = pts[0], b0 = pts[1];
  ctx.quadraticCurveTo(a0[0], a0[1], (a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2);
  ctx.closePath();
  ctx.fillStyle = metal ? '#fff' : s.paint; ctx.fill();
  ctx.save(); ctx.clip();
  if (!metal) {
    if (s.gilded) {
      for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) {
        ctx.fillStyle = r() < 0.5 ? `rgba(255,240,180,${0.25 * r()})` : `rgba(90,55,10,${0.3 * r()})`;
        ctx.fillRect(x + ((y / 12) % 2) * 6, y, 12, 12);
      }
    }
    // Age: darker toward the edge.
    const [cx, cy] = P(0, 0);
    const g = ctx.createRadialGradient(cx, cy, MK * 0.5, cx, cy, MK * 1.25);
    g.addColorStop(0, 'rgba(40,24,12,0)'); g.addColorStop(1, 'rgba(40,24,12,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const blush = (x, y, rad, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const col = metal ? '0,0,0' : rgb;
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  if (s.cheeks) for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.62, -0.28); blush(x, y, 0.2 * MK, s.cheeks, 0.55); }
  if (s.rings) for (const sd of [-1, 1]) { const [x, y] = P(sd * 0.46, -0.1); blush(x, y, 0.22 * MK, s.rings, 0.5); }
  // Wide painted eyes.
  const rx = 0.29 * MK, ry = 0.245 * MK;
  for (const sd of [-1, 1]) {
    const [x, y] = P(sd * 0.46, 0.12);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = c('#f3ede0'); ctx.fill();
    ctx.clip();
    const ix = x + s.look[0] * rx * 0.5, iy = y + s.look[1] * ry * 0.5, ir = rx * s.iris;
    ctx.fillStyle = c(s.irisColor); ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
    ctx.fillStyle = c('#0a0705'); ctx.beginPath(); ctx.arc(ix, iy, ir * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c('#ffffff'); ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.28, 0, TAU); ctx.fill();
    if (s.lid) {
      ctx.fillStyle = metal ? '#fff' : s.lidColor;
      ctx.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * s.lid + 2);
      ctx.strokeStyle = c('#1a110b'); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - rx, y - ry + ry * 2 * s.lid); ctx.lineTo(x + rx, y - ry + ry * 2 * s.lid); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = c('#1a110b'); ctx.lineCap = 'round';
    ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.03, Math.PI * 1.97); ctx.stroke();
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = sd > 0 ? Math.PI * (1.62 + i * 0.1) : Math.PI * (1.38 - i * 0.1);
      const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6 - 1.5); ctx.stroke();
    }
    // Thin high brows.
    const b = s.brow; // [outer lift, inner lift, arch]
    const [ox, oy] = P(sd * 0.8, 0.46 + b[0]), [nx, ny] = P(sd * 0.17, 0.46 + b[1]), [qx, qy] = P(sd * 0.48, 0.62 + b[2]);
    ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(qx, qy, nx, ny); ctx.stroke();
  }
  // Small painted mouth and the marionette jaw lines.
  const [mx, my] = P(0, -0.5);
  ctx.fillStyle = c(s.lips);
  ctx.beginPath(); ctx.moveTo(mx - 11, my); ctx.quadraticCurveTo(mx, my - 6 - s.smile, mx + 11, my);
  ctx.quadraticCurveTo(mx, my + 7 + s.open, mx - 11, my); ctx.fill();
  ctx.strokeStyle = c('#2a1a10'); ctx.lineWidth = 1.4;
  for (const sd of [-1, 1]) {
    const [jx, jy] = P(sd * 0.13, -0.53), [kx, ky] = P(sd * 0.17, -0.88);
    ctx.beginPath(); ctx.moveTo(jx, jy); ctx.lineTo(kx, ky); ctx.stroke();
  }
  // Cracks wandering in from the edges, and flakes of missing paint.
  const walk = (x, y, a, steps, depth) => {
    const line = [x, y];
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.9; x += Math.cos(a) * (4 + r() * 6); y += Math.sin(a) * (4 + r() * 6);
      line.push(x, y);
      if (depth < 2 && r() < 0.18) walk(x, y, a + (r() < 0.5 ? 0.9 : -0.9), 2 + Math.floor(r() * 4), depth + 1);
    }
    for (const [dx, col, lw] of [[0.8, 'rgba(255,248,230,0.25)', 0.9], [0, 'rgba(46,28,16,0.85)', 1.1]]) {
      if (metal && dx) continue;
      ctx.strokeStyle = metal ? '#000' : col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(line[0] + dx, line[1] + dx);
      for (let i = 2; i < line.length; i += 2) ctx.lineTo(line[i] + dx, line[i + 1] + dx);
      ctx.stroke();
    }
  };
  for (let i = 0; i < s.cracks; i++) {
    const [ex, ey] = pts[Math.floor(r() * pts.length)];
    walk(ex, ey, Math.atan2(H * 0.45 - ey, W / 2 - ex) + (r() - 0.5) * 1.1, 7 + Math.floor(r() * 8), 0);
  }
  for (let i = 0; i < s.flakes; i++) {
    const [fx, fy] = P((r() - 0.5) * 1.6, (r() - 0.5) * 1.5);
    const n = 7, poly = [];
    for (let j = 0; j < n; j++) { const a = (j / n) * TAU, rr = (3 + r() * 6) * (0.5 + r() * 0.7); poly.push(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.8); }
    ctx.beginPath(); ctx.moveTo(poly[0], poly[1]);
    for (let j = 2; j < poly.length; j += 2) ctx.lineTo(poly[j], poly[j + 1]);
    ctx.closePath();
    ctx.fillStyle = c(s.under); ctx.fill();
    ctx.strokeStyle = c('#24160d'); ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

const MASKS = {
  peasant: { seed: 3, paint: '#d6bf98', irisColor: '#5b3b22', iris: 0.42, look: [0.15, -0.45], brow: [-0.06, 0.08, 0.02],
    lips: '#7b2f25', smile: -3, open: 3, cheeks: '200,80,60', cracks: 3, flakes: 4, under: '#6d4528' },
  monk: { seed: 7, paint: '#c8c2b3', irisColor: '#4a5868', iris: 0.4, look: [0, 0.55], lid: 0.35, lidColor: '#b4ad9d',
    brow: [-0.08, -0.02, -0.04], lips: '#6a3a32', smile: 1, open: 0, cheeks: '170,110,100', cracks: 4, flakes: 3, under: '#6d4528' },
  priest: { seed: 11, paint: '#e8e3d8', irisColor: '#1c1817', iris: 0.3, look: [0, 0], brow: [0.06, -0.06, 0.0],
    lips: '#4a2a2a', smile: -2, open: -2, rings: '70,58,82', cracks: 4, flakes: 3, under: '#6d4528' },
  cardinal: { seed: 17, gilded: true, paint: '#c99b42', irisColor: '#22305a', iris: 0.38, look: [-0.4, 0.25], lid: 0.42, lidColor: '#b98a36',
    brow: [0.02, 0.06, 0.1], lips: '#a3191c', smile: 3, open: -1, cheeks: '190,60,50', cracks: 4, flakes: 5, under: '#6e2618' },
};

function maskMaterial(role) {
  const s = MASKS[role];
  const W = Math.round(PHI * 2 * MK), H = Math.round((UP + DOWN) * MK);
  const map = canvasTexture(W, H, (ctx) => drawMask(ctx, W, H, s, false));
  if (!s.gilded) return new THREE.MeshStandardMaterial({ map, roughness: 0.55, alphaTest: 0.5, emissiveMap: map, emissive: 0x4a4440 });
  const metalnessMap = canvasTexture(W, H, (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); drawMask(ctx, W, H, s, true); });
  return new THREE.MeshStandardMaterial({ map, metalnessMap, metalness: 1, roughness: 0.38, alphaTest: 0.5, emissiveMap: map, emissive: 0x5a4a38 });
}

// ---------------------------------------------------------------- materials

const std = (o) => new THREE.MeshStandardMaterial(o);
const woodMap = grainTex('#a77443', '#6a4325', '#c8955f', 3);
const darkMap = grainTex('#6a4428', '#3a2414', '#8a5c38', 5);
const M = {
  wood: std({ map: woodMap, roughness: 0.6 }),
  joint: std({ map: darkMap, roughness: 0.5, color: 0xd8c8b8 }),
  skull: std({ map: darkMap, roughness: 0.6 }),
  bar: std({ map: darkMap, roughness: 0.65 }),
  brass: std({ color: 0xc89a4a, metalness: 0.8, roughness: 0.4 }),
  thread: new THREE.LineBasicMaterial({ color: 0xdcd2bc, transparent: true, opacity: 0.6 }),
  tunic: std({ map: clothTex('#6e5a3f', 21, { repeat: [2, 1], patches: [[0.3, 0.45, 0.16, 0.2, '#545a3c', 0.1], [0.62, 0.3, 0.12, 0.14, '#7d3d28', -0.15], [0.86, 0.6, 0.14, 0.16, '#4c4740', 0.05]] }), roughness: 0.95 }),
  cap: std({ map: clothTex('#7a3626', 23), roughness: 0.95 }),
  habit: std({ map: clothTex('#55463a', 25), roughness: 0.95 }),
  habitShell: std({ map: clothTex('#55463a', 25), roughness: 0.95, side: THREE.DoubleSide }),
  cassock: std({ map: clothTex('#211f25', 27), roughness: 0.9 }),
  white: std({ color: 0xebe6da, roughness: 0.7 }),
  robe: std({ map: clothTex('#8e1a1e', 29), roughness: 0.85 }),
  cape: std({ map: clothTex('#6c1216', 31), roughness: 0.85, side: THREE.DoubleSide }),
  gold: std({ color: 0xd2a24a, metalness: 1, roughness: 0.34, emissive: 0x3a2808 }),
  rope: std({ color: 0xbfa676, roughness: 0.9 }),
  rag: std({ color: 0x2b2018, roughness: 1 }),
  shoe: std({ color: 0x2a1d15, roughness: 0.6 }),
  redShoe: std({ color: 0x7a1418, roughness: 0.5 }),
  book: std({ color: 0x4a1a16, roughness: 0.7 }),
  pages: std({ color: 0xe0d6bc, roughness: 0.9 }),
  buttons: std({ color: 0x8a1e1e, roughness: 0.5 }),
};
const MASK_MATS = {};
const NOSE_MATS = {};
for (const role of Object.keys(MASKS)) {
  MASK_MATS[role] = maskMaterial(role);
  NOSE_MATS[role] = MASKS[role].gilded ? M.gold : std({ color: MASKS[role].paint, roughness: 0.55, emissive: MASKS[role].paint, emissiveIntensity: 0.25 });
}

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const BALL = new THREE.SphereGeometry(1, 8, 6);
const SMALL = new THREE.SphereGeometry(1, 6, 4);
const ROD = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, -0.5, 0);
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const ring = (R, tube, rs = 4, ts = 18) => geo(`r${R}:${tube}:${rs}:${ts}`, () => new THREE.TorusGeometry(R, tube, rs, ts).rotateX(Math.PI / 2));

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}
const ball = (r, mat, x = 0, y = 0, z = 0, g = BALL) => { const m = part(g, mat, x, y, z); m.scale.setScalar(r); return m; };
const bead = (r, mat, x = 0, y = 0, z = 0) => ball(r, mat, x, y, z, SMALL);
// Rod hanging down from (x, y, z).
const rod = (len, r, mat, x = 0, y = 0, z = 0) => { const m = part(ROD, mat, x, y, z); m.scale.set(r, len, r); return m; };

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

function point(parent, x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

// Shoulder ball > cloth sleeve over the upper arm > elbow ball > forearm > wrist > hand.
function arm(parent, side, { sleeve, cuff = 0.042, sleeveLen = 0.12 }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.118, 0.595, 0);
  shoulder.add(ball(0.032, M.joint));
  shoulder.add(rod(0.125, 0.019, M.wood));
  shoulder.add(part(geo(`sleeve${cuff}:${sleeveLen}`, () => new THREE.CylinderGeometry(0.03, cuff, sleeveLen, 10, 1, true).translate(0, -sleeveLen / 2 - 0.01, 0)), sleeve));
  const elbow = new THREE.Group();
  elbow.position.y = -0.135;
  shoulder.add(elbow);
  elbow.add(bead(0.023, M.joint));
  elbow.add(rod(0.11, 0.016, M.wood));
  const wrist = new THREE.Group();
  wrist.position.y = -0.118;
  elbow.add(wrist);
  wrist.add(bead(0.015, M.joint));
  const hand = part(BALL, M.wood, 0, -0.038, 0);
  hand.scale.set(0.024, 0.04, 0.016);
  wrist.add(hand);
  const grip = point(wrist, 0, -0.038, 0.008);
  const att = point(wrist, 0, -0.02, 0);
  parent.add(shoulder);
  return { shoulder, elbow, wrist, grip, att, side };
}

// Hip (inside the costume) > thigh > knee ball > shin > ankle ball > carved shoe.
function leg(parent, side, shoe) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.052, 0.375, 0);
  hip.add(rod(0.16, 0.022, M.wood));
  const knee = new THREE.Group();
  knee.position.y = -0.165;
  hip.add(knee);
  knee.add(ball(0.027, M.joint));
  knee.add(rod(0.14, 0.018, M.wood));
  const ankle = new THREE.Group();
  ankle.position.y = -0.145;
  knee.add(ankle);
  ankle.add(bead(0.017, M.joint));
  const foot = part(BALL, shoe, 0, -0.022, 0.02);
  foot.scale.set(0.032, 0.024, 0.055);
  ankle.add(foot);
  parent.add(hip);
  return { hip, knee, ankle, side };
}

// Rotate `obj` (already in the tree) so it stands upright in `root`, then tilt it.
function standUpright(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

function radiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return profile[profile.length - 1][0];
}

// The whole puppet: control bar, hanging body, head with mask, limbs, strings.
// root > hang (pivots at the bar) > puppet > legs, torso (pivots at the waist) > arms, neck > head.
function puppet(role, { costume, costumeMat, hem = 0, sleeve, cuff, sleeveLen, shoe = M.shoe, scale = 1 }) {
  const root = new THREE.Group();
  root.add(blobShadow({ radius: 0.24, opacity: 0.6 }));

  // Control bar: a cross of wood with the head bar and the hand bar, a hook on top.
  const bar = new THREE.Group();
  bar.position.y = BAR;
  bar.add(mergeMeshes([
    part(box(0.026, 0.026, 0.25), M.bar, 0, 0, 0.03),
    part(box(0.3, 0.02, 0.022), M.bar, 0, -0.022, 0),
    part(box(0.42, 0.02, 0.022), M.bar, 0, -0.022, 0.13),
    part(geo('hook', () => new THREE.TorusGeometry(0.022, 0.005, 4, 10)), M.brass, 0, 0.036, 0.03),
    ...[[-0.155, 0], [0.155, 0], [-0.2, 0.13], [0.2, 0.13]].map(([x, z]) => bead(0.008, M.brass, x, -0.034, z)),
  ]));
  const barPts = {
    head: [-1, 1].map((s) => point(bar, s * 0.155, -0.04, 0)),
    hand: [-1, 1].map((s) => point(bar, s * 0.2, -0.04, 0.13)),
  };
  root.add(bar);

  const hang = new THREE.Group();
  hang.position.y = BAR;
  root.add(hang);
  const body = new THREE.Group();
  body.position.y = -BAR + 0.012;
  hang.add(body);

  const legs = [-1, 1].map((s) => leg(body, s, shoe));
  const [torso, T] = pivot(body, 0.42);
  const sk = lathe(costume, 16);
  if (hem) raggedHem(sk, hem, role.length);
  T.add(part(sk, costumeMat));
  const arms = [-1, 1].map((s) => arm(T, s, { sleeve, cuff, sleeveLen }));
  // Neck peg and head.
  T.add(rod(0.06, 0.022, M.wood, 0, 0.685, 0));
  T.add(bead(0.026, M.joint, 0, 0.655, 0));
  const [head, H] = pivot(T, 0.66);
  const skull = new THREE.Group();
  skull.position.y = HEAD_Y;
  skull.scale.set(1, HEAD_SY, 1);
  H.add(skull);
  skull.add(part(geo('skull', () => new THREE.SphereGeometry(HEAD_R, 16, 12)), M.skull));
  skull.add(part(geo('mask', () => new THREE.SphereGeometry(MASK_R, 14, 10, Math.PI / 2 - PHI, PHI * 2, Math.PI / 2 - UP, UP + DOWN)), MASK_MATS[role]));
  const nose = part(geo('nose', () => new THREE.ConeGeometry(0.02, 0.06, 6).rotateX(Math.PI / 2)), NOSE_MATS[role], 0, -0.03, MASK_R + 0.022);
  nose.rotation.x = 0.3;
  skull.add(nose);
  const headPts = [-1, 1].map((s) => point(H, s * (HEAD_R - 0.004), HEAD_Y + 0.04, -0.01));

  // Strings: head sides and hands up to the bar.
  const pairs = [[barPts.head[0], headPts[0]], [barPts.head[1], headPts[1]], [barPts.hand[0], arms[0].att], [barPts.hand[1], arms[1].att]];
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
  const strings = new THREE.LineSegments(sg, M.thread);
  strings.frustumCulled = false;
  strings.userData.noOutline = true;
  root.add(strings);

  root.scale.setScalar(scale);
  const rig = {
    root, bar, hang, body, torso, T, head, H, arms, legs, strings, pairs, costume,
    headTilt: 0.05, phase: 0, period: 6,
    arm: [{ x: -0.3, z: 0.2, el: -0.9, wr: 0.45, amp: 1 }, { x: -0.3, z: 0.2, el: -0.9, wr: 0.45, amp: 1 }],
  };
  root.userData.rig = rig;
  return rig;
}

// ---------------------------------------------------------------- roles

function peasant() {
  const costume = [[0.138, 0.27], [0.13, 0.32], [0.116, 0.4], [0.106, 0.46], [0.11, 0.52], [0.12, 0.565], [0.112, 0.6], [0.08, 0.628], [0.035, 0.642], [0.001, 0.646]];
  const r = puppet('peasant', { costume, costumeMat: M.tunic, hem: 0.035, sleeve: M.tunic, cuff: 0.045, sleeveLen: 0.09, shoe: M.wood });
  r.T.add(part(ring(0.108, 0.011, 4, 16), M.rope, 0, 0.45, 0));
  // Floppy felt cap with its tip slumped to one side.
  const cap = part(geo('cap', () => new THREE.SphereGeometry(HEAD_R + 0.012, 14, 6, 0, TAU, 0, Math.PI * 0.44)), M.cap, 0, HEAD_Y + 0.01, -0.008);
  cap.scale.set(1, HEAD_SY, 1.02);
  cap.rotation.z = 0.08;
  r.H.add(cap);
  const tip = new THREE.Group();
  tip.position.set(0.02, HEAD_Y + 0.165, -0.02);
  tip.rotation.set(-0.3, 0, -1.05);
  tip.add(part(geo('captip', () => new THREE.ConeGeometry(0.075, 0.17, 10).translate(0, 0.075, 0)), M.cap));
  tip.add(bead(0.022, M.cap, 0, 0.165, 0));
  r.H.add(tip);
  // Torch lashed to the right hand, which the string holds up.
  r.arm[1] = { x: -0.8, z: 0.32, el: -1.25, wr: 0.15, amp: 0.45 };
  const t = torch({ handleMaterial: M.bar, wrapMaterial: M.rag, length: 0.3, flameSize: 1.05, intensity: 1.15, distance: 2.3 });
  r.arms[1].grip.add(t);
  t.add(mergeMeshes([part(ring(0.02, 0.006, 3, 10), M.rope, 0, 0.005, 0), part(ring(0.02, 0.006, 3, 10), M.rope, 0, -0.02, 0)]));
  poseArms(r, 0);
  standUpright(r.root, t, 0.3, -0.2);
  Object.assign(r, { phase: 0.4, period: 5.3, headTilt: -0.12 });
  return r;
}

function monk() {
  const costume = [[0.17, 0.12], [0.16, 0.2], [0.14, 0.32], [0.122, 0.43], [0.118, 0.5], [0.125, 0.56], [0.12, 0.6], [0.09, 0.628], [0.04, 0.642], [0.001, 0.646]];
  const r = puppet('monk', { costume, costumeMat: M.habit, hem: 0.014, sleeve: M.habit, cuff: 0.06, sleeveLen: 0.15 });
  // Rope belt with a hanging knotted cord.
  r.T.add(mergeMeshes([
    part(ring(0.123, 0.011, 4, 16), M.rope, 0, 0.44, 0),
    rod(0.2, 0.007, M.rope, 0.045, 0.44, radiusAt(costume, 0.4) + 0.006),
    bead(0.014, M.rope, 0.045, 0.3, radiusAt(costume, 0.3) + 0.012),
    bead(0.016, M.rope, 0.045, 0.24, radiusAt(costume, 0.24) + 0.012),
  ]));
  // Deep hood around the big head, with a cowl over the shoulders.
  const hood = part(geo('hood', () => new THREE.SphereGeometry(HEAD_R + 0.028, 16, 9, Math.PI / 2 + 1.05, TAU - 2.1, 0, Math.PI * 0.78)), M.habitShell, 0, HEAD_Y, -0.01);
  hood.scale.set(1, HEAD_SY * 1.02, 1.05);
  r.H.add(hood);
  const peak = part(geo('hoodpeak', () => new THREE.ConeGeometry(0.05, 0.16, 8)), M.habit, 0, HEAD_Y + 0.09, -0.185);
  peak.rotation.x = -2.2;
  r.H.add(peak);
  r.T.add(part(lathe([[0.135, 0.54], [0.15, 0.58], [0.13, 0.625], [0.08, 0.655], [0.001, 0.665]], 16), M.habit));
  r.arm[0] = { x: -0.45, z: 0.16, el: -1.05, wr: 0.35, amp: 0.8 };
  r.arm[1] = { x: -0.45, z: 0.16, el: -1.05, wr: 0.35, amp: 0.8 };
  Object.assign(r, { phase: 2.1, period: 6.7, headTilt: 0.22 });
  return r;
}

function priest() {
  const costume = [[0.15, 0.13], [0.142, 0.2], [0.128, 0.32], [0.112, 0.43], [0.108, 0.5], [0.115, 0.56], [0.112, 0.6], [0.08, 0.628], [0.035, 0.642], [0.001, 0.646]];
  const r = puppet('priest', { costume, costumeMat: M.cassock, sleeve: M.cassock, cuff: 0.04, sleeveLen: 0.13 });
  // White collar band and a row of buttons down the front.
  r.T.add(part(geo('collar', () => new THREE.CylinderGeometry(0.03, 0.034, 0.03, 12)), M.white, 0, 0.645, 0));
  const btn = [];
  for (let y = 0.6; y > 0.15; y -= 0.045) btn.push(part(box(0.013, 0.013, 0.008), M.buttons, 0, y, radiusAt(costume, y) + 0.001));
  r.T.add(mergeMeshes(btn));
  // Biretta: square black cap with three ridges and a pompom.
  const biretta = new THREE.Group();
  biretta.position.set(0, HEAD_Y + 0.148, -0.005);
  biretta.rotation.set(-0.06, 0.12, 0);
  biretta.add(mergeMeshes([
    part(box(0.19, 0.06, 0.19), M.cassock, 0, 0, 0),
    part(box(0.008, 0.04, 0.15), M.cassock, -0.055, 0.045, 0),
    part(box(0.008, 0.04, 0.15), M.cassock, 0.055, 0.045, 0),
    part(box(0.15, 0.04, 0.008), M.cassock, 0, 0.045, -0.055),
    bead(0.024, M.cassock, 0, 0.05, 0),
  ]));
  r.H.add(biretta);
  // Small book in the left hand.
  const book = new THREE.Group();
  book.add(part(box(0.065, 0.085, 0.018), M.book), part(box(0.06, 0.08, 0.016), M.pages, 0.006, 0, 0));
  book.position.set(0, -0.01, 0.012);
  book.rotation.set(0.2, 0.3, 0);
  r.arms[0].grip.add(book);
  r.arm[0] = { x: -0.55, z: 0.12, el: -1.15, wr: 0.2, amp: 0.6 };
  Object.assign(r, { phase: 3.6, period: 5.9, headTilt: -0.02 });
  return r;
}

function cardinal() {
  const costume = [[0.16, 0.12], [0.152, 0.2], [0.136, 0.32], [0.118, 0.43], [0.112, 0.5], [0.118, 0.56], [0.114, 0.6], [0.08, 0.628], [0.035, 0.642], [0.001, 0.646]];
  const r = puppet('cardinal', { costume, costumeMat: M.robe, sleeve: M.robe, cuff: 0.045, sleeveLen: 0.13, shoe: M.redShoe, scale: 1.08 });
  // Long cape open at the front, short shoulder cape with gold trim, pectoral cross.
  r.T.add(part(lathe([[0.19, 0.13], [0.17, 0.28], [0.15, 0.42], [0.135, 0.52], [0.13, 0.575], [0.1, 0.618], [0.05, 0.638]], 16, Math.PI * 1.3), M.cape));
  r.T.add(part(lathe([[0.158, 0.47], [0.152, 0.52], [0.138, 0.57], [0.11, 0.612], [0.06, 0.64], [0.001, 0.648]], 16), M.robe));
  r.T.add(mergeMeshes([
    part(ring(0.158, 0.008, 4, 18), M.gold, 0, 0.47, 0),
    part(box(0.014, 0.06, 0.01), M.gold, 0, 0.515, 0.142),
    part(box(0.04, 0.013, 0.01), M.gold, 0, 0.528, 0.142),
  ]));
  // Galero: wide red brim, low crown, tassels on cords.
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_Y + 0.135, -0.005);
  hat.rotation.set(-0.08, 0, -0.07);
  hat.add(part(lathe([[0.1, 0], [0.245, -0.004], [0.255, 0.008], [0.23, 0.018], [0.12, 0.028], [0.1, 0.036],
    [0.1, 0.07], [0.085, 0.088], [0.045, 0.097], [0, 0.099]], 18), M.robe));
  const tassels = [];
  for (const s of [-1, 1]) {
    const tg = new THREE.Group();
    tg.position.set(s * 0.2, 0, 0.03);
    const parts = [rod(0.2, 0.004, M.robe)];
    for (const [n, row] of [[1, 0], [2, 1], [3, 2]]) {
      for (let k = 0; k < n; k++) parts.push(part(geo('tassel', () => new THREE.ConeGeometry(0.012, 0.034, 6)), M.robe, (k - (n - 1) / 2) * 0.022, -0.205 - row * 0.03, 0));
    }
    tg.add(mergeMeshes(parts));
    hat.add(tg);
    tassels.push(tg);
  }
  r.H.add(hat);
  // Gold processional cross held in the right hand.
  const staff = new THREE.Group();
  staff.add(mergeMeshes([
    part(geo('staff', () => new THREE.CylinderGeometry(0.009, 0.011, 0.92, 8)), M.gold, 0, 0.1, 0),
    bead(0.02, M.gold, 0, 0.56, 0),
    part(box(0.018, 0.13, 0.018), M.gold, 0, 0.64, 0),
    part(box(0.095, 0.018, 0.018), M.gold, 0, 0.655, 0),
  ]));
  r.arms[1].grip.add(staff);
  r.arm[1] = { x: -0.5, z: 0.3, el: -0.95, wr: 0.25, amp: 0.4 };
  poseArms(r, 0);
  standUpright(r.root, staff, 0, -0.04);
  Object.assign(r, { tassels, phase: 5.0, period: 7.3, headTilt: -0.1 });
  return r;
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- idle: dangling sway

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const W1 = 0.95, W2 = 0.7; // roll and pitch rates of the bar
// Sway waves, `lag` radians behind the bar (plain functions: no per-frame closures).
const roll = (t, p, lag) => Math.sin(t * W1 + p - lag);
const pitch = (t, p, lag) => Math.sin(t * W2 + p * 1.3 - lag);

function poseArms(r, t, kick = 0) {
  const p = r.phase;
  for (let i = 0; i < 2; i++) {
    const a = r.arms[i];
    const c = r.arm[a.side > 0 ? 1 : 0], ph = a.side * 0.6, amp = c.amp;
    a.shoulder.rotation.x = c.x + amp * (0.13 * pitch(t, p, 1.2 - ph) - kick * 0.3);
    a.shoulder.rotation.z = a.side * (c.z + amp * 0.06 * Math.sin(t * W1 + p - 1.2 + ph));
    a.elbow.rotation.x = c.el + amp * (0.18 * pitch(t, p, 1.9 - ph) - kick * 0.4);
    a.wrist.rotation.x = c.wr + amp * (0.25 * pitch(t, p, 2.6 - ph) + kick * 0.3);
  }
}

const _inv = new THREE.Matrix4();
const _p = new THREE.Vector3();

function pose(r, t, live) {
  const p = r.phase;
  // Now and then the hand twitches the bar up; everything below bounces after it.
  let lift = 0, kick = 0;
  if (live) {
    const T = t + p * 3, k = Math.floor(T / r.period), L = T - k * r.period;
    if (L < 2.5) {
      lift = L < 0.16 ? 0.05 * smooth(L / 0.16) : 0.05 * Math.exp(-3 * (L - 0.16)) * (0.5 + 0.5 * Math.cos(9 * (L - 0.16)));
      kick = Math.exp(-2.4 * L) * Math.sin(10 * L);
    }
  }
  r.bar.position.set(0.02 * roll(t, p, 0), BAR + lift, 0);
  r.bar.rotation.set(0.05 * pitch(t, p, 0), 0.12 * Math.sin(t * 0.3 + p), 0.06 * roll(t, p, 0));
  r.hang.position.y = BAR + lift;
  r.hang.rotation.set(0.03 * pitch(t, p, 0.6) + kick * 0.03, 0.12 * Math.sin(t * 0.3 + p - 0.5), 0.04 * roll(t, p, 0.6));
  r.torso.rotation.set(0.03 * pitch(t, p, 1.0) - kick * 0.05, 0, 0.035 * roll(t, p, 1.0));
  r.head.rotation.set(r.headTilt + 0.06 * pitch(t, p, 1.4) + kick * 0.08, 0.22 * Math.sin(t * 0.37 + p * 2), 0.08 * roll(t, p, 1.3));
  poseArms(r, t, kick);
  for (let i = 0; i < 2; i++) {
    const l = r.legs[i];
    const ph = l.side * 1.1;
    l.hip.rotation.x = -0.08 + 0.1 * pitch(t, p, 1.3 + ph) - kick * (l.side > 0 ? 0.25 : 0.15);
    l.hip.rotation.z = l.side * 0.03 + 0.03 * roll(t, p, 1.3);
    l.knee.rotation.x = Math.max(0.03, 0.22 + 0.1 * pitch(t, p, 2.0 + ph) + kick * 0.3);
    l.ankle.rotation.x = 0.34 + 0.18 * pitch(t, p, 2.7 + ph);
  }
  if (r.tassels) for (let i = 0; i < 2; i++) r.tassels[i].rotation.z = 0.12 * roll(t, p, 2.0 + i) - r.head.rotation.z;
  // Strings follow the bar and the puppet.
  r.root.updateMatrixWorld(true);
  _inv.copy(r.root.matrixWorld).invert();
  const pos = r.strings.geometry.attributes.position;
  for (let i = 0; i < r.pairs.length; i++) {
    for (let j = 0; j < 2; j++) {
      _p.setFromMatrixPosition(r.pairs[i][j].matrixWorld).applyMatrix4(_inv);
      pos.setXYZ(i * 2 + j, _p.x, _p.y, _p.z);
    }
  }
  pos.needsUpdate = true;
}

export default {
  id: '08-marionettes',
  name: "Architect's Marionettes",
  blurb: 'Cracked masked puppets dangling from the bar.',
  vibe: 'unjust architect',
  look: 'big carved heads',
  tileColor: 0x3a2f2a,

  setupScene(scene) {
    // Dark plum stage curtain behind, a dim spotlight from above, warm footlights.
    scene.background = canvasTexture(256, 256, (ctx, w, h) => {
      for (let x = 0; x < w; x++) {
        const f = 0.5 + 0.5 * Math.sin((x / w) * TAU * 6 + Math.sin(x * 0.07) * 0.9);
        ctx.fillStyle = `hsl(300, 20%, ${4 + f * f * 11}%)`;
        ctx.fillRect(x, 0, 1, h);
      }
      const g = ctx.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.75);
      g.addColorStop(0, 'rgba(255,200,140,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(0,0,0,0.65)'); v.addColorStop(0.35, 'rgba(0,0,0,0)'); v.addColorStop(0.8, 'rgba(0,0,0,0.1)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    });
    scene.fog = new THREE.Fog(0x0b080c, 9, 26);
    const env = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#0a080a'; ctx.fillRect(0, 0, w, h);
      const spot = (x, y, rx, ry, col) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(rx / ry, 1);
        const s = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
        s.addColorStop(0, col); s.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = s; ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
        ctx.restore();
      };
      ctx.fillStyle = 'rgba(255,226,180,0.9)'; ctx.fillRect(0, 0, w, 6);
      spot(0.5 * w, 0.06 * h, 120, 14, 'rgba(255,226,180,0.8)');
      spot(0.75 * w, 0.56 * h, 70, 10, 'rgba(255,150,80,0.9)');
      spot(0.25 * w, 0.4 * h, 40, 16, 'rgba(110,110,160,0.5)');
    });
    env.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = env;
    scene.environmentIntensity = 0.8;
    scene.add(new THREE.HemisphereLight(0x5c5274, 0x140c0c, 0.5));
    const spot = new THREE.SpotLight(0xffe2b4, 3.6, 0, 0.5, 0.6, 0);
    spot.position.set(0, 6.5, 2.4);
    spot.target.position.set(0, 0.6, 0);
    scene.add(spot, spot.target);
    const foot = new THREE.DirectionalLight(0xffae70, 1.1);
    foot.position.set(0, 0.3, 3);
    const rim = new THREE.DirectionalLight(0x8a96c8, 0.9);
    rim.position.set(-2, 2.5, -3);
    scene.add(foot, rim);
  },

  build(role) {
    const r = BUILDERS[role]();
    pose(r, 0, false);
    return r.root;
  },

  update(fig, role, t) {
    const r = fig.userData.rig;
    pose(r, REDUCED_MOTION ? 0 : t, !REDUCED_MOTION);
  },
};
