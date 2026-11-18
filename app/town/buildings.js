// Voxel models: one builder per building theme (see THEMES in layout.js), plus trees, lamps,
// stations, the cross on the hill, train cars and clouds. Building voxels are VOX (0.2) across;
// a lot is 15 voxels wide, so buildings stay within x and z from -6 to 6, with the front at +z.

import { Voxels, GLOW } from './voxels';
import { hash3, hashString, mulberry32 } from './random';

const WARM = [0xffd27f, 0xffe2a6, 0xffc766];

function windowVoxel(rnd) {
  return rnd() < 0.68 ? [WARM[Math.floor(rnd() * WARM.length)], GLOW.window] : [0x30465f, GLOW.darkWindow];
}

// Put windows on the outside walls of a box at the given rows, every `step` voxels.
function addWindows(V, rnd, { x0, x1, z0, z1, rows, step = 2, phase = 1, sides = 'nesw' }) {
  for (const y of rows) {
    if (sides.includes('s')) for (let x = x0 + phase; x < x1; x += step) V.paint(x, y, z1, x, y, z1, windowVoxel(rnd));
    if (sides.includes('n')) for (let x = x0 + phase; x < x1; x += step) V.paint(x, y, z0, x, y, z0, windowVoxel(rnd));
    if (sides.includes('e')) for (let z = z0 + phase; z < z1; z += step) V.paint(x1, y, z, x1, y, z, windowVoxel(rnd));
    if (sides.includes('w')) for (let z = z0 + phase; z < z1; z += step) V.paint(x0, y, z, x0, y, z, windowVoxel(rnd));
  }
}

// Same window on two rows (a tall window), from addWindows' columns.
const rowsOf = (...pairs) => pairs.flat();

function museum(V, rnd) {
  const stone = 0xd8cfbb;
  const wall = 0xefe7d4;
  const column = 0xfaf6ec;
  const roof = 0x6fae95;
  V.box(-6, 0, -6, 6, 0, 6, stone);
  V.box(-5, 1, -5, 5, 1, 5, stone);
  V.box(-5, 2, -5, 5, 7, 2, wall);
  for (const x of [-5, -3, -1, 1, 3, 5]) V.box(x, 2, 4, x, 7, 4, column);
  V.box(-5, 8, -5, 5, 8, 5, stone);
  for (let k = 0; k <= 5; k += 1) {
    V.box(-5 + k, 9 + k, -5, 5 - k, 9 + k, 5, (x, y, z) => ((z === 5 || z === -5) && Math.abs(x) < 5 - k ? wall : roof));
  }
  V.set(0, 10, 5, 0xd9b44a);
  V.box(-1, 2, 2, 1, 5, 2, 0x5b3b2a);
  addWindows(V, rnd, { x0: -5, x1: 5, z0: -5, z1: 2, rows: rowsOf(4, 5, 6), step: 2, phase: 2, sides: 'ewn' });
  return 15;
}

function radio(V, rnd) {
  const wall = 0xf1ece2;
  const stripe = 0xd2483f;
  const roof = 0x7b828c;
  V.box(-6, 0, -2, 2, 5, 5, (x, y) => (y === 4 ? stripe : wall));
  V.box(-6, 6, -2, 2, 6, 5, roof);
  V.box(-6, 7, -2, 2, 7, 5, (x, y, z) => (x === -6 || x === 2 || z === -2 || z === 5 ? roof : null));
  addWindows(V, rnd, { x0: -6, x1: 2, z0: -2, z1: 5, rows: [2, 3], step: 2, phase: 1, sides: 'sew' });
  V.box(-1, 0, 5, 0, 2, 5, 0x4a3426);
  // "On air" sign over the door, always lit.
  V.box(-4, 8, 4, -1, 9, 4, 0xe8463c, GLOW.always);
  // Satellite dish.
  V.box(-4, 8, 0, -4, 8, 0, 0x9aa2ad);
  V.box(-5, 9, 0, -3, 10, 0, 0xe9ecef);
  // Lattice radio tower, red and white.
  const band = (y) => (Math.floor(y / 3) % 2 ? 0xffffff : 0xd8392f);
  for (let y = 0; y <= 13; y += 1) {
    for (const [x, z] of [
      [3, -5],
      [5, -5],
      [3, -3],
      [5, -3],
    ]) V.set(x, y, z, band(y));
    if (y % 3 === 0) V.box(3, y, -5, 5, y, -3, (x, yy, z) => (x === 4 && z === -4 ? null : band(y)));
  }
  for (let y = 14; y <= 24; y += 1) V.set(4, y, -4, band(y));
  V.set(4, 25, -4, 0xff3030, GLOW.always);
  return 26;
}

