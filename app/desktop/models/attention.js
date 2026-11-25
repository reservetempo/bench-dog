// attention is all you need: a big upright almond eye with a black pupil and lashes.
import { THREE, part, group } from './kit.js';

function almond(w, h, segs) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  for (let i = 1; i <= segs; i += 1) {
    const a = Math.PI - (Math.PI * i) / segs;
    s.lineTo(Math.cos(a) * w, Math.sin(a) ** 2 * h);
  }
  for (let i = 1; i < segs; i += 1) {
    const a = (Math.PI * i) / segs;
    s.lineTo(Math.cos(a) * w, -(Math.sin(a) ** 2) * h);
  }
  return s;
}

export default function build() {
  const shape = almond(1.0, 0.6, 10);
  const eyeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
  eyeGeo.translate(0, 0, -0.2);
  const g = group(
    part(eyeGeo, 0.97),
    // Big black iris and pupil, through both faces so it reads while spinning.
    part(new THREE.CylinderGeometry(0.4, 0.4, 0.48, 8), 0.06, [0, 0, 0], [Math.PI / 2, 0, 0]),
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.54, 8), 0.03, [0, 0, 0], [Math.PI / 2, 0, 0]),
    // Tiny white glint.
    part(new THREE.BoxGeometry(0.15, 0.15, 0.6), 1, [-0.14, 0.14, 0]),
  );
  // Lashes on the upper lid.
  [-0.5, 0, 0.5].forEach((x) => {
    const y = (1 - x * x) * 0.6;
    g.add(part(new THREE.BoxGeometry(0.08, 0.22, 0.14), 0.1, [x * 1.08, y + 0.1, 0], [0, 0, -x * 0.8]));
  });
  return g;
}
