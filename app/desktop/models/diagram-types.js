// diagram types: a 3D bar chart of three rising bars with a pie chart and a lifted black wedge beside it.
import { THREE, part, group } from './kit.js';

function wedge(r, h, a0, a1, segs) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let i = 0; i <= segs; i += 1) {
    const a = a0 + ((a1 - a0) * i) / segs;
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

export default function build() {
  const g = group();
  // Bars along the left and back.
  const bars = [
    [-0.75, 0.6, -0.15, 0.97],
    [-0.3, 1.05, -0.45, 0.12],
    [0.15, 1.5, -0.55, 0.97],
  ];
  bars.forEach(([x, h, z, t]) => g.add(part(new THREE.BoxGeometry(0.38, h, 0.38), t, [x, h / 2, z])));
  // Thick pie in front-right: white three quarters, black wedge pulled out.
  g.add(part(wedge(0.62, 0.4, 0, Math.PI * 1.5, 10), 0.97, [0.45, 0, 0.35]));
  g.add(part(wedge(0.62, 0.4, Math.PI * 1.5, Math.PI * 2, 3), 0.1, [0.62, 0.2, 0.52]));
  return g;
}
