// archive: a three-drawer filing cabinet.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group(part(new THREE.BoxGeometry(1, 1.6, 0.9), 0.85, [0, 0.8, 0]));
  for (let i = 0; i < 3; i += 1) {
    const y = 0.3 + i * 0.5;
    g.add(part(new THREE.BoxGeometry(0.86, 0.42, 0.06), 0.95, [0, y, 0.47]));
    g.add(part(new THREE.BoxGeometry(0.3, 0.06, 0.08), 0.15, [0, y + 0.08, 0.52]));
    g.add(part(new THREE.BoxGeometry(0.2, 0.1, 0.02), 0.6, [0, y - 0.06, 0.51]));
  }
  return g;
}
