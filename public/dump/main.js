// main.js: the /dump page. One WebGLRenderer on a fixed canvas behind the page draws
// every on-screen card (and the overlay) into its element's rect with scissor viewports.
// Styles only build figures and set up their scene; layout, cameras, turntable, drag
// and the Game view board live here. See styles/index.js for the style API.

import * as THREE from 'three';
import { loadStyles } from './styles/index.js';
import { ROLES, REDUCED_MOTION } from './kit.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#gl');
const grid = $('#grid');
const statusEl = $('#status');
const overlay = $('#overlay');
const ovView = $('#ov-view');
const ovClose = $('#ov-close');
const switchBtns = [...document.querySelectorAll('.switch button')];

const VIEW_KEY = 'dump.view';
const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const GAME_PITCH = THREE.MathUtils.degToRad(55);
const CLOSE_PITCH = THREE.MathUtils.degToRad(6);
const SPIN_SPEED = 0.35; // turntable, radians per second

let mode = 'close';
try { const v = localStorage.getItem(VIEW_KEY); if (v === 'close' || v === 'game') mode = v; } catch { /* storage blocked */ }

statusEl.textContent = 'Loading styles…';

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.info.autoReset = false;
} catch (err) {
  console.warn('[dump] WebGL unavailable', err);
}

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
const slots = [];
let ovSlot = null;
const ovLabels = makeLabels(ovView);
const ovState = { key: '' };

// ---------------------------------------------------------------- board tiles

// One draw call per tile: vertex colours darken the sides, the material sets the top colour.
const tileGeo = (() => {
  const g = new THREE.BoxGeometry(1, 0.14, 1).translate(0, -0.07, 0);
  const n = g.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) c.fill(n.getY(i) > 0.5 ? 1 : 0.45, i * 3, i * 3 + 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
})();

function makeBoard(color) {
  const base = new THREE.Color(color ?? 0x3a3732);
  const topA = new THREE.MeshLambertMaterial({ color: base, vertexColors: true });
  const topB = new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(0.8), vertexColors: true });
  const board = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const tile = new THREE.Mesh(tileGeo, i === 0 || i === 3 ? topA : topB);
    tile.rotation.y = Math.PI / 4;
    board.add(tile);
  }
  board.visible = false;
  return board;
}

// ---------------------------------------------------------------- slots

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

