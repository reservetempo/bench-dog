// unit tree: a low-poly tree whose crown is a cluster of cube "units".
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  const bark = 0.15;
  g.add(part(new THREE.CylinderGeometry(0.13, 0.2, 1.0, 6), bark, [0, 0.5, 0]));
  // two branches forking from the trunk
  g.add(part(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 5), bark, [-0.22, 1.1, 0], [0, 0, 0.7]));
  g.add(part(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 5), bark, [0.22, 1.15, 0], [0, 0, -0.7]));
  // crown: faceted blobs
  const blob = new THREE.IcosahedronGeometry(1, 0);
  g.add(part(blob, 0.92, [0, 1.75, 0], [0.3, 0.2, 0], 0.62));
  g.add(part(blob, 0.92, [-0.55, 1.35, 0.1], [0.1, 0.7, 0.2], 0.45));
  g.add(part(blob, 0.92, [0.55, 1.4, -0.1], [0.5, 0.1, 0.3], 0.45));
  g.add(part(blob, 0.92, [0.05, 1.35, 0.45], [0.2, 0.4, 0.1], 0.4));
  g.add(part(blob, 0.92, [0, 1.4, -0.45], [0.6, 0.3, 0.2], 0.4));
  // ground mound
  g.add(part(new THREE.CylinderGeometry(0.45, 0.6, 0.12, 7), 0.6, [0, 0.03, 0]));
  return g;
}
