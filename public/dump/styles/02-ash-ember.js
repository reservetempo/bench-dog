// Style 02: Ash & Ember (post-apocalypse, grim).
// Gaunt, hunched survivors as faceted low-poly (flat shading, few segments,
// jittered vertices) in ash greys and charcoal, under cold blue moonlight.
// The peasant's torch is the only warm light; embers drift up from it.

import * as THREE from 'three';
import {
  torch, embers, blobShadow, lathe, raggedHem, jitter, mergeMeshes, eyePair,
  canvasTexture, gradientBackground, pointIn, wobble,
} from '../kit.js';

const HIP = 0.45;
const NECK = 0.74;
const HEAD_Y = 0.8;
const HEAD_R = 0.062;

// ---------------------------------------------------------------- materials

const flat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// Soot-stained cloth: multiplies a mid-grey base down to near black, leaves the
// hem ash-dusted and adds a few darker stains and pale smudges (v = 0 is the hem).
const sootTex = canvasTexture(64, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.28, '#727272'); g.addColorStop(1, '#6a6a6a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = i % 3 ? `rgba(0,0,0,${0.15 + r() * 0.2})` : `rgba(255,255,255,${0.08 + r() * 0.12})`;
    ctx.beginPath(); ctx.ellipse(r() * w, h * (0.15 + r() * 0.85), 2 + r() * 4, 2 + r() * 5, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
});

const M = {
  skin: flat(0x958f87),
  ash: flat(0x77736c),
  ashShell: flat(0x77736c, { side: THREE.DoubleSide }),
  ashLight: flat(0x9b958a),
  ashDark: flat(0x4c4946),
  charcoal: flat(0x3a3836),
  charcoalShell: flat(0x3a3836, { side: THREE.DoubleSide }),
  soot: flat(0x6a6662, { map: sootTex }),
  sootPlain: flat(0x262423),
  bone: flat(0xb8b09f),
  scarf: flat(0x5e4b43, { side: THREE.DoubleSide }),
  red: flat(0x7e3d35),
  redShell: flat(0x6a312b, { side: THREE.DoubleSide }),
  wood: flat(0x4b3d31),
  metal: flat(0x6f6a5f),
  rope: flat(0x8a7e69),
  rag: flat(0x5a5650),
};

// ---------------------------------------------------------------- geometry

const cache = new Map();
const geo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

// Faceted blob: low icosphere with jittered vertices.
const rock = (r, amt = 0.15, seed = 1, detail = 1) => geo(`r${r}:${amt}:${seed}:${detail}`,
  () => jitter(new THREE.IcosahedronGeometry(r, detail), r * amt, seed));
const limbGeo = (len, r0, r1, seg = 5) => geo(`l${len}:${r0}:${r1}:${seg}`,
  () => new THREE.CylinderGeometry(r0, r1, len, seg, 1).translate(0, -len / 2, 0));