// Radius around the figure's y axis and height, from the bounding boxes of its parts.
function measure(fig) {
  let r = 0, h = 0;
  fig.updateMatrixWorld(true);
  const walk = (o) => {
    if (o.userData.noFit || o.isPoints || o.isSprite || o.isLight) return;
    if ((o.isMesh || o.isLine) && o.geometry) {
      if (o.isInstancedMesh) { if (!o.boundingBox) o.computeBoundingBox(); _box.copy(o.boundingBox); }
      else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _box.copy(o.geometry.boundingBox); }
      for (let i = 0; i < 8; i++) {
        _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z)
          .applyMatrix4(o.matrixWorld);
        r = Math.max(r, Math.hypot(_v.x, _v.z));
        h = Math.max(h, _v.y);
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(fig);
  return { r, h };
}

function makeSlot(style, index) {
  const scene = new THREE.Scene();
  const slot = {
    style, index, scene, spots: [], figs: [], ticks: [], fitR: 0.3, fitH: 1,
    drag: 0, board: null, view: null, labels: null, state: { key: '' }, failed: false,
  };
  try { style.setupScene(scene); } catch (err) { console.error(`[dump] ${style.id} setupScene failed`, err); }
  let r = 0.2, h = 0.5;
  ROLES.forEach((role) => {
    const spot = new THREE.Group();
    scene.add(spot);
    let fig = null;
    try { fig = style.build(role) || null; } catch (err) { console.error(`[dump] ${style.id} build(${role}) failed`, err); }
    if (fig) {
      spot.add(fig);
      const m = measure(fig);
      r = Math.max(r, m.r); h = Math.max(h, m.h);
      fig.traverse((o) => { if (typeof o.userData.tick === 'function') slot.ticks.push(o.userData.tick); });
    }
    slot.spots.push(spot);
    slot.figs.push(fig);
  });
  slot.fitR = Math.min(r, 0.9);
  slot.fitH = Math.min(h, 2.2);
  slot.board = makeBoard(style.tileColor);
  scene.add(slot.board);
  animate(slot, 0, 0); // rest pose (and the only pose under reduced motion)
  return slot;
}

function animate(slot, t, dt) {
  const { style } = slot;
  if (slot.failed) return;
  try {
    if (style.update) for (let i = 0; i < 4; i++) if (slot.figs[i]) style.update(slot.figs[i], ROLES[i], t, dt);
    for (let i = 0; i < slot.ticks.length; i++) slot.ticks[i](t, dt);
  } catch (err) {
    slot.failed = true;
    console.error(`[dump] ${style.id} update failed`, err);
  }
}

// ---------------------------------------------------------------- layout + camera

// Places the four spots and the camera for a w × h view. Close-up: a row of four
// (two rows of two on tall views), turning. Game view: a 2×2 diamond of tiles.
function layout(slot, w, h, viewMode, t) {
  const aspect = w / h;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const r = slot.fitR, H = slot.fitH;
  const { spots, board } = slot;

  if (viewMode === 'close') {
    const cols = aspect < 1.15 ? 2 : 4;
    const rows = 4 / cols;
    const below = 0.26, above = 0.06, gap = rows > 1 ? 0.14 : 0;
    const rowH = H + below + above + gap;
    const needW = cols * Math.max(0.55, 2 * r + 0.08) * 1.03;
    const needH = (rows * rowH - gap) * 1.04;
    const d = Math.max(needW / 2 / (TAN * aspect), needH / 2 / TAN) + r * 0.3;
    const s = (2 * (d - r * 0.3) * TAN * aspect) / cols;
    const spin = REDUCED_MOTION ? 0 : t * SPIN_SPEED;
    for (let i = 0; i < 4; i++) {
      const col = i % cols, row = (i / cols) | 0;
      spots[i].position.set((col - (cols - 1) / 2) * s, (rows - 1 - row) * rowH, 0);
      spots[i].rotation.y = slot.drag + spin;
    }
    const cy = ((rows - 1) * rowH + H + above - below) / 2;
    camera.position.set(0, cy + Math.sin(CLOSE_PITCH) * d, Math.cos(CLOSE_PITCH) * d);
    camera.lookAt(0, cy, 0);
    board.visible = false;
  } else {
    const T = Math.max(1.15, 2 * r + 0.45);
    const a = T * Math.SQRT1_2;
    const pos = [[-a, 0], [-0.2 * T, -a], [0.2 * T, a], [a, 0]];
    const tiles = [[-a, 0], [0, -a], [0, a], [a, 0]];
    for (let i = 0; i < 4; i++) {
      spots[i].position.set(pos[i][0], 0, pos[i][1]);
      spots[i].rotation.y = slot.drag;
      const tile = board.children[i];
      tile.position.set(tiles[i][0], 0, tiles[i][1]);
      tile.scale.set(T * 0.96, 1, T * 0.96);
    }
    board.visible = true;
    const needW = 4 * a * 1.04;
    const needH = (4 * a * Math.sin(GAME_PITCH) + H * Math.cos(GAME_PITCH)) * 1.09;
    const d = Math.max(needW / 2 / (TAN * aspect), needH / 2 / TAN);
    const ty = H * 0.3;
    camera.position.set(0, ty + Math.sin(GAME_PITCH) * d, Math.cos(GAME_PITCH) * d);
    camera.lookAt(0, ty, 0);
  }
}

// Role labels sit under each figure's feet; recomputed only when the view changes.
function makeLabels(view) {
  return ROLES.map((role) => {
    const el = document.createElement('span');
    el.className = 'role';
    el.textContent = role;
    el.setAttribute('aria-hidden', 'true');
    view.appendChild(el);
    return el;
  });
}

function placeLabels(slot, labels, state, w, h, viewMode) {
  const key = `${w}x${h}:${viewMode}`;
  if (state.key === key) return;
  state.key = key;
  for (let i = 0; i < 4; i++) {
    const p = slot.spots[i].position;
    _v.set(p.x, p.y - 0.02, p.z + (viewMode === 'game' ? slot.fitR * 0.8 : 0)).project(camera);
    const x = Math.round((_v.x + 1) / 2 * w);
    const y = Math.min(Math.round((1 - _v.y) / 2 * h) + 3, h - 18);
    labels[i].style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    labels[i].classList.add('placed');
  }
}

// ---------------------------------------------------------------- rendering

let cw = 0, ch = 0, cpr = 0;
function syncSize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  if (w !== cw || h !== ch || pr !== cpr) {
    cw = w; ch = h; cpr = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
  }
}

function renderView(slot, rect, labels, state, t) {
  const w = rect.width, h = rect.height;
  if (w < 4 || h < 4) return;
  layout(slot, w, h, mode, t);
  const x = rect.left, y = ch - rect.bottom;
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(slot.scene, camera);
  placeLabels(slot, labels, state, w, h, mode);
}

function draw(t, dt, all) {
  if (!renderer) return;
  syncSize();
  renderer.info.reset();
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  if (ovSlot) {
    if (!REDUCED_MOTION) animate(ovSlot, t, dt);
    renderView(ovSlot, ovView.getBoundingClientRect(), ovLabels, ovState, t);
    return;
  }
  for (const slot of slots) {
    const rect = slot.view.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < ch && rect.right > 0 && rect.left < cw;
    if (!onScreen && !all) continue;
    if (!REDUCED_MOTION) animate(slot, t, dt);
    renderView(slot, rect, slot.labels, slot.state, t);
  }
}

