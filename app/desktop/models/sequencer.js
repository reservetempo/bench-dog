// sequencer: a wedge-shaped drum machine with a 4x4 grid of black pads and two knobs.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  // Side profile of the wedge (x = depth, y = height), extruded across the width.
  const s = new THREE.Shape();
  s.moveTo(0.7, 0);
  s.lineTo(0.7, 0.25);
  s.lineTo(-0.4, 1.25);
  s.lineTo(-0.7, 1.25);
  s.lineTo(-0.7, 0);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false });
  body.translate(0, 0, -0.75);
  g.add(part(body, 0.92, [0, 0, 0], [0, -Math.PI / 2, 0]));
  // Panel on the slope: local y is the panel normal, local z runs down the slope.
  const panel = group();
  panel.position.set(0, 0.75, 0.15);
  panel.rotation.x = Math.atan2(1.0, 1.1);
  const pad = new THREE.BoxGeometry(0.22, 0.12, 0.22);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const lit = r === 1 && c === 2;
      panel.add(part(pad, lit ? 1 : 0.05, [-0.33 + c * 0.33, 0.04, -0.5 + r * 0.33]));
    }
  }
  const knob = new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8);
  panel.add(part(knob, 0.05, [-0.62, 0.08, -0.35]));
  panel.add(part(knob, 0.05, [-0.62, 0.08, 0.1]));
  panel.add(part(new THREE.BoxGeometry(0.14, 0.12, 0.22), 0.05, [-0.62, 0.04, 0.5]));
  g.add(panel);
  return g;
}
