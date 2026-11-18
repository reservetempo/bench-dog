// Low-poly buildings: one builder per building theme (see THEMES in layout.js), each a handful
// of flat-shaded solids. Units are world tiles; a lot is 5 across, and buildings stay within
// x and z from -2.4 to 2.4 (most within 1.2), with the front at +z. Walls are pale, roofs and
// trim take the building's colour, and the windows are panes a little darker than the wall
// that glow at night.

import { Shape, GLOW, FACE, blink, mix, shade, textWidth } from './shapes';
import { hashString, mulberry32 } from './random';

const WALLS = [0xf2ece1, 0xeae4d8, 0xf4f1ea, 0xe9dfcd, 0xe2ded6];
const TRIM = 0xd9d2c4;
const DARK = 0x4a505c;
const STONE = 0xc7c2b8;
const BRICK = 0xb4664f;
const GLASS = 0x4d5d70;
const RED = 0xd8473c;

// A building's colours and the random numbers it draws on.
function paletteFor(building, accent) {
  const seed = hashString(building.name);
  const r = mulberry32(seed ^ 0x5bd1e995);
  const wall = WALLS[Math.floor(r() * WALLS.length)];
  return {
    r,
    wall,
    roof: shade(accent, 0.94 + r() * 0.1),
    accent,
    glass: mix(wall, GLASS, 0.5),
  };
}

// A window: lit at night or not, at random.
function win(S, P, x, y, z, w, h, face) {
  S.pane(x, y, z, w, h, face, P.glass, P.r() < 0.7 ? GLOW.window : GLOW.none);
}

// A door, which always shows a light at night.
function door(S, x, y, z, w, h, face = FACE.s) {
  S.pane(x, y + h / 2, z, w, h, face, DARK, GLOW.window);
}

const E = 0.006; // how far panes stand off the wall