function newspaper(V, rnd) {
  const brick = (x, y) => (y % 2 ? 0xb2513b : 0xa64a35);
  const cream = 0xeee3c8;
  V.box(-5, 0, -5, 5, 15, 4, brick);
  V.box(-6, 16, -6, 6, 16, 5, cream);
  V.box(-5, 4, 4, 5, 4, 4, cream);
  // Shop front, awning and door.
  for (const x of [-4, -3, -2, 2, 3, 4]) V.box(x, 1, 4, x, 3, 4, windowVoxel(rnd));
  V.box(-1, 0, 4, 1, 2, 4, 0x3b2a20);
  V.box(-5, 4, 5, 5, 4, 5, (x) => (x % 2 ? 0x2f8a5b : 0xf4f1e8));
  addWindows(V, rnd, { x0: -5, x1: 5, z0: -5, z1: 4, rows: rowsOf(6, 7, 10, 11, 14), step: 2, phase: 1 });
  // Rooftop newspaper sign: a red masthead over lines of "text".
  V.box(-4, 17, 0, -4, 18, 0, 0x4a4f57);
  V.box(4, 17, 0, 4, 18, 0, 0x4a4f57);
  V.box(-5, 19, 0, 5, 22, 0, (x, y) => {
    if (y === 22) return 0xd23b2f;
    if (y === 19) return 0xf6f3ea;
    return x > -5 && x < 5 && hash3(x, y, 7) < 0.65 ? 0x2b2f36 : 0xf6f3ea;
  });
  V.set(-3, 18, 1, 0xffe39a, GLOW.lamp);
  V.set(3, 18, 1, 0xffe39a, GLOW.lamp);
  return 23;
}

function school(V, rnd) {
  const red = 0xc4473a;
  const trim = 0xf3eee6;
  const roof = 0x4b5059;
  V.box(-6, 0, -4, 6, 0, 3, 0x8d8a85);
  V.box(-6, 1, -4, 6, 6, 3, (x, y, z) => (Math.abs(x) === 6 && (z === -4 || z === 3) ? trim : red));
  for (let k = 0; k <= 4; k += 1) V.box(-7, 7 + k, -5 + k, 7, 7 + k, 4 - k, roof);
  for (const x of [-5, -4, 4, 5]) V.box(x, 2, 3, x, 4, 3, windowVoxel(rnd));
  for (const x of [-2, 2]) V.box(x, 3, 3, x, 4, 3, windowVoxel(rnd));
  V.box(-1, 1, 3, 1, 3, 3, 0x5a3a26);
  V.box(-1, 4, 4, 1, 4, 4, trim);
  addWindows(V, rnd, { x0: -6, x1: 6, z0: -4, z1: 3, rows: [3, 4], step: 3, phase: 2, sides: 'n' });
  // Bell tower on the ridge.
  V.box(-1, 11, -1, 1, 11, 1, trim);
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) V.box(x, 12, z, x, 13, z, trim);
  V.set(0, 12, 0, 0xd8b04a);
  V.box(-2, 14, -2, 2, 14, 2, roof);
  V.box(-1, 15, -1, 1, 15, 1, roof);
  V.set(0, 16, 0, roof);
  // Flagpole with a blue flag and a white cross.
  V.box(-6, 1, 6, -6, 12, 6, 0xd5d8dc);
  V.box(-5, 10, 6, -2, 12, 6, (x, y) => (x === -4 || y === 11 ? 0xffffff : 0x1f4fa8));
  return 17;
}

