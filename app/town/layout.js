// Lays out the town from tree.json. No three.js here, so the page can use it while rendering
// on the server. Each top-level folder is an area around the hill; each item in a folder is a
// building on its own lot. A railway runs around the south side of the hill, past every area.

import { hashString } from './random';

export const LOT = 3; // tiles per building lot (a square)
export const ROAD = 1; // tiles of road between lots
export const GROUND = 2; // terrain layers under the areas and the railway
export const LAYER = 0.4; // height of one terrain layer
export const GROUND_Y = GROUND * LAYER;
export const HILL = { x: 0, z: -4 };
export const TRACK_R = 12; // radius of the railway around the hill
export const TRACK_END = 0.35; // radians of track past the first and last stations

export const AREA_COLORS = ['#f2b33d', '#4fa3e0', '#e8664f', '#6cc26a', '#b07be0', '#f08fb8'];

// Buildings for the links that exist. Anything added later gets a generic building
// picked from its name (GENERIC), and a folder inside an area becomes a triplex.
export const THEMES = {
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

export const LABELS = {
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

export function themeFor(item) {
  if (isFolder(item)) return 'plex';
  return THEMES[item.name.toLowerCase()] || GENERIC[hashString(item.name) % GENERIC.length];
}

export function layoutTown(tree) {
  const folders = tree.items.filter(isFolder);
  const loose = tree.items.filter((item) => !isFolder(item));
  const groups = folders.map((f) => ({ name: f.name, path: f.name, items: f.items }));
  if (loose.length) groups.push({ name: 'town square', path: null, items: loose });

  const n = groups.length;
  const areas = groups.map((g, i) => {
    const count = Math.max(1, g.items.length);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const w = cols * (LOT + ROAD) + ROAD;
    const d = rows * (LOT + ROAD) + ROAD;
    // West first, then on around the south side of the hill.
    const theta = Math.PI - (i * 2 * Math.PI) / Math.max(n, 1);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const half = (Math.abs(cos) * w) / 2 + (Math.abs(sin) * d) / 2;
    const r = TRACK_R + 2 + half;
    const x0 = Math.round(HILL.x + cos * r - w / 2);
    const z0 = Math.round(HILL.z + sin * r - d / 2);
    const area = {
      index: i,
      id: `a${i}`,
      name: g.name,
      path: g.path,
      items: g.items,
      color: AREA_COLORS[i % AREA_COLORS.length],
      theta,
      cols,
      rows,
      rect: { x0, z0, x1: x0 + w, z1: z0 + d },
      center: { x: x0 + w / 2, z: z0 + d / 2 },
      lots: [],
      buildings: [],
    };
    for (let k = 0; k < cols * rows; k += 1) {
      const c = k % cols;
      const row = Math.floor(k / cols);
      const tx = x0 + ROAD + c * (LOT + ROAD);
      const tz = z0 + ROAD + row * (LOT + ROAD);
      area.lots.push({ tx, tz, center: { x: tx + LOT / 2, z: tz + LOT / 2 }, used: k < g.items.length });
    }
    area.buildings = g.items.map((item, k) => ({
      id: `a${i}b${k}`,
      area: i,
      index: k,
      item,
      name: item.name,
      folder: isFolder(item),
      theme: themeFor(item),
      center: area.lots[k].center,
    }));
    return area;
  });

  // The railway: an arc around the hill from the first area's station to the last.
  let track = null;
  if (areas.length >= 2) {
    const start = areas[0].theta + TRACK_END;
    const end = areas[areas.length - 1].theta - TRACK_END;
    track = {
      radius: TRACK_R,
      start,
      length: TRACK_R * (start - end),
      stops: areas.map((a) => TRACK_R * (start - a.theta)),
    };
  }

  // The island wraps the areas and the hill with room to spare.
  let minX = HILL.x - TRACK_R - 2;
  let maxX = HILL.x + TRACK_R + 2;
  let minZ = HILL.z - TRACK_R - 2;
  let maxZ = HILL.z + TRACK_R + 2;
  for (const a of areas) {
    minX = Math.min(minX, a.rect.x0);
    maxX = Math.max(maxX, a.rect.x1);
    minZ = Math.min(minZ, a.rect.z0);
    maxZ = Math.max(maxZ, a.rect.z1);
  }
  const island = {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    rx: Math.max(30, (maxX - minX) / 2 + 9),
    rz: Math.max(20, (maxZ - minZ) / 2 + 8),
  };

  return { areas, track, island, bounds: { minX: minX - 6, maxX: maxX + 6, minZ: minZ - 6, maxZ: maxZ + 8 } };
}

// Where a link goes, written short: "/archive" or "reservetempo.github.io/sap-computer".
export function prettyHref(href) {
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
