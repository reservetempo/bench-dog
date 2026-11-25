// analog oscillator recipes: a synth oscillator module with a big tuning knob and a sine wave on its face.
import { THREE, part, group } from './kit.js';

export default function build() {
  // Panel tilted back so its face catches the light.
  const panel = group(part(new THREE.BoxGeometry(1.6, 1.5, 0.35), 0.95, [0, 0, 0]));

  // Sine wave drawn as a chain of short bars standing out of the face.
  const n = 9;
  for (let i = 0; i < n; i += 1) {
    const a = (i / (n - 1)) * Math.PI * 2;
    const b = ((i + 1) / (n - 1)) * Math.PI * 2;
    const x0 = -0.62 + (i / (n - 1)) * 1.24;
    const x1 = -0.62 + ((i + 1) / (n - 1)) * 1.24;
    const y0 = 0.38 + Math.sin(a) * 0.22;
    const y1 = 0.38 + Math.sin(b) * 0.22;
    if (i === n - 1) break;
    const len = Math.hypot(x1 - x0, y1 - y0);
    panel.add(
      part(new THREE.BoxGeometry(len + 0.04, 0.09, 0.08), 0.1, [(x0 + x1) / 2, (y0 + y1) / 2, 0.2], [0, 0, Math.atan2(y1 - y0, x1 - x0)])
    );
  }

  // Big tuning knob with a pointer, plus two jacks.
  panel.add(part(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 8), 0.5, [-0.3, -0.35, 0.28], [Math.PI / 2, 0, 0]));
  panel.add(part(new THREE.BoxGeometry(0.06, 0.24, 0.06), 1, [-0.3, -0.25, 0.41]));
  panel.add(part(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 6), 0.05, [0.4, -0.22, 0.22], [Math.PI / 2, 0, 0]));
  panel.add(part(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 6), 0.05, [0.4, -0.55, 0.22], [Math.PI / 2, 0, 0]));
  panel.rotation.x = -0.3;

  return group(panel, part(new THREE.BoxGeometry(1.7, 0.18, 0.9), 0.3, [0, -0.85, 0.05]));
}
