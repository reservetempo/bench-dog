// Voxel building blocks: a sparse voxel grid, a mesher that keeps only the faces you can see
// (with baked ambient occlusion and a little colour noise per voxel), and the shared material
// that adds snow on top faces and lights the windows at night.

import * as THREE from 'three';
import { hash3 } from './random';

export const VOX = 0.2; // size of a building voxel (a terrain tile is 1)

// What the glow value on a voxel means (see the material below).
export const GLOW = {
  none: 0,
  darkWindow: 0.5, // glass that stays dark at night
  window: 1, // glass by day, warm light at night
  lamp: 2, // its own colour, glowing at night
  always: 3, // its own colour, always glowing (beacons, signs)
};

const OFF = 1024;
const keyOf = (x, y, z) => ((x + OFF) * 4096 + (y + OFF)) * 4096 + (z + OFF);

export class Voxels {
  constructor() {
    this.map = new Map();
  }

  set(x, y, z, color, glow = 0) {
    this.map.set(keyOf(x, y, z), [x, y, z, color, glow]);
    return this;
  }

  get(x, y, z) {
    return this.map.get(keyOf(x, y, z));
  }

  has(x, y, z) {
    return this.map.has(keyOf(x, y, z));
  }

  del(x, y, z) {
    this.map.delete(keyOf(x, y, z));
    return this;
  }

  // Fill an inclusive box. `color` may be a function (x, y, z) => colour, or null for a gap.
  box(x0, y0, z0, x1, y1, z1, color, glow = 0) {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    const [az, bz] = z0 <= z1 ? [z0, z1] : [z1, z0];
    for (let x = ax; x <= bx; x += 1) {
      for (let y = ay; y <= by; y += 1) {
        for (let z = az; z <= bz; z += 1) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c == null) continue;
          if (Array.isArray(c)) this.set(x, y, z, c[0], c[1]);
          else this.set(x, y, z, c, glow);
        }
      }
    }
    return this;
  }

  clear(x0, y0, z0, x1, y1, z1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1) this.del(x, y, z);
      }
    }
    return this;
  }

  // Recolour voxels that exist in a box.
  paint(x0, y0, z0, x1, y1, z1, color, glow = 0) {
    return this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => {
      if (!this.has(x, y, z)) return null;
      const c = typeof color === 'function' ? color(x, y, z) : color;
      return c == null ? this.get(x, y, z).slice(3) : Array.isArray(c) ? c : [c, glow];
    });
  }

  // A vertical cylinder of radius r around (cx, cz).
  cylinder(cx, cz, r, y0, y1, color, glow = 0) {
    const ri = Math.ceil(r);
    for (let x = -ri; x <= ri; x += 1) {
      for (let z = -ri; z <= ri; z += 1) {
        if (x * x + z * z > r * r) continue;
        this.box(cx + x, y0, cz + z, cx + x, y1, cz + z, color, glow);
      }
    }
    return this;
  }

  // A ball (or the part of one above `minY`).
  ball(cx, cy, cz, r, color, { minY = -Infinity, fill = 1, rnd = Math.random, glow = 0 } = {}) {
    const ri = Math.ceil(r);
    for (let x = -ri; x <= ri; x += 1) {
      for (let y = -ri; y <= ri; y += 1) {
        for (let z = -ri; z <= ri; z += 1) {
          if (x * x + y * y + z * z > r * r + 0.5 || cy + y < minY) continue;
          if (fill < 1 && rnd() > fill) continue;
          const c = typeof color === 'function' ? color(cx + x, cy + y, cz + z) : color;
          if (c == null) continue;
          this.set(cx + x, cy + y, cz + z, c, glow);
        }
      }
    }
    return this;
  }

  get size() {
    return this.map.size;
  }
}

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

const AO = [0.5, 0.68, 0.84, 1];
const CORNERS_POS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const CORNERS_NEG = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
];

