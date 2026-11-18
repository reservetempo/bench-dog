// /app/page.jsx
// The homepage is a voxel town: each folder in app/desktop/tree.json is an area and each
// link in it is a building (see app/town/). Add a link with scripts/add-link.mjs.

import { Pixelify_Sans } from 'next/font/google';
import Town from './town/Town';
import tree from './desktop/tree.json';

const pixel = Pixelify_Sans({ subsets: ['latin'], display: 'swap' });

export default function Home() {
  return <Town tree={tree} fontClass={pixel.className} />;
}
