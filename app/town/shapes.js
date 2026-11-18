// Low-poly building blocks: a Shape collects simple solids (boxes, gabled and sawtooth roofs,
// pyramids, cylinders, cones, domes, rocks, window panes and pixel letters), each in one
// colour, into a single flat-shaded geometry. The shared material adds snow on upward faces,
// lights windows at night, blinks status lights and brightens a building under the pointer.

import * as THREE from 'three';

// What the glow value on a face means (see the material below).
export const GLOW = {
  none: 0,
  window: 1, // its own colour by day, warm light at night
  lamp: 2, // its own colour, glowing at night
  always: 3, // its own colour, always glowing (beacons, signs)
};

// A status light that blinks on and off; `phase` (0 to 1) sets its rhythm.
export const blink = (phase) => 4 + Math.min(Math.max(phase, 0), 0.99);

// Letters and digits 3 pixels wide and 5 high, top row first.
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'],
  ' ': ['...', '...', '...', '...', '...'],
};

// How wide a line of pixel letters is, in pixels.
export const textWidth = (str) => Math.max(0, [...str].length * 4 - 1);

// Which way a face looks, as an angle around y: 0 is the front (+z), then east, back, west.
export const FACE = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

// Colours are given as sRGB hex and baked into vertices in linear space.
const linearCache = new Map();
const tmpColor = new THREE.Color();
function linear(hex) {
  let c = linearCache.get(hex);
  if (!c) {
    tmpColor.setHex(hex);
    c = [tmpColor.r, tmpColor.g, tmpColor.b];
    linearCache.set(hex, c);
  }
  return c;
}

// Blend two sRGB hex colours.
export function mix(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// Darken (k < 1) or lighten (k > 1) an sRGB hex colour.
export function shade(hex, k) {
  return k < 1 ? mix(hex, 0x000000, 1 - k) : mix(hex, 0xffffff, k - 1);
}

const m4 = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, 'YXZ'); // tilt first, then turn about y
const at = new THREE.Vector3();
const scale = new THREE.Vector3();
const v = new THREE.Vector3();

export class Shape {
  constructor() {
    this.pos = [];
    this.col = [];
    this.glw = [];
  }