// The data center: a long windowless hall of pale panels under a glowing band, the folder's
// name in pixel letters, cooling units on the roof and down one side, a glass lobby, a
// loading dock, a generator with its fuel tank, and parking out front.
function datacenter(S, P, { name = '' } = {}) {
  const W = 3.4;
  const D = 2.5;
  const H = 1.35;
  const cz = -0.45;
  const front = cz + D / 2;
  const panel = 0xe6e9ed;
  const seam = 0xcdd3da;
  const cool = 0xbdc4cc;
  const fan = 0x3a3f49;
  const sign = 0x262c35;

  // The apron, parking bays and a kerb.
  S.box(0.2, 0, 1.65, 4.5, 0.012, 1.3, 0x7d838c);
  for (let i = 0; i < 5; i += 1) S.box(-0.6 + i * 0.6, 0.012, 1.95, 0.035, 0.004, 0.62, 0xf4f3ee);
  S.box(0.2, 0, 2.33, 4.5, 0.05, 0.06, 0xd6d3cc);

  // The hall.
  S.box(0, 0, cz, W, H, D, panel);
  S.box(0, H, cz, W + 0.04, 0.03, D + 0.04, seam);
  for (const s of [-1, 1]) {
    S.box(0, H, cz + s * (D / 2 - 0.02), W + 0.04, 0.12, 0.04, seam);
    S.box(s * (W / 2 - 0.02), H, cz, 0.04, 0.12, D + 0.04, seam);
  }

  // The name in pixel letters on a dark panel, glowing at night.
  const label = name.length <= 8 ? name : '';
  const px = label ? Math.min(0.11, 1.3 / textWidth(label)) : 0;
  const signW = label ? textWidth(label) * px + 0.3 : 0;
  const signX = -W / 2 + 0.25 + signW / 2;
  if (label) {
    S.pane(signX, 0.68, front + E, signW, 5 * px + 0.3, FACE.s, sign);
    S.text(label, signX, 0.68 - 2.5 * px, front + 2 * E, px, FACE.s, P.accent, GLOW.lamp);
  }

  // Panel seams on the front and sides, and a band in the building's colour under the roof.
  for (let i = 1; i < 8; i += 1) {
    const x = -W / 2 + i * (W / 8);
    if (label && Math.abs(x - signX) < signW / 2 + 0.03) continue;
    S.pane(x, H / 2 - 0.08, front + E, 0.02, H - 0.2, FACE.s, seam);
  }
  for (let i = 1; i < 6; i += 1) {
    const z = cz - D / 2 + i * (D / 6);
    S.pane(W / 2 + E, H / 2 - 0.08, z, 0.02, H - 0.2, FACE.e, seam);
    S.pane(-W / 2 - E, H / 2 - 0.08, z, 0.02, H - 0.2, FACE.w, seam);
  }
  S.pane(0, H - 0.12, front + 2 * E, W, 0.06, FACE.s, P.accent, GLOW.lamp);
  S.pane(W / 2 + 2 * E, H - 0.12, cz, D, 0.06, FACE.e, P.accent, GLOW.lamp);
  S.pane(-W / 2 - 2 * E, H - 0.12, cz, D, 0.06, FACE.w, P.accent, GLOW.lamp);

  // The loading dock: a roller door over a concrete step, with bumpers.
  const dockX = 0.42;
  S.pane(dockX, 0.43, front + E, 0.82, 0.86, FACE.s, 0xa3aab2);
  for (let k = 1; k < 8; k += 1) S.pane(dockX, k * 0.1075, front + 2 * E, 0.82, 0.012, FACE.s, 0x80878f);
  S.box(dockX, 0, front + 0.15, 1.05, 0.14, 0.3, 0xc9c6bf);
  for (const s of [-1, 1]) S.box(dockX + s * 0.36, 0.16, front + 0.04, 0.08, 0.12, 0.08, DARK);

  // The lobby: a glass box under a canopy in the building's colour.
  const lobbyX = 1.26;
  S.box(lobbyX, 0, front + 0.28, 0.72, 0.82, 0.56, P.glass, { glow: GLOW.window });
  door(S, lobbyX, 0, front + 0.56 + E, 0.3, 0.6);
  S.box(lobbyX, 0.82, front + 0.32, 0.92, 0.06, 0.76, P.accent);

  // On the roof: two rows of cooling units, and a mast with a red light.
  for (const x of [-1.05, 0, 1.05]) {
    for (const z of [cz - 0.55, cz + 0.45]) {
      S.box(x, H + 0.03, z, 0.62, 0.24, 0.62, cool);
      S.rod(x, H + 0.28, z, 0.22, 0.012, fan, { seg: 10 });
    }
  }
  S.box(1.45, H + 0.03, cz - 1.0, 0.05, 0.95, 0.05, DARK);
  S.ball(1.45, H + 1.02, cz - 1.0, 0.06, RED, GLOW.always);

  // Down the west side: cooling units, piped into the hall.
  for (const z of [cz - 0.8, cz, cz + 0.8]) {
    S.box(-2.08, 0, z, 0.52, 0.48, 0.56, cool);
    S.rod(-2.08, 0.49, z, 0.18, 0.012, fan, { seg: 10 });
    S.box(-1.78, 0.32, z, 0.12, 0.05, 0.05, seam);
  }

  // Down the east side: a generator with its exhaust, and the fuel tank on two saddles.
  S.box(2.1, 0, cz - 0.6, 0.5, 0.5, 0.95, 0x7b838d);
  S.box(2.1, 0.5, cz - 0.6, 0.42, 0.04, 0.8, 0x6a717a);
  S.cyl(2.2, 0.5, cz - 0.95, 0.04, 0.32, DARK, { seg: 6 });
  for (const z of [cz + 0.35, cz + 0.85]) S.box(2.1, 0, z, 0.3, 0.1, 0.08, 0x8a919b);
  S.rod(2.1, 0.24, cz + 0.6, 0.17, 0.8, 0xe2ded4, { seg: 10, rx: Math.PI / 2 });
  S.ball(2.1, 0.14, cz + 1.02, 0.025, 0x52e08a, blink(0.4));
}

