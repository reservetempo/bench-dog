// studio 414: a potter's wheel with a pot on the wheel head.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  // body of the wheel
  g.add(part(new THREE.BoxGeometry(1.3, 0.55, 1.1), 1, [0, 0.28, 0]));
  // splash pan
  g.add(part(new THREE.CylinderGeometry(0.78, 0.66, 0.28, 10), 0.35, [0, 0.69, 0]));
  // dark wheel head
  g.add(part(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 10), 0.1, [0, 0.86, 0]));
  // pot (lathed)
  const pts = [
    [0.0, 0], [0.32, 0], [0.42, 0.18], [0.46, 0.4], [0.36, 0.68], [0.24, 0.85], [0.3, 0.98], [0.26, 1.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(part(new THREE.LatheGeometry(pts, 8), 1, [0, 0.92, 0], [0, 0, 0], 1.25));
  // dark opening at the rim
  g.add(part(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 8), 0.1, [0, 2.17, 0], [0, 0, 0], 1.25));
  // pedal
  g.add(part(new THREE.BoxGeometry(0.4, 0.12, 0.35), 0.1, [0.4, 0.06, 0.75]));
  return g;
}
