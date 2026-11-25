// sap-1: a breadboard on an easel with a big black DIP chip and a row of LEDs.
import { THREE, part, group } from './kit.js';

export default function build() {
  const panel = group();
  // White breadboard with a grey centre channel.
  panel.add(part(new THREE.BoxGeometry(1.5, 1.4, 0.12), 1, [0, 0, 0]));
  panel.add(part(new THREE.BoxGeometry(1.5, 0.06, 0.13), 0.5, [0, -0.15, 0.005]));
  // Big DIP chip straddling the channel, with chunky comb legs above and below.
  panel.add(part(new THREE.BoxGeometry(1.1, 0.4, 0.16), 0.05, [0, -0.15, 0.13]));
  panel.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6), 0.6, [-0.45, -0.07, 0.22], [Math.PI / 2, 0, 0]));
  const leg = new THREE.BoxGeometry(0.08, 0.14, 0.08);
  for (let i = 0; i < 6; i += 1) {
    const x = -0.45 + i * 0.18;
    panel.add(part(leg, 0.05, [x, 0.1, 0.1]));
    panel.add(part(leg, 0.05, [x, -0.4, 0.1]));
  }
  // Row of LEDs near the top, as little bulbs, plus wires as a black bar.
  const led = new THREE.CylinderGeometry(0.09, 0.09, 0.2, 6);
  for (let i = 0; i < 4; i += 1) {
    panel.add(part(led, i % 2 ? 0.05 : 1, [-0.45 + i * 0.3, 0.45, 0.14], [Math.PI / 2, 0, 0]));
  }
  panel.add(part(new THREE.BoxGeometry(1.2, 0.06, 0.06), 0.05, [0, 0.27, 0.08]));
  panel.position.set(0, 0.75, 0);
  panel.rotation.x = -0.3;
  // Easel foot and back strut.
  return group(
    panel,
    part(new THREE.BoxGeometry(1.6, 0.12, 0.6), 0.05, [0, 0.0, 0.05]),
    part(new THREE.BoxGeometry(0.2, 1.2, 0.12), 0.35, [0, 0.6, -0.35], [0.35, 0, 0])
  );
}