// The archive: a classical temple on two steps, columns all round and a pediment on the front.
function museum(S, P) {
  S.box(0, 0, 0, 2.4, 0.12, 2.4, TRIM);
  S.box(0, 0.12, 0, 2.18, 0.12, 2.18, TRIM);
  S.box(0, 0.24, -0.1, 1.36, 1.4, 1.5, P.wall);
  door(S, 0, 0.24, 0.65 + E, 0.4, 0.86);
  for (const x of [-0.92, -0.31, 0.31, 0.92]) {
    for (const z of [-0.92, 0.92]) S.cyl(x, 0.24, z, 0.09, 1.4, P.wall, { seg: 6 });
  }
  for (const x of [-0.92, 0.92]) for (const z of [-0.31, 0.31]) S.cyl(x, 0.24, z, 0.09, 1.4, P.wall, { seg: 6 });
  S.box(0, 1.64, 0, 2.12, 0.18, 2.12, TRIM);
  S.gable(0, 1.82, 0, 2.2, 2.2, 0.55, P.roof, { along: 'z', ends: P.wall });
}

// The radio station: a low studio with a lit "on air" sign, and a red and white mast.
function radio(S, P) {
  S.box(-0.45, 0, 0.35, 1.5, 0.95, 1.3, P.wall);
  S.box(-0.45, 0.95, 0.35, 1.62, 0.1, 1.42, P.roof);
  door(S, -0.75, 0, 1.0 + E, 0.3, 0.6);
  win(S, P, -0.2, 0.55, 1.0 + E, 0.42, 0.34, FACE.s);
  S.box(-0.45, 1.05, 0.85, 0.62, 0.22, 0.06, RED, { glow: GLOW.always });
  // The mast: tapering bands on a plinth, a light at the top.
  S.box(0.65, 0, -0.6, 0.56, 0.14, 0.56, TRIM);
  const H = 4.4;
  const bands = 6;
  for (let i = 0; i < bands; i += 1) {
    const r0 = 0.2 - (0.16 * i) / bands;
    const r1 = 0.2 - (0.16 * (i + 1)) / bands;
    S.cyl(0.65, 0.14 + (i * H) / bands, -0.6, r0, H / bands, i % 2 ? 0xf3f1ec : RED, { top: r1, seg: 4 });
  }
  S.ball(0.65, 0.14 + H + 0.06, -0.6, 0.08, RED, GLOW.always);
}

// The newspaper: a three-storey block with an awning over the door and a sign on the roof.
function newspaper(S, P) {
  S.box(0, 0, -0.1, 1.9, 2.5, 1.7, P.wall);
  S.box(0, 2.5, -0.1, 2.02, 0.1, 1.82, P.roof);
  const front = 0.75 + E;
  door(S, 0, 0, front, 0.36, 0.62);
  S.box(0, 0.72, 0.86, 1.2, 0.06, 0.22, P.roof);
  for (const x of [-0.6, 0.6]) win(S, P, x, 0.42, front, 0.34, 0.4, FACE.s);
  for (const y of [1.2, 1.85]) for (const x of [-0.6, 0, 0.6]) win(S, P, x, y, front, 0.34, 0.4, FACE.s);
  for (const y of [0.42, 1.2, 1.85]) for (const z of [-0.55, 0.25]) win(S, P, 0.95 + E, y, z, 0.34, 0.4, FACE.e);
  // The rooftop sign on two legs, its face lit at night.
  for (const x of [-0.55, 0.55]) S.box(x, 2.6, 0.2, 0.06, 0.3, 0.06, DARK);
  S.box(0, 2.9, 0.2, 1.6, 0.5, 0.08, P.roof);
  S.pane(0, 3.15, 0.24 + E, 1.38, 0.3, FACE.s, 0xf6f1e4, GLOW.lamp);
}

