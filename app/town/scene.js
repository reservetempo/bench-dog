// The 3D view: renderer, camera (drag to pan, scroll or pinch to zoom, turn in 90° steps),
// picking and the frame loop, for the town outside and for the inside of each folder's
// building. Going in or out flies toward the door as a dark veil comes down, swaps scenes
// and lifts the veil. Town.jsx drives it through the returned API and hears back through
// `handlers.current` (onPick, onPlace, onInteract, onFrame).

import * as THREE from 'three';
import { buildWorld } from './world';
import { buildInterior } from './interiors';
import { createSky } from './sky';
import { shapeUniforms } from './shapes';

const FOV = 32;
const TAN = Math.tan((FOV * Math.PI) / 360);
const OUT_MIN = 9;
const OUT_MAX = 150;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth01 = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

export function createTown({ host, canvas, layout, conditions, handlers, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const shadowSize = coarse ? 1024 : 2048;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 3000);

  // ---- Places: the town outside, and the inside of each folder's building ----
  const scene = new THREE.Scene();
  const world = buildWorld(layout, conditions.season);
  scene.add(world.group);
  const sky = createSky({ scene, reducedMotion, shadowSize, center: layout.center });
  sky.setConditions(conditions);
  const outside = {
    id: null,
    scene,
    objects: world.buildings,
    pickables: [...world.buildings.values()].map((o) => o.mesh),
    floorY: world.floorY,
    min: OUT_MIN,
    max: OUT_MAX,
    yaw: 0,
    bounds: layout.bounds,
    // Looking down steeply from far away, a little more toward the horizon close up.
    pitch: (dist) => 0.66 + 0.36 * Math.sqrt(clamp((dist - OUT_MIN) / (OUT_MAX - OUT_MIN), 0, 1)),
    update(dt, view) {
      sky.update(dt, view);
    },
  };
  const interiors = new Map();
  const buildingOf = (id) => layout.buildings.find((x) => x.id === id);
  // A building's inside, built the first time it's visited (the town for anything else).
  function placeFor(id) {
    if (id == null) return outside;
    let p = interiors.get(id);
    if (!p) {
      const b = buildingOf(id);
      if (!b?.inside) return outside;
      p = buildInterior(b, { shadowSize });
      interiors.set(id, p);
    }
    return p;
  }
  let place = outside;

  // The yellow ring round the selected thing's footprint.
  const ring = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
  const ringGeo = new THREE.BoxGeometry(1, 0.05, 1);
  const bars = [0, 1, 2, 3].map(() => ring.add(new THREE.Mesh(ringGeo, ringMat)).children.at(-1));
  let ringFoot = null;
  function shapeRing(foot) {
    if (ringFoot === foot) return;
    ringFoot = foot;
    const { w, d } = foot;
    const t = 0.1;
    bars[0].position.set(0, 0, -d / 2 + t / 2);
    bars[1].position.set(0, 0, d / 2 - t / 2);
    bars[0].scale.set(w, 1, t);
    bars[1].scale.set(w, 1, t);
    bars[2].position.set(-w / 2 + t / 2, 0, 0);
    bars[3].position.set(w / 2 - t / 2, 0, 0);
    bars[2].scale.set(t, 1, d);
    bars[3].scale.set(t, 1, d);
  }
  ring.visible = false;
  scene.add(ring);

  // The veil: a dark sheet drawn over the whole view while going in or out.
  const veilScene = new THREE.Scene();
  const veilMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(0x0b0f15) } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; void main() { gl_FragColor = vec4(uC, uA); }',
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const veilQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
  veilQuad.frustumCulled = false;
  veilScene.add(veilQuad);
  let veil = 0;

  // ---- Camera ----
  const rig = { target: new THREE.Vector3(0, outside.floorY, 0), dist: 60, yaw: 0, yawGoal: 0, fly: null };
  const view = { target: rig.target, dist: rig.dist };
  const size = { w: 1, h: 1 };

  function applyCamera() {
    const b = place.bounds;
    rig.target.x = clamp(rig.target.x, b.minX, b.maxX);
    rig.target.z = clamp(rig.target.z, b.minZ, b.maxZ);
    rig.dist = clamp(rig.dist, place.min, place.max);
    const p = place.pitch(rig.dist);
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
      const p = place.pitch(dist);
      dist = Math.max(sw / (2 * TAN * aspect), (sd * Math.sin(p)) / (2 * TAN)) * 1.06;
    }
    return clamp(dist, place.min, place.max);
  }

  const home = () => {
    const f = layout.town;
    return { x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2 + 1, dist: fitDist(f.maxX - f.minX, f.maxZ - f.minZ) };
  };
  // Where the camera settles in a place (call it once that place is the current one).
  function fitFor(p) {
    if (p === outside) return home();
    const v = p.view;
    return { x: v.x, z: v.z, dist: fitDist(v.w, v.d, 1.2, 4.5) };
  }
  // Close up on a building's door, from outside.
  function doorOf(id) {
    const b = buildingOf(id);
    return b ? { x: b.center.x, z: b.center.z + 0.6, dist: OUT_MIN } : home();
  }

  function jump({ x, z, dist }) {
    rig.fly = null;
    rig.target.set(x, place.floorY, z);
    rig.dist = dist;
    applyCamera();
  }

  // Fly the camera somewhere. `veilTo` brings the veil to that value over the part of the
  // flight from `a` to `b` (0 to 1); `done` runs when it lands. A flight with a veil is a
  // trip in or out, which input can't interrupt.
  function flyTo(goal, { dur = 1.1, veilTo = null, a = 0, b = 1, done = null } = {}) {
    if (reducedMotion && veilTo == null) {
      jump(goal);
      return;
    }
    rig.fly = {
      fx: rig.target.x,
      fz: rig.target.z,
      fd: rig.dist,
      tx: goal.x,
      tz: goal.z,
      td: clamp(goal.dist, place.min, place.max),
      t: 0,
      dur,
      veil: veilTo == null ? null : { from: veil, to: veilTo, a, b },
      done,
    };
  }
  const tripping = () => Boolean(rig.fly?.veil);
  function stopFly() {
    if (!tripping()) rig.fly = null;
  }

  function updateCamera(dt) {
    if (rig.fly) {
      const f = rig.fly;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeInOut(f.t);
      rig.target.x = f.fx + (f.tx - f.fx) * e;
      rig.target.z = f.fz + (f.tz - f.fz) * e;
      rig.dist = Math.exp(Math.log(f.fd) + (Math.log(f.td) - Math.log(f.fd)) * e);
      if (f.veil) veil = f.veil.from + (f.veil.to - f.veil.from) * smooth01((f.t - f.veil.a) / (f.veil.b - f.veil.a));
      if (f.t >= 1) {
        rig.fly = null;
        f.done?.();
      }
    }
    if (rig.yaw !== rig.yawGoal) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
      rig.yaw += (rig.yawGoal - rig.yaw) * k;
      if (Math.abs(rig.yawGoal - rig.yaw) < 0.0005) rig.yaw = rig.yawGoal;
    }
    applyCamera();
  }

  // ---- Going in and out ----
  let goal = null; // where the view is headed: a folder building's id, or null for the town
  let hovered = null;
  let hoverAt = null;
  let selected = null;

  function swap(id) {
    place.yaw = rig.yawGoal;
    place = placeFor(id);
    rig.yaw = place.yaw;
    rig.yawGoal = place.yaw;
    rig.target.y = place.floorY;
    groundPlane.constant = -place.floorY;
    place.scene.add(ring);
    hovered = null;
    hoverAt = null;
    canvas.style.cursor = '';
    handlers.current.onPlace?.(place.id);
  }

  // Go into a folder's building (its id), or back out to the town (null).
  function enter(id, { instant = false } = {}) {
    const to = id != null && buildingOf(id)?.inside ? id : null;
    if (to === goal) return;
    goal = to;
    if (instant || reducedMotion) {
      if (place.id !== to) swap(to);
      veil = 0;
      jump(fitFor(place));
      return;
    }
    if (place.id === to) {
      // Turned back before getting there: lift the veil where we are.
      flyTo(fitFor(place), { dur: 0.7, veilTo: 0, b: 0.6 });
      return;
    }
    const door = place === outside ? doorOf(to) : { x: rig.target.x, z: rig.target.z, dist: rig.dist * 0.6 };
    flyTo(door, { dur: 0.8, veilTo: 1, a: 0.35, done: arrive });
  }

  function arrive() {
    const from = place.id;
    swap(goal);
    const fit = fitFor(place);
    jump(place === outside ? doorOf(from) : { ...fit, dist: fit.dist * 0.62 });
    veil = 1;
    flyTo(fit, { dur: 1.0, veilTo: 0, b: 0.55 });
  }

  // ---- Picking ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -place.floorY);
  const tmpHit = new THREE.Vector3();

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
    const hit = raycaster.intersectObjects(place.pickables, false)[0];
    if (hit) return { type: 'object', id: hit.object.userData.id };
    if (place === outside) {
      // Outside, anywhere on a building's lot counts as the building.
      const p = raycaster.ray.intersectPlane(groundPlane, tmpHit);
      if (p) {
        for (const b of layout.buildings) {
          const { x0, z0, x1, z1 } = b.rect;
          if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return { type: 'object', id: b.id };
        }
      }
    }
    return { type: 'none' };
  }

  // ---- Input ----
  const pointers = new Map();
  let drag = null;
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
      if (drag.moved && drag.grab && !tripping()) {
        const p = groundAt(e.clientX, e.clientY, tmpA);
        if (p) {
          rig.target.add(drag.grab).sub(p);
          applyCamera();
        }
      }
    } else if (pointers.size === 2 && !tripping()) {
      stopFly();
      interact();
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (drag.pinch > 0) rig.dist = clamp((drag.dist * drag.pinch) / Math.max(d, 1), place.min, place.max);
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
      if (drag && !drag.moved && e.type === 'pointerup' && !tripping()) handlers.current.onPick?.(pick(e.clientX, e.clientY));
      drag = null;
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { sx: p.x, sy: p.y, moved: true, grab: groundAt(p.x, p.y) };
    }
  }

  function zoomAround(factor, clientX, clientY) {
    if (tripping()) return;
    stopFly();
    const before = clientX != null ? groundAt(clientX, clientY) : null;
    rig.dist = clamp(rig.dist * factor, place.min, place.max);
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
    if (tripping()) return;
    stopFly();
    rig.yawGoal += (dir * Math.PI) / 2;
  }

  function panBy(right, forward) {
    if (tripping()) return;
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
  // On a tall screen (a phone held upright), turn the town so a long one runs up the screen.
  if (size.w / size.h < 0.8 && layout.town.maxX - layout.town.minX > layout.town.maxZ - layout.town.minZ) {
    outside.yaw = -Math.PI / 2;
    rig.yaw = outside.yaw;
    rig.yawGoal = outside.yaw;
  }
  jump(home());

  // ---- Frame loop ----
  // Lift (or slide out) the thing under the pointer and the selected one; ring the selected.
  function updateObjects(dt) {
    if (hoverAt && !drag) {
      const hit = tripping() ? { type: 'none' } : pick(hoverAt.x, hoverAt.y);
      hoverAt = null;
      hovered = hit.type === 'object' ? hit.id : null;
      canvas.style.cursor = hit.type === 'none' ? '' : 'pointer';
    }
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
    for (const o of place.objects.values()) {
      const g = o.id === selected ? o.reach.selected : o.id === hovered ? o.reach.hover : 0;
      o.lift += (g - o.lift) * k;
      if (Math.abs(g - o.lift) < 0.0005) o.lift = g;
      o.mesh.position.copy(o.base).addScaledVector(o.dir, o.lift);
      o.mesh.material = g > 0 ? o.highlight : o.material;
    }
    const s = selected != null ? place.objects.get(selected) : null;
    ring.visible = Boolean(s);
    if (s) {
      shapeRing(s.foot);
      ring.position.set(s.base.x + s.dir.x * s.lift, s.base.y + 0.03, s.base.z + s.dir.z * s.lift);
      ring.rotation.y = s.facing || 0;
    }
  }

  function step(dt) {
    updateCamera(dt);
    view.dist = rig.dist;
    updateObjects(dt);
    if (!reducedMotion) shapeUniforms.uTime.value += dt;
    place.update(dt, place === outside ? view : rig.yaw);
  }

  function draw() {
    renderer.render(place.scene, camera);
    if (veil > 0.002) {
      veilMat.uniforms.uA.value = veil;
      renderer.autoClear = false;
      renderer.render(veilScene, camera);
      renderer.autoClear = true;
    }
  }

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    draw();
    handlers.current.onFrame?.();
  }
  raf = requestAnimationFrame(frame);

  // ---- API ----
  const projected = { x: 0, y: 0, visible: false };
  const pv = new THREE.Vector3();
  const anchored = { x: 0, y: 0, z: 0 };

  return {
    enter,
    select(id) {
      selected = id ?? null;
    },
    // The building whose inside is on screen (null: the town), and how far down the veil is.
    where: () => place.id,
    veil: () => veil,
    home() {
      if (place === outside && !tripping()) flyTo(home());
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
    // The top middle of a building or fixture in the current place, as it moves (reused
    // object), or null if it isn't in this place.
    anchor(id) {
      const o = place.objects.get(id);
      if (!o) return null;
      anchored.x = o.base.x + o.dir.x * o.lift;
      anchored.y = o.base.y + o.dir.y * o.lift + o.height;
      anchored.z = o.base.z + o.dir.z * o.lift;
      return anchored;
    },
    // For checking in a hidden tab, where frames barely run: step time forward and draw.
    advance(seconds = 0) {
      let left = seconds;
      do {
        step(Math.min(0.05, left));
        left -= 0.05;
      } while (left > 0);
      draw();
      handlers.current.onFrame?.();
      return {
        ...renderer.info.render,
        where: place.id,
        veil: Math.round(veil * 100) / 100,
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
      ring.removeFromParent();
      ringGeo.dispose();
      ringMat.dispose();
      veilQuad.geometry.dispose();
      veilMat.dispose();
      for (const p of interiors.values()) p.dispose();
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
