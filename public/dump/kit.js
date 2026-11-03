// kit.js: shared helpers for the /dump style modules.
//
// Conventions (see styles/index.js for the full style API):
// - 1 unit is roughly one figure's height. Figures stand on y = 0 and face +z.
// - Anything with `userData.tick = (t, dt) => {}` inside a figure is called by
//   main.js every frame (t and dt in seconds). Ticks are collected once after
//   build(), so add them during build. Skipped when REDUCED_MOTION is true.
// - userData flags main.js and these helpers respect:
//     noFit      leave this object (and its children) out of the framing box
//     noOutline  outlineAll() skips this mesh
// - Helpers cache and share geometries, materials and textures; don't dispose them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };

export const ROLES = ['peasant', 'monk', 'priest', 'cardinal'];

// True when the viewer asked for reduced motion. main.js then skips update()
// and ticks (it calls each once at t = 0) and the turntable stands still.
// Styles should skip particles when it is true; embers() already does.
export const REDUCED_MOTION = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

// ---------------------------------------------------------------- random

// Small seeded random generator: rng(seed)() returns a number in [0, 1).
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth-ish 1D noise in [-1, 1], handy for flicker and idle sway.
export function wobble(t, seed = 0) {
  return (Math.sin(t * 1.7 + seed * 1.3) * 0.5 + Math.sin(t * 2.9 + seed * 2.1) * 0.3 + Math.sin(t * 5.3 + seed * 0.7) * 0.2);
}

// ---------------------------------------------------------------- geometry

// Push every vertex by a random offset of up to `amount` (in geometry units).
// Vertices at the same position move together, so seams stay closed.
// Use with `flatShading: true` materials for a faceted low-poly look,
// or a small amount on smooth materials for clay lumps. Returns the geometry.
export function jitter(geometry, amount = 0.02, seed = 1) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const qx = Math.round(x * 1e4), qy = Math.round(y * 1e4), qz = Math.round(z * 1e4);
    pos.setXYZ(i,
      x + (hash3(qx, qy, qz, seed) - 0.5) * 2 * amount,
      y + (hash3(qx, qy, qz, seed + 17) - 0.5) * 2 * amount,
      z + (hash3(qx, qy, qz, seed + 31) - 0.5) * 2 * amount);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// LatheGeometry from [[radius, y], ...] pairs listed bottom to top, seam at the back.
// Good for robes, capes, hats, bells. thetaLength < 2π leaves an opening at the front (+z).
export function lathe(points, segments = 16, thetaLength = Math.PI * 2) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const full = thetaLength >= Math.PI * 2 - 1e-6;
  const start = full ? Math.PI : (Math.PI * 2 - thetaLength) / 2;
  return new THREE.LatheGeometry(pts, segments, start, thetaLength);
}

// Ragged hem: moves the lowest ring of a lathe() geometry up and down in a zigzag
// (every other vertex lifted by up to `amount`). Returns the geometry.
export function raggedHem(geometry, amount = 0.03, seed = 1) {
  const pos = geometry.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  const r = rng(seed);
  const lifts = new Map();
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > minY + 1e-5) continue;
    const ang = Math.round(Math.atan2(pos.getX(i), pos.getZ(i)) * 1000);
    let lift = lifts.get(ang);
    if (lift === undefined) { lift = (lifts.size % 2 ? 0.2 : 1) * amount * (0.5 + r()); lifts.set(ang, lift); }
    pos.setY(i, minY + lift);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

// Merge static meshes into one mesh per material (fewer draw calls).
// Each mesh's own position/rotation/scale is baked in (parents are ignored),
// so pass meshes that are siblings in one part. Returns a Group.
export function mergeMeshes(meshes) {
  const byMat = new Map();
  for (const m of meshes) {
    m.updateMatrix();
    let g = m.geometry.clone().applyMatrix4(m.matrix);
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(g);
  }
  const group = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(merged, mat));
  }
  return group;
}

// Position of `obj` in `root`'s local space (call after the parts are assembled).
export function pointIn(root, obj, target = new THREE.Vector3()) {
  root.updateMatrixWorld(true);
  obj.getWorldPosition(target);
  return root.worldToLocal(target);
}

