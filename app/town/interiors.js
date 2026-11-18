// Inside a folder's building: a room seen as a cutaway, with one fixture per item in the
// folder (a server rack in the data center, a lit stand in any other building). The walls
// between the camera and the room hide as the view turns. Each room is its own scene with
// its own indoor light, built the first time you go in; scene.js swaps to it.

import * as THREE from 'three';
import { Shape, GLOW, FACE, blink, makeShapeMaterial, indoorUniforms, mix, shade, textWidth } from './shapes';
import { RACK } from './layout';
import { hashString, mulberry32 } from './random';

const E = 0.006; // how far panes stand off what they sit on
const WALL_T = 0.15;
const C = {
  bg: 0x151b23,
  slab: 0x3b424d,
  gap: 0x9aa3ad,
  tiles: [0xdde1e6, 0xd4d9df],
  wood: [0xd9c6a3, 0xd1bc96],
  perf: 0xb5c0cc,
  wall: 0xe2e6ea,
  skirt: 0xa9b1bb,
  cap: 0x2a2f37,
  rack: 0x22262d,
  face: 0x2a2f37,
  seam: 0x3d444f,
  bay: 0x4a525e,
  end: 0x30363f,
  tray: 0xf0c02e,
  pole: 0x8a929c,
  crac: 0xe8ebee,
  grille: 0xa3acb6,
  desk: 0xd3d8de,
  dark: 0x2b313a,
  screen: 0x9fd4ff,
  red: 0xd8473c,
  door: 0x9aa1aa,
  green: 0x52e08a,
  amber: 0xffb340,
};
const LEDS = [C.green, C.green, 0x4fb3ff, C.amber];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (css) => parseInt(css.slice(1), 16);

// The floor: a slab under square tiles, with dark gaps between them. Tiles whose middle is in
// one of the `cool` rectangles are perforated ones (a bluer grey).
function floor(S, w, d, tiles, cool = []) {
  S.box(0, -0.34, 0, w + 2 * WALL_T, 0.32, d + 2 * WALL_T, C.slab);
  S.floor(-w / 2, -d / 2, w / 2, d / 2, -0.01, C.gap);
  const T = 0.6;
  for (let i = 0; i < Math.ceil(w / T); i += 1) {
    for (let j = 0; j < Math.ceil(d / T); j += 1) {
      const x0 = -w / 2 + i * T;
      const z0 = -d / 2 + j * T;
      const x1 = Math.min(x0 + T, w / 2);
      const z1 = Math.min(z0 + T, d / 2);
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const perf = cool.some((r) => mx > r.x0 && mx < r.x1 && mz > r.z0 && mz < r.z1);
      S.floor(x0 + 0.012, z0 + 0.012, x1 - 0.012, z1 - 0.012, 0, perf ? C.perf : tiles[(i + j) % 2]);
    }
  }
}

// The four walls, each in its own shape: a pale wall with a dark cap on its cut top and a
// skirting board along the inside.
function shell(walls, w, d, h) {
  const t = WALL_T;
  const H = h + 0.02;
  walls.n.box(0, -0.02, -d / 2 - t / 2, w + 2 * t, H, t, C.wall);
  walls.s.box(0, -0.02, d / 2 + t / 2, w + 2 * t, H, t, C.wall);
  walls.w.box(-w / 2 - t / 2, -0.02, 0, t, H, d, C.wall);
  walls.e.box(w / 2 + t / 2, -0.02, 0, t, H, d, C.wall);
  walls.n.box(0, h, -d / 2 - t / 2, w + 2 * t + 0.004, 0.04, t + 0.004, C.cap);
  walls.s.box(0, h, d / 2 + t / 2, w + 2 * t + 0.004, 0.04, t + 0.004, C.cap);
  walls.w.box(-w / 2 - t / 2, h, 0, t + 0.004, 0.04, d, C.cap);
  walls.e.box(w / 2 + t / 2, h, 0, t + 0.004, 0.04, d, C.cap);
  walls.n.pane(0, 0.08, -d / 2 + E, w, 0.16, FACE.s, C.skirt);
  walls.s.pane(0, 0.08, d / 2 - E, w, 0.16, FACE.n, C.skirt);
  walls.w.pane(-w / 2 + E, 0.08, 0, d, 0.16, FACE.e, C.skirt);
  walls.e.pane(w / 2 - E, 0.08, 0, d, 0.16, FACE.w, C.skirt);
}

