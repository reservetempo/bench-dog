// styles/index.js: registry of the 10 character styles, in page order.
//
// Style module API. Each file default-exports one object:
//
//   export default {
//     id: '01-woodcut',            // same as the file name
//     name: 'Plague Woodcut',      // card title
//     blurb: 'One line ...',       // card subtitle
//     vibe: 'Black Death',         // 'Black Death' | 'post-apocalypse' | 'unjust architect'
//     look: 'grim',                // proportions tag: 'grim', 'big heads', 'anime', 'chibi anime', ...
//     tileColor: 0x3a3630,         // optional: top colour of the Game view board tiles
//     setupScene(scene) {},        // lights, fog, scene.background. Called once per scene.
//     build(role) { return group },        // role: 'peasant' | 'monk' | 'priest' | 'cardinal'
//     update(group, role, t, dt) {},       // optional idle animation; t, dt in seconds
//   };
//
// Units and rules:
// - Figures stand on y = 0, face +z and are about 1 unit tall (big-head styles may be
//   shorter and wider). main.js measures each figure once after build() to frame the
//   camera and space the four figures, so keep particles/glows flagged userData.noFit.
// - main.js owns layout, cameras, the turntable, drag and the board tiles. It wraps each
//   figure in its own parent group, so update() may move, tilt or hop the figure group
//   itself; just keep it near its origin. Camera: fov 30, about 3–5 units from the
//   figures in Close-up and 6–10 in Game view (55° down), so linear fog should start
//   around 6–7 and end past 16 or the Game view goes grey.
// - The same scene is drawn in the card and in the overlay. Don't add ground planes;
//   Game view adds its own tiles (top at y = 0).
// - build() is called once per role; share materials and geometries within the style.
//   Store anything update() needs on group.userData (no per-frame allocations).
// - Reduced motion (kit.REDUCED_MOTION): main.js calls update() and userData.tick once
//   at t = 0 and then never again; skip particles in build().
// - About 3k triangles per figure, no image files (small canvas textures are fine).
// - Helpers: see kit.js (torch, embers, blobShadow, outlineAll, toonMat/toonGradient,
//   jitter, lathe, raggedHem, mergeMeshes, pointIn, eyePair/paintedEye, canvasTexture,
//   gradientBackground, softDotTexture, rng, wobble, shade). 01-woodcut.js is the
//   worked example (toon + outlines), 02-ash-ember.js the faceted one.

export const STYLE_IDS = [
  '01-woodcut',
  '02-ash-ember',
  '03-rust-scavengers',
  '04-grim-chibi',
  '05-clay-votive',
  '06-voxel-famine',
  '07-wooden-pawns',
  '08-marionettes',
  '09-anime-penitents',
  '10-ashen-anime',
];

// Loads every style module. A style that fails to load is replaced by a stub
// (and the error is logged), so one broken file doesn't take the page down.
export async function loadStyles() {
  return Promise.all(STYLE_IDS.map((id) =>
    import(`./${id}.js`).then((m) => m.default, (err) => {
      console.error(`[dump] style ${id} failed to load`, err);
      return { id, name: id, blurb: 'Failed to load: see console.', vibe: '?', look: '?', broken: true,
        setupScene() {}, build: () => null };
    })));
}
