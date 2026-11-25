// dump: a skip bin heaped with crumpled pages and boxes.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  // Skip body: trapezoid side profile (wide top, sloped ends), extruded front to back.
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0.8, 0.75);
  s.lineTo(-0.8, 0.75);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false });
  body.translate(0, 0, -0.5);
  g.add(part(body, 0.1, [0, 0.1, 0]));
  // White rim around the top and white ribs down the long sides.
  g.add(part(new THREE.BoxGeometry(1.7, 0.1, 1.08), 1, [0, 0.86, 0]));
  const rib = new THREE.BoxGeometry(0.12, 0.72, 1.06);
  for (const x of [-0.25, 0.25]) g.add(part(rib, 1, [x, 0.46, 0]));
  // Lifting lugs on the sloped ends.
  const lug = new THREE.BoxGeometry(0.14, 0.14, 0.5);
  g.add(part(lug, 0.05, [-0.78, 0.55, 0]));
  g.add(part(lug, 0.05, [0.78, 0.55, 0]));
  // Heap of junk: crumpled paper balls, a box and a loose sheet.
  const ball = new THREE.IcosahedronGeometry(0.3, 0);
  g.add(part(ball, 1, [-0.45, 1.0, 0.1], [0.3, 0.2, 0]));
  g.add(part(ball, 1, [0.1, 1.12, -0.1], [0.9, 0.4, 0.1], 1.25));
  g.add(part(ball, 1, [0.5, 0.98, 0.15], [0.5, 1, 0], 0.95));
  g.add(part(new THREE.BoxGeometry(0.42, 0.38, 0.34), 0.5, [-0.15, 1.2, 0.2], [0.2, 0.5, 0.35]));
  g.add(part(new THREE.BoxGeometry(0.5, 0.07, 0.38), 1, [0.35, 1.32, 0.05], [0.1, -0.3, -0.5]));
  // Runners underneath.
  const foot = new THREE.BoxGeometry(0.18, 0.12, 1.0);
  g.add(part(foot, 0.05, [-0.32, 0.05, 0]));
  g.add(part(foot, 0.05, [0.32, 0.05, 0]));
  return g;
}