function factory(V, rnd) {
  const wall = 0x8796a8;
  const roof = 0x6e7681;
  const brick = 0xa5503c;
  V.box(-6, 0, -5, 3, 0, 5, 0x5d6875);
  V.box(-6, 1, -5, 3, 6, 5, wall);
  for (const zs of [-5, -1]) {
    for (let i = 0; i <= 2; i += 1) V.box(-6, 7, zs + i, 3, 7 + i, zs + i, roof);
    V.box(-6, 7, zs + 3, 3, 9, zs + 3, () => windowVoxel(rnd));
  }
  V.box(-6, 7, 3, 3, 7, 5, roof);
  // Rooftop chip: a black body with gold pins.
  V.box(-4, 8, 3, 0, 8, 5, 0x24282e);
  for (const x of [-4, -2, 0]) V.set(x, 8, 6, 0xd9b44a);
  addWindows(V, rnd, { x0: -6, x1: 3, z0: -5, z1: 5, rows: [3, 4], step: 2, phase: 1, sides: 'sw' });
  V.box(-3, 1, 5, -1, 4, 5, 0x4f5862);
  // Office annex and chimney.
  V.box(4, 0, 0, 6, 4, 5, 0xd8d2c4);
  V.box(4, 5, 0, 6, 5, 5, roof);
  addWindows(V, rnd, { x0: 4, x1: 6, z0: 0, z1: 5, rows: [2, 3], step: 2, phase: 1, sides: 'se' });
  V.box(4, 0, -5, 5, 19, -4, (x, y) => (y === 16 || y === 17 ? 0xf0ede6 : y === 19 ? 0x3a3a3a : brick));
  return 20;
}

function castle(V, rnd) {
  const stone = (x, y, z) => (hash3(x, y, z, 9) < 0.3 ? 0x868d95 : 0x9ba2a9);
  const roof = 0xc0392b;
  const gold = 0xe5b93c;
  V.box(-4, 0, -4, 4, 0, 4, 0x6aa84f);
  // Curtain wall with battlements.
  V.box(-5, 0, -5, 5, 4, 5, (x, y, z) => (Math.abs(x) === 5 || Math.abs(z) === 5 ? stone(x, y, z) : null));
  V.box(-5, 5, -5, 5, 5, 5, (x, y, z) => ((Math.abs(x) === 5 || Math.abs(z) === 5) && (x + z) % 2 === 0 ? stone(x, y, z) : null));
  V.clear(-1, 0, 5, 1, 2, 5);
  V.box(-1, 0, 4, 1, 2, 4, 0x4a3222);
  // Corner towers with red caps.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 5;
      const cz = sz * 5;
      V.box(cx - 1, 0, cz - 1, cx + 1, 7, cz + 1, stone);
      V.set(cx + sx, 5, cz + sz, 0x2a2a2a, GLOW.window);
      V.box(cx - 1, 8, cz - 1, cx + 1, 8, cz + 1, roof);
      V.set(cx, 9, cz, roof);
      V.set(cx, 10, cz, roof);
    }
  }
  // The keep, crowned in gold.
  V.box(-2, 0, -3, 2, 9, 1, stone);
  V.box(-2, 10, -3, 2, 10, 1, (x, y, z) => ((Math.abs(x) === 2 || z === -3 || z === 1) && (x + z) % 2 === 0 ? gold : null));
  V.set(0, 10, -1, 0xc23b6a);
  for (const y of [4, 7]) {
    V.paint(0, y, 1, 0, y, 1, windowVoxel(rnd));
    V.paint(-2, y, -1, -2, y, -1, windowVoxel(rnd));
    V.paint(2, y, -1, 2, y, -1, windowVoxel(rnd));
  }
  V.box(0, 11, -1, 0, 14, -1, 0x6b5a48);
  V.box(1, 13, -1, 3, 14, -1, (x) => (x === 1 ? 0x7a3fb0 : gold));
  return 15;
}