// The schoolhouse: a long gabled hall with a clock tower on its front and a flag on top.
function school(S, P) {
  S.box(0, 0, -0.4, 2.3, 1.15, 1.2, P.wall);
  S.gable(0, 1.15, -0.4, 2.42, 1.34, 0.62, P.roof, { ends: P.wall });
  for (const x of [-0.85, -0.55, 0.55, 0.85]) win(S, P, x, 0.6, 0.2 + E, 0.2, 0.5, FACE.s);
  for (const z of [-0.65, -0.15]) {
    win(S, P, 1.15 + E, 0.6, z, 0.24, 0.5, FACE.e);
    win(S, P, -1.15 - E, 0.6, z, 0.24, 0.5, FACE.w);
  }
  // The tower: a clock, an open belfry under a pyramid roof, the flag.
  S.box(0, 0, 0.45, 0.72, 2.05, 0.72, P.wall);
  door(S, 0, 0, 0.81 + E, 0.3, 0.6);
  win(S, P, 0, 1.05, 0.81 + E, 0.2, 0.4, FACE.s);
  S.rod(0, 1.65, 0.82, 0.17, 0.03, 0xf6f1e4, { seg: 10, rx: Math.PI / 2, glow: GLOW.lamp });
  for (const [x, z] of [
    [-0.3, 0.15],
    [0.3, 0.15],
    [-0.3, 0.75],
    [0.3, 0.75],
  ]) S.box(x, 2.05, z, 0.1, 0.38, 0.1, P.wall);
  S.box(0, 2.15, 0.45, 0.24, 0.22, 0.24, 0xc9a24a);
  S.pyramid(0, 2.43, 0.45, 0.86, 0.86, 0.62, P.roof);
  S.box(0, 3.0, 0.45, 0.03, 0.62, 0.03, DARK);
  S.box(0.16, 3.38, 0.45, 0.3, 0.2, 0.02, P.accent);
}

// The factory: a shed under a sawtooth roof of glass, a small office and a tall chimney.
function factory(S, P) {
  S.box(-0.25, 0, 0, 1.9, 1.05, 2.2, P.wall);
  const teeth = 3;
  const span = 2.2 / teeth;
  for (let i = 0; i < teeth; i += 1) {
    S.tooth(-0.25, 1.05, 1.1 - (i + 0.5) * span, 1.9, span, 0.42, P.roof, { ends: P.wall, back: P.glass, glow: GLOW.window });
  }
  S.pane(-0.45, 0.42, 1.1 + E, 0.6, 0.84, FACE.s, DARK, GLOW.window);
  for (const x of [-1.0, 0.25]) win(S, P, x, 0.6, 1.1 + E, 0.3, 0.36, FACE.s);
  for (const z of [-0.7, 0, 0.7]) win(S, P, -1.2 - E, 0.6, z, 0.36, 0.36, FACE.w);
  // The office.
  S.box(0.98, 0, 0.62, 0.44, 0.75, 0.9, P.wall);
  S.box(0.98, 0.75, 0.62, 0.5, 0.08, 0.96, P.roof);
  win(S, P, 0.98, 0.4, 1.07 + E, 0.24, 0.3, FACE.s);
  // The chimney, a band of the roof colour near its top.
  S.cyl(0.92, 0, -0.62, 0.22, 3.0, BRICK, { top: 0.17, seg: 8 });
  S.cyl(0.92, 3.0, -0.62, 0.17, 0.22, P.roof, { top: 0.165, seg: 8 });
  S.cyl(0.92, 3.22, -0.62, 0.165, 0.4, BRICK, { top: 0.15, seg: 8 });
}