let time = 0, last = 0, rafId = 0, running = false;
function loop(now) {
  rafId = requestAnimationFrame(loop);
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  time += dt;
  draw(time, dt, false);
}
function start() {
  if (running || document.hidden || !renderer || !slots.length) return;
  running = true;
  last = 0;
  rafId = requestAnimationFrame(loop);
}
function stop() {
  running = false;
  cancelAnimationFrame(rafId);
}
document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

// ---------------------------------------------------------------- cards and UI

const VIBE_CLASS = { 'Black Death': 'v-plague', 'post-apocalypse': 'v-ash', 'unjust architect': 'v-arch' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function tagsFor(style) {
  const frag = document.createDocumentFragment();
  frag.append(el('span', `tag ${VIBE_CLASS[style.vibe] || ''}`, style.vibe), el('span', 'tag t-look', style.look));
  return frag;
}

function makeCard(slot) {
  const { style, index } = slot;
  const card = el('button', 'card');
  card.type = 'button';
  card.setAttribute('aria-label', `${index + 1}. ${style.name}: ${style.blurb}`);
  const head = el('span', 'card-head');
  head.append(el('span', 'num', String(index + 1).padStart(2, '0')), el('span', 'name', style.name));
  const tags = el('span', 'tags');
  tags.append(tagsFor(style));
  head.append(tags);
  const view = el('span', 'view');
  if (style.broken) view.append(el('span', 'broken', 'This style failed to load.'));
  const blurb = el('span', 'blurb', style.blurb);
  card.append(head, view, blurb);
  slot.view = view;
  slot.labels = makeLabels(view);
  bindDrag(view, () => slot);
  card.addEventListener('click', () => {
    if (performance.now() < suppressClickUntil) return;
    openOverlay(slot, card);
  });
  return card;
}

// Horizontal drag on a view turns all four figures; a short tap still clicks.
let suppressClickUntil = 0;
function bindDrag(view, getSlot) {
  let id = null, x0 = 0, base = 0, moved = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    id = e.pointerId; x0 = e.clientX; base = getSlot().drag; moved = false;
  });
  view.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      try { view.setPointerCapture(id); } catch { /* pointer gone */ }
    }
    if (moved) getSlot().drag = base + dx * 0.012;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (moved) suppressClickUntil = performance.now() + 350;
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}

let lastFocus = null;
function openOverlay(slot, card) {
  const { style, index } = slot;
  ovSlot = slot;
  lastFocus = card;
  $('#ov-title').textContent = `${String(index + 1).padStart(2, '0')} ${style.name}`;
  $('#ov-blurb').textContent = style.blurb;
  const tags = $('#ov-tags');
  tags.textContent = '';
  tags.append(tagsFor(style));
  ovState.key = '';
  ovLabels.forEach((l) => l.classList.remove('placed'));
  overlay.hidden = false;
  document.documentElement.classList.add('ov-open');
  ovClose.focus();
}

function closeOverlay() {
  if (!ovSlot) return;
  ovSlot = null;
  overlay.hidden = true;
  document.documentElement.classList.remove('ov-open');
  slots.forEach((s) => { s.state.key = ''; });
  if (lastFocus) lastFocus.focus();
}

bindDrag(ovView, () => ovSlot);
ovClose.addEventListener('click', closeOverlay);
overlay.querySelector('.backdrop').addEventListener('click', closeOverlay);
document.addEventListener('keydown', (e) => {
  if (!ovSlot) return;
  if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
  else if (e.key === 'Tab') { e.preventDefault(); ovClose.focus(); }
});

function setMode(m) {
  mode = m;
  document.documentElement.dataset.view = m;
  switchBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === m)));
  try { localStorage.setItem(VIEW_KEY, m); } catch { /* storage blocked */ }
}
switchBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.view)));
setMode(mode);

// ---------------------------------------------------------------- boot

const styles = await loadStyles();
styles.forEach((style, i) => {
  const slot = makeSlot(style, i);
  slots.push(slot);
  grid.appendChild(makeCard(slot));
});
statusEl.textContent = renderer ? '' : 'WebGL is not available here, so the previews can’t be drawn.';

// Debug hook: renderAll(t) animates and draws every card once at time t (seconds),
// for checking when requestAnimationFrame doesn't run (e.g. a hidden preview pane).
let lastAll = 0;
window.__dump = {
  styles,
  renderer,
  renderAll(t = 0) {
    const dt = Math.min(Math.max(t - lastAll, 0), 0.1) || 1 / 60;
    lastAll = t;
    time = t;
    slots.forEach((s) => { s.state.key = ''; });
    ovState.key = '';
    draw(t, dt, true);
    return renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } : null;
  },
};

start();
