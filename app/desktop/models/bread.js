// bread: a tall round scored sourdough boule on a small dark board.
import { THREE, part, group } from './kit.js';

export default function build() {
  const pts = [
    [0.0, 0.0],
    [0.72, 0.0],
    [0.86, 0.2],
    [0.86, 0.5],
    [0.72, 0.8],
    [0.44, 0.98],
    [0.0, 1.04],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const loaf = new THREE.LatheGeometry(pts, 9);
  const by = 0.2;
  const g = group(
    part(new THREE.BoxGeometry(2.0, by, 1.4), 0.15, [0, by / 2, 0]),
    part(loaf, 0.95, [0, by, 0]),
  );
  // Scored cross on top, plus slashes running down the shoulders.
  const top = by + 1.04;
  g.add(part(new THREE.BoxGeometry(1.0, 0.12, 0.22), 0.08, [0, top - 0.05, 0], [0, Math.PI / 4, 0]));
  g.add(part(new THREE.BoxGeometry(1.0, 0.12, 0.22), 0.08, [0, top - 0.05, 0], [0, -Math.PI / 4, 0]));
  [1, 3, 5, 7].forEach((k) => {
    const a = (k * Math.PI) / 4;
    const r = 0.62;
    g.add(part(new THREE.BoxGeometry(0.42, 0.12, 0.22), 0.08, [Math.cos(a) * r, top - 0.27, -Math.sin(a) * r], [0, a, -0.75]));
  });
  return g;
}
