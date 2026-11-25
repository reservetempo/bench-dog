#!/usr/bin/env node
// Check homepage figurines build: node scripts/check-figurine.mjs [name.js ...]
// Prints each model's triangle count and size, or the error that stopped it.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'desktop', 'models');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir).filter((f) => f.endsWith('.js') && !['kit.js', 'index.js'].includes(f));
let failed = 0;
for (const f of files) {
  try {
    const obj = (await import(pathToFileURL(join(dir, f)).href)).default();
    obj.updateMatrixWorld(true);
    let tris = 0;
    obj.traverse((o) => {
      if (o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    console.log(`${f.padEnd(24)} ${String(tris).padStart(5)} tris  ${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)}`);
  } catch (e) {
    failed += 1;
    console.log(`${f.padEnd(24)} FAILED: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
