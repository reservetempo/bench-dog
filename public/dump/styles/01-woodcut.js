// Style 01: Plague Woodcut (Black Death, grim).
// Slim, slightly hunched figures with flat 2-step shading, thick ink outlines,
// parchment faces and hands, sepia and soot cloth with hatched hem bands, crimson
// only on the cardinal. Also the reference example of the style API (styles/index.js).

import * as THREE from 'three';
import {
  torch, blobShadow, outlineAll, toonMat, lathe, raggedHem, mergeMeshes, eyePair,
  canvasTexture, gradientBackground, pointIn,
} from '../kit.js';

const INK = 0x17120d;
const HIP = 0.47;      // upper body pivots here (hunch, bow, breathing)
const NECK = 0.8;      // head pivots here
const HEAD_Y = 0.875;  // head centre
const HEAD_R = 0.068;

// ---------------------------------------------------------------- materials

// Woodcut hatching: a few dark bands near the hem (v = 0 is the bottom of a lathe).
function hatchTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const band = (v0, v1) => [h * (1 - v1), h * (v1 - v0)];
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    let [y, bh] = band(0, 0.05); ctx.fillRect(0, y, w, bh);
    [y, bh] = band(0.26, 0.285); ctx.fillRect(0, y, w, bh);
    [y, bh] = band(0.08, 0.22);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, w, bh); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    for (let x = -h; x < w + h; x += 9) { ctx.beginPath(); ctx.moveTo(x, y + bh); ctx.lineTo(x + bh, y); ctx.stroke(); }
    ctx.restore();
  }, { repeat: [5, 1] });
}

const hatch = hatchTexture();
const T2 = { steps: 2 };
const M = {
  skin: toonMat(0xead9b4, T2),
  cream: toonMat(0xdac8a0, T2),
  creamShell: toonMat(0xdac8a0, { ...T2, side: THREE.DoubleSide }),
  sepia: toonMat(0x7d5c3b, { ...T2, map: hatch }),
  sepiaPlain: toonMat(0x7d5c3b, T2),
  hose: toonMat(0x5b4733, T2),
  grey: toonMat(0x4d4945, { ...T2, map: hatch }),
  greyPlain: toonMat(0x4d4945, T2),
  greyShell: toonMat(0x4d4945, { ...T2, side: THREE.DoubleSide }),
  soot: toonMat(0x2c2622, { ...T2, map: hatch }),
  sootPlain: toonMat(0x2c2622, T2),
  crimson: toonMat(0xa8161b, { ...T2, map: hatch, side: THREE.DoubleSide }),
  crimsonPlain: toonMat(0xa8161b, T2),
  gold: toonMat(0xd8ab3e, T2),
  wood: toonMat(0x5e4128, T2),
  rope: toonMat(0xb39a6c, T2),
  ink: new THREE.MeshBasicMaterial({ color: INK }),
};

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