// A server rack standing on the floor at (x, z), its front at +z: a dark cabinet full of
// servers with blinking lights. With an `accent` colour it's one of the folder's own racks:
// glowing edges, lights in its colour and a little screen.
function rack(S, x, z, r, accent = null) {
  const { w, d, h } = RACK;
  S.box(x, 0, z, w, h, d, C.rack); // flush with its neighbours, so nothing shows between
  const f = z + d / 2 + E;
  S.pane(x, h / 2, f, w - 0.1, h - 0.12, FACE.s, C.face);
  const units = 10;
  const bottom = 0.12;
  const uh = (h - 0.1 - bottom) / units;
  const leds = accent ? [accent, mix(accent, 0xffffff, 0.5), C.green] : LEDS;
  for (let u = 0; u < units; u += 1) {
    const y = bottom + u * uh;
    S.pane(x, y + uh - 0.008, f + E, w - 0.14, 0.012, FACE.s, C.seam);
    if (!accent && r() < 0.2) continue; // an empty slot
    if (r() < 0.55) S.pane(x - 0.08, y + uh / 2, f + E, 0.26, uh * 0.42, FACE.s, C.bay);
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i += 1) {
      S.pane(x + w / 2 - 0.1 - i * 0.05, y + uh / 2, f + E, 0.026, 0.026, FACE.s, leds[Math.floor(r() * leds.length)], blink(r()));
    }
  }
  if (accent) {
    for (const s of [-1, 1]) S.pane(x + s * (w / 2 - 0.035), h / 2, f + 2 * E, 0.03, h - 0.05, FACE.s, accent, GLOW.always);
    S.pane(x, h - 0.04, f + 2 * E, w - 0.1, 0.03, FACE.s, accent, GLOW.always);
    S.pane(x - 0.03, 1.47, f + 2 * E, 0.36, 0.2, FACE.s, C.dark);
    S.pane(x - 0.03, 1.47, f + 3 * E, 0.3, 0.14, FACE.s, mix(accent, 0xffffff, 0.55), GLOW.always);
  }
}

