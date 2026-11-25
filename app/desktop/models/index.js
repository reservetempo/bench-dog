// Which figurine stands for which homepage item, by its name in tree.json, and its colours.
// An item with no entry here keeps its pixel folder or document icon.
//
// Models are built in greyscale with tone() (see kit.js). colors is [dark, mid, light]: each
// tone is mapped along that ramp, so tone-0 parts take the dark colour and tone-1 the light.

const entry = (load, colors) => ({ load, colors });

export const MODELS = {
  archive: entry(() => import('./archive.js'), ['#16264f', '#2f6fe0', '#8fd0ff']),
  sequencer: entry(() => import('./sequencer.js'), ['#ff2d95', '#ff8c1a', '#fff1d6']),
  blog: entry(() => import('./blog.js'), ['#1d2bff', '#7a5cff', '#fff6cf']),
  units: entry(() => import('./units.js'), ['#12805c', '#ff4d4d', '#fff7d6']),
  'sap-1': entry(() => import('./sap-1.js'), ['#141414', '#ff2e63', '#55f59b']),
  dump: entry(() => import('./dump.js'), ['#f77f00', '#fcbf49', '#fff3c4']),
  'learning feed': entry(() => import('./learning-feed.js'), ['#241e4e', '#e85d75', '#ffd166']),
  euclid: entry(() => import('./euclid.js'), ['#3a0ca3', '#9d4edd', '#ffd60a']),
  'unit tree': entry(() => import('./unit-tree.js'), ['#7f4f24', '#2d9c4a', '#6cf08a']),
  'studio 414': entry(() => import('./studio-414.js'), ['#1d4e5f', '#2a9d8f', '#f4a261']),
  mudmuddd: entry(() => import('./mudmuddd.js'), ['#1f3b4d', '#e9c46a', '#e2723b']),
  'design framework': entry(() => import('./design-framework.js'), ['#ff006e', '#8338ec', '#ffbe0b']),
  'website framework': entry(() => import('./website-framework.js'), ['#2459e0', '#8ecae6', '#ffffff']),
  'diagram types': entry(() => import('./diagram-types.js'), ['#ff006e', '#ffbe0b', '#3ae0ff']),
  'calculus spivak': entry(() => import('./calculus-spivak.js'), ['#03045e', '#0077b6', '#ffd60a']),
  AI: entry(() => import('./ai.js'), ['#ff2fb9', '#7b61ff', '#a8f4ff']),
  'attention is all you need': entry(() => import('./attention.js'), ['#7209b7', '#00b4d8', '#ffffff']),
  bread: entry(() => import('./bread.js'), ['#5a3510', '#c8731e', '#f3b44c']),
};