function junkyard(V, rnd) {
  V.box(-6, 0, -6, 6, 0, 6, 0x8b6f4e);
  // Fence of corrugated panels, open at the front.
  V.box(-6, 1, -6, 6, 3, 6, (x, y, z) => {
    if (Math.abs(x) !== 6 && Math.abs(z) !== 6) return null;
    if (z === 6 && Math.abs(x) <= 2) return null;
    return (x + z) % 3 === 0 ? 0x6c747c : (x + z) % 2 ? 0x8d969e : 0x7d858c;
  });
  const scrap = [0x9c4f2e, 0x6d7781, 0x4e6e8e, 0x7a8a4e, 0xb3893d, 0x5a4636, 0x8f3b30];
  for (const [hx, hz, r, h] of [
    [-3, -3, 2.6, 5],
    [2, -3, 2.2, 4],
    [-3, 2, 2, 3],
  ]) {
    for (let x = -3; x <= 3; x += 1) {
      for (let z = -3; z <= 3; z += 1) {
        const dist = Math.hypot(x, z);
        if (dist > r) continue;
        const top = Math.round(h * (1 - dist / (r + 0.6)) + rnd() * 1.2);
        V.box(hx + x, 1, hz + z, hx + x, Math.max(1, top), hz + z, () => scrap[Math.floor(rnd() * scrap.length)]);
      }
    }
  }
  // An old car.
  V.box(1, 1, 2, 4, 2, 4, 0xc8412f);
  V.box(2, 3, 2, 3, 3, 4, 0x30465f);
  for (const [x, z] of [
    [1, 2],
    [4, 2],
    [1, 4],
    [4, 4],
  ]) V.set(x, 1, z, 0x1f1f1f);
  // Crane with a magnet.
  V.box(-5, 1, -5, -5, 12, -5, 0xe5b52f);
  V.box(-5, 12, -5, 1, 12, -5, 0xe5b52f);
  V.box(0, 9, -5, 0, 11, -5, 0x2b2b2b);
  V.box(-1, 8, -6, 1, 8, -4, 0x4a4f57);
  return 13;
}

function depot(V, rnd) {
  const ribs = (x, y, z) => ((x + z) % 2 ? 0x3f8f8b : 0x367c78);
  V.box(-6, 0, -6, 2, 6, 4, ribs);
  V.box(-6, 7, -6, 2, 7, 4, 0xa7adb3);
  V.box(-5, 8, -6, 1, 8, 4, 0xa7adb3);
  V.box(-4, 9, -6, 0, 9, 4, 0xa7adb3);
  V.box(-4, 0, 4, -1, 3, 4, 0x5a6168);
  // Rooftop billboard reading "</>".
  const sign = ['...#..##...', '..#...#.#..', '.#...#...#.', '..#.#...#..', '...##..#...'];
  for (const x of [-6, 2]) V.box(x, 8, 0, x, 10, 0, 0x4a4f57);
  V.box(-7, 11, 0, 3, 15, 0, (x, y) => (sign[15 - y][x + 7] === '#' ? 0x23272e : 0xf4f1e8));
  V.set(-2, 10, 1, 0xffe39a, GLOW.lamp);
  addWindows(V, rnd, { x0: -6, x1: 2, z0: -6, z1: 4, rows: [5], step: 3, phase: 2, sides: 'wn' });
  // Shipping containers.
  const colors = [0xd9622b, 0x2f6fb0, 0xc23b3b, 0x3f8f4f, 0xe0b53d];
  const stacks = [
    [-6, -1, 0],
    [-6, -1, 3],
    [0, 5, 0],
  ];
  for (const [z0, z1, y0] of stacks) {
    const c = colors[Math.floor(rnd() * colors.length)];
    V.box(4, y0, z0, 6, y0 + 2, z1, (x, y, z) => (z % 2 ? c : c - 0x101010));
  }
  return 10;
}

function observatory(V, rnd) {
  const wall = 0xece8df;
  const dome = 0xc9d0d8;
  V.cylinder(0, 0, 6.2, 0, 0, 0xa59d90);
  V.cylinder(0, 0, 5.4, 1, 5, wall);
  for (const [x, z] of [
    [5, 0],
    [-5, 0],
    [0, -5],
    [4, 3],
    [-4, 3],
    [4, -3],
    [-4, -3],
  ]) V.paint(x, 3, z, x, 3, z, windowVoxel(rnd));
  V.box(0, 1, 5, 0, 3, 5, 0x4a3426);
  V.cylinder(0, 0, 5.6, 6, 6, 0xd9b44a);
  // Dome with a slit from the top down the front.
  V.ball(0, 6, 0, 5.4, (x, y, z) => (x === 0 && y >= 8 && z > -3 ? null : dome), { minY: 7 });
  // Telescope looking out through the slit.
  for (let i = 0; i <= 5; i += 1) V.set(0, 7 + i, Math.round(i * 0.8), 0x3a3f47);
  V.set(0, 12, 4, 0x8fd3ff, GLOW.lamp);
  return 12;
}

