// The static world: an island in a wide river with a wooded hill in the middle (a nod to
// Mount Royal and the St. Lawrence), the town areas, trees for the season, the railway,
// stations, street lamps, and the lit cross on the hilltop.

import * as THREE from 'three';
import { meshCells, meshVoxels, makeVoxelMaterial, VOX } from './voxels';
import { buildBuilding, treeTemplates, lampVoxels, stationVoxels, crossVoxels } from './buildings';
import { GROUND, GROUND_Y, LAYER, HILL, LOT, ROAD } from './layout';
import { fbm, hash2, mulberry32 } from './random';

export const WATER_Y = 0.2;

const K = { grass: 0, sand: 1, bed: 2, road: 3, lot: 4, park: 5 };
const R = { water: 0, island: 1, hill: 2, shore: 3, islet: 4, town: 5 };

const GRASS = {
  spring: [0x86c752, 0x7cbc4a],
  summer: [0x72b648, 0x68aa41],
  autumn: [0x96ad4e, 0x8aa247],
  'late-autumn': [0x8f9a56, 0x858f4f],
  winter: [0x8a8c5e, 0x7f8357],
};
const DIRT = 0x8a6a45;
const ROCK = 0x7d7f84;
const SAND = 0xe3d39a;
const BED = 0xb3a274;
const ASPHALT = 0x5b5f66;
const PAVING = 0xcfc8b8;

// A box with the attributes the voxel material needs, for instanced track parts.
function plainBox(w, h, d, hex) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const n = geo.attributes.position.count;
  const c = new THREE.Color(hex);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  return geo;
}

// Position and heading on the railway at arc length s.
export function trackPoint(track, s, out = { x: 0, z: 0, yaw: 0 }) {
  const th = track.start - s / track.radius;
  out.x = HILL.x + track.radius * Math.cos(th);
  out.z = HILL.z + track.radius * Math.sin(th);
  out.yaw = Math.atan2(Math.sin(th), -Math.cos(th));
  return out;
}