// The data center: rows of racks under yellow cable trays, perforated tiles in the cold
// aisles, cooling units down the left wall, an operator's desk, fire suppression tanks, the
// monitoring wall at the back and an exit.
function datacenter({ room, walls, inside, accent, r, fixture, name }) {
  const { w, d } = inside.room;
  const { rows, perRow, rowX0, rowZ } = inside;
  const rowLen = perRow * RACK.w;
  const taken = new Set(inside.fixtures.map((f) => `${f.row}:${f.slot}`));
  const trayY = RACK.h + 0.22;

  floor(
    room,
    w,
    d,
    C.tiles,
    rowZ.map((z) => ({ x0: rowX0, x1: rowX0 + rowLen, z0: z + RACK.d / 2, z1: z + RACK.d / 2 + 1.25 }))
  );

  for (let k = 0; k < rows; k += 1) {
    const z = rowZ[k];
    for (let s = 0; s < perRow; s += 1) {
      if (!taken.has(`${k}:${s}`)) rack(room, rowX0 + (s + 0.5) * RACK.w, z, r);
    }
    for (const x of [rowX0 - 0.03, rowX0 + rowLen + 0.03]) room.box(x, 0, z, 0.06, RACK.h + 0.04, RACK.d + 0.06, C.end);
    // The cable tray over the row on a pole at each end, with fibre and copper in it.
    const tx = rowX0 + rowLen / 2;
    room.box(tx, trayY, z, rowLen + 0.44, 0.025, 0.36, C.tray);
    for (const s of [-1, 1]) room.box(tx, trayY, z + s * 0.17, rowLen + 0.44, 0.09, 0.02, C.tray);
    room.box(tx, trayY + 0.025, z - 0.06, rowLen + 0.4, 0.04, 0.12, 0x3d7fd1);
    room.box(tx, trayY + 0.025, z + 0.07, rowLen + 0.4, 0.035, 0.1, 0xeeeeea);
    for (const x of [rowX0 - 0.2, rowX0 + rowLen + 0.2]) room.box(x, 0, z, 0.05, trayY, 0.05, C.pole);
    // The row's letter on a plate hung from the tray, over the front of the row.
    const plateX = rowX0 + rowLen - 0.16;
    const px = 0.04;
    room.box(plateX, trayY + 0.01, z + 0.36, 0.03, 0.03, 0.4, C.pole);
    room.box(plateX, trayY - 0.18, z + 0.55, 0.26, 0.26, 0.02, 0xf4f5f6);
    room.text(String.fromCharCode(65 + (k % 26)), plateX, trayY - 0.05 - 2.5 * px, z + 0.56 + E, px, FACE.s, C.dark);
  }

  // The folder's own racks.
  for (const f of inside.fixtures) fixture(f, (S) => rack(S, 0, 0, r, accent), { top: trayY + 0.12 });

  // Cooling units down the left wall, blowing into the room.
  const n = Math.max(2, Math.round((d - 1.5) / 2.6));
  for (let i = 0; i < n; i += 1) {
    const z = -d / 2 + 1.1 + (i * (d - 2.6)) / Math.max(1, n - 1);
    const x = -w / 2 + 0.42;
    room.box(x, 0, z, 0.8, 1.95, 1.25, C.crac);
    room.box(x, 1.95, z, 0.84, 0.05, 1.29, C.grille);
    const fx = x + 0.4 + E;
    for (let k = 0; k < 7; k += 1) room.pane(fx, 0.22 + k * 0.11, z + 0.12, 0.9, 0.035, FACE.e, C.grille);
    room.pane(fx, 1.5, z - 0.2, 0.42, 0.3, FACE.e, C.dark);
    room.pane(fx + E, 1.52, z - 0.2, 0.3, 0.16, FACE.e, C.screen, GLOW.always);
    room.pane(fx, 1.5, z + 0.32, 0.05, 0.05, FACE.e, C.green, blink(r()));
  }

  // The operator's desk by the door: two screens, a keyboard and a chair.
  const dx = w / 2 - 1.15;
  const dz = d / 2 - 0.95;
  room.box(dx, 0.7, dz, 1.5, 0.05, 0.62, C.desk);
  for (const s of [-1, 1]) room.box(dx + s * 0.7, 0, dz, 0.05, 0.7, 0.56, C.pole);
  for (const s of [-1, 1]) {
    const mx = dx + s * 0.37;
    room.box(mx, 0.75, dz - 0.18, 0.08, 0.12, 0.06, C.dark);
    room.box(mx, 0.86, dz - 0.2, 0.64, 0.38, 0.04, C.dark);
    room.pane(mx, 1.05, dz - 0.18 + E, 0.58, 0.32, FACE.s, s < 0 ? C.screen : mix(accent, 0xffffff, 0.35), GLOW.always);
  }
  room.box(dx, 0.75, dz + 0.1, 0.5, 0.02, 0.16, C.dark);
  room.cyl(dx, 0, dz + 0.62, 0.05, 0.42, C.dark, { seg: 6 });
  room.box(dx, 0.42, dz + 0.62, 0.46, 0.07, 0.46, 0x3b4655);
  room.box(dx, 0.49, dz + 0.83, 0.46, 0.5, 0.06, 0x3b4655);

  // Fire suppression tanks in the back corner.
  for (let i = 0; i < 3; i += 1) {
    const x = w / 2 - 0.32;
    const z = -d / 2 + 0.35 + i * 0.4;
    room.cyl(x, 0, z, 0.15, 1.15, C.red, { seg: 10 });
    room.cyl(x, 1.15, z, 0.15, 0.08, C.red, { top: 0.08, seg: 10 });
    room.cyl(x, 1.23, z, 0.04, 0.08, C.pole, { seg: 6 });
  }

  // The monitoring wall at the back: the folder's name, server status and load bars.
  const bz = -d / 2;
  walls.n.box(0.2, 1.0, bz + 0.04, 3.8, 1.35, 0.08, C.dark);
  const fz = bz + 0.08 + E;
  const label = textWidth(name) <= 40 ? name : '';
  if (label) {
    const px = Math.min(0.1, 1.2 / textWidth(label));
    walls.n.text(label, -0.95, 1.67 - 2.5 * px, fz, px, FACE.s, accent, GLOW.always);
  }
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      walls.n.pane(-1.47 + i * 0.15, 1.2 + j * 0.13, fz, 0.1, 0.08, FACE.s, r() < 0.85 ? C.green : C.amber, blink(r()));
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const bh = 0.15 + r() * 0.75;
    walls.n.pane(0.35 + i * 0.13, 1.12 + bh / 2, fz, 0.08, bh, FACE.s, i % 4 === 3 ? C.amber : mix(accent, C.green, 0.3), GLOW.always);
  }

  // The exit, on the right wall, and the way in, on the front wall.
  const ex = w / 2 - E;
  walls.e.pane(ex, 1.0, 0, 1.0, 2.0, FACE.w, C.door);
  walls.e.pane(ex - E, 1.0, 0, 0.015, 2.0, FACE.w, 0x7d848d);
  for (const s of [-1, 1]) walls.e.pane(ex - E, 1.0, s * 0.25, 0.3, 0.04, FACE.w, 0x5d636b);
  walls.e.box(w / 2 - 0.05, 2.12, 0, 0.1, 0.2, 0.5, C.dark);
  walls.e.text('EXIT', w / 2 - 0.1 - E, 2.162, 0, 0.024, FACE.w, 0x3ccf6e, GLOW.always);
  walls.s.pane(0.6, 1.0, d / 2 - E, 1.0, 2.0, FACE.n, C.door);
  walls.s.pane(0.6, 1.0, d / 2 - 2 * E, 0.015, 2.0, FACE.n, 0x7d848d);
  walls.s.pane(-0.05, 1.2, d / 2 - E, 0.1, 0.16, FACE.n, C.dark);
  walls.s.pane(-0.05, 1.24, d / 2 - 2 * E, 0.05, 0.05, FACE.n, C.green, GLOW.always);
}

