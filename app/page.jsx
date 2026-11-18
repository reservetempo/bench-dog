// /app/page.jsx
// The homepage is a low-poly town: each top-level folder in app/desktop/tree.json is one
// building, and you go inside it to see what the folder holds (see app/town/). Add a link
// with scripts/add-link.mjs.

import { Pixelify_Sans } from 'next/font/google';
import Town from './town/Town';
import tree from './desktop/tree.json';

const pixel = Pixelify_Sans({ subsets: ['latin'], display: 'swap' });

export default function Home() {
  return <Town tree={tree} fontClass={pixel.className} />;
}
