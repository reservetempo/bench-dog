// euclid: a drafting compass standing astride the circle it has drawn.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  const spread = 0.5; // half-angle of the legs
  const len = 1.7;
  const hy = Math.cos(spread) * len + 0.05;
  const dx = Math.sin(spread) * len;
  const dy = Math.cos(spread) * len;
  // the circle drawn by the compass, centred on the needle and through the pencil
  g.add(part(new THREE.TorusGeometry(2 * dx, 0.09, 3, 20), 0.1, [-dx, 0.02, 0], [Math.PI / 2, 0, 0], [1, 1, 0.4]));
  // legs
  for (const s of [-1, 1]) {
    const leg = new THREE.BoxGeometry(0.22, len, 0.22);
    g.add(part(leg, 0.95, [s * dx / 2, hy - dy / 2, 0], [0, 0, s * spread]));
  }
  // needle tip (left) and pencil lead (right)
  g.add(part(new THREE.ConeGeometry(0.1, 0.3, 6), 0.1, [-dx, 0.15, 0], [Math.PI, 0, 0]));
  g.add(part(new THREE.ConeGeometry(0.13, 0.32, 6), 0.1, [dx, 0.16, 0], [Math.PI, 0, 0]));
  // hinge and handle
  g.add(part(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8), 0.1, [0, hy, 0], [Math.PI / 2, 0, 0]));
  g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), 0.1, [0, hy + 0.35, 0]));
  return g;
}
