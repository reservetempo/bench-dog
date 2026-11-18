// The town outside: a flat plain running off into the haze, a low pale pad under each
// building's lot, and the low-poly buildings standing on the pads.

import * as THREE from 'three';
import { Shape, makeShapeMaterial, mix } from './shapes';
import { buildBuilding } from './buildings';
import { GROUND_Y, LOT } from './layout';

const PLAIN = {
  spring: 0xb6d99a,
  summer: 0xa9d08e,
  autumn: 0xc9cc9a,
  'late-autumn': 0xc6c9a8,
  winter: 0xcacbb9,
};
const PAD = 0xebe6da;
const FAR = 2000;
const UP = new THREE.Vector3(0, 1, 0);

export const hex = (css) => parseInt(css.slice(1), 16);

export function buildWorld(layout, season) {
  const material = makeShapeMaterial();
  const highlight = makeShapeMaterial({ highlight: 1 });
  const group = new THREE.Group();

  // The plain, and a pad under each lot tinted with its building's colour.
  const land = new Shape();
  const { x: cx, z: cz } = layout.center;
  land.floor(cx - FAR, cz - FAR, cx + FAR, cz + FAR, 0, PLAIN[season] || PLAIN.summer);
  for (const b of layout.buildings) {
    const m = 0.25;
    land.box(b.center.x, 0, b.center.z, LOT + 2 * m, GROUND_Y, LOT + 2 * m, mix(PAD, hex(b.color), 0.14));
  }
  const ground = new THREE.Mesh(land.geometry(), material);
  ground.receiveShadow = true;
  group.add(ground);

  // Buildings, one mesh each so they can be picked and lifted.
  const buildings = new Map();
  for (const b of layout.buildings) {
    const { geometry, height } = buildBuilding(b, hex(b.color));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(b.center.x, GROUND_Y, b.center.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = b.id;
    group.add(mesh);
    buildings.set(b.id, {
      ...b,
      mesh,
      material,
      highlight,
      height,
      lift: 0,
      base: mesh.position.clone(),
      dir: UP,
      reach: { hover: 0.1, selected: 0.3 },
      foot: { w: LOT - 0.2, d: LOT - 0.2 },
    });
  }

  return { group, material, highlight, buildings, floorY: GROUND_Y };
}