  // A triangle, counter-clockwise seen from outside.
  tri(a, b, c, color, glow = 0) {
    const [r, g, bl] = linear(color);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(r, g, bl);
      this.glw.push(glow);
    }
    return this;
  }

  quad(a, b, c, d, color, glow = 0) {
    return this.tri(a, b, c, color, glow).tri(a, c, d, color, glow);
  }

  // Add a three.js geometry made around the origin, in one colour: scaled, tilted (rx, rz),
  // turned about y (ry) and moved to (x, y, z). The geometry is disposed.
  geo(geometry, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, glow = 0 } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    m4.compose(at.set(x, y, z), quat.setFromEuler(euler.set(rx, ry, rz)), scale.set(sx, sy, sz));
    const p = g.attributes.position;
    const [r, gg, b] = linear(color);
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4);
      this.pos.push(v.x, v.y, v.z);
      this.col.push(r, gg, b);
      this.glw.push(glow);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  // A box standing on y, centred on (x, z): w across x, h tall, d across z.
  box(x, y, z, w, h, d, color, opts = {}) {
    return this.geo(new THREE.BoxGeometry(w, h, d), color, { ...opts, x, y: y + h / 2, z });
  }

  // A cylinder standing on y, with `seg` flat sides (one facing the front); top radius `top`
  // (0 for a cone).
  cyl(x, y, z, r, h, color, { top = r, seg = 8, glow = 0 } = {}) {
    return this.geo(new THREE.CylinderGeometry(top, r, h, seg, 1, false, Math.PI / seg), color, { x, y: y + h / 2, z, glow });
  }

  cone(x, y, z, r, h, color, { seg = 8 } = {}) {
    return this.cyl(x, y, z, r, h, color, { top: 0, seg });
  }

  // A rod or disc: a cylinder centred on (x, y, z), standing up unless tilted (rx = π/2
  // points it at the front).
  rod(x, y, z, r, len, color, { seg = 8, rx = 0, ry = 0, glow = 0 } = {}) {
    return this.geo(new THREE.CylinderGeometry(r, r, len, seg, 1, false, Math.PI / seg), color, { x, y, z, rx, ry, glow });
  }

  // A small faceted ball centred on (x, y, z).
  ball(x, y, z, r, color, glow = 0) {
    return this.geo(new THREE.IcosahedronGeometry(r, 0), color, { x, y, z, glow });
  }

  // The top half of a ball, sitting on y.
  dome(x, y, z, r, color, { seg = 12, rings = 4 } = {}) {
    return this.geo(new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, 0, Math.PI / 2), color, { x, y, z });
  }

  // A lumpy rock, squashed to `sy` of its height and sunk a little into y.
  rock(x, y, z, r, color, { sy = 0.6, ry = 0 } = {}) {
    return this.geo(new THREE.IcosahedronGeometry(r, 0), color, { x, y: y + r * sy * 0.55, z, sx: 1, sy, sz: 1, ry });
  }

  // Points of a solid laid out along x around the origin, turned and moved into place.
  place(points, { x, y, z, along }) {
    const turn = along === 'z';
    return points.map(([px, py, pz]) => (turn ? [x + pz, y + py, z - px] : [x + px, y + py, z + pz]));
  }

  // A gabled roof on y over a `len` by `span` rectangle centred on (x, z), its ridge `h` up
  // and running along x or z. The triangular ends are `ends` (the wall colour, say).
  gable(x, y, z, len, span, h, color, { along = 'x', ends = color } = {}) {
    const a = len / 2;
    const b = span / 2;
    const [A, B, C, D, R0, R1] = this.place(
      [
        [-a, 0, -b],
        [a, 0, -b],
        [a, 0, b],
        [-a, 0, b],
        [-a, h, 0],
        [a, h, 0],
      ],
      { x, y, z, along }
    );
    this.quad(A, R0, R1, B, color);
    this.quad(D, C, R1, R0, color);
    this.tri(A, D, R0, ends);
    this.tri(B, R1, C, ends);
    return this.quad(A, B, C, D, ends);
  }

  // One tooth of a sawtooth roof: sloping up from the front edge to a tall back face of
  // `back` (glass, usually), over a `len` by `span` rectangle, with its ridge along x or z.
  tooth(x, y, z, len, span, h, color, { along = 'x', ends = color, back = color, glow = 0 } = {}) {
    const a = len / 2;
    const b = span / 2;
    const [A, B, C, D, T0, T1] = this.place(
      [
        [-a, 0, -b],
        [a, 0, -b],
        [a, 0, b],
        [-a, 0, b],
        [-a, h, -b],
        [a, h, -b],
      ],
      { x, y, z, along }
    );
    this.quad(D, C, T1, T0, color);
    this.quad(A, T0, T1, B, back, glow);
    this.tri(A, D, T0, ends);
    this.tri(B, T1, C, ends);
    return this.quad(A, B, C, D, ends);
  }

  // A four-sided pyramid on y over a w-by-d rectangle centred on (x, z).
  pyramid(x, y, z, w, d, h, color) {
    const a = w / 2;
    const b = d / 2;
    const P0 = [x - a, y, z - b];
    const P1 = [x + a, y, z - b];
    const P2 = [x + a, y, z + b];
    const P3 = [x - a, y, z + b];
    const T = [x, y + h, z];
    return this.tri(P0, T, P1, color).tri(P3, P2, T, color).tri(P0, P3, T, color).tri(P1, T, P2, color);
  }

  // A flat pane (a window, a door, a sign) w by h, centred on (x, y, z) and facing `face`
  // (an angle around y; see FACE). Set it a hair proud of the wall it sits on.
  pane(x, y, z, w, h, face, color, glow = 0) {
    const tx = Math.cos(face) * (w / 2);
    const tz = -Math.sin(face) * (w / 2);
    const hh = h / 2;
    return this.quad(
      [x - tx, y - hh, z - tz],
      [x + tx, y - hh, z + tz],
      [x + tx, y + hh, z + tz],
      [x - tx, y + hh, z - tz],
      color,
      glow
    );
  }

  // A line of pixel letters (see FONT) on a wall facing `face`, centred on (x, z) along the
  // wall, its bottom at y; `px` is the size of one pixel. Each run of pixels is one pane.
  text(str, x, y, z, px, face, color, glow = 0) {
    const chars = [...str.toUpperCase()].map((ch) => FONT[ch] || FONT[' ']);
    const rx = Math.cos(face);
    const rz = -Math.sin(face);
    const left = (-textWidth(str) * px) / 2;
    chars.forEach((rows, i) => {
      rows.forEach((row, r) => {
        let c = 0;
        while (c < 3) {
          if (row[c] !== '#') {
            c += 1;
            continue;
          }
          let e = c;
          while (e + 1 < 3 && row[e + 1] === '#') e += 1;
          const u = left + (i * 4 + (c + e + 1) / 2) * px;
          this.pane(x + rx * u, y + (4.5 - r) * px, z + rz * u, (e - c + 1) * px, px, face, color, glow);
          c = e + 1;
        }
      });
    });
    return this;
  }

  // An upward-facing rectangle at height y.
  floor(x0, z0, x1, z1, y, color) {
    return this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], color);
  }

  geometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('glow', new THREE.Float32BufferAttribute(this.glw, 1));
    // No shared vertices, so every face keeps its own normal: flat shading.
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }
}