// ---------------------------------------------------------------- textures

// CanvasTexture drawn by draw(ctx, w, h). sRGB colour space, mipmapped.
export function canvasTexture(w, h, draw, { nearest = false, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}

// Vertical gradient for scene.background: stops = [[0, '#top'], [1, '#bottom']].
// `vignette` (0–1) darkens the corners.
export function gradientBackground(stops, { vignette = 0, grain = 0 } = {}) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [at, col] of stops) g.addColorStop(at, col);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (vignette > 0) {
      const v = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.15, w / 2, h * 0.5, h * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${vignette})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    }
    if (grain > 0) {
      const r = rng(7);
      for (let i = 0; i < w * h * 0.08; i++) {
        ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${grain * r()})` : `rgba(255,255,255,${grain * 0.6 * r()})`;
        ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
      }
    }
  });
}

let softDot = null;
// White soft round dot (alpha falls off to the edge), for sprites, glows and particles.
export function softDotTexture() {
  if (!softDot) {
    softDot = canvasTexture(64, 64, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    });
  }
  return softDot;
}

// ---------------------------------------------------------------- toon shading

const gradients = {};
const GRADIENT_LEVELS = { 2: [90, 255], 3: [60, 150, 255], 5: [40, 90, 145, 205, 255] };

// Gradient map for MeshToonMaterial: steps = 2, 3 or 5 (or an array of 0–255 levels).
export function toonGradient(steps = 3) {
  const levels = Array.isArray(steps) ? steps : GRADIENT_LEVELS[steps] || GRADIENT_LEVELS[3];
  const key = levels.join(',');
  if (!gradients[key]) {
    const tex = new THREE.DataTexture(new Uint8Array(levels), levels.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    gradients[key] = tex;
  }
  return gradients[key];
}

// MeshToonMaterial with a stepped gradient. Extra options go to the material.
export function toonMat(color, { steps = 3, ...rest } = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(steps), ...rest });
}

// ---------------------------------------------------------------- outlines

const outlineMats = new Map();

// Back-face hull material that pushes vertices out along their normals.
// `thickness` is in the mesh's own units (outlineAll corrects for scale).
export function outlineMaterial(color = 0x000000, thickness = 0.015) {
  const key = color + ':' + thickness.toFixed(4);
  let mat = outlineMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOutline = { value: thickness };
      shader.vertexShader = 'uniform float uOutline;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
    };
    mat.customProgramCacheKey = () => 'dump-outline';
    outlineMats.set(key, mat);
  }
  return mat;
}

// Inverted-hull outline: adds a hull child to `mesh` and returns it.
// Smooth (shared-normal) geometry gives clean outlines; hard edges may show small gaps.
export function addOutline(mesh, { color = 0x000000, thickness = 0.015 } = {}) {
  const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(color, thickness));
  hull.userData.noOutline = true;
  hull.userData.noFit = true;
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}

const _s = new THREE.Vector3();
// Outline every mesh under `root` (skips noOutline, transparent and unlit-flame meshes).
// Call once at the end of build(), after the parts are placed and scaled.
export function outlineAll(root, { color = 0x000000, thickness = 0.015 } = {}) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noOutline) return;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.side === THREE.BackSide) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.noOutline) return;
    list.push(o);
  });
  for (const o of list) {
    o.getWorldScale(_s);
    const sc = (Math.abs(_s.x) + Math.abs(_s.y) + Math.abs(_s.z)) / 3 || 1;
    addOutline(o, { color, thickness: Math.round((thickness / sc) * 1e4) / 1e4 });
  }
}

// ---------------------------------------------------------------- blob shadow

const shadowGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const shadowMats = new Map();

// Soft dark disc on the ground (no shadow maps). Add it to the figure at y = 0.
export function blobShadow({ radius = 0.3, opacity = 0.45, color = 0x000000 } = {}) {
  const key = color + ':' + opacity;
  let mat = shadowMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, alphaMap: softDotTexture(), transparent: true, opacity, depthWrite: false });
    shadowMats.set(key, mat);
  }
  const m = new THREE.Mesh(shadowGeo, mat);
  m.scale.set(radius, 1, radius);
  m.position.y = 0.004;
  m.renderOrder = -1;
  m.userData.noFit = true;
  m.userData.noOutline = true;
  return m;
}

// ---------------------------------------------------------------- torch

const flameGeo = lathe([[0, 0], [0.5, 0.18], [0.62, 0.42], [0.45, 0.7], [0.18, 0.92], [0, 1.2]], 9);
const flameMats = new Map();
function flameMat(color, opacity) {
  const key = color + ':' + opacity;
  if (!flameMats.has(key)) {
    flameMats.set(key, new THREE.MeshBasicMaterial({
      color, fog: false, toneMapped: false,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
      blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
  }
  return flameMats.get(key);
}
const glowMats = new Map();
let torchSeed = 0;

// A lit torch. The group's origin is the grip (put it in the hand); the handle
// runs along +y with the flame on top. Options:
//   length, radius            handle size (default 0.34, 0.014)
//   handleMaterial, wrapMaterial   style materials for the stick and the rag head
//   flameSize                 flame scale (default 1 = about 0.1 tall)
//   flameColors               [outer, middle, core]
//   light                     add a warm PointLight (default true)
//   intensity, distance, decay, lightColor   PointLight settings
//   glow                      soft additive halo sprite (default true)
// Returns a Group with userData { flame (Group), flameTip (Object3D), light, tick }.
// The flicker runs from userData.tick, so it stops under reduced motion.
export function torch({
  length = 0.34, radius = 0.014,
  handleMaterial = null, wrapMaterial = null,
  flameSize = 1, flameColors = [0xff4a10, 0xff9a2a, 0xffe7a0],
  light = true, intensity = 1.1, distance = 2.4, decay = 1.3, lightColor = 0xff8a3a,
  glow = true,
} = {}) {
  const g = new THREE.Group();
  const hMat = handleMaterial || new THREE.MeshLambertMaterial({ color: 0x4a3020 });
  const wMat = wrapMaterial || new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
  const top = length * 0.62;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, length, 6), hMat);
  handle.position.y = top - length / 2;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 2.1, radius * 1.6, length * 0.2, 7), wMat);
  wrap.position.y = top - length * 0.08;
  g.add(handle, wrap);

  const flame = new THREE.Group();
  flame.position.y = top + length * 0.02;
  flame.userData.noOutline = true;
  const s = 0.085 * flameSize;
  const outer = new THREE.Mesh(flameGeo, flameMat(flameColors[0], 0.85));
  outer.scale.set(s * 0.95, s, s * 0.95);
  const mid = new THREE.Mesh(flameGeo, flameMat(flameColors[1], 1));
  mid.scale.set(s * 0.62, s * 0.78, s * 0.62);
  const core = new THREE.Mesh(flameGeo, flameMat(flameColors[2], 1));
  core.scale.set(s * 0.32, s * 0.45, s * 0.32);
  flame.add(outer, mid, core);
  const tip = new THREE.Object3D();
  tip.position.y = s * 1.1;
  flame.add(tip);
  g.add(flame);

  if (glow) {
    const key = flameColors[1];
    if (!glowMats.has(key)) {
      glowMats.set(key, new THREE.SpriteMaterial({
        map: softDotTexture(), color: flameColors[1], blending: THREE.AdditiveBlending,
        transparent: true, opacity: 0.5, depthWrite: false, fog: false, toneMapped: false,
      }));
    }
    const sprite = new THREE.Sprite(glowMats.get(key));
    sprite.scale.setScalar(s * 4.2);
    sprite.position.y = s * 0.5;
    sprite.userData.noFit = true;
    flame.add(sprite);
  }

  let pl = null;
  if (light) {
    pl = new THREE.PointLight(lightColor, intensity, distance, decay);
    pl.position.y = s * 0.6;
    flame.add(pl);
  }

  const seed = ++torchSeed * 3.7;
  g.userData.flame = flame;
  g.userData.flameTip = tip;
  g.userData.light = pl;
  g.userData.tick = (t) => {
    const n = wobble(t * 6, seed), m = wobble(t * 9 + 3, seed + 1);
    flame.scale.set(1 + m * 0.08, 1 + n * 0.16, 1 + m * 0.08);
    flame.rotation.z = m * 0.08;
    flame.rotation.x = n * 0.05;
    if (pl) pl.intensity = intensity * (0.86 + n * 0.12 + m * 0.06);
  };
  return g;
}

// ---------------------------------------------------------------- embers

const _o = new THREE.Vector3();
const emberMats = new Map();

// Glowing embers drifting up from `source` (e.g. torch.userData.flameTip).
// Add the returned object to the figure root (not the torch), so embers rise
// straight up even when the torch tilts. Returns an empty Group under reduced motion.
export function embers({ source, count = 14, color = 0xff9a3a, size = 0.03, rise = 0.55, spread = 0.07, speed = 0.45 } = {}) {
  if (REDUCED_MOTION || !source) { const e = new THREE.Group(); e.userData.noFit = true; return e; }
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const origin = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const r = rng(count * 13 + 5);
  for (let i = 0; i < count; i++) life[i] = r();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const key = size;
  if (!emberMats.has(key)) {
    emberMats.set(key, new THREE.PointsMaterial({
      size, map: softDotTexture(), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
  }
  const pts = new THREE.Points(geo, emberMats.get(key));
  pts.frustumCulled = false;
  pts.userData.noFit = true;
  const c = new THREE.Color(color);
  let started = false;
  pts.userData.tick = (t, dt) => {
    if (!pts.parent) return;
    _o.setFromMatrixPosition(source.matrixWorld);
    pts.parent.worldToLocal(_o);
    for (let i = 0; i < count; i++) {
      let l = life[i] + dt * speed * (0.7 + 0.6 * ((i * 0.618) % 1));
      if (l >= 1 || !started) {
        if (l >= 1) l -= 1;
        origin[i * 3] = _o.x; origin[i * 3 + 1] = _o.y; origin[i * 3 + 2] = _o.z;
      }
      life[i] = l;
      const ph = i * 2.39996;
      pos[i * 3] = origin[i * 3] + Math.sin(t * 1.3 + ph) * spread * l + Math.cos(ph) * spread * 0.4 * l;
      pos[i * 3 + 1] = origin[i * 3 + 1] + l * rise;
      pos[i * 3 + 2] = origin[i * 3 + 2] + Math.cos(t * 1.1 + ph) * spread * l + Math.sin(ph) * spread * 0.4 * l;
      const f = l < 0.1 ? l / 0.1 : (1 - l) * (1 - l);
      const flick = 0.7 + 0.3 * Math.sin(t * 17 + ph * 3);
      col[i * 3] = c.r * f * flick; col[i * 3 + 1] = c.g * f * flick; col[i * 3 + 2] = c.b * f * flick;
    }
    started = true;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return pts;
}

// ---------------------------------------------------------------- eyes

const eyeGeos = new Map();
const eyeMats = new Map();
const dotGeo = new THREE.SphereGeometry(1, 8, 6);
const dotMats = new Map();

// Patch of a sphere of radius `headRadius` centred on +z, w × h across (UVs 0–1).
function eyePatch(headRadius, w, h) {
  const key = [headRadius, w, h].join(':');
  if (!eyeGeos.has(key)) {
    const R = headRadius * 1.012;
    const pw = w / R, ph = h / R;
    eyeGeos.set(key, new THREE.SphereGeometry(R, 6, 6, Math.PI / 2 - pw / 2, pw, Math.PI / 2 - ph / 2, ph));
  }
  return eyeGeos.get(key);
}

// One painted eye drawn on a canvas, as a patch that sits on a sphere-ish head.
// Put the mesh at the head's centre; rotate it (y = left/right, x = up/down) to move it on the surface.
//   headRadius, w, h      head radius and eye size (units)
//   sclera, iris, pupil   CSS colours (iris/pupil null to skip)
//   irisSize              iris diameter as a fraction of the eye width (0–1)
//   highlights            number of white highlights (0–3)
//   lid                   0–1, how far the upper lid comes down (lidColor)
//   ring                  CSS colour for a dark ring under the eye, or null
//   closed                draw a closed, curved line instead
//   shape                 'oval' or 'round'; lit = true uses a Lambert material
export function paintedEye({
  headRadius = 0.12, w = 0.06, h = 0.07,
  sclera = '#f4efe4', iris = '#3a2a20', pupil = '#000000', irisSize = 0.6,
  highlights = 1, lid = 0, lidColor = '#d9b99a', ring = null, closed = false,
  line = '#111111', shape = 'oval', lit = false,
} = {}) {
  const opts = { sclera, iris, pupil, irisSize, highlights, lid, lidColor, ring, closed, line, shape, lit };
  const key = JSON.stringify(opts);
  if (!eyeMats.has(key)) {
    const tex = canvasTexture(64, 64, (ctx, W, H) => {
      const cx = W / 2, cy = H / 2, rx = W * 0.42, ry = shape === 'round' ? W * 0.42 : H * 0.46;
      if (ring) {
        ctx.fillStyle = ring;
        ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.35, rx * 1.05, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (closed) {
        ctx.strokeStyle = line; ctx.lineWidth = W * 0.09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.2, rx * 0.85, ry * 0.45, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        return;
      }
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = sclera; ctx.fill();
      ctx.clip();
      if (iris) {
        const ir = rx * irisSize * 1.25;
        const g = ctx.createRadialGradient(cx, cy + ir * 0.2, ir * 0.2, cx, cy, ir);
        g.addColorStop(0, iris); g.addColorStop(1, shade(iris, -0.45));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy + ry * 0.08, ir, 0, Math.PI * 2); ctx.fill();
        if (pupil) { ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(cx, cy + ry * 0.08, ir * 0.45, 0, Math.PI * 2); ctx.fill(); }
      }
      if (lid > 0) {
        ctx.fillStyle = lidColor;
        ctx.fillRect(0, 0, W, cy - ry + ry * 2 * lid);
        ctx.strokeStyle = line; ctx.lineWidth = W * 0.06;
        ctx.beginPath(); ctx.moveTo(0, cy - ry + ry * 2 * lid); ctx.lineTo(W, cy - ry + ry * 2 * lid); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      const hl = [[-0.3, -0.35, 0.22], [0.28, 0.25, 0.12], [-0.05, 0.4, 0.08]];
      for (let i = 0; i < Math.min(highlights, 3); i++) {
        const [hx, hy, hr] = hl[i];
        ctx.beginPath(); ctx.arc(cx + hx * rx, cy + hy * ry, hr * rx, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = line; ctx.lineWidth = W * 0.07;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    });
    const Mat = lit ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
    eyeMats.set(key, new Mat({ map: tex, alphaTest: 0.5, transparent: false }));
  }
  const m = new THREE.Mesh(eyePatch(headRadius, w, h), eyeMats.get(key));
  m.userData.noOutline = true;
  return m;
}

// Two eyes on a head. `make()` returns one eye mesh centred on +z at the head's
// centre (e.g. () => paintedEye({...})); for plain bead/dot eyes pass
// { dot: { headRadius, size, color } } instead. yaw = how far apart (radians),
// pitch = how high (radians, positive is up). Returns a Group to put at the head centre.
export function eyePair(make, { yaw = 0.32, pitch = 0, dot = null } = {}) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    let e;
    if (dot) {
      const key = dot.color ?? 0x111111;
      if (!dotMats.has(key)) dotMats.set(key, new THREE.MeshBasicMaterial({ color: key }));
      e = new THREE.Group();
      const bead = new THREE.Mesh(dotGeo, dotMats.get(key));
      bead.scale.setScalar(dot.size ?? 0.016);
      bead.position.z = (dot.headRadius ?? 0.12) * 0.98;
      bead.userData.noOutline = true;
      e.add(bead);
    } else {
      e = make(side);
    }
    e.rotation.order = 'YXZ';
    e.rotation.y = side * yaw;
    e.rotation.x = -pitch;
    g.add(e);
  }
  g.userData.noFit = true;
  return g;
}

// Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour.
export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  if (amount < 0) c.multiplyScalar(1 + amount); else c.lerp(new THREE.Color(1, 1, 1), amount);
  return '#' + c.getHexString();
}
