// calculus spivak: a big white extruded integral sign standing on a thick white textbook.
import { THREE, part, group } from './kit.js';

// A ribbon of varying width along a centreline, as a closed shape.
function ribbon(pts, width) {
  const left = [];
  const right = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    const w = width(i / (pts.length - 1));
    const nx = (-dy / l) * w;
    const ny = (dx / l) * w;
    left.push([p[0] + nx, p[1] + ny]);
    right.push([p[0] - nx, p[1] - ny]);
  });
  const s = new THREE.Shape();
  const all = left.concat(right.reverse());
  s.moveTo(...all[0]);
  all.slice(1).forEach((p) => s.lineTo(...p));
  return s;
}

export default function build() {
  const g = group();
  // Book: white covers, checker page edges, black spine.
  g.add(part(new THREE.BoxGeometry(1.6, 0.09, 1.15), 1, [0, 0.045, 0]));
  g.add(part(new THREE.BoxGeometry(1.5, 0.36, 1.05), 0.9, [0.04, 0.27, 0]));
  g.add(part(new THREE.BoxGeometry(1.6, 0.09, 1.15), 1, [0, 0.495, 0]));
  g.add(part(new THREE.BoxGeometry(0.12, 0.54, 1.15), 0.1, [-0.8, 0.27, 0]));

  // Integral sign centreline: top hook, slanted stem, bottom hook (point-symmetric).
  const top = [
    [0.75, 0.82],
    [0.75, 1.0],
    [0.66, 1.13],
    [0.5, 1.2],
    [0.35, 1.16],
    [0.24, 1.03],
    [0.17, 0.8],
    [0.1, 0.45],
    [0.04, 0.15],
  ];
  const pts = top.concat(top.slice().reverse().map(([x, y]) => [-x, -y]));
  const shape = ribbon(pts, (u) => 0.07 + 0.06 * Math.sin(Math.PI * u));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.translate(0, 0, -0.08);
  const sign = group(
    part(geo, 0.97),
    part(new THREE.IcosahedronGeometry(0.14, 0), 0.97, [0.75, 0.8, 0]),
    part(new THREE.IcosahedronGeometry(0.14, 0), 0.97, [-0.75, -0.8, 0]),
  );
  sign.position.set(0.05, 1.85, 0);
  sign.scale.setScalar(1.1);
  g.add(sign);
  return g;
}