// Uniforms shared by the town's shape materials, driven by the sky each frame (uTime by the
// frame loop).
export const shapeUniforms = {
  uSnow: { value: 0 },
  uNight: { value: 0 },
  uTime: { value: 0 },
  uWarm: { value: new THREE.Color(0xffc979) },
  uSnowColor: { value: new THREE.Color(0xf4f8fc) },
};

// Indoors: no snow, and the lamps are always on.
export const indoorUniforms = { ...shapeUniforms, uSnow: { value: 0 }, uNight: { value: 1 } };

export function makeShapeMaterial({ highlight = 0, uniforms = shapeUniforms } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hl = { value: highlight };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uHighlight: hl });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float glow;
        varying float vGlow;
        varying float vUp;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGlow = glow;
        vUp = normal.y;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSnow;
        uniform float uNight;
        uniform float uTime;
        uniform float uHighlight;
        uniform vec3 uWarm;
        uniform vec3 uSnowColor;
        varying float vGlow;
        varying float vUp;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float blinks = step(3.5, vGlow);
        float win = step(0.5, vGlow) * step(vGlow, 1.5);
        float lamp = step(1.5, vGlow) * step(vGlow, 2.5);
        float always = step(2.5, vGlow) * (1.0 - blinks);
        // Status lights: each one on or off at random, at its own pace (the fraction of vGlow).
        float ph = fract(vGlow);
        float tick = mod(floor(uTime * (0.7 + ph * 2.6) + ph * 23.0), 997.0);
        float on = step(0.32, fract(sin(tick * 12.9898 + ph * 78.233) * 43758.5453));
        diffuseColor.rgb *= 1.0 - blinks * (1.0 - on) * 0.65;
        diffuseColor.rgb = mix(diffuseColor.rgb, uWarm, win * uNight);
        // Snow settles on flat tops and gentle roofs, not on walls or steep spires.
        float snowy = smoothstep(0.5, 0.65, vUp) * smoothstep(0.05, 0.6, uSnow) * (1.0 - win);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowy);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.96, 0.8), uHighlight * 0.18);
        vec3 glowLight = diffuseColor.rgb * ((win + lamp) * uNight * 1.6 + always * 0.9 + blinks * on * 1.4);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += glowLight;`
      );
  };
  mat.customProgramCacheKey = () => `shape-${highlight}`;
  return mat;
}