// The castle: curtain walls with merlons, round corner towers under cones, a keep and a flag.
function castle(S, P) {
  const R = 1.0;
  const T = 0.16;
  const H = 0.9;
  S.box(0, 0, -R + T / 2, 2 * R, H, T, STONE);
  S.box(-R + T / 2, 0, 0, T, H, 2 * R - 2 * T, STONE);
  S.box(R - T / 2, 0, 0, T, H, 2 * R - 2 * T, STONE);
  for (const s of [-1, 1]) S.box((s * (R + 0.2)) / 2, 0, R - T / 2, R - 0.2, H, T, STONE);
  S.box(0, 0.62, R - T / 2, 0.4, H - 0.62, T, STONE);
  S.pane(0, 0.31, R + E, 0.4, 0.62, FACE.s, DARK, GLOW.window);
  // Merlons along the tops of the walls.
  for (const u of [-0.5, -0.17, 0.17, 0.5]) {
    S.box(u, H, -R + T / 2, 0.14, 0.14, T, STONE);
    S.box(u, H, R - T / 2, 0.14, 0.14, T, STONE);
    S.box(-R + T / 2, H, u, T, 0.14, 0.14, STONE);
    S.box(R - T / 2, H, u, T, 0.14, 0.14, STONE);
  }
  for (const x of [-R, R]) {
    for (const z of [-R, R]) {
      S.cyl(x, 0, z, 0.26, 1.35, STONE, { seg: 8 });
      S.cone(x, 1.35, z, 0.33, 0.62, P.roof);
    }
  }
  // The keep.
  S.box(0, 0, -0.2, 0.9, 2.05, 0.9, STONE);
  S.box(0, 2.05, -0.2, 1.02, 0.12, 1.02, STONE);
  S.pyramid(0, 2.17, -0.2, 0.92, 0.92, 0.7, P.roof);
  for (const y of [1.0, 1.6]) win(S, P, 0, y, 0.25 + E, 0.16, 0.3, FACE.s);
  win(S, P, 0.45 + E, 1.6, -0.2, 0.16, 0.3, FACE.e);
  S.box(0, 2.82, -0.2, 0.03, 0.55, 0.03, DARK);
  S.box(0.16, 3.15, -0.2, 0.3, 0.2, 0.02, P.accent);
}

// The junkyard: a low fence round heaps of scrap, an old car and a crane with a magnet.
function junkyard(S, P) {
  S.box(0, 0, 0, 2.36, 0.02, 2.36, 0xbcae96);
  const F = 0.32;
  const fence = 0x7a808a;
  S.box(0, 0, -1.15, 2.36, F, 0.05, fence);
  for (const x of [-1.15, 1.15]) S.box(x, 0, 0, 0.05, F, 2.36, fence);
  for (const s of [-1, 1]) S.box(s * 0.78, 0, 1.15, 0.8, F, 0.05, fence);
  for (const x of [-0.38, 0.38]) S.box(x, 0, 1.15, 0.08, 0.5, 0.08, DARK);
  const scrap = [0x9b6a4f, 0x7d838c, 0x666b74, 0xa4825a, 0x5e636b];
  const heaps = [
    [-0.5, -0.45, 0.42],
    [0.5, -0.55, 0.36],
    [-0.6, 0.5, 0.3],
  ];
  for (const [hx, hz, r] of heaps) {
    S.rock(hx, 0, hz, r, scrap[Math.floor(P.r() * scrap.length)], { sy: 0.9, ry: P.r() * 3 });
    for (let k = 0; k < 3; k += 1) {
      const a = P.r() * Math.PI * 2;
      S.rock(hx + Math.cos(a) * r * 0.7, 0, hz + Math.sin(a) * r * 0.7, r * 0.55, scrap[Math.floor(P.r() * scrap.length)], { ry: P.r() * 3 });
    }
  }
  // The car.
  S.box(0.5, 0.06, 0.55, 0.66, 0.2, 0.38, P.roof);
  S.box(0.46, 0.26, 0.55, 0.36, 0.15, 0.34, P.glass);
  for (const x of [0.28, 0.72]) for (const z of [0.36, 0.74]) S.rod(x, 0.07, z, 0.07, 0.06, DARK, { seg: 6, rx: Math.PI / 2 });
  // The crane.
  S.box(-0.95, 0, -0.95, 0.12, 2.25, 0.12, P.roof);
  S.box(-0.4, 2.13, -0.95, 1.3, 0.1, 0.1, P.roof);
  S.box(-1.12, 2.13, -0.95, 0.2, 0.18, 0.18, DARK);
  S.box(0.05, 1.42, -0.95, 0.015, 0.72, 0.015, DARK);
  S.cyl(0.05, 1.3, -0.95, 0.13, 0.12, DARK, { seg: 8 });
}

