// The 3D town: renderer, camera (drag to pan, scroll or pinch to zoom, turn in 90° steps),
// picking, the shuttle train, and the frame loop. Town.jsx drives it through the returned API
// and gets clicks, area leaving and per-frame updates back through `handlers.current`.

import * as THREE from 'three';
import { buildWorld, trackPoint } from './world';
import { createSky } from './sky';
import { meshVoxels } from './voxels';
import { trainCarVoxels } from './buildings';
import { GROUND_Y, LOT } from './layout';

const MIN_DIST = 9;
const MAX_DIST = 150;
const FOV = 32;
const TAN = Math.tan((FOV * Math.PI) / 360);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

// Looking down steeply from far away, a little more toward the horizon close up.
function pitchFor(dist) {
  const t = clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
  return 0.66 + 0.36 * Math.sqrt(t);
}

export function createTown({ host, canvas, layout, conditions, handlers, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 3000);
  const world = buildWorld(layout, conditions.season);
  scene.add(world.group);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const sky = createSky({
    scene,
    world,
    reducedMotion,
    shadowSize: coarse ? 1024 : 2048,
    center: { x: layout.island.cx, z: layout.island.cz },
  });
  sky.setConditions(conditions);

  // A ring around the selected building's lot.
  const ring = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
  const half = LOT / 2 - 0.08;
  for (const [x, z, w, d] of [
    [0, -half, LOT - 0.04, 0.1],
    [0, half, LOT - 0.04, 0.1],
    [-half, 0, 0.1, LOT - 0.04],
    [half, 0, 0.1, LOT - 0.04],
  ]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), ringMat);
    bar.position.set(x, 0.03, z);
    ring.add(bar);
  }
  ring.visible = false;
  scene.add(ring);

  // ---- Train: three cars shuttling between the stations ----
  const train = layout.track ? makeTrain() : null;

  function makeTrain() {
    const cab = meshVoxels(trainCarVoxels(true));
    const mid = meshVoxels(trainCarVoxels(false));
    const SPACING = 2.65;
    const cars = [
      { geo: cab, off: -SPACING, flip: true },
      { geo: mid, off: 0, flip: false },
      { geo: cab, off: SPACING, flip: false },
    ].map((c) => {
      const mesh = new THREE.Mesh(c.geo, world.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { ...c, mesh };
    });
    const { stops, length } = layout.track;
    const order = [...stops.keys()];
    order.push(...order.slice(1, -1).reverse());
    const DWELL = 6;
    const SPEED = 3.2;
    let total = 0;
    const legs = order.map((from, i) => {
      const a = stops[from];
      const b = stops[order[(i + 1) % order.length]];
      const travel = Math.abs(b - a) / SPEED + 1.5;
      const leg = { a, b, start: total, travel };
      total += DWELL + travel;
      return leg;
    });
    const p = { x: 0, z: 0, yaw: 0 };
    return {
      update(t) {
        let s = stops[0];
        if (!reducedMotion) {
          const tt = t % total;
          const leg = legs.findLast((l) => l.start <= tt) || legs[0];
          const local = tt - leg.start;
          s = local < DWELL ? leg.a : leg.a + (leg.b - leg.a) * easeSine(Math.min(1, (local - DWELL) / leg.travel));
        }
        for (const car of cars) {
          trackPoint(layout.track, clamp(s + car.off, 0, length), p);
          car.mesh.position.set(p.x, GROUND_Y + 0.25, p.z);
          car.mesh.rotation.y = p.yaw + (car.flip ? Math.PI : 0);
        }
      },
    };
  }

  // ---- Camera ----
  const rig = { target: new THREE.Vector3(0, GROUND_Y, 0), dist: 60, yaw: 0, yawGoal: 0, fly: null };
  const view = { target: rig.target, dist: rig.dist };
  const b = layout.bounds;
  const size = { w: 1, h: 1 };

  function applyCamera() {
    rig.target.x = clamp(rig.target.x, b.minX - 6, b.maxX + 6);
    rig.target.z = clamp(rig.target.z, b.minZ - 6, b.maxZ + 6);
    rig.dist = clamp(rig.dist, MIN_DIST, MAX_DIST);
    const p = pitchFor(rig.dist);
    camera.position.set(
      rig.target.x + Math.sin(rig.yaw) * Math.cos(p) * rig.dist,
      rig.target.y + Math.sin(p) * rig.dist,
      rig.target.z + Math.cos(rig.yaw) * Math.cos(p) * rig.dist
    );
    camera.lookAt(rig.target);
  }

  // How far back the camera must be to show a w-by-d rectangle of ground (world x by z),
  // with padX and padY extra across and up the screen.
  function fitDist(w, d, padX = 0, padY = 0) {
    const odd = Math.round(rig.yawGoal / (Math.PI / 2)) % 2 !== 0;
    const [sw, sd] = odd ? [d + padX, w + padY] : [w + padX, d + padY];
    const aspect = size.w / size.h;
    let dist = 40;
    for (let i = 0; i < 3; i += 1) {
      const p = pitchFor(dist);
      dist = Math.max(sw / (2 * TAN * aspect), (sd * Math.sin(p)) / (2 * TAN)) * 1.06;
    }
    return clamp(dist, MIN_DIST, MAX_DIST);
  }

  const home = () => ({
    x: (b.minX + b.maxX) / 2,
    z: (b.minZ + b.maxZ) / 2 + 1,
    dist: fitDist(b.maxX - b.minX, b.maxZ - b.minZ),
  });

  function areaFit(index) {
    const a = layout.areas[index];
    const w = a.rect.x1 - a.rect.x0;
    const d = a.rect.z1 - a.rect.z0;
    // A little room at the sides, more up the screen for tall buildings and their tags.
    const portrait = size.w / size.h < 0.8;
    const dist = Math.max(portrait ? 14 : 18, fitDist(w, d, portrait ? 1 : 5, 7));
    return { x: a.center.x, z: a.center.z, dist, radius: Math.hypot(w + 5, d + 7) / 2 };
  }

  function flyTo({ x, z, dist }, instant) {
    if (instant || reducedMotion) {
      rig.fly = null;
      rig.target.set(x, GROUND_Y, z);
      rig.dist = dist;
      applyCamera();
      return;
    }
    rig.fly = { fx: rig.target.x, fz: rig.target.z, fd: rig.dist, tx: x, tz: z, td: clamp(dist, MIN_DIST, MAX_DIST), t: 0 };
  }

  function stopFly() {
    rig.fly = null;
  }

  function updateCamera(dt) {
    if (rig.fly) {
      const f = rig.fly;
      f.t = Math.min(1, f.t + dt / 1.1);
      const e = easeInOut(f.t);
      rig.target.x = f.fx + (f.tx - f.fx) * e;
      rig.target.z = f.fz + (f.tz - f.fz) * e;
      rig.dist = Math.exp(Math.log(f.fd) + (Math.log(f.td) - Math.log(f.fd)) * e);
      if (f.t >= 1) rig.fly = null;
    }
    if (rig.yaw !== rig.yawGoal) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
      rig.yaw += (rig.yawGoal - rig.yaw) * k;
      if (Math.abs(rig.yawGoal - rig.yaw) < 0.0005) rig.yaw = rig.yawGoal;
    }
    applyCamera();
  }

  // ---- Picking ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
  const buildingMeshes = [...world.buildings.values()].map((x) => x.mesh);

  function rayAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  }

  function groundAt(clientX, clientY, out = new THREE.Vector3()) {
    return rayAt(clientX, clientY).ray.intersectPlane(groundPlane, out);
  }

  function pick(clientX, clientY) {
    rayAt(clientX, clientY);
    const hit = raycaster.intersectObjects(buildingMeshes, false)[0];
    if (hit) return { type: 'building', id: hit.object.userData.buildingId };
    const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (p) {
      for (const a of layout.areas) {
        const { x0, z0, x1, z1 } = a.rect;
        if (p.x >= x0 - 2 && p.x <= x1 + 2 && p.z >= z0 - 2 && p.z <= z1 + 2) return { type: 'area', id: a.index };
      }
    }
    return { type: 'none' };
  }

  // ---- State from Town.jsx ----
  let activeArea = null;
  let selected = null;
  let hovered = null;

  function focusArea(index, { instant = false } = {}) {
    const next = index ?? null;
    if (next === activeArea) return;
    activeArea = next;
    flyTo(next == null ? home() : areaFit(next), instant);
  }

  function select(id) {
    selected = id ?? null;
    const sel = selected && world.buildings.get(selected);
    ring.visible = Boolean(sel);
    if (sel) ring.position.set(sel.center.x, GROUND_Y, sel.center.z);
  }

  // ---- Input ----
  const pointers = new Map();
  let drag = null;
  let hoverAt = null;
  const tmpA = new THREE.Vector3();

  const interact = () => handlers.current.onInteract?.();

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the drag still follows moves over the canvas.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { sx: e.clientX, sy: e.clientY, moved: false, grab: groundAt(e.clientX, e.clientY) };
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      drag = {
        moved: true,
        pinch: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        dist: rig.dist,
        grab: groundAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2),
      };
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') hoverAt = { x: e.clientX, y: e.clientY };
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    if (pointers.size === 1) {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        stopFly();
        interact();
      }
      if (drag.moved && drag.grab) {
        const p = groundAt(e.clientX, e.clientY, tmpA);
        if (p) {
          rig.target.add(drag.grab).sub(p);
          applyCamera();
        }
      }
    } else if (pointers.size === 2) {
      stopFly();
      interact();
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (drag.pinch > 0) rig.dist = clamp((drag.dist * drag.pinch) / Math.max(d, 1), MIN_DIST, MAX_DIST);
      applyCamera();
      const p = groundAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, tmpA);
      if (p && drag.grab) {
        rig.target.add(drag.grab).sub(p);
        applyCamera();
      }
    }
  }

  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (drag && !drag.moved && e.type === 'pointerup') handlers.current.onPick?.(pick(e.clientX, e.clientY));
      drag = null;
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { sx: p.x, sy: p.y, moved: true, grab: groundAt(p.x, p.y) };
    }
  }

  function zoomAround(factor, clientX, clientY) {
    stopFly();
    const before = clientX != null ? groundAt(clientX, clientY) : null;
    rig.dist = clamp(rig.dist * factor, MIN_DIST, MAX_DIST);
    applyCamera();
    if (before) {
      const after = groundAt(clientX, clientY, tmpA);
      if (after) {
        rig.target.add(before).sub(after);
        applyCamera();
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    interact();
    const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 0.5 : 0.0012;
    zoomAround(Math.exp(clamp(e.deltaY, -300, 300) * unit), e.clientX, e.clientY);
  }

  function rotate(dir) {
    stopFly();
    rig.yawGoal += (dir * Math.PI) / 2;
  }

  function panBy(right, forward) {
    stopFly();
    const step = rig.dist * 0.1;
    const s = Math.sin(rig.yawGoal);
    const c = Math.cos(rig.yawGoal);
    rig.target.x += (c * right - s * forward) * step;
    rig.target.z += (-s * right - c * forward) * step;
    applyCamera();
  }

  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    const k = e.key.toLowerCase();
    const moves = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, 1], w: [0, 1], arrowdown: [0, -1], s: [0, -1] };
    if (moves[k]) {
      e.preventDefault();
      panBy(...moves[k]);
    } else if (k === 'q') rotate(-1);
    else if (k === 'e') rotate(1);
    else if (k === '+' || k === '=') zoomAround(0.8);
    else if (k === '-' || k === '_') zoomAround(1.25);
    else return;
    interact();
  }

  function onLeaveCanvas() {
    hoverAt = null;
    hovered = null;
    canvas.style.cursor = '';
  }

  const listeners = [
    [canvas, 'pointerdown', onPointerDown],
    [canvas, 'pointermove', onPointerMove],
    [canvas, 'pointerup', onPointerUp],
    [canvas, 'pointercancel', onPointerUp],
    [canvas, 'pointerleave', onLeaveCanvas],
    [canvas, 'wheel', onWheel, { passive: false }],
    [window, 'keydown', onKey],
  ];
  for (const [el, type, fn, opts] of listeners) el.addEventListener(type, fn, opts);

  // ---- Sizing ----
  function resize() {
    size.w = Math.max(1, host.clientWidth);
    size.h = Math.max(1, host.clientHeight);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();
  // On a tall screen (a phone held upright), turn the view so the long island runs up the screen.
  if (size.w / size.h < 0.8) {
    rig.yaw = -Math.PI / 2;
    rig.yawGoal = rig.yaw;
  }
  const h0 = home();
  rig.target.set(h0.x, GROUND_Y, h0.z);
  rig.dist = h0.dist;
  applyCamera();

  // ---- Frame loop ----
  function updateBuildings(dt) {
    if (hoverAt && !drag) {
      const hit = pick(hoverAt.x, hoverAt.y);
      hoverAt = null;
      hovered = hit.type === 'building' ? hit.id : null;
      canvas.style.cursor = hit.type === 'none' ? '' : 'pointer';
    }
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
    for (const bd of world.buildings.values()) {
      const goal = bd.id === selected ? 0.3 : bd.id === hovered ? 0.1 : 0;
      bd.lift += (goal - bd.lift) * k;
      bd.mesh.position.y = GROUND_Y + bd.lift;
      bd.mesh.material = goal > 0 ? world.highlight : world.material;
    }
  }

  function checkLeave() {
    if (activeArea == null || rig.fly || drag?.moved === false) return;
    const fit = areaFit(activeArea);
    const away = Math.hypot(rig.target.x - fit.x, rig.target.z - fit.z) > fit.radius + 4;
    if (rig.dist > fit.dist * 2.3 || away) {
      activeArea = null;
      handlers.current.onLeave?.();
    }
  }

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    updateCamera(dt);
    view.dist = rig.dist;
    updateBuildings(dt);
    train?.update(now / 1000);
    sky.update(dt, view);
    renderer.render(scene, camera);
    checkLeave();
    handlers.current.onFrame?.();
  }
  raf = requestAnimationFrame(frame);

  // ---- API ----
  const projected = { x: 0, y: 0, visible: false };
  const pv = new THREE.Vector3();

  return {
    focusArea,
    select,
    home() {
      activeArea = null;
      flyTo(home());
    },
    rotate,
    zoomBy: (f) => zoomAround(f),
    setConditions: (c) => sky.setConditions(c),
    // Screen position of a point in the world (reused object; read it right away).
    project(x, y, z) {
      pv.set(x, y, z).project(camera);
      projected.x = ((pv.x + 1) / 2) * size.w;
      projected.y = ((1 - pv.y) / 2) * size.h;
      projected.visible = pv.z > -1 && pv.z < 1 && projected.x > -200 && projected.x < size.w + 200;
      return projected;
    },
    buildingTop(id) {
      const bd = world.buildings.get(id);
      return bd ? GROUND_Y + bd.lift + bd.height : GROUND_Y;
    },
    // For checking in a hidden tab, where frames barely run: step time forward and draw.
    advance(seconds = 0) {
      let left = seconds;
      do {
        const dt = Math.min(0.05, left);
        updateCamera(dt);
        view.dist = rig.dist;
        updateBuildings(dt);
        sky.update(dt, view);
        left -= dt;
      } while (left > 0);
      train?.update(performance.now() / 1000);
      renderer.render(scene, camera);
      checkLeave();
      handlers.current.onFrame?.();
      return {
        ...renderer.info.render,
        active: activeArea,
        flying: Boolean(rig.fly),
        dist: Math.round(rig.dist * 10) / 10,
        target: rig.target.toArray().map((v) => Math.round(v * 10) / 10),
      };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const [el, type, fn, opts] of listeners) el.removeEventListener(type, fn, opts);
      canvas.style.cursor = '';
      sky.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      world.material.dispose();
      world.highlight.dispose();
      renderer.dispose();
    },
  };
}
