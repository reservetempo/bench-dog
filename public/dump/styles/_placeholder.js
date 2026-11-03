// Grey stand-in figures used by styles that aren't built yet (tasks 15 and 16
// replace those files). Not a real style: just enough for the page to work.

import * as THREE from 'three';
import { torch, blobShadow, gradientBackground } from '../kit.js';

const mat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a, flatShading: true });
const dark = new THREE.MeshLambertMaterial({ color: 0x5a5a5a, flatShading: true });
const red = new THREE.MeshLambertMaterial({ color: 0x8a3a36, flatShading: true });
const body = new THREE.ConeGeometry(0.2, 0.62, 10).translate(0, 0.31, 0);
const head = new THREE.SphereGeometry(0.11, 12, 8);
const hood = new THREE.ConeGeometry(0.14, 0.2, 10);
const hat = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16);

export function placeholder(meta) {
  return {
    ...meta,
    setupScene(scene) {
      scene.background = gradientBackground([[0, '#2b2b2e'], [1, '#18181a']], { vignette: 0.4 });
      scene.add(new THREE.HemisphereLight(0xb8bcc8, 0x202024, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(2, 4, 3);
      scene.add(key);
    },
    build(role) {
      const g = new THREE.Group();
      const tall = role === 'cardinal' ? 1.12 : 1;
      const b = new THREE.Mesh(body, role === 'cardinal' ? red : role === 'priest' ? dark : mat);
      b.scale.y = tall;
      const h = new THREE.Mesh(head, mat);
      h.position.y = 0.7 * tall;
      g.add(b, h, blobShadow({ radius: 0.26 }));
      if (role === 'monk') { const c = new THREE.Mesh(hood, dark); c.position.y = 0.8; g.add(c); }
      if (role === 'cardinal') { const c = new THREE.Mesh(hat, red); c.position.y = 0.86; g.add(c); }
      if (role === 'peasant') {
        const t = torch();
        t.position.set(0.2, 0.42, 0.08);
        g.add(t);
      }
      return g;
    },
  };
}
