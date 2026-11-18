// Lays out the town from tree.json. No three.js here, so the page can use it while rendering
// on the server. Each top-level item is one building on its own lot. A folder's building can
// be entered: what's in the folder is laid out inside it (layoutInside), one fixture per item.
// A link's building gets a card with a Visit button. Items marked "hidden": true are left out.

import { hashString } from './random';

export const LOT = 5; // tiles across a building's lot (a square)
export const ROAD = 1.5; // tiles between lots
export const GROUND_Y = 0.12; // the top of the pad each lot stands on

export const COLORS = ['#f2b33d', '#4fa3e0', '#e8664f', '#6cc26a', '#b07be0', '#f08fb8'];

// Buildings for the names that exist. Anything added later gets a generic building picked
// from its name (GENERIC); a folder without a theme of its own becomes a triplex.
export const THEMES = {
  ai: 'datacenter',
  archive: 'museum',
  sequencer: 'radio',
  blog: 'newspaper',
  units: 'school',
  'sap-1': 'factory',
  'logic king': 'castle',
  dump: 'junkyard',
  'html dump': 'depot',
  'attention is all you need': 'observatory',
};
const GENERIC = ['house', 'shop', 'plex', 'office'];
const THEME_COLORS = { datacenter: '#4fa3e0' };

export const LABELS = {
  datacenter: 'Data center',
  museum: 'Museum',
  radio: 'Radio station',
  newspaper: 'Newspaper office',
  school: 'Schoolhouse',
  factory: 'Factory',
  castle: 'Castle',
  junkyard: 'Junkyard',
  depot: 'Depot',
  observatory: 'Observatory',
  house: 'House',
  shop: 'Shop',
  plex: 'Triplex',
  office: 'Office tower',
};

export const isFolder = (item) => Array.isArray(item.items);
export const shown = (items) => items.filter((item) => !item.hidden);

export function themeFor(item) {
  const theme = THEMES[item.name.toLowerCase()];
  if (theme) return theme;
  if (isFolder(item)) return 'plex';
  return GENERIC[hashString(item.name) % GENERIC.length];
}

export function layoutTown(tree) {
  const items = shown(tree.items);
  const n = items.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const step = LOT + ROAD;

  const buildings = items.map((item, k) => {
    const row = Math.floor(k / cols);
    const inRow = Math.min(cols, n - row * cols);
    const x = ((k % cols) - (inRow - 1) / 2) * step;
    const z = (row - (rows - 1) / 2) * step;
    const theme = themeFor(item);
    const building = {
      id: `b${k}`,
      index: k,
      parent: null,
      item,
      name: item.name,
      folder: isFolder(item),
      theme,
      color: THEME_COLORS[theme] || COLORS[k % COLORS.length],
      path: isFolder(item) ? item.name : null,
      center: { x, z },
      rect: { x0: x - LOT / 2, z0: z - LOT / 2, x1: x + LOT / 2, z1: z + LOT / 2 },
      inside: null,
      fixtures: [],
    };
    if (building.folder) {
      building.inside = layoutInside(building);
      building.fixtures = building.inside.fixtures;
    }
    return building;
  });

  // The lots, with room around them for the tags; the camera stays over `bounds`.
  let minX = -LOT / 2;
  let maxX = LOT / 2;
  let minZ = -LOT / 2;
  let maxZ = LOT / 2;
  for (const b of buildings) {
    minX = Math.min(minX, b.rect.x0);
    maxX = Math.max(maxX, b.rect.x1);
    minZ = Math.min(minZ, b.rect.z0);
    maxZ = Math.max(maxZ, b.rect.z1);
  }
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const town = { minX: minX - 3, maxX: maxX + 3, minZ: minZ - 4, maxZ: maxZ + 3 };
  const bounds = { minX: town.minX - 14, maxX: town.maxX + 14, minZ: town.minZ - 14, maxZ: town.maxZ + 14 };

  return { buildings, center, town, bounds };
}

// ---- Inside a folder's building ----
// A room centred on the origin, the floor at y = 0 and the front wall at +z. Each item is a
// fixture: { id, parent, item, name, folder, label, center, facing (an angle about y, 0 is
// +z), size }. `view` is the part of the room the camera frames on the way in.

export const RACK = { w: 0.62, d: 1.0, h: 2.1 };
const PER_ROW = 7;
const ROW_PITCH = 2.7; // a row of racks and the aisle in front of it
const FRONT = 2.0; // walkway between the front wall and the first row

export function layoutInside(building) {
  const items = shown(building.item.items);
  return building.theme === 'datacenter' ? datacenter(building, items) : hall(building, items);
}

const fixtureOf = (building, item, k, extra) => ({
  id: `${building.id}f${k}`,
  parent: building.id,
  index: k,
  item,
  name: item.name,
  folder: isFolder(item),
  facing: 0,
  ...extra,
});

// Rows of server racks, all facing the front. Each item gets a rack of its own, two to a row
// (one in the middle when a row has one), filling the rows from the front.
function datacenter(building, items) {
  const rows = Math.max(3, Math.ceil(items.length / 2));
  const rowLen = PER_ROW * RACK.w;
  const w = rowLen + 4.2; // cooling units down the left wall, a desk on the right
  const d = FRONT + rows * ROW_PITCH;
  const rowX0 = -w / 2 + 2.0;
  const rowZ = Array.from({ length: rows }, (_, r) => d / 2 - FRONT - r * ROW_PITCH - RACK.d / 2);
  const fixtures = items.map((item, k) => {
    const row = Math.floor(k / 2);
    const inRow = Math.min(2, items.length - row * 2);
    const slot = inRow === 1 ? 3 : k % 2 ? 5 : 1;
    return fixtureOf(building, item, k, {
      label: `Rack ${String.fromCharCode(65 + (row % 26))}${slot + 1}`,
      row,
      slot,
      center: { x: rowX0 + (slot + 0.5) * RACK.w, z: rowZ[row] },
      size: RACK,
    });
  });
  return {
    kind: 'datacenter',
    room: { w, d, h: 2.7 },
    view: { x: rowX0 + rowLen / 2 + 0.3, z: -0.4, w: rowLen + 3.2, d: d - 0.8 },
    rows,
    perRow: PER_ROW,
    rowX0,
    rowZ,
    fixtures,
  };
}

// Any other building: a hall with a lit stand for each item, in rows from the front.
function hall(building, items) {
  const n = Math.max(1, items.length);
  const cols = Math.max(2, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(2, Math.ceil(n / cols));
  const P = 2.4;
  const w = cols * P + 2;
  const d = rows * P + 2.4;
  const fixtures = items.map((item, k) =>
    fixtureOf(building, item, k, {
      label: `Stand ${k + 1}`,
      center: { x: ((k % cols) - (cols - 1) / 2) * P, z: ((rows - 1) / 2 - Math.floor(k / cols)) * P + 0.4 },
      size: { w: 1.0, d: 1.0, h: 1.4 },
    })
  );
  return { kind: 'hall', room: { w, d, h: 2.6 }, view: { x: 0, z: 0, w: w - 0.5, d: d - 0.5 }, fixtures };
}

// Where a link goes, written short: "/archive" or "reservetempo.github.io/sap-computer".
export function prettyHref(href) {
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
