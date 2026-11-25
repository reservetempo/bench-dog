// Pixel-art icons on a 16 × 16 grid, drawn at 3× (48 px).
// '#' is the outline, '.' is the fill, a space is transparent.

const FOLDER = [
  '                ',
  '                ',
  '  ####          ',
  ' #....#         ',
  ' ############## ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' #............# ',
  ' ############## ',
  '                ',
  '                ',
];

const DOCUMENT = [
  '  ########      ',
  '  #......##     ',
  '  #......#.#    ',
  '  #......#..#   ',
  '  #......####   ',
  '  #.........#   ',
  '  #.........#   ',
  '  #.#####...#   ',
  '  #.........#   ',
  '  #.######..#   ',
  '  #.........#   ',
  '  #.####....#   ',
  '  #.........#   ',
  '  #.........#   ',
  '  ###########   ',
  '                ',
];

// One path per colour: each horizontal run of a character becomes a rectangle.
function toPath(rows, ch) {
  let d = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== ch) { x += 1; continue; }
      const start = x;
      while (x < row.length && row[x] === ch) x += 1;
      d += `M${start} ${y}h${x - start}v1h${start - x}z`;
    }
  });
  return d;
}

const SHAPES = {
  folder: { line: toPath(FOLDER, '#'), fill: toPath(FOLDER, '.') },
  document: { line: toPath(DOCUMENT, '#'), fill: toPath(DOCUMENT, '.') },
};

export function PixelIcon({ kind, lineClass, fillClass }) {
  const shape = SHAPES[kind];
  return (
    <svg viewBox="0 0 16 16" width="48" height="48" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d={shape.fill} className={fillClass} />
      <path d={shape.line} className={lineClass} />
    </svg>
  );
}

// A 1-unit checkerboard, used to fill the icon of a folder whose window is open.
export function DitherDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <pattern id="desktop-dither" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#fff" />
          <rect width="1" height="1" fill="#000" />
          <rect x="1" y="1" width="1" height="1" fill="#000" />
        </pattern>
      </defs>
    </svg>
  );
}
