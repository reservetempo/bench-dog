// website framework: a browser window showing a page laid out in blocks.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  const w = 1.9;
  const h = 1.6;
  const d = 0.3;
  // window body
  g.add(part(new THREE.BoxGeometry(w, h, d), 1, [0, h / 2, 0]));
  // black title bar wrapping the top
  g.add(part(new THREE.BoxGeometry(w + 0.04, 0.3, d + 0.04), 0.1, [0, h - 0.13, 0]));
  // three window buttons
  const dot = new THREE.BoxGeometry(0.12, 0.12, 0.04);
  for (let i = 0; i < 3; i += 1) g.add(part(dot, 0.95, [-w / 2 + 0.2 + i * 0.2, h - 0.13, d / 2 + 0.03]));
  // page layout blocks on the front
  const z = d / 2 + 0.03;
  g.add(part(new THREE.BoxGeometry(1.5, 0.3, 0.06), 0.1, [0, 1.05, z])); // header
  g.add(part(new THREE.BoxGeometry(0.62, 0.6, 0.06), 0.1, [-0.44, 0.45, z])); // block
  g.add(part(new THREE.BoxGeometry(0.62, 0.6, 0.06), 0.1, [0.44, 0.45, z])); // block
  // the same layout on the back so it reads while spinning
  g.add(part(new THREE.BoxGeometry(1.5, 0.3, 0.06), 0.1, [0, 1.05, -z]));
  g.add(part(new THREE.BoxGeometry(0.62, 0.6, 0.06), 0.1, [-0.44, 0.45, -z]));
  g.add(part(new THREE.BoxGeometry(0.62, 0.6, 0.06), 0.1, [0.44, 0.45, -z]));
  return g;
}
