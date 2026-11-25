// learning feed: an old CRT television wearing a graduation cap.
import { THREE, part, group } from './kit.js';

export default function build() {
  const tv = group();
  // White cabinet and a tapered tube housing at the back.
  tv.add(part(new THREE.BoxGeometry(1.3, 1.05, 0.7), 1, [0, 0, 0]));
  tv.add(part(new THREE.BoxGeometry(0.9, 0.7, 0.4), 0.9, [0, 0, -0.5]));
  // Big black screen with a white play triangle, and two dials.
  tv.add(part(new THREE.BoxGeometry(0.86, 0.8, 0.08), 0.05, [-0.14, 0, 0.35]));
  tv.add(part(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 3), 1, [-0.1, 0, 0.4], [Math.PI / 2, 0, -Math.PI / 2]));
  const dial = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
  tv.add(part(dial, 0.05, [0.47, 0.2, 0.37], [Math.PI / 2, 0, 0]));
  tv.add(part(dial, 0.05, [0.47, -0.15, 0.37], [Math.PI / 2, 0, 0]));
  tv.position.set(0, 0.72, 0);
  tv.rotation.x = -0.18; // lean back so the screen catches the light
  const g = group(tv);
  // Legs.
  const leg = new THREE.BoxGeometry(0.12, 0.3, 0.12);
  for (const x of [-0.45, 0.45]) g.add(part(leg, 0.05, [x, 0.1, 0]));
  // Graduation cap, tipped forward so the square board shows: skull cap, board, white tassel.
  const cap = group();
  cap.add(part(new THREE.CylinderGeometry(0.28, 0.32, 0.16, 8), 0.05, [0, 0.08, 0]));
  cap.add(part(new THREE.BoxGeometry(0.8, 0.07, 0.8), 0.05, [0, 0.2, 0], [0, Math.PI / 4, 0]));
  cap.add(part(new THREE.BoxGeometry(0.08, 0.36, 0.08), 1, [0.55, 0.04, 0]));
  cap.add(part(new THREE.BoxGeometry(0.55, 0.06, 0.08), 1, [0.3, 0.25, 0]));
  cap.position.set(0, 1.2, -0.1);
  cap.rotation.set(0.25, 0, -0.12);
  g.add(cap);
  return g;
}