// Mesh voxel cells: `cells` yields [x, y, z, colour, glow]; `isSolid(x, y, z)` says whether a
// neighbour hides a face. Faces between two solid cells are skipped.
export function meshCells(cells, isSolid, { size = [VOX, VOX, VOX], origin = [-VOX / 2, 0, -VOX / 2], jitter = 0.06, seed = 0, bottoms = true } = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  const glw = [];
  const occ = [];
  const idx = [];
  const [sx, sy, sz] = size;
  const [ox, oy, oz] = origin;
  const c = [0, 0, 0];
  const nb = [0, 0, 0];
  const t = [0, 0, 0];
  const ao = [0, 0, 0, 0];
  let v = 0;

  const solidAt = (p) => isSolid(p[0], p[1], p[2]);

  for (const cell of cells) {
    const [x, y, z, hex, glow] = cell;
    const base = linear(hex);
    const j = 1 + (hash3(x, y, z, seed) - 0.5) * 2 * jitter;
    const r = base[0] * j;
    const g = base[1] * j;
    const b = base[2] * j;
    c[0] = x;
    c[1] = y;
    c[2] = z;
    for (let f = 0; f < 6; f += 1) {
      const d = f >> 1;
      const s = f & 1 ? -1 : 1;
      if (!bottoms && d === 1 && s < 0) continue;
      nb[0] = x;
      nb[1] = y;
      nb[2] = z;
      nb[d] += s;
      if (solidAt(nb)) continue;
      const u = (d + 1) % 3;
      const w = (d + 2) % 3;
      const corners = s > 0 ? CORNERS_POS : CORNERS_NEG;
      for (let k = 0; k < 4; k += 1) {
        const [cu, cw] = corners[k];
        const du = cu ? 1 : -1;
        const dw = cw ? 1 : -1;
        t[0] = nb[0];
        t[1] = nb[1];
        t[2] = nb[2];
        t[u] += du;
        const s1 = solidAt(t) ? 1 : 0;
        t[w] += dw;
        const sc = solidAt(t) ? 1 : 0;
        t[u] -= du;
        const s2 = solidAt(t) ? 1 : 0;
        ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);

        const px = c[0] + (d === 0 ? (s > 0 ? 1 : 0) : 0) + (u === 0 ? cu : 0) + (w === 0 ? cw : 0);
        const py = c[1] + (d === 1 ? (s > 0 ? 1 : 0) : 0) + (u === 1 ? cu : 0) + (w === 1 ? cw : 0);
        const pz = c[2] + (d === 2 ? (s > 0 ? 1 : 0) : 0) + (u === 2 ? cu : 0) + (w === 2 ? cw : 0);
        pos.push(ox + px * sx, oy + py * sy, oz + pz * sz);
        nor.push(d === 0 ? s : 0, d === 1 ? s : 0, d === 2 ? s : 0);
        col.push(r, g, b);
        glw.push(glow);
        occ.push(glow >= 1 ? 1 : AO[ao[k]]);
      }
      if (ao[0] + ao[2] > ao[1] + ao[3]) idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      else idx.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
      v += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('glow', new THREE.Float32BufferAttribute(glw, 1));
  geo.setAttribute('ao', new THREE.Float32BufferAttribute(occ, 1));
  geo.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export function meshVoxels(vox, opts) {
  return meshCells(vox.map.values(), (x, y, z) => vox.has(x, y, z), opts);
}

// Uniforms shared by every voxel material, driven by the sky each frame.
export const voxelUniforms = {
  uSnow: { value: 0 },
  uNight: { value: 0 },
  uGlass: { value: new THREE.Color(0x30465f) },
  uSnowColor: { value: new THREE.Color(0xf4f8fc) },
  uHighlight: { value: 0 },
};

export function makeVoxelMaterial({ highlight = 0 } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hl = { value: highlight };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = voxelUniforms.uSnow;
    shader.uniforms.uNight = voxelUniforms.uNight;
    shader.uniforms.uGlass = voxelUniforms.uGlass;
    shader.uniforms.uSnowColor = voxelUniforms.uSnowColor;
    shader.uniforms.uHighlight = hl;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float glow;
        attribute float ao;
        varying float vGlow;
        varying float vAo;
        varying float vUp;
        varying vec3 vWorld;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGlow = glow;
        vAo = ao;
        vUp = normal.y;
        vec4 vw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          vw = instanceMatrix * vw;
        #endif
        vWorld = (modelMatrix * vw).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSnow;
        uniform float uNight;
        uniform float uHighlight;
        uniform vec3 uGlass;
        uniform vec3 uSnowColor;
        varying float vGlow;
        varying float vAo;
        varying float vUp;
        varying vec3 vWorld;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float isWin = step(0.25, vGlow) * step(vGlow, 1.25);
        float lit = step(0.75, vGlow) * step(vGlow, 1.25);
        float isLamp = step(1.5, vGlow) * step(vGlow, 2.5);
        float always = step(2.5, vGlow);
        vec3 glassCol = mix(uGlass, diffuseColor.rgb, lit * uNight);
        diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, isWin);
        // Snow settles on top faces, patchy while it is thin.
        vec2 cellXZ = floor(vWorld.xz * 5.0 + 0.001);
        float n = fract(sin(dot(cellXZ, vec2(12.9898, 78.233))) * 43758.5453);
        float snowy = step(0.5, vUp) * step(n, uSnow * 1.15 - 0.08) * (1.0 - isWin);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor * (0.93 + 0.07 * n), snowy);
        diffuseColor.rgb *= vAo;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.96, 0.8), uHighlight * 0.18);
        vec3 glowLight = diffuseColor.rgb * ((lit + isLamp) * uNight * 1.6 + always * 0.9);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += glowLight;`
      );
  };
  mat.customProgramCacheKey = () => `voxel-${highlight}`;
  return mat;
}