function makeTerrain(layout, season) {
  const { island, areas, track } = layout;
  const north = island.cz - island.rz - 7;
  const south = island.cz + island.rz + 17;
  const gx0 = Math.floor(island.cx - island.rx - 26);
  const gx1 = Math.ceil(island.cx + island.rx + 26);
  const gz0 = Math.floor(north - 14);
  const gz1 = Math.ceil(south + 12);
  const W = gx1 - gx0;
  const D = gz1 - gz0;
  const H = new Int8Array(W * D);
  const kind = new Uint8Array(W * D);
  const region = new Uint8Array(W * D);
  const islet = { x: island.cx + island.rx * 0.5, z: island.cz + island.rz + 8 };

  for (let j = 0; j < D; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const x = gx0 + i + 0.5;
      const z = gz0 + j + 0.5;
      const n = fbm(x * 0.09, z * 0.09, 7);
      const e = Math.hypot((x - island.cx) / island.rx, (z - island.cz) / island.rz) + (n - 0.5) * 0.28;
      const edge = Math.min(i, j, W - 1 - i, D - 1 - j);
      let h = -1;
      let k = K.bed;
      let r = R.water;
      if (e < 1) {
        r = R.island;
        if (e > 0.93) {
          h = 1;
          k = K.sand;
        } else {
          h = 2 + (fbm(x * 0.17, z * 0.17, 3) > 0.64 ? 1 : 0);
          k = K.grass;
        }
        const hr = Math.hypot(x - HILL.x, z - HILL.z);
        const bump = 11 * Math.exp(-(hr * hr) / 36) * (0.8 + 0.4 * fbm(x * 0.35, z * 0.35, 11));
        if (bump > 0.6) {
          h = Math.max(h, Math.round(2 + bump));
          k = K.grass;
          r = R.hill;
        }
      } else {
        const nb = north + (n - 0.5) * 5;
        const sb = south + (n - 0.5) * 5;
        if (z < nb || z > sb) {
          r = R.shore;
          const inland = z < nb ? nb - z : z - sb;
          if (inland < 1.2) {
            h = 1;
            k = K.sand;
          } else {
            h = 2 + (fbm(x * 0.12, z * 0.12, 5) > 0.62 ? 1 : 0);
            k = K.grass;
          }
        } else {
          const toBank = Math.min(Math.abs(z - nb), Math.abs(z - sb));
          h = e < 1.12 || toBank < 2 ? 0 : -1;
        }
        const ir = Math.hypot(x - islet.x, (z - islet.z) * 1.5) + (n - 0.5) * 1.6;
        if (ir < 4.6) {
          r = R.islet;
          h = ir > 3.7 ? 1 : 2;
          k = ir > 3.7 ? K.sand : K.grass;
        }
      }
      // The grid's edge meets the flat far banks and the open river.
      if (edge < 3) h = h >= 2 ? 2 : h >= 0 ? -1 : h;
      const idx = j * W + i;
      H[idx] = h;
      kind[idx] = k;
      region[idx] = r;
    }
  }

  const at = (tx, tz) => {
    const i = tx - gx0;
    const j = tz - gz0;
    return i >= 0 && j >= 0 && i < W && j < D ? j * W + i : -1;
  };

  // Flatten the railway's bed.
  if (track) {
    const end = track.start - track.length / track.radius;
    for (let j = 0; j < D; j += 1) {
      for (let i = 0; i < W; i += 1) {
        const x = gx0 + i + 0.5 - HILL.x;
        const z = gz0 + j + 0.5 - HILL.z;
        const r = Math.hypot(x, z);
        if (Math.abs(r - track.radius) > 3) continue;
        const th = Math.atan2(z, x);
        let best = Infinity;
        for (const t of [th - 2 * Math.PI, th, th + 2 * Math.PI]) {
          if (t >= end && t <= track.start) best = Math.min(best, Math.abs(r - track.radius));
        }
        if (best === Infinity) {
          for (const t of [end, track.start]) {
            best = Math.min(best, Math.hypot(x - track.radius * Math.cos(t), z - track.radius * Math.sin(t)));
          }
        }
        if (best < 1.8) {
          const idx = j * W + i;
          H[idx] = GROUND;
          kind[idx] = K.grass;
          region[idx] = R.town;
        }
      }
    }
  }

  // Flatten the areas: roads around and between the lots, with a grass verge.
  for (const a of areas) {
    const { x0, z0, x1, z1 } = a.rect;
    for (let tz = z0 - 1; tz <= z1; tz += 1) {
      for (let tx = x0 - 1; tx <= x1; tx += 1) {
        const idx = at(tx, tz);
        if (idx < 0) continue;
        H[idx] = GROUND;
        region[idx] = R.town;
        const inside = tx >= x0 && tx < x1 && tz >= z0 && tz < z1;
        if (!inside) {
          kind[idx] = K.grass;
          continue;
        }
        const lx = tx - x0;
        const lz = tz - z0;
        const span = LOT + ROAD;
        if (lx % span < ROAD || lz % span < ROAD) {
          kind[idx] = K.road;
        } else {
          const lot = a.lots[Math.floor(lz / span) * a.cols + Math.floor(lx / span)];
          kind[idx] = lot && lot.used ? K.lot : K.park;
        }
      }
    }
  }

  // The hilltop, for the cross.
  let summit = null;
  for (let idx = 0; idx < H.length; idx += 1) {
    if (region[idx] === R.hill && (!summit || H[idx] > summit.h)) summit = { idx, h: H[idx] };
  }

  const grass = GRASS[season] || GRASS.summer;
  const colorOf = (idx, tx, y, tz) => {
    const h = H[idx];
    const top = y === h - 1;
    const v = hash2(tx, tz, 21);
    switch (kind[idx]) {
      case K.sand:
        return top ? SAND : 0xcdb983;
      case K.bed:
        return top ? BED : 0x998a62;
      case K.road:
        return top ? ASPHALT : DIRT;
      case K.lot:
        return top ? PAVING : DIRT;
      case K.park:
        return top ? grass[v < 0.5 ? 0 : 1] : DIRT;
      default:
        if (!top) return y >= h - 2 ? DIRT : ROCK;
        if (h >= 10 && v < 0.45) return v < 0.2 ? 0x8b8e93 : ROCK;
        return grass[v < 0.5 ? 0 : 1];
    }
  };

  const cells = [];
  const hAt = (i, j) => H[Math.min(D - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
  for (let j = 0; j < D; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const idx = j * W + i;
      const h = H[idx];
      const lo = Math.min(h - 1, hAt(i - 1, j), hAt(i + 1, j), hAt(i, j - 1), hAt(i, j + 1));
      const tx = gx0 + i;
      const tz = gz0 + j;
      for (let y = lo; y < h; y += 1) cells.push([tx, y, tz, colorOf(idx, tx, y, tz), 0]);
    }
  }
  const isSolid = (x, y, z) => y < hAt(x - gx0, z - gz0);
  const geometry = meshCells(cells, isSolid, { size: [1, LAYER, 1], origin: [0, 0, 0], jitter: 0.045, bottoms: false });

  const heightAt = (x, z) => hAt(Math.floor(x) - gx0, Math.floor(z) - gz0) * LAYER;
  const summitPos = summit && {
    x: gx0 + (summit.idx % W) + 0.5,
    z: gz0 + Math.floor(summit.idx / W) + 0.5,
    y: summit.h * LAYER,
  };

  return { geometry, H, kind, region, W, D, gx0, gz0, north, south, heightAt, summit: summitPos, grass };
}