// Any other building: a wooden floor, a rug, the folder's name on the back wall and a lit
// stand for each item.
function hall({ room, walls, inside, accent, fixture, name }) {
  const { w, d } = inside.room;
  floor(room, w, d, C.wood);
  room.box(0, 0, 0.2, w * 0.6, 0.012, d - 1.8, mix(accent, 0xffffff, 0.55));
  for (const f of inside.fixtures) {
    fixture(
      f,
      (S) => {
        S.box(0, 0, 0, 0.9, 0.9, 0.9, 0xf1ede6);
        S.box(0, 0.9, 0, 1.0, 0.06, 1.0, 0xd9d2c4);
        S.box(0, 0.96, 0, 0.42, 0.42, 0.42, accent, { glow: GLOW.lamp, ry: 0.6 });
      },
      { top: 1.5, slide: 'up' }
    );
  }
  const label = textWidth(name) <= 60 ? name : '';
  if (label) {
    const px = Math.min(0.09, (w - 2) / textWidth(label));
    walls.n.text(label, 0, 1.5, -d / 2 + E, px, FACE.s, shade(accent, 0.8));
  }
}

const ROOMS = { datacenter, hall };

export function buildInterior(building, { shadowSize = 2048 } = {}) {
  const inside = building.inside;
  const { w, d, h } = inside.room;
  const accent = hex(building.color);
  const r = mulberry32(hashString(building.name) ^ 0x2c1b3c6d);
  const material = makeShapeMaterial({ uniforms: indoorUniforms });
  const highlight = makeShapeMaterial({ uniforms: indoorUniforms, highlight: 1 });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  const hemi = new THREE.HemisphereLight(0xeef4ff, 0x3a414c, 1.8);
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(-w * 0.3, 14, d * 0.35);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  const R = Math.hypot(w, d) / 2 + 1;
  Object.assign(key.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 40 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(hemi, key, key.target);

  const objects = new Map();
  const pickables = [];
  function fixture(f, draw, { top, slide = 'front' } = {}) {
    const S = new Shape();
    draw(S);
    const geometry = S.geometry();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(f.center.x, 0, f.center.z);
    mesh.rotation.y = f.facing;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = f.id;
    scene.add(mesh);
    pickables.push(mesh);
    const up = slide === 'up';
    objects.set(f.id, {
      ...f,
      mesh,
      material,
      highlight,
      height: top ?? geometry.boundingBox.max.y,
      lift: 0,
      base: mesh.position.clone(),
      // Racks slide out of their row toward you; anything else rises a little.
      dir: up ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.sin(f.facing), 0, Math.cos(f.facing)),
      reach: up ? { hover: 0.08, selected: 0.22 } : { hover: 0.12, selected: 0.5 },
      foot: { w: f.size.w + 0.24, d: f.size.d + 0.24 },
    });
  }

  const room = new Shape();
  const walls = { n: new Shape(), s: new Shape(), e: new Shape(), w: new Shape() };
  shell(walls, w, d, h);
  (ROOMS[inside.kind] || hall)({ room, walls, inside, accent, r, fixture, name: building.name });

  const roomMesh = new THREE.Mesh(room.geometry(), material);
  roomMesh.castShadow = true;
  roomMesh.receiveShadow = true;
  scene.add(roomMesh);
  // Each wall with the way it faces out of the room.
  const wallMeshes = [
    [walls.n, 0, -1],
    [walls.s, 0, 1],
    [walls.e, 1, 0],
    [walls.w, -1, 0],
  ].map(([S, nx, nz]) => {
    const mesh = new THREE.Mesh(S.geometry(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, nx, nz };
  });

  const MIN = 4.5;
  const MAX = 40;
  return {
    id: building.id,
    scene,
    objects,
    pickables,
    floorY: 0,
    min: MIN,
    max: MAX,
    yaw: 0,
    bounds: { minX: -w / 2 - 1, maxX: w / 2 + 1, minZ: -d / 2 - 1, maxZ: d / 2 + 2 },
    view: inside.view,
    // A steeper view than outside, to see down into the aisles.
    pitch: (dist) => 0.8 + 0.25 * clamp((dist - MIN) / (MAX - MIN), 0, 1),
    // Hide the walls on the camera's side of the room (`yaw` is the camera's angle about y).
    update(dt, yaw) {
      const cx = Math.sin(yaw);
      const cz = Math.cos(yaw);
      for (const wm of wallMeshes) wm.mesh.visible = wm.nx * cx + wm.nz * cz < 0.35;
    },
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      material.dispose();
      highlight.dispose();
      key.shadow.map?.dispose();
    },
  };
}
