// units: a stack of three study books with an apple on top.
import { THREE, part, group } from './kit.js';

// A book lying flat: black boards top and bottom, black spine on the left, white pages showing.
function book(w, h, d, y, rot) {
  const b = group();
  const board = new THREE.BoxGeometry(w, 0.07, d);
  b.add(part(board, 0.05, [0, h / 2 - 0.035, 0]));
  b.add(part(board, 0.05, [0, -h / 2 + 0.035, 0]));
  b.add(part(new THREE.BoxGeometry(0.1, h, d), 0.05, [-w / 2 + 0.05, 0, 0]));
  b.add(part(new THREE.BoxGeometry(w - 0.12, h - 0.12, d - 0.08), 1, [0.02, 0, 0]));
  b.position.set(0, y, 0);
  b.rotation.y = rot;
  return b;
}

export default function build() {
  const g = group();
  g.add(book(1.5, 0.38, 1.05, 0.19, 0));
  g.add(book(1.35, 0.34, 0.95, 0.55, Math.PI + 0.25));
  g.add(book(1.25, 0.36, 0.9, 0.9, -0.15));
  // Apple with stalk and leaf.
  g.add(part(new THREE.IcosahedronGeometry(0.3, 0), 1, [0.1, 1.33, 0.05], [0.2, 0.3, 0], [1, 0.9, 1]));
  g.add(part(new THREE.BoxGeometry(0.07, 0.22, 0.07), 0.05, [0.1, 1.62, 0.05], [0, 0, 0.3]));
  g.add(part(new THREE.IcosahedronGeometry(0.1, 0), 0.05, [0.23, 1.62, 0.05], [0, 0, 0], [1.4, 0.5, 0.8]));
  return g;
}