const sphere = (r, w = 12, h = 10) => geo(`s${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
// Cylinder hanging down from its origin (for limbs and cords).
const limbGeo = (len, r0, r1, seg = 7) => geo(`l${len}:${r0}:${r1}:${seg}`,
  () => new THREE.CylinderGeometry(r0, r1, len, seg, 1).translate(0, -len / 2, 0));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
// Sphere shell with an opening at the front (hoods, coifs, hair).
const shell = (r, open, thetaEnd, w = 14, h = 9) => geo(`h${r}:${open}:${thetaEnd}`,
  () => new THREE.SphereGeometry(r, w, h, Math.PI / 2 + open / 2, Math.PI * 2 - open, 0, thetaEnd));

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

// Arm with a shoulder and an elbow pivot; `grip` is where a hand holds things.
function arm(parent, side, { sleeve, hand = M.skin, upper = 0.19, fore = 0.165, r = 0.024, cuff = 0.03, showHand = true }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.112, 0.745, 0);
  shoulder.add(part(sphere(r * 1.15, 8, 6), sleeve));
  shoulder.add(part(limbGeo(upper, r, r * 0.92), sleeve));
  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  elbow.add(part(limbGeo(fore, r * 0.9, cuff), sleeve));
  if (showHand) elbow.add(part(sphere(0.02, 8, 6), hand, 0, -fore - 0.014, 0));
  const grip = new THREE.Object3D();
  grip.position.y = -fore - 0.016;
  elbow.add(grip);
  parent.add(shoulder);
  return { shoulder, elbow, grip };
}

// Shared body: skirt (static), upper body (pivots at the hip), head (pivots at the neck).
function body({ skirt, skirtMat, torso, torsoMat, hem = 0, seed = 1 }) {
  const root = new THREE.Group();
  const sk = lathe(skirt, 14);
  if (hem) raggedHem(sk, hem, seed);
  root.add(part(sk, skirtMat));
  const [upper, U] = pivot(root, HIP);
  U.add(part(lathe(torso, 14), torsoMat));
  U.add(part(limbGeo(0.07, 0.026, 0.03), M.skin, 0, NECK + 0.03, 0.004));
  const [head, H] = pivot(U, NECK);
  const skull = part(sphere(HEAD_R), M.skin, 0, HEAD_Y, 0.008);
  skull.scale.set(0.94, 1.12, 1);
  H.add(skull);
  const nose = part(geo('nose', () => new THREE.ConeGeometry(0.011, 0.03, 5).rotateX(Math.PI / 2)), M.skin, 0, HEAD_Y - 0.01, 0.078);
  H.add(nose);
  const eyes = eyePair(null, { yaw: 0.36, pitch: 0.08, dot: { headRadius: HEAD_R + 0.004, size: 0.0085, color: INK } });
  eyes.position.set(0, HEAD_Y, 0.008);
  H.add(eyes);
  const mouth = part(box(0.028, 0.004, 0.004), M.ink, 0, HEAD_Y - 0.038, 0.07);
  mouth.userData.noOutline = true;
  H.add(mouth);
  root.add(blobShadow({ radius: 0.27, opacity: 0.38, color: INK }));
  return { root, upper, U, head, H };
}

// Rotate `obj` (already in the tree) so it stands upright in `root`, then tilt it.
function standUpright(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

// ---------------------------------------------------------------- roles

function peasant() {
  const b = body({
    skirt: [[0.14, 0.27], [0.132, 0.32], [0.118, 0.42], [0.112, 0.5]], skirtMat: M.sepia, hem: 0.045, seed: 3,
    torso: [[0.11, 0.44], [0.118, 0.58], [0.12, 0.68], [0.1, 0.745], [0.06, 0.785], [0.03, 0.8]], torsoMat: M.sepiaPlain,
  });
  const { root, U, H } = b;
  for (const s of [-1, 1]) {
    const leg = part(limbGeo(0.42, 0.03, 0.022), M.hose, s * 0.045, 0.45, 0);
    leg.rotation.z = s * 0.035;
    const shoe = part(sphere(0.03, 8, 6), M.sootPlain, s * 0.052, 0.022, 0.018);
    shoe.scale.set(0.9, 0.7, 1.55);
    root.add(leg, shoe);
  }
  U.add(part(geo('belt-p', () => new THREE.TorusGeometry(0.113, 0.01, 5, 16).rotateX(Math.PI / 2)), M.rope, 0, 0.47, 0));
  // Coif: close linen cap open at the face.
  const coif = part(shell(0.078, 2.0, Math.PI * 0.74), M.creamShell, 0, HEAD_Y + 0.004, 0.004);
  coif.scale.set(0.98, 1.1, 1.04);
  H.add(coif);
  // Left arm hangs, forearm bandaged; right arm holds the torch up.
  const armL = arm(U, -1, { sleeve: M.sepiaPlain, upper: 0.19, fore: 0.165, cuff: 0.022 });
  armL.shoulder.rotation.set(0.08, 0, -0.1);
  armL.elbow.rotation.x = -0.25;
  const bandage = mergeMeshes([-0.04, -0.075, -0.11, -0.14].map((y, i) => {
    const m = part(geo('bandage', () => new THREE.TorusGeometry(0.025, 0.008, 4, 10).rotateX(Math.PI / 2)), M.cream, 0, y, 0);
    m.rotation.z = (i % 2 ? 0.25 : -0.2);
    return m;
  }));
  armL.elbow.add(bandage);
  const armR = arm(U, 1, { sleeve: M.sepiaPlain, upper: 0.19, fore: 0.16 });
  armR.shoulder.rotation.set(-0.35, 0, 0.3);
  armR.elbow.rotation.x = -1.55;
  const t = torch({ handleMaterial: M.wood, wrapMaterial: M.sootPlain, length: 0.34, intensity: 1.0, distance: 2.2 });
  armR.grip.add(t);
  standUpright(root, t, 0.1, -0.12);
  outlineAll(root, { color: INK, thickness: 0.011 });
  root.userData.rig = { ...b, armL, armR, hunch: 0.13, headTilt: 0.06, phase: 0.3 };
  return root;
}

function monk() {
  const b = body({
    skirt: [[0.205, 0.0], [0.198, 0.025], [0.172, 0.16], [0.146, 0.33], [0.132, 0.5]], skirtMat: M.grey, hem: 0.012, seed: 5,
    torso: [[0.132, 0.44], [0.136, 0.6], [0.133, 0.69], [0.11, 0.75], [0.07, 0.79], [0.035, 0.81]], torsoMat: M.greyPlain,
  });
  const { root, U, H } = b;
  // Shoulder cape (scapular cowl).
  U.add(part(lathe([[0.158, 0.6], [0.153, 0.66], [0.132, 0.72], [0.094, 0.775], [0.05, 0.81]], 14), M.greyPlain));
  // Hood with a peak falling back.
  const hood = part(shell(0.094, 1.75, Math.PI * 0.8), M.greyShell, 0, HEAD_Y + 0.012, -0.004);
  hood.scale.set(1, 1.12, 1.08);
  H.add(hood);
  const peak = part(geo('peak', () => new THREE.ConeGeometry(0.045, 0.1, 7)), M.greyPlain, 0, HEAD_Y + 0.07, -0.07);
  peak.rotation.x = -1.2;
  H.add(peak);
  // Rope belt with knotted ends.
  U.add(part(geo('belt-m', () => new THREE.TorusGeometry(0.136, 0.011, 5, 16).rotateX(Math.PI / 2)), M.rope, 0, 0.47, 0));
  const cord = mergeMeshes([
    part(limbGeo(0.22, 0.007, 0.007, 5), M.rope, -0.05, 0.47, 0.13),
    part(limbGeo(0.17, 0.007, 0.007, 5), M.rope, -0.03, 0.47, 0.135),
    part(sphere(0.014, 6, 5), M.rope, -0.05, 0.31, 0.135),
    part(sphere(0.014, 6, 5), M.rope, -0.05, 0.25, 0.14),
    part(sphere(0.014, 6, 5), M.rope, -0.03, 0.3, 0.14),
  ]);
  root.add(cord);
  // Rosary loop and cross hanging from the belt.
  const rosary = new THREE.Group();
  rosary.position.set(0.075, 0.465, 0.12);
  const beads = [];
  for (let k = 0; k <= 12; k++) {
    const a = (Math.PI * k) / 12;
    beads.push(part(sphere(0.009, 6, 4), M.wood, 0.03 * Math.cos(a), -0.11 * Math.sin(a), 0.004 * Math.sin(a)));
  }
  for (let k = 1; k <= 3; k++) beads.push(part(sphere(0.009, 6, 4), M.wood, 0, -0.11 - k * 0.022, 0.006));
  beads.push(part(box(0.008, 0.05, 0.008), M.wood, 0, -0.2, 0.006), part(box(0.032, 0.008, 0.008), M.wood, 0, -0.19, 0.006));
  rosary.add(mergeMeshes(beads));
  root.add(rosary);
  // Hands hidden in wide sleeves meeting in front.
  const sleeve = { sleeve: M.greyPlain, upper: 0.18, fore: 0.15, r: 0.03, cuff: 0.05, showHand: false };
  const armL = arm(U, -1, sleeve);
  const armR = arm(U, 1, sleeve);
  armL.shoulder.rotation.set(-0.3, 0, 0.3);
  armR.shoulder.rotation.set(-0.3, 0, -0.3);
  armL.elbow.rotation.set(-1.35, 0, 0);
  armR.elbow.rotation.set(-1.35, 0, 0);
  outlineAll(root, { color: INK, thickness: 0.011 });
  root.userData.rig = { ...b, armL, armR, rosary, hunch: 0.16, headTilt: 0.18, phase: 1.7 };
  return root;
}

function priest() {
  const b = body({
    skirt: [[0.168, 0.0], [0.162, 0.025], [0.146, 0.25], [0.128, 0.5]], skirtMat: M.soot,
    torso: [[0.126, 0.44], [0.13, 0.6], [0.128, 0.69], [0.106, 0.75], [0.06, 0.785], [0.033, 0.8]], torsoMat: M.sootPlain,
  });
  const { root, U, H } = b;
  // Collar and stole (two cream strips with small ink crosses).
  U.add(part(geo('collar', () => new THREE.CylinderGeometry(0.033, 0.036, 0.024, 10)), M.cream, 0, NECK + 0.005, 0.003));
  for (const s of [-1, 1]) {
    const up = part(box(0.026, 0.3, 0.008), M.cream, s * 0.036, 0.625, 0.124);
    up.rotation.x = -0.16;
    const low = part(box(0.026, 0.25, 0.008), M.cream, s * 0.04, 0.385, 0.14);
    low.rotation.x = -0.1;
    const cross = mergeMeshes([part(box(0.004, 0.026, 0.004), M.ink, 0, 0, 0), part(box(0.016, 0.004, 0.004), M.ink, 0, 0.004, 0)]);
    cross.position.set(s * 0.04, 0.3, 0.151);
    cross.userData.noOutline = true;
    U.add(up);
    root.add(low, cross);
  }
  // Short dark hair.
  const hair = part(shell(0.073, 1.3, Math.PI * 0.5), M.sootPlain, 0, HEAD_Y + 0.006, 0.004);
  hair.scale.set(0.96, 1.1, 1.04);
  H.add(hair);
  // Both hands hold a small book open at the chest.
  const armL = arm(U, -1, { sleeve: M.sootPlain, upper: 0.18, fore: 0.15 });
  const armR = arm(U, 1, { sleeve: M.sootPlain, upper: 0.18, fore: 0.15 });
  armL.shoulder.rotation.set(-0.25, 0, 0.32);
  armR.shoulder.rotation.set(-0.25, 0, -0.32);
  armL.elbow.rotation.x = -1.25;
  armR.elbow.rotation.x = -1.25;
  const book = new THREE.Group();
  book.add(part(box(0.09, 0.075, 0.012), M.wood), part(box(0.082, 0.068, 0.01), M.cream, 0, 0, 0.008));
  const hands = pointIn(root, armL.grip).add(pointIn(root, armR.grip)).multiplyScalar(0.5);
  book.position.set(0, hands.y + 0.012, hands.z + 0.006);
  book.rotation.x = -0.9;
  U.add(book);
  outlineAll(root, { color: INK, thickness: 0.011 });
  root.userData.rig = { ...b, armL, armR, book, hunch: 0.1, headTilt: 0.32, phase: 3.1 };
  return root;
}

function cardinal() {
  const b = body({
    skirt: [[0.172, 0.0], [0.166, 0.025], [0.15, 0.25], [0.13, 0.5]], skirtMat: M.soot,
    torso: [[0.128, 0.44], [0.132, 0.6], [0.13, 0.69], [0.108, 0.75], [0.06, 0.785], [0.033, 0.8]], torsoMat: M.sootPlain,
  });
  const { root, U, H } = b;
  // Long crimson cape open at the front, and a short shoulder cape over it.
  U.add(part(lathe([[0.232, 0.06], [0.212, 0.25], [0.186, 0.45], [0.166, 0.6], [0.152, 0.68], [0.128, 0.745], [0.086, 0.78], [0.045, 0.8]], 16, Math.PI * 1.55), M.crimson));
  U.add(part(lathe([[0.176, 0.6], [0.17, 0.65], [0.145, 0.72], [0.104, 0.77], [0.05, 0.805]], 16), M.crimsonPlain));
  const pect = mergeMeshes([part(box(0.012, 0.05, 0.008), M.gold, 0, 0, 0), part(box(0.032, 0.011, 0.008), M.gold, 0, 0.01, 0)]);
  pect.position.set(0, 0.645, 0.145);
  pect.rotation.x = -0.12;
  U.add(pect);
  // Galero: wide flat brim, low crown, tasselled cords on both sides.
  const hat = new THREE.Group();
  hat.position.y = HEAD_Y + 0.062;
  hat.add(part(geo('brim', () => new THREE.CylinderGeometry(0.205, 0.205, 0.012, 22)), M.crimsonPlain));
  hat.add(part(geo('crown', () => new THREE.CylinderGeometry(0.07, 0.085, 0.05, 16)), M.crimsonPlain, 0, 0.03, 0));
  H.add(hat);
  const tassels = [];
  for (const s of [-1, 1]) {
    const t = new THREE.Group();
    t.position.set(s * 0.15, HEAD_Y + 0.056, 0.02);
    const parts = [part(limbGeo(0.17, 0.004, 0.004, 4), M.crimsonPlain, 0, 0, 0)];
    let row = 0;
    for (const n of [1, 2, 3]) {
      for (let k = 0; k < n; k++) {
        parts.push(part(geo('tassel', () => new THREE.ConeGeometry(0.011, 0.03, 5)), M.crimsonPlain, (k - (n - 1) / 2) * 0.022, -0.18 - row * 0.03, 0));
      }
      row++;
    }
    t.add(mergeMeshes(parts));
    H.add(t);
    tassels.push(t);
  }
  // Right hand on a tall gold processional cross; left hand at rest.
  const armL = arm(U, -1, { sleeve: M.crimsonPlain, upper: 0.19, fore: 0.16 });
  armL.shoulder.rotation.set(-0.1, 0, -0.18);
  armL.elbow.rotation.x = -0.5;
  const armR = arm(U, 1, { sleeve: M.crimsonPlain, upper: 0.19, fore: 0.16 });
  armR.shoulder.rotation.set(-0.2, 0, 0.42);
  armR.elbow.rotation.x = -1.05;
  const g = pointIn(root, armR.grip);
  const staff = new THREE.Group();
  staff.position.set(g.x, 0, g.z);
  staff.add(mergeMeshes([
    part(geo('staff', () => new THREE.CylinderGeometry(0.011, 0.013, 1.2, 6).translate(0, 0.6, 0)), M.gold, 0, 0, 0),
    part(box(0.03, 0.03, 0.03), M.gold, 0, g.y, 0),
    part(box(0.022, 0.16, 0.022), M.gold, 0, 1.24, 0),
    part(box(0.12, 0.022, 0.022), M.gold, 0, 1.25, 0),
    part(sphere(0.022, 8, 6), M.gold, 0, 1.15, 0),
  ]));
  root.add(staff);
  root.scale.setScalar(1.07);
  outlineAll(root, { color: INK, thickness: 0.011 });
  root.userData.rig = { ...b, armL, armR, tassels, hunch: 0.04, headTilt: -0.05, phase: 4.4 };
  return root;
}

const BUILDERS = { peasant, monk, priest, cardinal };

// ---------------------------------------------------------------- style

export default {
  id: '01-woodcut',
  name: 'Plague Woodcut',
  blurb: 'Ink-outlined plague-year figures cut from sepia, soot and parchment.',
  vibe: 'Black Death',
  look: 'grim',
  tileColor: 0x7a705c,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#b4aa94'], [0.55, '#968c79'], [1, '#6c6455']], { vignette: 0.5, grain: 0.08 });
    scene.fog = new THREE.Fog(0x928976, 7, 22);
    scene.add(new THREE.HemisphereLight(0xfff2da, 0x3a3026, 0.7));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
    key.position.set(-2, 3.5, 3);
    scene.add(key);
  },

  build(role) {
    const fig = BUILDERS[role]();
    // Start every figure in its rest pose.
    const r = fig.userData.rig;
    r.upper.rotation.x = r.hunch;
    r.head.rotation.x = r.headTilt;
    return fig;
  },

  // Small idle: breathing sway, slow head turns, and a prop or two moving.
  update(fig, role, t) {
    const r = fig.userData.rig;
    const p = r.phase;
    r.upper.rotation.x = r.hunch + Math.sin(t * 1.4 + p) * 0.012;
    r.upper.rotation.z = Math.sin(t * 0.6 + p) * 0.012;
    r.head.rotation.y = Math.sin(t * 0.42 + p) * 0.22;
    r.head.rotation.x = r.headTilt + Math.sin(t * 0.7 + p) * 0.035;
    if (role === 'peasant') {
      r.armL.shoulder.rotation.x = 0.08 + Math.sin(t * 1.1 + p) * 0.05;
      r.armR.shoulder.rotation.z = 0.3 + Math.sin(t * 0.9 + p) * 0.025;
    } else if (role === 'monk') {
      const bow = Math.max(0, Math.sin(t * 0.33 + p));
      r.upper.rotation.x += bow * bow * bow * 0.16;
      r.rosary.rotation.z = Math.sin(t * 1.3 + p) * 0.12;
      r.rosary.rotation.x = Math.sin(t * 0.9 + p) * 0.08;
    } else if (role === 'priest') {
      r.head.rotation.y *= 0.3;
      r.book.rotation.x = -0.9 + Math.sin(t * 0.8 + p) * 0.04;
    } else if (role === 'cardinal') {
      for (let i = 0; i < r.tassels.length; i++) r.tassels[i].rotation.z = Math.sin(t * 1.6 + i * 1.3) * 0.07;
    }
  },
};