function house(V, rnd, seed) {
  const r = mulberry32(seed);
  const walls = [0xe8d8b0, 0xd9e3ea, 0xf0c9b8, 0xcfe0c3, 0xf3e3a3];
  const roofs = [0xb5452f, 0x4d5560, 0x2f5c8a, 0x7a4a35];
  const wall = walls[Math.floor(r() * walls.length)];
  const roof = roofs[Math.floor(r() * roofs.length)];
  V.box(-4, 0, -4, 4, 7, 3, wall);
  for (let k = 0; k <= 4; k += 1) V.box(-5, 8 + k, -5 + k, 5, 8 + k, 4 - k, roof);
  for (const [x, y] of [
    [-3, 2],
    [3, 2],
    [-3, 5],
    [0, 5],
    [3, 5],
  ]) V.box(x, y, 3, x, y + 1, 3, windowVoxel(rnd));
  V.box(0, 0, 3, 0, 2, 3, 0x5a3a26);
  addWindows(V, rnd, { x0: -4, x1: 4, z0: -4, z1: 3, rows: [2, 5], step: 3, phase: 2, sides: 'ewn' });
  V.box(2, 10, -3, 3, 13, -2, 0x9c4a3a);
  V.box(-6, 0, 5, 6, 0, 5, (x) => (x === 0 || x === 1 ? null : 0x4f8a3f));
  return 14;
}

function shop(V, rnd, seed) {
  const r = mulberry32(seed);
  const walls = [0xf2e6d0, 0xd6e4f0, 0xf5d0c5, 0xe4efd8];
  const awn = [0xd2483f, 0x2f8a5b, 0x2f6fb0, 0xe0a030][Math.floor(r() * 4)];
  V.box(-5, 0, -4, 5, 8, 3, walls[Math.floor(r() * walls.length)]);
  V.box(-5, 9, -4, 5, 9, 3, 0x7b828c);
  V.box(-5, 10, -4, 5, 10, 3, (x, y, z) => (Math.abs(x) === 5 || z === -4 || z === 3 ? 0x7b828c : null));
  for (const x of [-4, -3, -2, 2, 3, 4]) V.box(x, 1, 3, x, 3, 3, windowVoxel(rnd));
  V.box(-1, 0, 3, 1, 3, 3, 0x30465f, GLOW.darkWindow);
  V.box(-5, 4, 4, 5, 4, 5, (x) => (x % 2 ? awn : 0xf6f3ea));
  V.box(-4, 5, 4, 4, 5, 4, awn);
  V.set(0, 6, 4, 0xffe39a, GLOW.lamp);
  addWindows(V, rnd, { x0: -5, x1: 5, z0: -4, z1: 3, rows: [7], step: 2, phase: 1 });
  return 11;
}

function plex(V, rnd, seed, { floors = 3 } = {}) {
  const r = mulberry32(seed);
  const bricks = [
    [0xa8513d, 0x9c4a37],
    [0x8a5a44, 0x7f523e],
    [0xb9774f, 0xab6c48],
    [0x9a8b7a, 0x8e8070],
  ][Math.floor(r() * 4)];
  const top = floors * 4;
  const metal = 0x2f3236;
  V.box(-5, 0, -5, 5, top, 3, (x, y) => bricks[y % 2]);
  V.box(-6, top + 1, -6, 6, top + 1, 4, 0x4a3a2e);
  for (let f = 0; f < floors; f += 1) {
    const y = f * 4 + 1;
    for (const x of [-4, -3, 3, 4]) V.box(x, y, 3, x, y + 1, 3, windowVoxel(rnd));
    if (f === 0) V.box(-1, 0, 3, 0, 2, 3, 0x4a3426);
    else V.box(-1, f * 4 + 1, 3, 0, f * 4 + 2, 3, 0x30465f, GLOW.darkWindow);
    if (f > 0) {
      V.box(-5, f * 4, 4, 5, f * 4, 5, metal);
      V.box(-5, f * 4 + 1, 5, 5, f * 4 + 1, 5, (x) => (x % 2 ? metal : null));
    }
  }
  addWindows(V, rnd, { x0: -5, x1: 5, z0: -5, z1: 3, rows: Array.from({ length: floors }, (_, f) => f * 4 + 2), step: 3, phase: 2, sides: 'ewn' });
  // The outside staircases Montreal is known for.
  for (let s = 0; s < 4; s += 1) V.set(5 - s, s, 6, metal);
  if (floors > 2) for (let s = 0; s < 4; s += 1) V.set(-2 - s, 4 + s, 6, metal);
  return top + 2;
}

