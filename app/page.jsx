// /app/page.jsx
// The homepage is an old one-bit desktop: each folder in app/desktop/tree.json opens into a
// window, and each link goes to its page. Each item is drawn as a low-poly figurine
// (app/desktop/models/, registered in models/index.js), or as a pixel folder or document icon
// when it has none. Add a link with scripts/add-link.mjs.

import { Pixelify_Sans } from 'next/font/google';
import Desktop from './desktop/Desktop';
import tree from './desktop/tree.json';

const pixel = Pixelify_Sans({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });

export default function Home() {
  return <Desktop tree={tree} fontClass={pixel.className} />;
}