// The depot: a long gabled train shed with a big lit doorway and stacked shipping containers.
function depot(S, P) {
  S.box(-0.4, 0, -0.05, 1.3, 1.15, 2.2, P.wall);
  S.gable(-0.4, 1.15, -0.05, 2.32, 1.44, 0.68, P.roof, { along: 'z', ends: P.wall });
  S.pane(-0.4, 0.5, 1.05 + E, 0.66, 1.0, FACE.s, DARK, GLOW.window);
  S.rod(-0.4, 1.45, 1.11, 0.16, 0.02, P.glass, { seg: 10, rx: Math.PI / 2, glow: GLOW.window });
  for (const z of [-0.75, -0.25, 0.25, 0.75]) win(S, P, 0.25 + E, 0.65, z, 0.24, 0.4, FACE.e);
  const boxes = [P.roof, shade(P.roof, 0.78), 0x8a919b];
  S.box(0.88, 0, -0.55, 0.52, 0.44, 1.05, boxes[0]);
  S.box(0.88, 0.44, -0.55, 0.52, 0.44, 1.05, boxes[2]);
  S.box(0.88, 0, 0.65, 0.52, 0.44, 1.05, boxes[1]);
}

// The observatory: a white drum under a dome, its slit open and the telescope looking out.
function observatory(S, P) {
  S.cyl(0, 0, 0, 1.12, 0.12, TRIM, { seg: 12 });
  S.cyl(0, 0.12, 0, 0.95, 1.15, P.wall, { seg: 12 });
  S.cyl(0, 1.27, 0, 1.0, 0.08, TRIM, { seg: 12 });
  const R = 0.93;
  const Y = 1.35;
  S.dome(0, Y, 0, R, P.roof, { seg: 12, rings: 5 });
  // The slit: dark strips laid along the front of the dome, from the rim over the top.
  for (const t of [0.22, 0.6, 0.98, 1.36]) {
    S.box(0, Y + Math.sin(t) * (R + 0.005) - 0.2, Math.cos(t) * (R + 0.005), 0.2, 0.4, 0.02, DARK, { rx: -t });
  }
  S.rod(0, Y + 0.62, 0.6, 0.08, 0.7, 0x3a3f49, { rx: 0.85 });
  const r = 0.95 * Math.cos(Math.PI / 12) + E;
  door(S, 0, 0.12, r, 0.34, 0.62);
  for (const a of [-1, 1, 2, -2].map((k) => (k * Math.PI) / 3)) win(S, P, Math.sin(a) * r, 0.75, Math.cos(a) * r, 0.2, 0.32, a);
}

// A house: a gabled cottage with a chimney, its ridge one way or the other.
function house(S, P) {
  const along = P.r() < 0.5 ? 'x' : 'z';
  const W = 1.8;
  const D = 1.5;
  const H = 1.05 + P.r() * 0.25;
  S.box(0, 0, 0, W, H, D, P.wall);
  const [len, span] = along === 'x' ? [W + 0.12, D + 0.16] : [D + 0.12, W + 0.16];
  S.gable(0, H, 0, len, span, 0.8, P.roof, { along, ends: P.wall });
  S.box(0.5, H + 0.1, -0.35, 0.22, 0.85, 0.22, BRICK);
  door(S, -0.3, 0, D / 2 + E, 0.3, 0.6);
  win(S, P, 0.4, H * 0.55, D / 2 + E, 0.36, 0.32, FACE.s);
  for (const z of [-0.35, 0.35]) win(S, P, W / 2 + E, H * 0.55, z, 0.32, 0.32, FACE.e);
  if (along === 'z') win(S, P, 0, H + 0.28, D / 2 + 0.06 + E, 0.24, 0.24, FACE.s);
}

// A shop: two storeys with a big shop window under a striped awning and a sign on the parapet.
function shop(S, P) {
  S.box(0, 0, -0.1, 1.9, 1.75, 1.5, P.wall);
  S.box(0, 1.75, -0.1, 2.0, 0.1, 1.6, P.roof);
  const front = 0.65 + E;
  S.pane(-0.25, 0.42, front, 1.05, 0.6, FACE.s, P.glass, GLOW.window);
  door(S, 0.6, 0, front, 0.3, 0.66);
  for (let i = 0; i < 4; i += 1) {
    S.box(-0.71 + i * 0.475, 0.86, 0.84, 0.475, 0.04, 0.4, i % 2 ? 0xf3f1ec : P.roof, { rx: 0.4 });
  }
  for (const x of [-0.55, 0, 0.55]) win(S, P, x, 1.3, front, 0.3, 0.38, FACE.s);
  S.box(0, 1.85, 0.5, 1.3, 0.34, 0.08, P.roof);
  S.pane(0, 2.02, 0.54 + E, 1.1, 0.16, FACE.s, 0xf6f1e4, GLOW.lamp);
}