function placeTrees(terrain, layout, season, material) {
  const { H, kind, region, W, D, gx0, gz0, summit } = terrain;
  const templates = treeTemplates(season).map((t) => ({ ...t, geometry: meshVoxels(t.voxels), spots: [] }));
  const rnd = mulberry32(4242);
  const pick = (pineBias) => {
    const weights = templates.map((t) => t.weight * (t.kind === 'pine' ? pineBias : 1));
    let r = rnd() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < templates.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return templates[i];
    }
    return templates[templates.length - 1];
  };
  const snap = () => Math.round((rnd() - 0.5) * 3) * VOX;
  const density = { [R.hill]: 0.62, [R.island]: 0.07, [R.shore]: 0.12, [R.islet]: 0.5 };
  const pineBias = { [R.hill]: 0.45, [R.island]: 0.8, [R.shore]: 1.6, [R.islet]: 1 };

  for (let j = 0; j < D; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const idx = j * W + i;
      const p = density[region[idx]];
      if (!p || kind[idx] !== K.grass || H[idx] < 2) continue;
      const x = gx0 + i + 0.5;
      const z = gz0 + j + 0.5;
      if (summit && Math.abs(x - summit.x) < 1.5 && Math.abs(z - summit.z) < 1.5) continue;
      if (rnd() > p) continue;
      pick(pineBias[region[idx]]).spots.push([x + snap(), H[idx] * LAYER, z + snap(), Math.floor(rnd() * 4), 0.85 + rnd() * 0.3]);
    }
  }
  // Little parks on empty lots.
  for (const a of layout.areas) {
    for (const lot of a.lots) {
      if (lot.used) continue;
      for (const [dx, dz] of [
        [-0.7, -0.6],
        [0.7, 0.5],
        [-0.5, 0.8],
      ]) {
        pick(0.6).spots.push([lot.center.x + dx, GROUND_Y, lot.center.z + dz, Math.floor(rnd() * 4), 0.8 + rnd() * 0.2]);
      }
    }
  }

  const meshes = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const t of templates) {
    if (!t.spots.length) continue;
    const mesh = new THREE.InstancedMesh(t.geometry, material, t.spots.length);
    t.spots.forEach(([x, y, z, rot, s], i) => {
      q.setFromAxisAngle(up, (rot * Math.PI) / 2);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }
  return meshes;
}

function buildTrack(track, material) {
  const group = new THREE.Group();
  const parts = [
    { geo: plainBox(0.52, 0.12, 1.35, 0x9a8f80), step: 0.5, y: GROUND_Y + 0.06, offsets: [0] },
    { geo: plainBox(0.14, 0.06, 1.0, 0x5b4636), step: 0.42, y: GROUND_Y + 0.15, offsets: [0] },
    { geo: plainBox(0.52, 0.07, 0.07, 0xb8bec6), step: 0.5, y: GROUND_Y + 0.215, offsets: [-0.34, 0.34] },
  ];
  const p = { x: 0, z: 0, yaw: 0 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (const part of parts) {
    const count = Math.floor(track.length / part.step) + 1;
    const mesh = new THREE.InstancedMesh(part.geo, material, count * part.offsets.length);
    let n = 0;
    for (let i = 0; i < count; i += 1) {
      trackPoint(track, Math.min(track.length, i * part.step), p);
      // Box length runs along local x, so turn it to the track's heading.
      q.setFromAxisAngle(up, p.yaw + Math.PI / 2);
      for (const off of part.offsets) {
        const ox = Math.cos(p.yaw) * off;
        const oz = -Math.sin(p.yaw) * off;
        m.compose(new THREE.Vector3(p.x + ox, part.y, p.z + oz), q, one);
        mesh.setMatrixAt(n, m);
        n += 1;
      }
    }
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  // Buffer stops at both ends.
  const stopGeo = plainBox(0.9, 0.35, 0.2, 0xd23b2f);
  for (const s of [0, track.length]) {
    trackPoint(track, s, p);
    const stop = new THREE.Mesh(stopGeo, material);
    stop.position.set(p.x, GROUND_Y + 0.3, p.z);
    stop.rotation.y = p.yaw;
    stop.castShadow = true;
    group.add(stop);
  }
  return group;
}

export function buildWorld(layout, season) {
  const material = makeVoxelMaterial();
  const highlight = makeVoxelMaterial({ highlight: 1 });
  const group = new THREE.Group();
  const terrain = makeTerrain(layout, season);

  const ground = new THREE.Mesh(terrain.geometry, material);
  ground.receiveShadow = true;
  ground.castShadow = true;
  group.add(ground);

  // Open water and the far banks, running off into the haze.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshLambertMaterial({ color: 0x3b8fd0, transparent: true, opacity: 0.84, depthWrite: false })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  water.renderOrder = 1;
  group.add(water);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x8a7c58 }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -LAYER;
  group.add(bed);
  const bankMat = new THREE.MeshLambertMaterial({ color: terrain.grass[1] });
  // They stop short of the wavy bank line, so they only ever sit under land tiles.
  for (const [zFrom, zTo] of [
    [-2000, terrain.north - 4],
    [terrain.south + 4, 2000],
  ]) {
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(4000, zTo - zFrom), bankMat);
    bank.rotation.x = -Math.PI / 2;
    bank.position.set(0, GROUND_Y - 0.02, (zFrom + zTo) / 2);
    bank.receiveShadow = true;
    group.add(bank);
  }

  const trees = placeTrees(terrain, layout, season, material);
  trees.forEach((t) => group.add(t));

  // Buildings, one mesh each so they can be picked and lifted.
  const buildings = new Map();
  for (const a of layout.areas) {
    for (const b of a.buildings) {
      const { voxels, height } = buildBuilding(b);
      const mesh = new THREE.Mesh(meshVoxels(voxels), material);
      mesh.position.set(b.center.x, GROUND_Y, b.center.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.buildingId = b.id;
      group.add(mesh);
      buildings.set(b.id, { ...b, mesh, height: height * VOX, lift: 0 });
    }
  }

  // Street lamps at the crossings, and their glow at night.
  const halos = [];
  const lampSpots = [];
  for (const a of layout.areas) {
    for (let r = 0; r <= a.rows; r += 1) {
      for (let c = 0; c <= a.cols; c += 1) {
        lampSpots.push([a.rect.x0 + c * (LOT + ROAD) + 0.85, a.rect.z0 + r * (LOT + ROAD) + 0.85]);
      }
    }
  }
  const lampMesh = new THREE.InstancedMesh(meshVoxels(lampVoxels()), material, lampSpots.length);
  const m = new THREE.Matrix4();
  lampSpots.forEach(([x, z], i) => {
    m.makeTranslation(x, GROUND_Y, z);
    lampMesh.setMatrixAt(i, m);
    halos.push(x, GROUND_Y + 5.5 * VOX, z);
  });
  lampMesh.castShadow = true;
  lampMesh.computeBoundingSphere();
  group.add(lampMesh);

  // Railway and stations.
  if (layout.track) {
    group.add(buildTrack(layout.track, material));
    const p = { x: 0, z: 0, yaw: 0 };
    layout.areas.forEach((a, i) => {
      trackPoint(layout.track, layout.track.stops[i], p);
      const station = new THREE.Mesh(meshVoxels(stationVoxels(a.color)), material);
      station.position.set(p.x, GROUND_Y, p.z);
      station.rotation.y = p.yaw;
      station.castShadow = true;
      station.receiveShadow = true;
      group.add(station);
      station.updateMatrixWorld();
      for (const lz of [-12, 12]) {
        const v = new THREE.Vector3(-5 * VOX, 8.5 * VOX, lz * VOX).applyMatrix4(station.matrixWorld);
        halos.push(v.x, v.y, v.z);
      }
    });
  }

  if (terrain.summit) {
    const cross = new THREE.Mesh(meshVoxels(crossVoxels()), material);
    cross.position.set(terrain.summit.x, terrain.summit.y, terrain.summit.z);
    cross.castShadow = true;
    group.add(cross);
    halos.push(terrain.summit.x, terrain.summit.y + 2.4, terrain.summit.z);
  }

  return {
    group,
    material,
    highlight,
    buildings,
    halos: new Float32Array(halos),
    heightAt: terrain.heightAt,
    water,
    bankMat,
    bankBase: terrain.grass[1],
  };
}