const box = (x, y, z) => geo(`b${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
// Lathe with a torn hem and a few jittered facets.
const rag = (key, pts, seg, hem, j, seed, theta) => geo(`g${key}`, () => {
  const g = lathe(pts, seg, theta);
  if (hem) raggedHem(g, hem, seed);
  return jitter(g, j, seed);
});
const shell = (key, r, open, thetaEnd, hem, seed) => geo(`h${key}`, () => {
  const g = new THREE.SphereGeometry(r, 9, 6, Math.PI / 2 + open / 2, Math.PI * 2 - open, 0, thetaEnd);
  if (hem) raggedHem(g, hem, seed);
  return jitter(g, r * 0.08, seed);
});

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
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

// Long thin arm: shoulder and elbow pivots, `grip` at the hand.
function arm(parent, side, { sleeve, upper = 0.2, fore = 0.19, r = 0.019, cuff = 0.024, hand = true }) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.1, 0.71, 0);
  shoulder.add(part(rock(r * 1.4, 0.1, 3, 0), sleeve));
  shoulder.add(part(limbGeo(upper, r, r * 0.9), sleeve));
  const elbow = new THREE.Group();
  elbow.position.y = -upper;
  shoulder.add(elbow);
  elbow.add(part(limbGeo(fore, r * 0.85, cuff), sleeve));
  if (hand) {
    const h = part(rock(0.019, 0.2, 7, 0), M.skin, 0, -fore - 0.012, 0);
    h.scale.set(0.9, 1.3, 0.8);
    elbow.add(h);
  }
  const grip = new THREE.Object3D();
  grip.position.y = -fore - 0.014;
  elbow.add(grip);
  parent.add(shoulder);
  return { shoulder, elbow, grip };
}

// Gaunt body: skirt/legs stay put, upper body hunches from the hip, head lifts to look ahead.
function body({ skirt, skirtMat, torso, torsoMat, seed }) {
  const root = new THREE.Group();
  if (skirt) root.add(part(skirt, skirtMat));
  const [upper, U] = pivot(root, HIP);
  U.add(part(torso, torsoMat));
  U.add(part(limbGeo(0.07, 0.02, 0.026, 5), M.skin, 0, NECK + 0.035, 0.01));
  const [head, H] = pivot(U, NECK);
  const skull = part(rock(HEAD_R, 0.1, seed), M.skin, 0, HEAD_Y, 0.012);
  skull.scale.set(0.88, 1.16, 1);
  H.add(skull);
  const jaw = part(rock(0.04, 0.12, seed + 1, 0), M.skin, 0, HEAD_Y - 0.045, 0.03);
  jaw.scale.set(0.9, 0.7, 1);
  H.add(jaw);
  const eyes = eyePair(null, { yaw: 0.38, pitch: 0.05, dot: { headRadius: HEAD_R * 0.98, size: 0.009, color: 0x0c0b0b } });
  eyes.position.set(0, HEAD_Y, 0.014);
  H.add(eyes);
  root.add(blobShadow({ radius: 0.26, opacity: 0.6 }));
  return { root, upper, U, head, H };
}

function legs(root, mat) {
  for (const s of [-1, 1]) {
    const leg = part(limbGeo(0.42, 0.024, 0.018, 5), mat, s * 0.045, 0.44, 0);
    leg.rotation.z = s * 0.05;
    leg.rotation.x = s * 0.06;
    const wrap = part(limbGeo(0.12, 0.024, 0.026, 5), M.rag, s * 0.054, 0.16, s * 0.005);
    const foot = part(rock(0.032, 0.2, 5 + s, 0), M.rag, s * 0.058, 0.022, 0.02);
    foot.scale.set(0.8, 0.6, 1.4);
    root.add(leg, wrap, foot);
  }
}

// Rotate a held prop so it hangs or stands straight in figure space, then tilt it.
function straighten(root, obj, tiltX = 0, tiltZ = 0) {
  root.updateMatrixWorld(true);
  const q = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, 0, tiltZ)));
}

// ---------------------------------------------------------------- roles

function peasant() {
  const b = body({
    torso: rag('p-cloak', [[0.17, 0.27], [0.158, 0.38], [0.14, 0.52], [0.13, 0.62], [0.118, 0.69], [0.08, 0.735], [0.03, 0.76]], 8, 0.07, 0.01, 21),
    torsoMat: M.ash, seed: 2,
  });
  const { root, U, H } = b;
  legs(root, M.ashDark);
  // Patches sewn on the cloak.
  const patches = [[0.5, 0.42, M.ashLight], [-0.9, 0.55, M.ashDark], [2.6, 0.4, M.ashLight], [-2.2, 0.6, M.rag]].map(([a, y, m], i) => {
    const r = 0.135 + (0.6 - y) * 0.17;
    const p = part(box(0.06 + i * 0.008, 0.055, 0.008), m, Math.sin(a) * r, y, Math.cos(a) * r);
    p.rotation.set(-0.12, a, (i - 1.5) * 0.2);
    return p;
  });
  U.add(mergeMeshes(patches));
  // Ragged wide hat with a drooping brim.
  const hat = part(rag('p-hat', [[0.17, -0.035], [0.13, -0.006], [0.074, 0.01], [0.068, 0.05], [0.045, 0.072], [0.002, 0.078]], 9, 0.03, 0.006, 4), M.ashDark, 0, HEAD_Y + 0.045, 0.01);
  hat.rotation.set(0.12, 0, -0.08);
  H.add(hat);
  // Scarf wrapped over the mouth and nose, one tail hanging.
  const scarf = part(geo('scarf', () => jitter(new THREE.CylinderGeometry(0.06, 0.066, 0.05, 8, 1, true), 0.004, 9)), M.scarf, 0, HEAD_Y - 0.03, 0.016);
  H.add(scarf);
  const tail = part(box(0.035, 0.13, 0.008), M.scarf, 0.04, HEAD_Y - 0.1, -0.05);
  tail.rotation.set(0.3, 0.6, 0.15);
  H.add(tail);
  const armL = arm(U, -1, { sleeve: M.ash, cuff: 0.03 });
  armL.shoulder.rotation.set(0.05, 0, -0.12);
  armL.elbow.rotation.x = -0.35;
  const armR = arm(U, 1, { sleeve: M.ash, cuff: 0.03 });
  armR.shoulder.rotation.set(-0.95, 0, 0.32);
  armR.elbow.rotation.x = -0.8;
  const t = torch({ handleMaterial: M.wood, wrapMaterial: M.rag, length: 0.32, intensity: 2.2, distance: 3.2, decay: 1.2, flameSize: 1.15 });
  armR.grip.add(t);
  straighten(root, t, -0.35, -0.15);
  const sparks = embers({ source: t.userData.flameTip, count: 18, rise: 0.7, spread: 0.09, size: 0.045 });
  root.add(sparks);
  root.userData.rig = { ...b, armL, armR, hunch: 0.3, headTilt: -0.22, phase: 0.4 };
  return root;
}

function monk() {
  const b = body({
    skirt: rag('m-skirt', [[0.19, 0.0], [0.172, 0.12], [0.15, 0.3], [0.132, 0.47]], 8, 0.05, 0.008, 31), skirtMat: M.charcoal,
    torso: rag('m-torso', [[0.132, 0.42], [0.134, 0.58], [0.124, 0.66], [0.1, 0.71], [0.06, 0.74], [0.03, 0.76]], 8, 0, 0.006, 32),
    torsoMat: M.charcoal, seed: 6,
  });
  const { root, U, H } = b;
  // Torn shoulder mantle and a big tattered hood.
  U.add(part(rag('m-mantle', [[0.17, 0.5], [0.16, 0.6], [0.136, 0.67], [0.096, 0.72], [0.05, 0.755]], 8, 0.07, 0.008, 33), M.charcoalShell));
  const hood = part(shell('m-hood', 0.092, 1.5, Math.PI * 0.86, 0.04, 34), M.charcoalShell, 0, HEAD_Y + 0.012, -0.01);
  hood.scale.set(1, 1.15, 1.12);
  H.add(hood);
  const peak = part(geo('m-peak', () => jitter(new THREE.ConeGeometry(0.05, 0.13, 5), 0.006, 35)), M.charcoal, 0, HEAD_Y + 0.08, -0.06);
  peak.rotation.x = -0.9;
  H.add(peak);
  U.add(part(geo('m-belt', () => jitter(new THREE.TorusGeometry(0.135, 0.011, 4, 9).rotateX(Math.PI / 2), 0.004, 36)), M.rope, 0, 0.46, 0));
  // Left hand clutches the robe; right holds out a hand bell.
  const armL = arm(U, -1, { sleeve: M.charcoal, r: 0.024, cuff: 0.04 });
  armL.shoulder.rotation.set(-0.2, 0, 0.12);
  armL.elbow.rotation.x = -1.1;
  const armR = arm(U, 1, { sleeve: M.charcoal, r: 0.024, cuff: 0.04 });
  armR.shoulder.rotation.set(-0.75, 0, 0.18);
  armR.elbow.rotation.x = -0.35;
  const bell = new THREE.Group();
  bell.add(part(geo('bell', () => jitter(lathe([[0.045, -0.085], [0.04, -0.075], [0.03, -0.045], [0.022, -0.02], [0.006, -0.008]], 7), 0.002, 37)), M.metal));
  bell.add(part(limbGeo(0.03, 0.008, 0.008, 5), M.wood, 0, 0.022, 0));
  bell.add(part(rock(0.011, 0.1, 38, 0), M.ashDark, 0, -0.088, 0));
  armR.grip.add(bell);
  straighten(root, bell, 0, 0);
  root.userData.rig = { ...b, armL, armR, bell, hunch: 0.34, headTilt: -0.12, phase: 1.9 };
  return root;
}

function priest() {
  const b = body({
    skirt: rag('pr-skirt', [[0.168, 0.0], [0.158, 0.1], [0.142, 0.3], [0.128, 0.47]], 8, 0.03, 0.006, 41), skirtMat: M.soot,
    torso: rag('pr-torso', [[0.128, 0.42], [0.13, 0.58], [0.122, 0.66], [0.098, 0.71], [0.056, 0.74], [0.03, 0.76]], 8, 0, 0.005, 42),
    torsoMat: M.sootPlain, seed: 8,
  });
  const { root, U, H } = b;
  U.add(part(geo('pr-collar', () => jitter(new THREE.CylinderGeometry(0.032, 0.04, 0.034, 7), 0.002, 43)), M.bone, 0, NECK + 0.012, 0.014));
  // Thin hair over a bony head.
  const hair = part(shell('pr-hair', 0.066, 1.6, Math.PI * 0.42, 0, 44), M.ashDark, 0, HEAD_Y + 0.006, 0.01);
  hair.scale.set(0.92, 1.12, 1.04);
  H.add(hair);
  // Left hand on the chest; right swings a cracked censer on a chain.
  const armL = arm(U, -1, { sleeve: M.sootPlain, cuff: 0.03 });
  armL.shoulder.rotation.set(-0.35, 0, 0.35);
  armL.elbow.rotation.x = -1.7;
  const armR = arm(U, 1, { sleeve: M.sootPlain, cuff: 0.03 });
  armR.shoulder.rotation.set(-0.5, 0, 0.22);
  armR.elbow.rotation.x = -0.3;
  const censer = new THREE.Group();
  const chainLen = 0.2;
  const links = [];
  for (let i = 0; i < 6; i++) {
    const l = part(geo('link', () => new THREE.TorusGeometry(0.008, 0.002, 3, 5)), M.metal, 0, -0.015 - i * 0.03, 0);
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    links.push(l);
  }
  censer.add(mergeMeshes(links));
  const bowl = part(geo('bowl', () => jitter(new THREE.SphereGeometry(0.048, 7, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0.004, 45)), M.metal, 0, -chainLen, 0);
  const lid = part(geo('lid', () => jitter(new THREE.SphereGeometry(0.045, 7, 3, 0, Math.PI * 1.6, 0, Math.PI / 2), 0.004, 46)), M.ashDark, 0.006, -chainLen + 0.012, 0);
  lid.rotation.z = 0.35;
  censer.add(bowl, lid);
  armR.grip.add(censer);
  straighten(root, censer, 0, 0);
  root.userData.rig = { ...b, armL, armR, censer, censerRest: censer.quaternion.clone(), hunch: 0.28, headTilt: -0.05, phase: 3.3 };
  return root;
}

function cardinal() {
  const b = body({
    skirt: rag('c-skirt', [[0.2, 0.0], [0.186, 0.1], [0.16, 0.3], [0.138, 0.47]], 9, 0.05, 0.008, 51), skirtMat: M.red,
    torso: rag('c-torso', [[0.138, 0.42], [0.14, 0.58], [0.13, 0.66], [0.104, 0.71], [0.058, 0.74], [0.03, 0.76]], 9, 0, 0.006, 52),
    torsoMat: M.red, seed: 10,
  });
  const { root, U, H } = b;
  U.add(part(rag('c-cape', [[0.2, 0.36], [0.18, 0.5], [0.16, 0.61], [0.14, 0.68], [0.1, 0.72], [0.05, 0.755]], 9, 0.08, 0.008, 53), M.redShell));
  // Broken tall hat: the top half has snapped and leans over.
  const hat = new THREE.Group();
  hat.position.set(0, HEAD_Y + 0.04, 0.005);
  hat.add(part(geo('c-band', () => jitter(new THREE.CylinderGeometry(0.068, 0.064, 0.03, 8), 0.003, 54)), M.metal, 0, 0, 0));
  hat.add(part(rag('c-hat', [[0.066, 0.01], [0.078, 0.09], [0.08, 0.16]], 8, 0, 0.004, 55), M.red));
  const top = part(rag('c-top', [[0.08, 0], [0.06, 0.08], [0.004, 0.15]], 8, 0.03, 0.004, 56), M.red, 0.03, 0.15, -0.01);
  top.rotation.set(-0.3, 0, -0.85);
  hat.add(top);
  H.add(hat);
  // Leans on a crooked staff topped with a broken cross.
  const armR = arm(U, 1, { sleeve: M.red, cuff: 0.034 });
  armR.shoulder.rotation.set(-0.55, 0, 0.35);
  armR.elbow.rotation.x = -0.75;
  const armL = arm(U, -1, { sleeve: M.red, cuff: 0.034 });
  armL.shoulder.rotation.set(-0.1, 0, -0.1);
  armL.elbow.rotation.x = -0.5;
  root.scale.setScalar(1.05);
  const g = pointIn(root, armR.grip);
  const segs = [];
  const bends = [0.04, -0.06, 0.05, -0.03];
  let x = 0, y = 0;
  for (let i = 0; i < 4; i++) {
    const len = 0.3;
    const s = part(geo(`staff${i}`, () => jitter(new THREE.CylinderGeometry(0.011, 0.014, len, 5).translate(0, len / 2, 0), 0.002, 60 + i)), M.wood, x, y, 0);
    s.rotation.z = bends[i];
    segs.push(s);
    x -= Math.sin(bends[i]) * len; y += Math.cos(bends[i]) * len;
  }
  segs.push(part(box(0.022, 0.15, 0.022), M.wood, x, y + 0.04, 0));
  const arm1 = part(box(0.07, 0.02, 0.02), M.wood, x + 0.035, y + 0.06, 0);
  arm1.rotation.z = -0.15;
  segs.push(arm1);
  const staff = mergeMeshes(segs);
  staff.position.set(g.x - x * 0.4, 0, g.z);
  root.add(staff);
  root.userData.rig = { ...b, armL, armR, hunch: 0.2, headTilt: -0.1, phase: 4.8 };
  return root;
}

const BUILDERS = { peasant, monk, priest, cardinal };
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// ---------------------------------------------------------------- style

export default {
  id: '02-ash-ember',
  name: 'Ash & Ember',
  blurb: 'Gaunt low-poly survivors in moonlit ash; one torch, drifting embers.',
  vibe: 'post-apocalypse',
  look: 'grim',
  tileColor: 0x4a4c51,

  setupScene(scene) {
    scene.background = gradientBackground([[0, '#1e2a3b'], [0.55, '#121923'], [1, '#07090c']], { vignette: 0.55, grain: 0.05 });
    scene.fog = new THREE.Fog(0x10161f, 6, 19);
    scene.add(new THREE.HemisphereLight(0x6f86b0, 0x16161a, 1.5));
    const moon = new THREE.DirectionalLight(0xb0c8ff, 3.2);
    moon.position.set(-3, 4, -2);
    const fill = new THREE.DirectionalLight(0x8098c4, 1.5);
    fill.position.set(2, 2, 4);
    scene.add(moon, fill);
  },

  build(role) {
    const fig = BUILDERS[role]();
    const r = fig.userData.rig;
    r.upper.rotation.x = r.hunch;
    r.head.rotation.x = r.headTilt;
    return fig;
  },

  // Slow, heavy breathing and shivers; the bell rings now and then, the censer swings.
  update(fig, role, t) {
    const r = fig.userData.rig;
    const p = r.phase;
    r.upper.rotation.x = r.hunch + Math.sin(t * 1.1 + p) * 0.02;
    r.upper.rotation.z = wobble(t * 0.4, p) * 0.02;
    r.head.rotation.x = r.headTilt + Math.sin(t * 1.1 + p + 0.6) * 0.02;
    r.head.rotation.y = wobble(t * 0.3, p + 2) * 0.3;
    r.head.rotation.z = wobble(t * 3.1, p) * 0.006;
    if (role === 'peasant') {
      r.head.rotation.y = Math.sin(t * 0.5 + p) * 0.45;
      r.armR.shoulder.rotation.x = -0.95 + Math.sin(t * 0.8 + p) * 0.04;
    } else if (role === 'monk') {
      const ring = Math.max(0, Math.sin(t * 0.5 + p)) ** 6;
      r.armR.elbow.rotation.z = Math.sin(t * 9) * 0.25 * ring;
    } else if (role === 'priest') {
      _e.set(Math.sin(t * 1.6 + p) * 0.12, 0, Math.sin(t * 1.6 + p + 1.2) * 0.3);
      r.censer.quaternion.copy(r.censerRest).multiply(_q.setFromEuler(_e));
    }
  },
};
