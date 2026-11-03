// Style 04: Grim Chibi (Black Death, big heads, cartoony).
// Head about 45% of the height, stubby limbs, 3-step toon shading with ink outlines,
// muted dark pastels. Painted tired eyes with dark rings and small pupils (they blink),
// bandages and plague spots, and a bouncy squash-and-stretch idle.

import * as THREE from 'three';
import {
  torch, blobShadow, outlineAll, toonMat, lathe, raggedHem, jitter, mergeMeshes, pointIn,
  canvasTexture, gradientBackground,
} from '../kit.js';

const INK = 0x1a1418;
const HR = 0.2;            // head radius (before the head's scale)
const HEAD_Y = 0.63;       // head centre
const NECK = 0.44;         // head pivots here
const SH_Y = 0.37;         // shoulder height
const DS = THREE.DoubleSide;
const SKIN = '#cdb8a2';    // must match M.skin: lids are painted in it

// ---------------------------------------------------------------- textures

const strawTex = canvasTexture(64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = y % 8 ? 'rgba(90,60,20,0.16)' : 'rgba(90,60,20,0.34)';
    ctx.fillRect(0, y, w, 2);
  }
  ctx.strokeStyle = 'rgba(80,50,15,0.3)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 4, h); ctx.stroke(); }
}, { repeat: [10, 3] });

const stitchTex = canvasTexture(64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2a2026'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
  ctx.strokeRect(7, 7, w - 14, h - 14);
});

// ---------------------------------------------------------------- materials

const tm = (color, o = {}) => toonMat(color, { steps: 3, ...o });
const M = {
  skin: tm(0xcdb8a2),
  sage: tm(0x76846a),
  patchA: tm(0x8c6e7e, { map: stitchTex }),
  patchB: tm(0x67788c, { map: stitchTex }),
  trousers: tm(0x574c45),
  shoe: tm(0x463830),
  straw: tm(0xc4aa6a, { map: strawTex }),
  band: tm(0x5b4634),
  wood: tm(0x6a4a30),
  rag: tm(0x3f3129),
  brown: tm(0x6d5443),
  brownDark: tm(0x57412f),
  hair: tm(0x4a3a2f),
  rope: tm(0xb5a07a),
  black: tm(0x2e2b36),
  blackHair: tm(0x221f28),
  white: tm(0xe6e0d3, { side: DS }),
  red: tm(0xa3333c),
  redDeep: tm(0x7a232b, { side: DS }),
  gold: tm(0xe0b850, { emissive: 0x3a2800 }),
  bandage: tm(0xe0d5bd),
  spot: tm(0x5a2f47),
  book: tm(0x4f2a30),
  page: tm(0xe8e0cc),
};

// ---------------------------------------------------------------- painted faces

// The face is a canvas painted on a patch of a sphere just outside the head, lit
// with the same toon shading, so painted lids match the skin. Patch angles in radians.
const PW = 1.9, PH = 1.2, PTOP = 0.45;
const FW = 512, FH = Math.round((FW * PH) / PW);
const EYE_YAW = 0.38, EYE_PITCH = -0.05, MOUTH_PITCH = -0.42;
const faceGeo = new THREE.SphereGeometry(HR * 1.012, 12, 8, Math.PI / 2 - PW / 2, PW, Math.PI / 2 - PTOP, PH);

const C = {
  sclera: '#ebe3d0', pupil: '#120e12', line: '#1a1418', brow: '#2b2127', mouth: '#2b1a22',
  ringOut: '#a3889a', ringIn: '#765a6d', ringFaint: '#bca497', spotOut: '#86566b', spotIn: '#4f2a42',
};

function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

