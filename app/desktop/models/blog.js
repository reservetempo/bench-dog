// blog: a quill feather standing in a black inkpot.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  // Inkpot: squat octagonal pot with a white collar.
  g.add(part(new THREE.CylinderGeometry(0.5, 0.6, 0.55, 8), 0.08, [0, 0.275, 0]));
  g.add(part(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 8), 0.08, [0, 0.6, 0]));
  g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 8), 1, [0, 0.72, 0]));
  // Quill: a broad leaf-shaped feather on a shaft, leaning toward the light.
  const quill = group();
  quill.add(part(new THREE.IcosahedronGeometry(0.5, 0), 1, [0, 1.0, 0], [0, 0, 0], [0.62, 1.35, 0.22]));
  quill.add(part(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), 0.05, [0, 0.9, 0.08]));
  quill.position.set(0, 0.55, 0);
  quill.rotation.set(0, 0, 0.32);
  g.add(quill);
  return g;
}
