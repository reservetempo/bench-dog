// One shared WebGL renderer draws every homepage figurine (browsers allow only a few WebGL
// contexts, so each icon gets a plain 2D canvas instead). Each figurine is rendered in its own
// colours (models/index.js) with flat shading, then given a bold black outline.

import { MODELS } from './models';

export const SIZE = 80; // icon size in CSS pixels
const RES = 2; // rendered at 2x for sharp edges on high-density screens
export const PX = SIZE * RES;
const OUTLINE = 3; // outline width in rendered pixels
export const REST_ANGLE = -0.6; // radians: a three-quarter view

let enginePromise = null;
const modelPromises = new Map();

export const hasModel = (name) => Object.prototype.hasOwnProperty.call(MODELS, name);

function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const THREE = await import('three');
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setPixelRatio(1);
      renderer.setSize(PX, PX, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const target = new THREE.WebGLRenderTarget(PX, PX, { colorSpace: THREE.SRGBColorSpace });
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
      camera.position.set(0, 1.6, 6);
      camera.lookAt(0, 0, 0);

      // Lambert divides light by pi, so intensities are scaled by pi: faces toward the light
      // show their colour at full strength and faces turned away go a shade darker.
      scene.add(new THREE.AmbientLight(0xffffff, 0.5 * Math.PI));
      const key = new THREE.DirectionalLight(0xffffff, 0.85 * Math.PI);
      key.position.set(-2, 3, 2.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 0.25 * Math.PI);
      rim.position.set(3, 1, -2);
      scene.add(rim);

      const pivot = new THREE.Group();
      scene.add(pivot);
      const buffer = new Uint8Array(PX * PX * 4);
      return { THREE, renderer, target, scene, camera, pivot, buffer };
    })();
  }
  return enginePromise;
}

// Swap each greyscale tone material for a colour on the model's [dark, mid, light] ramp.
function recolour(THREE, obj, colors) {
  const stops = colors.map((c) => new THREE.Color(c));
  const made = new Map();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.material.color.r;
    if (!made.has(t)) {
      const color = t < 0.5 ? stops[0].clone().lerp(stops[1], t * 2) : stops[1].clone().lerp(stops[2], t * 2 - 1);
      made.set(t, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    }
    o.material = made.get(t);
  });
}

// Build a model once, coloured, centred and scaled so it fits the icon at every turn about y.
function getModel(name) {
  if (!modelPromises.has(name)) {
    modelPromises.set(
      name,
      Promise.all([getEngine(), MODELS[name].load()]).then(([{ THREE }, mod]) => {
        const obj = mod.default();
        recolour(THREE, obj, MODELS[name].colors);
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        let r = 0;
        const v = new THREE.Vector3();
        obj.traverse((o) => {
          const pos = o.geometry?.attributes?.position;
          if (!pos) return;
          for (let i = 0; i < pos.count; i += 1) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            r = Math.max(r, Math.hypot(v.x - c.x, v.z - c.z));
          }
        });
        const h = (box.max.y - box.min.y) / 2;
        // The camera looks down a little, so the height and the depth both take up screen room.
        const s = 0.92 / Math.max(r, h * 0.97 + r * 0.26, 1e-6);
        obj.position.sub(c);
        const holder = new THREE.Group();
        holder.add(obj);
        holder.scale.setScalar(s);
        return holder;
      })
    );
  }
  return modelPromises.get(name);
}

// Load what a figurine needs; resolves to false when WebGL or the model is unavailable.
export async function prepare(name) {
  if (!hasModel(name)) return false;
  try {
    await getModel(name);
    return true;
  } catch (err) {
    console.warn(`figurine "${name}" unavailable`, err);
    return false;
  }
}

// Draw a figurine into a PX x PX canvas. Selected darkens it, as old desktops did; open
// (a folder whose window is open) shades it with a checkerboard.
export async function draw(canvas, name, { angle = REST_ANGLE, selected = false, open = false } = {}) {
  const [eng, model] = await Promise.all([getEngine(), getModel(name)]);
  const { renderer, target, scene, camera, pivot, buffer } = eng;

  pivot.clear();
  pivot.add(model);
  pivot.rotation.y = angle;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, PX, PX, buffer);
  renderer.setRenderTarget(null);
  pivot.clear();

  // Which pixels the figurine covers (GL rows run bottom-up).
  const solid = new Uint8Array(PX * PX);
  for (let y = 0; y < PX; y += 1) {
    for (let x = 0; x < PX; x += 1) {
      if (buffer[((PX - 1 - y) * PX + x) * 4 + 3] >= 128) solid[y * PX + x] = 1;
    }
  }

  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(PX, PX);
  const d = img.data;
  const r2 = OUTLINE * OUTLINE;
  for (let y = 0; y < PX; y += 1) {
    for (let x = 0; x < PX; x += 1) {
      const j = y * PX + x;
      const o = j * 4;
      if (solid[j]) {
        const i = ((PX - 1 - y) * PX + x) * 4;
        const dim = selected || (open && ((x >> 1) + (y >> 1)) % 2) ? 0.45 : 1;
        d[o] = buffer[i] * dim;
        d[o + 1] = buffer[i + 1] * dim;
        d[o + 2] = buffer[i + 2] * dim;
        d[o + 3] = 255;
        continue;
      }
      // A transparent pixel within OUTLINE of the figurine is part of its black outline.
      let near = false;
      for (let dy = -OUTLINE; dy <= OUTLINE && !near; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= PX) continue;
        for (let dx = -OUTLINE; dx <= OUTLINE; dx += 1) {
          const xx = x + dx;
          if (xx >= 0 && xx < PX && dx * dx + dy * dy <= r2 && solid[yy * PX + xx]) {
            near = true;
            break;
          }
        }
      }
      if (near) d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