// One tired eye: dark rings under it, small pupil, heavy upper lid (outer corner drooping).
function paintEye(ctx, x, y, side, f, closed, k) {
  const s = 0.17 * k, ry = s * 0.84;
  if (f.rings === 'faint') {
    ctx.fillStyle = C.ringFaint; ell(ctx, x, y + s * 0.3, s * 1.08, ry);
  } else {
    ctx.fillStyle = C.ringOut; ell(ctx, x, y + s * 0.36, s * 1.12, ry);
    ctx.fillStyle = C.ringIn; ell(ctx, x, y + s * 0.2, s * 1.04, ry * 0.96);
  }
  if (closed) {
    ctx.fillStyle = SKIN; ell(ctx, x, y, s * 1.02, ry * 1.02);
    ctx.strokeStyle = C.line; ctx.lineWidth = s * 0.17;
    ctx.beginPath(); ctx.moveTo(x - s * 0.95, y + ry * 0.12); ctx.quadraticCurveTo(x, y + ry * 0.62, x + s * 0.95, y + ry * 0.12); ctx.stroke();
  } else {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, s, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.sclera; ctx.fill();
    ctx.clip();
    const px = x + f.look[0] * s * 0.42, py = y + ry * 0.12 + f.look[1] * ry * 0.35;
    ctx.fillStyle = C.pupil; ell(ctx, px, py, s * f.pupil, s * f.pupil);
    ctx.fillStyle = '#ffffff'; ell(ctx, px - s * f.pupil * 0.4, py - s * f.pupil * 0.45, s * 0.05, s * 0.05);
    const lidY = y - ry + 2 * ry * f.lid;
    const xin = x - side * s * 1.1, xout = x + side * s * 1.1;
    const yin = lidY - f.droop * s * 0.3, yout = lidY + f.droop * s;
    const lidPath = () => { ctx.beginPath(); ctx.moveTo(xin, yin); ctx.quadraticCurveTo(x, lidY + s * 0.14, xout, yout); };
    lidPath(); ctx.lineTo(xout, y - ry - 4); ctx.lineTo(xin, y - ry - 4); ctx.closePath();
    ctx.fillStyle = SKIN; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.08, ry * 1.12, 0, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = C.line; ctx.lineWidth = s * 0.17;
    lidPath(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.ellipse(x, y, s, ry, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  }
  if (f.brow) {
    const { lift = 0.35, tilt = 0, raise = 0 } = f.brow;
    const by = y - ry - s * lift - (side > 0 ? raise * s : 0);
    ctx.strokeStyle = C.brow; ctx.lineWidth = s * 0.19;
    ctx.beginPath();
    ctx.moveTo(x - side * s * 0.72, by - tilt * s * 0.6);
    ctx.quadraticCurveTo(x, by - s * 0.14, x + side * s * 0.82, by + tilt * s * 0.35);
    ctx.stroke();
  }
}

function paintMouth(ctx, x, y, kind, k) {
  const w = 0.075 * k;
  ctx.strokeStyle = C.mouth; ctx.fillStyle = C.mouth; ctx.lineWidth = 0.028 * k;
  ctx.beginPath();
  if (kind === 'frown') {
    ctx.moveTo(x - w, y + 0.02 * k); ctx.quadraticCurveTo(x, y - 0.035 * k, x + w, y + 0.02 * k); ctx.stroke();
  } else if (kind === 'wobble') {
    ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w * 0.3, y - 0.025 * k, x + w * 0.3, y + 0.025 * k, x + w, y - 0.005 * k); ctx.stroke();
  } else if (kind === 'o') {
    ell(ctx, x, y, 0.03 * k, 0.038 * k);
  } else if (kind === 'smirk') {
    ctx.moveTo(x - w * 0.8, y + 0.008 * k); ctx.quadraticCurveTo(x + w * 0.3, y + 0.03 * k, x + w * 1.05, y - 0.035 * k); ctx.stroke();
    ctx.lineWidth = 0.018 * k;
    ctx.beginPath(); ctx.moveTo(x + w * 1.0, y - 0.06 * k); ctx.lineTo(x + w * 1.15, y - 0.02 * k); ctx.stroke();
  }
}

function paintSpot(ctx, x, y, r) {
  ctx.fillStyle = C.spotOut; ell(ctx, x, y, r, r);
  ctx.fillStyle = C.spotIn; ell(ctx, x, y + r * 0.1, r * 0.62, r * 0.62);
  ctx.fillStyle = '#a07a88'; ell(ctx, x - r * 0.28, y - r * 0.3, r * 0.17, r * 0.17);
}

function faceTexture(f, closed) {
  return canvasTexture(FW, FH, (ctx, W) => {
    const k = W / PW;
    const X = (yaw) => W / 2 + yaw * k;
    const Y = (pitch) => (PTOP - pitch) * k;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (f.blush) {
      ctx.fillStyle = '#d39b93';
      for (const s of [-1, 1]) ell(ctx, X(s * 0.56), Y(-0.25), 0.1 * k, 0.055 * k);
    }
    for (const [yaw, pitch, r] of f.spots || []) paintSpot(ctx, X(yaw), Y(pitch), r * k);
    if (f.plaster) {
      ctx.save(); ctx.translate(X(f.plaster[0]), Y(f.plaster[1]));
      for (const a of [0.6, -0.6]) {
        ctx.save(); ctx.rotate(a);
        ctx.fillStyle = '#e4d9c1'; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(-0.075 * k, -0.022 * k, 0.15 * k, 0.044 * k, 4); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    for (const s of [-1, 1]) paintEye(ctx, X(s * EYE_YAW), Y(EYE_PITCH), s, f, closed, k);
    paintMouth(ctx, X(f.mouth === 'smirk' ? 0.03 : 0), Y(MOUTH_PITCH), f.mouth, k);
    if (f.sweat) {
      const x = X(f.sweat[0]), y = Y(f.sweat[1]), r = 0.045 * k;
      ctx.beginPath(); ctx.moveTo(x, y - r * 2.2); ctx.lineTo(x + r * 0.89, y - r * 0.45);
      ctx.arc(x, y, r, -Math.PI * 0.15, Math.PI * 1.15); ctx.closePath();
      ctx.fillStyle = '#b7cbd6'; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ell(ctx, x - r * 0.35, y - r * 0.1, r * 0.22, r * 0.3);
    }
  });
}

const FACES = {
  peasant: { lid: 0.42, droop: 0.25, pupil: 0.19, look: [0, 0.2], brow: { lift: 0.4, tilt: 0.3 }, mouth: 'wobble',
    spots: [[0.6, -0.3, 0.036], [0.71, -0.16, 0.022], [0.5, -0.44, 0.016]], plaster: [-0.6, -0.24] },
  monk: { lid: 0.64, droop: 0.15, pupil: 0.2, look: [0, 0.7], brow: { lift: 0.32, tilt: 0.05 }, mouth: 'o' },
  priest: { lid: 0.36, droop: 0.3, pupil: 0.16, look: [-0.3, 0], brow: { lift: 0.5, tilt: 0.55 }, mouth: 'frown',
    spots: [[-0.62, -0.32, 0.032], [-0.5, -0.46, 0.018]], sweat: [0.8, 0.18] },
  cardinal: { lid: 0.56, droop: -0.08, pupil: 0.2, look: [0.6, 0.2], rings: 'faint', brow: { lift: 0.3, tilt: -0.12, raise: 0.3 },
    mouth: 'smirk', blush: true },
};

function faceMaterial(f, closed) {
  return toonMat(0xffffff, { steps: 3, map: faceTexture(f, closed), alphaTest: 0.5 });
}

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

const sphere = (r, w = 10, h = 8) => geo(`s${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const flatRing = (r, tube, rs = 5, ts = 16) => geo(`f${r}:${tube}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, tube, rs, ts).rotateX(Math.PI / 2));
// Capsule hanging down from its origin (stubby arms and legs).
const capsule = (r, len) => geo(`c${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 1, 8).translate(0, -len / 2, 0));

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

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

// Put `mesh` on the head surface (child of the skull, so it follows the head's scale).
function onHead(skull, mesh, yaw, pitch, lift = 0) {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  mesh.position.copy(d).multiplyScalar(HR + lift);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  skull.add(mesh);
  return mesh;
}

function plagueSpot(r = 0.024) {
  const m = new THREE.Mesh(sphere(r, 8, 6), M.spot);
  m.scale.set(1, 1, 0.35);
  m.userData.noOutline = true;
  return m;
}

// Stubby arm: one capsule and a mitten hand. aim() points it along a direction.
const _down = new THREE.Vector3(0, -1, 0);
function arm(parent, side, { mat, hand = M.skin, sleeve = null, len = 0.11, r = 0.042 }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.125, SH_Y, 0.03);
  shoulder.add(part(capsule(r, len), mat));
  if (sleeve) shoulder.add(part(geo('sleeve', () => new THREE.CylinderGeometry(0.05, 0.056, 0.07, 8)), sleeve, 0, -0.02, 0));
  const h = part(sphere(0.046, 7, 5), hand, 0, -len - r * 0.55, 0);
  shoulder.add(h);
  const grip = new THREE.Object3D();
  grip.position.y = -len - r * 0.55;
  shoulder.add(grip);
  parent.add(shoulder);
  return { shoulder, grip, hand: h };
}
function aim(a, x, y, z) {
  a.shoulder.quaternion.setFromUnitVectors(_down, new THREE.Vector3(x, y, z).normalize());
  a.rest = a.shoulder.rotation.clone();
}

// Shared body: blob shadow on the root, everything else in `bounce` (squash and hop),
// robe or tunic lathe, feet, and a big head pivoting at the neck with a painted face.
function body(role, { robe, robeMat, hem = 0, seed = 1, legs = null }) {
  const root = new THREE.Group();
  const shadow = blobShadow({ radius: 0.27, opacity: 0.5, color: INK });
  root.add(shadow);
  const bounce = new THREE.Group();
  root.add(bounce);
  const g = lathe(robe, 15);
  if (hem) raggedHem(g, hem, seed);
  bounce.add(part(g, robeMat));
  const feet = [];
  for (const s of [-1, 1]) {
    if (legs) feet.push(part(geo('leg', () => new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8)), legs, s * 0.066, 0.11, 0));
    const shoe = part(sphere(0.055, 7, 5), M.shoe, s * 0.068, 0.03, legs ? 0.025 : 0.105);
    shoe.scale.set(0.95, 0.6, 1.3);
    feet.push(shoe);
  }
  bounce.add(mergeMeshes(feet));
  const [head, H] = pivot(bounce, NECK);
  const skull = part(sphere(HR, 16, 12), M.skin, 0, HEAD_Y, 0);
  skull.scale.set(1.08, 0.96, 1);
  H.add(skull);
  const faceOpen = faceMaterial(FACES[role], false);
  const faceClosed = faceMaterial(FACES[role], true);
  const faceMesh = new THREE.Mesh(faceGeo, faceOpen);
  faceMesh.userData.noOutline = true;
  skull.add(faceMesh);
  return { root, shadow, bounce, head, H, skull, faceMesh, faceOpen, faceClosed };
}

// Wide round parts (hat brims, cape) are left out of main.js's framing: it measures
// bounding-box corners, which would count a round brim as √2 times its real radius.
function noFit(mesh) { mesh.userData.noFit = true; return mesh; }

function finish(root, rig) {
  outlineAll(root, { color: INK, thickness: 0.011 });
  root.userData.rig = rig;
  return root;
}

// ---------------------------------------------------------------- roles

function peasant() {
  const tunic = [[0.155, 0.09], [0.163, 0.13], [0.16, 0.22], [0.142, 0.32], [0.112, 0.4], [0.07, 0.44], [0.02, 0.46]];
  const b = body('peasant', { robe: tunic, robeMat: M.sage, hem: 0.03, seed: 3, legs: M.trousers });
  const { root, bounce, H } = b;
  // Rope belt and stitched patches on the tunic.
  const extra = [part(flatRing(0.163, 0.012, 3, 12), M.rope, 0, 0.2, 0)];
  for (const [a, y, w, h, mat, rz] of [[-0.45, 0.29, 0.075, 0.065, M.patchA, 0.15], [0.6, 0.14, 0.07, 0.06, M.patchB, -0.2], [2.6, 0.3, 0.06, 0.06, M.patchB, 0.3]]) {
    const r = radiusAt(tunic, y) + 0.002;
    const p = part(box(w, h, 0.008), mat, Math.sin(a) * r, y, Math.cos(a) * r);
    p.rotation.set(-0.15, a, rz, 'YXZ');
    extra.push(p);
  }
  bounce.add(mergeMeshes(extra));
  // Floppy straw hat with a band, pushed back.
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_Y + 0.115, -0.01);
  hat.rotation.set(-0.2, 0, 0.1);
  const brim = jitter(lathe([[0.125, 0.004], [0.29, 0.0], [0.302, 0.012], [0.282, 0.022], [0.19, 0.036]], 14), 0.006, 4);
  const crown = jitter(lathe([[0.19, 0.036], [0.165, 0.06], [0.155, 0.11], [0.11, 0.14], [0.0, 0.152]], 14), 0.006, 4);
  hat.add(noFit(part(brim, M.straw)), part(crown, M.straw), part(flatRing(0.163, 0.014, 3, 12), M.band, 0, 0.07, 0));
  H.add(hat);
  // Right hand holds up an oversized torch; left arm bare, bandaged and spotted.
  const armR = arm(bounce, 1, { mat: M.skin, sleeve: M.sage });
  aim(armR, 0.75, 0.15, 0.65);
  const t = torch({ handleMaterial: M.wood, wrapMaterial: M.rag, length: 0.44, radius: 0.021, flameSize: 1.85, intensity: 1.5, distance: 2.8, decay: 1.2 });
  armR.grip.add(t);
  standUpright(root, t, 0.25, -0.25);
  noFit(t.userData.flame); // the big flame would push the whole card's framing out
  const armL = arm(bounce, -1, { mat: M.skin, sleeve: M.sage });
  aim(armL, -0.35, -1, 0.12);
  const wraps = [];
  for (const [y, rz] of [[-0.07, 0.3], [-0.1, -0.2]]) {
    const w = part(flatRing(0.044, 0.01, 3, 10), M.bandage, 0, y, 0);
    w.rotation.z = rz;
    wraps.push(w);
  }
  armL.shoulder.add(mergeMeshes(wraps));
  const sp = plagueSpot(0.018);
  sp.position.set(0.02, -0.135, 0.042);
  sp.rotation.y = 0.4;
  armL.shoulder.add(sp);
  return finish(root, { ...b, armL, armR, headTilt: 0.04, tempo: 0.95, hop: 0.03, squash: 0.045, sway: 0.03, phase: 0.1, blinkEvery: 3.7, blinkPhase: 1.0 });
}

function monk() {
  const robe = [[0.19, 0.0], [0.185, 0.02], [0.168, 0.15], [0.152, 0.27], [0.128, 0.36], [0.085, 0.43], [0.02, 0.46]];
  const b = body('monk', { robe, robeMat: M.brown, hem: 0.012, seed: 5 });
  const { root, bounce, skull } = b;
  // Big hood down: a rolled cowl round the neck and the hood's bag on the back.
  const bag = part(sphere(0.13, 10, 7), M.brownDark, 0, 0.37, -0.13);
  bag.scale.set(1.15, 0.95, 0.6);
  bounce.add(mergeMeshes([
    part(geo('cowl', () => new THREE.TorusGeometry(0.13, 0.055, 5, 14).rotateX(Math.PI / 2)), M.brownDark, 0, 0.43, -0.01),
    bag,
    part(flatRing(0.155, 0.013, 3, 12), M.rope, 0, 0.24, 0),
    part(geo('cord', () => new THREE.CylinderGeometry(0.008, 0.008, 0.13, 5)), M.rope, -0.06, 0.18, radiusAt(robe, 0.18) + 0.004),
    part(sphere(0.017, 7, 5), M.rope, -0.06, 0.11, radiusAt(robe, 0.11) + 0.008),
  ]));
  // Tonsure: ring of hair round a bald crown with plague spots on it.
  const fringe = part(geo('fringe', () => new THREE.TorusGeometry(0.186, 0.036, 4, 16).rotateX(Math.PI / 2)), M.hair, 0, 0.07, -0.004);
  fringe.rotation.x = -0.15;
  skull.add(fringe);
  for (const [yaw, pitch, r] of [[0.35, 1.0, 0.026], [-0.5, 1.15, 0.02], [0.05, 1.32, 0.017], [0.8, 0.82, 0.016]]) onHead(skull, plagueSpot(r), yaw, pitch);
  // Hands together at the chest holding a wooden rosary.
  const armL = arm(bounce, -1, { mat: M.brown });
  const armR = arm(bounce, 1, { mat: M.brown });
  aim(armL, 0.45, -0.5, 0.85);
  aim(armR, -0.45, -0.5, 0.85);
  const hands = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  const rosary = new THREE.Group();
  rosary.position.set(hands.x, hands.y - 0.01, hands.z + 0.02);
  rosary.add(mergeMeshes([
    part(geo('beads', () => new THREE.TorusGeometry(0.042, 0.008, 3, 12)), M.wood, 0, -0.04, 0),
    part(box(0.012, 0.05, 0.01), M.wood, 0, -0.105, 0),
    part(box(0.034, 0.012, 0.01), M.wood, 0, -0.098, 0),
  ]));
  bounce.add(rosary);
  return finish(root, { ...b, armL, armR, rosary, headTilt: 0.12, tempo: 0.6, hop: 0.012, squash: 0.03, sway: 0.02, phase: 0.6, blinkEvery: 5.3, blinkPhase: 2.0 });
}

function priest() {
  const robe = [[0.178, 0.0], [0.172, 0.02], [0.158, 0.17], [0.142, 0.29], [0.115, 0.37], [0.07, 0.43], [0.02, 0.46]];
  const b = body('priest', { robe, robeMat: M.black, hem: 0.006, seed: 7 });
  const { root, bounce, skull } = b;
  // Tall white collar cupping the chin.
  bounce.add(part(lathe([[0.1, 0.37], [0.112, 0.41], [0.14, 0.465], [0.168, 0.515], [0.174, 0.53]], 18), M.white));
  // Slicked black hair with a side-swept fringe.
  const fringe = part(sphere(0.09, 10, 7), M.blackHair, 0, 0, 0);
  fringe.scale.set(1.5, 0.55, 0.7);
  skull.add(
    part(geo('haircap', () => new THREE.SphereGeometry(HR * 1.04, 16, 7, 0, Math.PI * 2, 0, Math.PI * 0.37)), M.blackHair),
    part(geo('hairback', () => new THREE.SphereGeometry(HR * 1.03, 10, 4, Math.PI / 2 + 1.75, Math.PI * 2 - 3.5, Math.PI * 0.3, Math.PI * 0.27)), M.blackHair),
  );
  onHead(skull, fringe, -0.35, 0.62, 0.0);
  // Both hands clutch a small book to the chest.
  const armL = arm(bounce, -1, { mat: M.black });
  const armR = arm(bounce, 1, { mat: M.black });
  aim(armL, 0.4, -0.45, 0.85);
  aim(armR, -0.4, -0.45, 0.85);
  const hands = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  const book = mergeMeshes([
    part(box(0.12, 0.15, 0.03), M.book),
    part(box(0.11, 0.14, 0.032), M.page, 0.006, 0, 0),
    part(box(0.012, 0.062, 0.006), M.bandage, 0, 0.008, 0.017),
    part(box(0.042, 0.012, 0.006), M.bandage, 0, 0.022, 0.017),
  ]);
  book.position.set(0, hands.y + 0.045, hands.z + 0.004);
  book.rotation.x = -0.3;
  bounce.add(book);
  return finish(root, { ...b, armL, armR, headTilt: 0.02, tempo: 1.25, hop: 0.022, squash: 0.04, sway: 0.02, phase: 0.3, blinkEvery: 2.6, blinkPhase: 0.5 });
}

function cardinal() {
  const robe = [[0.2, 0.0], [0.196, 0.02], [0.206, 0.1], [0.2, 0.2], [0.172, 0.3], [0.124, 0.39], [0.065, 0.44], [0.02, 0.46]];
  const b = body('cardinal', { robe, robeMat: M.red });
  const { root, bounce, H } = b;
  // Long cape behind (open at the front) and a short shoulder cape.
  bounce.add(noFit(part(lathe([[0.27, 0.015], [0.26, 0.12], [0.24, 0.24], [0.205, 0.33], [0.15, 0.4], [0.08, 0.45]], 16, Math.PI * 1.25), M.redDeep)));
  bounce.add(part(lathe([[0.192, 0.27], [0.182, 0.32], [0.146, 0.39], [0.096, 0.435], [0.04, 0.46]], 16), M.red));
  // Huge round galero, tipped back, with tassels on cords.
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_Y + 0.13, -0.01);
  hat.rotation.set(-0.14, 0, -0.06);
  hat.add(noFit(part(lathe([[0.15, 0.0], [0.32, 0.0], [0.345, 0.008], [0.34, 0.018], [0.21, 0.03]], 18), M.red)));
  hat.add(part(lathe([[0.21, 0.03], [0.17, 0.05], [0.16, 0.09], [0.125, 0.125], [0.0, 0.138]], 16), M.red));
  const tassels = [];
  for (const s of [-1, 1]) {
    const tg = new THREE.Group();
    tg.position.set(s * 0.27, 0.0, 0.04);
    const cone = geo('tassel', () => new THREE.ConeGeometry(0.02, 0.045, 6));
    tg.add(mergeMeshes([
      part(geo('tcord', () => new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4).translate(0, -0.1, 0)), M.red),
      part(cone, M.red, 0, -0.215, 0),
      part(cone, M.red, -0.022, -0.25, 0),
      part(cone, M.red, 0.022, -0.25, 0),
    ]));
    hat.add(tg);
    tassels.push(tg);
  }
  H.add(hat);
  // Right hand holds up a tiny gold cross; left hand on the hip.
  const armR = arm(bounce, 1, { mat: M.red });
  aim(armR, 0.45, 0.8, 0.45);
  const cross = mergeMeshes([
    part(box(0.012, 0.07, 0.01), M.gold, 0, 0.068, 0),
    part(box(0.042, 0.012, 0.01), M.gold, 0, 0.082, 0),
  ]);
  armR.grip.add(cross);
  standUpright(root, cross, 0, -0.15);
  const armL = arm(bounce, -1, { mat: M.red });
  aim(armL, -0.75, -0.6, -0.05);
  root.scale.setScalar(1.06);
  return finish(root, { ...b, armL, armR, tassels, headTilt: -0.06, tempo: 0.5, hop: 0.012, squash: 0.03, sway: 0.05, phase: 0.8, blinkEvery: 4.4, blinkPhase: 3.1 });
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- style

export default {
  id: '04-grim-chibi',
  name: 'Grim Chibi',
  blurb: 'Big tired heads, bandages and plague spots, bouncing on.',
  vibe: 'Black Death',
  look: 'big heads',
  tileColor: 0x3e3947,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#4a4357'], [0.5, '#2c2836'], [1, '#121016']], { vignette: 0.55, grain: 0.05 });
    scene.fog = new THREE.Fog(0x2a2633, 7, 20);
    scene.add(new THREE.HemisphereLight(0xd6cce6, 0x2a2430, 1.2));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
    key.position.set(-2, 3, 3.5);
    const rim = new THREE.DirectionalLight(0x9aa8e0, 1.3);
    rim.position.set(2.5, 2.2, -3);
    scene.add(key, rim);
  },

  build(role) {
    const fig = BUILDERS[role]();
    fig.userData.rig.head.rotation.x = fig.userData.rig.headTilt;
    return fig;
  },

  // Bouncy squash-and-stretch hop, a lagging head wobble, blinks, and a habit per role.
  update(fig, role, t) {
    const r = fig.userData.rig;
    const c = t * r.tempo + r.phase;
    const hop = Math.abs(Math.sin(c * Math.PI)) * r.hop;
    const sq = Math.cos(c * Math.PI * 2) * r.squash;
    r.bounce.position.y = hop;
    r.bounce.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    r.bounce.rotation.z = Math.sin(c * Math.PI + 0.3) * r.sway;
    const sh = 0.27 * (1 - hop * 4);
    r.shadow.scale.set(sh, 1, sh);
    r.head.rotation.z = -Math.sin(c * Math.PI - 0.5) * 0.06;
    r.head.rotation.x = r.headTilt + Math.cos(c * Math.PI * 2 - 0.9) * 0.025;
    r.head.rotation.y = Math.sin(t * 0.45 + r.phase * 3) * 0.15;
    let closed = (t + r.blinkPhase) % r.blinkEvery < 0.14;
    if (role === 'peasant') {
      r.armR.shoulder.rotation.x = r.armR.rest.x + Math.sin(c * Math.PI * 2 + 0.6) * 0.05;
      r.armL.shoulder.rotation.z = r.armL.rest.z + Math.sin(t * 1.3) * 0.06;
    } else if (role === 'monk') {
      // Nodding off: the head sinks slowly, eyes shut, then it jerks back up.
      const d = (t * 0.17 + 0.3) % 1;
      const nod = d < 0.8 ? (d / 0.8) * (d / 0.8) * 0.32 : ((1 - d) / 0.2) * 0.32;
      r.head.rotation.x += nod;
      r.head.rotation.y *= 0.3;
      if (nod > 0.2) closed = true;
      r.rosary.rotation.z = Math.sin(t * 1.4) * 0.12;
    } else if (role === 'priest') {
      // Nervous glances left and right.
      r.head.rotation.y = Math.tanh(Math.sin(t * 0.8 + 1) * 4) * 0.32;
    } else if (role === 'cardinal') {
      r.armR.shoulder.rotation.x = r.armR.rest.x + Math.sin(t * 0.9) * 0.06;
      for (let i = 0; i < 2; i++) r.tassels[i].rotation.z = Math.sin(t * 1.5 + i * 1.7) * 0.1 - r.bounce.rotation.z;
    }
    r.faceMesh.material = closed ? r.faceClosed : r.faceOpen;
  },
};