function office(V, rnd, seed) {
  const r = mulberry32(seed);
  const h = 20 + Math.floor(r() * 7);
  const concrete = [0xd5d8dc, 0xc9ccd1, 0xe0dccf][Math.floor(r() * 3)];
  V.box(-4, 0, -4, 4, h, 4, (x, y, z) => {
    const edge = Math.abs(x) === 4 || Math.abs(z) === 4;
    if (!edge || y % 3 === 0 || (Math.abs(x) === 4 && Math.abs(z) === 4)) return concrete;
    return windowVoxel(rnd);
  });
  V.box(-2, h + 1, -2, 2, h + 2, 2, 0x8a9099);
  V.box(0, h + 3, 0, 0, h + 6, 0, 0xb0b5bc);
  V.set(0, h + 7, 0, 0xff3030, GLOW.always);
  return h + 8;
}

const BUILDERS = { museum, radio, newspaper, school, factory, castle, junkyard, depot, observatory, house, shop, plex, office };

// Build a building's voxels; returns { voxels, height } (height in voxels).
export function buildBuilding(building) {
  const seed = hashString(building.name);
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  const V = new Voxels();
  const builder = BUILDERS[building.theme] || house;
  const floors = building.folder ? Math.max(2, Math.min(4, building.item.items.length)) : 3;
  const height = builder(V, rnd, seed, { floors });
  return { voxels: V, height };
}

// Trees for the season: returns [{ voxels, weight, kind }].
export function treeTemplates(season) {
  const rnd = mulberry32(77);
  const pine = (r, h, color) => {
    const V = new Voxels();
    V.box(0, 0, 0, 0, 2, 0, 0x6b4a2f);
    let y = 2;
    for (let rad = r; rad >= 1; rad -= 1) {
      V.box(-rad, y, -rad, rad, y + 1, rad, (x, yy, z) => (Math.abs(x) + Math.abs(z) <= rad + 1 ? color(x, yy, z) : null));
      y += 2;
    }
    V.box(0, y, 0, 0, y + 1, 0, color);
    return V;
  };
  const pineColor = (x, y, z) => (hash3(x, y, z, 3) < 0.35 ? 0x2c5e36 : 0x346d3f);
  const leafy = (palette, { fill = 1, radius = 3, trunk = 4 } = {}) => {
    const V = new Voxels();
    V.box(0, 0, 0, 0, trunk, 0, 0x6e4f35);
    V.ball(0, trunk + 2, 0, radius, (x, y, z) => palette[Math.floor(hash3(x, y, z, 5) * palette.length)], { fill, rnd });
    return V;
  };
  const bare = (trunk = 5) => {
    const V = new Voxels();
    const wood = 0x6a5240;
    V.box(0, 0, 0, 0, trunk + 2, 0, wood);
    V.box(-2, trunk, 0, -1, trunk, 0, wood);
    V.set(-2, trunk + 1, 0, wood);
    V.box(1, trunk - 1, 0, 2, trunk - 1, 0, wood);
    V.set(2, trunk, 0, wood);
    V.box(0, trunk + 1, 1, 0, trunk + 1, 2, wood);
    V.box(0, trunk + 2, -1, 0, trunk + 2, -2, wood);
    V.set(0, trunk + 3, -2, wood);
    return V;
  };

  const greens = [0x4f9a3c, 0x5aa845, 0x468a35];
  const templates = [
    { voxels: pine(3, 0, pineColor), weight: 1, kind: 'pine' },
    { voxels: pine(2, 0, pineColor), weight: 1, kind: 'pine' },
  ];
  const add = (voxels, weight) => templates.push({ voxels, weight, kind: 'leafy' });
  if (season === 'summer') {
    add(leafy(greens), 2);
    add(leafy([0x3f8233, 0x4a9139], { radius: 2.6 }), 1.5);
  } else if (season === 'spring') {
    add(leafy([0x8cc957, 0x7dbd4d, 0x9bd162]), 2);
    add(leafy([0xf2b6c6, 0xf7d3dc, 0xe99ab0], { radius: 2.6 }), 0.8);
  } else if (season === 'autumn') {
    add(leafy([0xd9532b, 0xc4412a, 0xe0682f]), 1.3);
    add(leafy([0xe8a031, 0xf0b53c, 0xd98a26]), 1.3);
    add(leafy([0xe9cf4a, 0xd8bb38, 0xf2dc63], { radius: 2.6 }), 1);
  } else if (season === 'late-autumn') {
    add(bare(), 2);
    add(leafy([0xa8622f, 0xb87a3a, 0x8f5a33], { fill: 0.45 }), 1);
  } else {
    add(bare(), 2);
    add(bare(4), 1);
  }
  return templates;
}

