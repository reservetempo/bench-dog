// Shared helpers for the low-poly figurines on the homepage (one file per link in this folder).
//
// A model file default-exports build(), which returns a THREE.Object3D with y up, facing +z.
// Size and position don't matter: the engine centres it and scales it to fill the icon.
// The engine renders it with flat shading and then dithers it to one bit (black and white),
// so shapes and tone carry the meaning, not colour: use tone() for every material.

import * as THREE from 'three';

const cache = new Map();

// A flat-shaded material by brightness: 0 is black, 1 is white. Lighting then varies it per face.
export function tone(t) {
  const key = Math.round(t * 100);
  if (!cache.has(key)) {
    const c = new THREE.Color().setScalar(key / 100);
    cache.set(key, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  }
  return cache.get(key);
}

// A mesh at a position, with optional rotation [x, y, z] (radians) and scale (number or [x, y, z]).
export function part(geometry, t, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1) {
  const m = new THREE.Mesh(geometry, typeof t === 'number' ? tone(t) : t);
  m.position.set(...position);
  m.rotation.set(...rotation);
  if (Array.isArray(scale)) m.scale.set(...scale);
  else m.scale.setScalar(scale);
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}

export { THREE };