// A plex: a flat-roofed block of flats with balconies, and the outside staircases Montreal is
// known for. A folder gets one with as many floors as it holds links (two to four).
function plex(S, P, { floors = 3 } = {}) {
  const F = 0.7;
  const H = floors * F;
  const iron = shade(P.roof, 0.62);
  S.box(0, 0, -0.25, 2.0, H, 1.5, P.wall);
  S.box(0, H, -0.25, 2.1, 0.12, 1.6, P.roof);
  const front = 0.5 + E;
  for (let f = 0; f < floors; f += 1) {
    const y = f * F + F * 0.55;
    for (const x of [-0.65, 0.65]) win(S, P, x, y, front, 0.34, 0.36, FACE.s);
    if (f === 0) door(S, 0, 0, front, 0.3, 0.56);
    else S.pane(0, f * F + 0.28, front, 0.3, 0.56, FACE.s, P.glass, P.r() < 0.6 ? GLOW.window : GLOW.none);
    for (const z of [-0.65, 0.05]) win(S, P, 1.0 + E, y, z, 0.3, 0.36, FACE.e);
    if (f === 0) continue;
    S.box(0, f * F, 0.66, 2.0, 0.05, 0.32, iron);
    S.box(0, f * F + 0.05, 0.8, 2.0, 0.16, 0.02, iron);
  }
  // The staircase: one flight up to the first balcony, another on up to the second.
  const flight = (x0, x1, y0) => {
    const run = x1 - x0;
    S.box((x0 + x1) / 2, y0 + F / 2 - 0.025, 0.95, Math.hypot(run, F), 0.05, 0.2, iron, { rz: Math.atan2(F, run) });
  };
  if (floors > 1) flight(1.05, 0.35, 0);
  if (floors > 2) flight(-0.35, -1.05, F);
}

// An office tower: ribbons of windows a floor apart, a lantern on top and an antenna.
function office(S, P) {
  const floors = 7 + Math.floor(P.r() * 3);
  const F = 0.46;
  const H = floors * F + 0.2;
  S.box(0, 0, 0, 1.5, H, 1.5, P.wall);
  door(S, 0, 0, 0.75 + E, 0.6, 0.34);
  for (let f = 1; f < floors; f += 1) {
    const y = f * F + 0.24;
    win(S, P, 0, y, 0.75 + E, 1.24, 0.2, FACE.s);
    win(S, P, 0.75 + E, y, 0, 1.24, 0.2, FACE.e);
    win(S, P, 0, y, -0.75 - E, 1.24, 0.2, FACE.n);
    win(S, P, -0.75 - E, y, 0, 1.24, 0.2, FACE.w);
  }
  S.box(0, H, 0, 1.58, 0.08, 1.58, P.roof);
  S.box(0, H + 0.08, 0, 1.0, 0.42, 1.0, TRIM);
  S.box(0, H + 0.5, 0, 1.08, 0.08, 1.08, P.roof);
  S.box(0.25, H + 0.58, 0.2, 0.04, 0.75, 0.04, DARK);
  S.ball(0.25, H + 1.36, 0.2, 0.06, RED, GLOW.always);
}

const BUILDERS = { datacenter, museum, radio, newspaper, school, factory, castle, junkyard, depot, observatory, house, shop, plex, office };

// Build a building in its own colour (`accent`, an sRGB hex number). Returns
// { geometry, height }, height in world units above its base.
export function buildBuilding(building, accent) {
  const S = new Shape();
  const P = paletteFor(building, accent);
  const builder = BUILDERS[building.theme] || house;
  const floors = building.folder ? Math.max(2, Math.min(4, building.fixtures.length)) : 3;
  builder(S, P, { floors, name: building.name });
  const geometry = S.geometry();
  return { geometry, height: geometry.boundingBox.max.y };
}