export function lampVoxels() {
  const V = new Voxels();
  V.box(0, 0, 0, 0, 4, 0, 0x6b737d);
  V.set(0, 5, 0, 0xffe7a8, GLOW.lamp);
  V.set(0, 6, 0, 0x55606b);
  return V;
}

// A station beside the track: the track runs along local z, the area is toward local -x.
export function stationVoxels(color) {
  const V = new Voxels();
  const hex = parseInt(color.slice(1), 16);
  V.box(-7, 0, -15, -4, 1, 15, (x, y, z) => (x === -4 && y === 1 ? 0xf2d64b : 0xb9b3a6));
  for (const z of [-4, 4]) V.box(-6, 2, z, -6, 6, z, 0x5a6068);
  V.box(-7, 7, -6, -4, 7, 6, hex);
  V.box(-6, 2, -2, -6, 2, 2, 0x8a5a3a);
  V.box(-7, 4, -2, -7, 5, 2, hex);
  for (const z of [-12, 12]) {
    V.box(-5, 2, z, -5, 7, z, 0x3b4047);
    V.set(-5, 8, z, 0xffe7a8, GLOW.lamp);
  }
  return V;
}

// The cross on top of the hill, lit at night.
export function crossVoxels() {
  const V = new Voxels();
  V.box(-1, 0, -1, 1, 0, 1, 0x8d8a85);
  V.box(0, 1, 0, 0, 15, 0, 0xe8eef5, GLOW.lamp);
  V.box(-3, 11, 0, 3, 11, 0, 0xe8eef5, GLOW.lamp);
  return V;
}

// A train car, 12 voxels long along z. A cab car has its nose at +z.
export function trainCarVoxels(cab) {
  const V = new Voxels();
  const body = 0xd9472b;
  const cream = 0xf2ead8;
  const dark = 0x2a2d33;
  V.box(-2, 0, -5, 2, 0, 5, dark);
  V.box(-2, 1, -6, 2, 5, 5, (x, y) => (y === 3 || y === 4 ? cream : body));
  V.box(-2, 6, -6, 2, 6, 5, 0x9aa1a8);
  for (let z = -5; z <= 4; z += 2) {
    for (const x of [-2, 2]) V.box(x, 3, z, x, 4, z, [0xffe2a6, GLOW.window]);
  }
  if (cab) {
    V.box(-2, 1, 6, 2, 3, 6, body);
    V.box(-2, 4, 6, 2, 4, 6, [0x9fd4ff, GLOW.window]);
    V.box(-1, 5, 6, 1, 5, 6, body);
    V.set(-2, 2, 7, 0xfff3c4, GLOW.lamp);
    V.set(2, 2, 7, 0xfff3c4, GLOW.lamp);
    V.box(-1, 1, 7, 1, 1, 7, dark);
  } else {
    V.box(-1, 1, 6, 1, 4, 6, dark);
  }
  return V;
}

export function cloudVoxels(seed) {
  const r = mulberry32(seed);
  const V = new Voxels();
  const blobs = 3 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i += 1) {
    const cx = Math.round((r() - 0.5) * 8);
    const cz = Math.round((r() - 0.5) * 5);
    const w = 2 + Math.floor(r() * 3);
    const d = 1 + Math.floor(r() * 3);
    V.box(cx - w, 0, cz - d, cx + w, 1 + Math.floor(r() * 2), cz + d, 0xffffff);
  }
  return V;
}
