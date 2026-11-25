// mudmuddd: a glazed ceramic amphora with two handles and a dark band.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  const pts = [
    [0.0, 0], [0.32, 0], [0.34, 0.08], [0.6, 0.45], [0.7, 0.8], [0.6, 1.15], [0.34, 1.4],
    [0.28, 1.65], [0.38, 1.82], [0.34, 1.86],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(part(new THREE.LatheGeometry(pts, 8), 0.95, [0, 0, 0]));
  // dark glaze band around the belly
  g.add(part(new THREE.CylinderGeometry(0.715, 0.69, 0.22, 8), 0.1, [0, 0.82, 0]));
  // dark mouth
  g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 8), 0.1, [0, 1.85, 0]));
  // handles: loops from neck to shoulder
  const handle = new THREE.TorusGeometry(0.28, 0.07, 4, 8, Math.PI * 1.1);
  g.add(part(handle, 0.9, [0.48, 1.4, 0], [0, 0, -Math.PI * 0.55]));
  g.add(part(handle, 0.9, [-0.48, 1.4, 0], [0, Math.PI, -Math.PI * 0.55]));
  return g;
}
