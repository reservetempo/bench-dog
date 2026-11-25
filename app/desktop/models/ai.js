// AI: a big white robot head with antenna sitting in an open box.
import { THREE, part, group } from './kit.js';

export default function build() {
  const W = 1.4;
  const D = 1.1;
  const H = 0.45;
  const w = 0.08;
  const f = 0.3;
  const g = group(
    // Open box: floor and four walls.
    part(new THREE.BoxGeometry(W, w, D), 0.6, [0, w / 2, 0]),
    part(new THREE.BoxGeometry(W, H, w), 0.7, [0, H / 2, -D / 2]),
    part(new THREE.BoxGeometry(W, H, w), 0.7, [0, H / 2, D / 2]),
    part(new THREE.BoxGeometry(w, H, D), 0.7, [-W / 2, H / 2, 0]),
    part(new THREE.BoxGeometry(w, H, D), 0.7, [W / 2, H / 2, 0]),
    // Four flaps folded open, leaning outward.
    part(new THREE.BoxGeometry(W, f, w * 0.6), 0.4, [0, H + 0.11, D / 2 + 0.1], [0.7, 0, 0]),
    part(new THREE.BoxGeometry(W, f, w * 0.6), 0.4, [0, H + 0.11, -D / 2 - 0.1], [-0.7, 0, 0]),
    part(new THREE.BoxGeometry(w * 0.6, f, D), 0.4, [W / 2 + 0.1, H + 0.11, 0], [0, 0, -0.7]),
    part(new THREE.BoxGeometry(w * 0.6, f, D), 0.4, [-W / 2 - 0.1, H + 0.11, 0], [0, 0, 0.7]),
  );
  // Robot head, big, rising out of the box.
  const hy = 0.95;
  const hd = 0.8;
  g.add(part(new THREE.BoxGeometry(1.1, 0.85, hd), 0.97, [0, hy, 0]));
  // Face on the front and back so it reads while spinning.
  [1, -1].forEach((s) => {
    const z = (s * hd) / 2 + s * 0.02;
    g.add(part(new THREE.BoxGeometry(0.28, 0.28, 0.06), 0.05, [-0.25, hy + 0.1, z]));
    g.add(part(new THREE.BoxGeometry(0.28, 0.28, 0.06), 0.05, [0.25, hy + 0.1, z]));
    g.add(part(new THREE.BoxGeometry(0.56, 0.1, 0.06), 0.08, [0, hy - 0.24, z]));
  });
  // Ears.
  g.add(part(new THREE.BoxGeometry(0.14, 0.32, 0.32), 0.1, [-0.62, hy, 0]));
  g.add(part(new THREE.BoxGeometry(0.14, 0.32, 0.32), 0.1, [0.62, hy, 0]));
  // Antenna.
  g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5), 0.15, [0, hy + 0.57, 0]));
  g.add(part(new THREE.IcosahedronGeometry(0.14, 0), 0.1, [0, hy + 0.76, 0]));
  return g;
}
