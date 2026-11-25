// design framework: a fanned deck of swatch cards pinned at one corner.
import { THREE, part, group } from './kit.js';

export default function build() {
  const g = group();
  const tones = [0.1, 1, 0.1, 1, 0.1];
  const n = tones.length;
  const card = new THREE.BoxGeometry(0.36, 1.8, 0.08);
  const chip = new THREE.BoxGeometry(0.38, 0.5, 0.1);
  for (let i = 0; i < n; i += 1) {
    const a = -1.2 + (2.4 * i) / (n - 1);
    const arm = group(
      part(card, 1, [0, 0.9, 0]),
      part(chip, tones[i], [0, 1.55, 0]),
    );
    arm.rotation.set(0, 0, -a);
    arm.position.set(0, 0, (i - (n - 1) / 2) * 0.1);
    g.add(arm);
  }
  // rivet through the deck
  g.add(part(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), 0.1, [0, 0.12, 0], [Math.PI / 2, 0, 0]));
  return g;
}
