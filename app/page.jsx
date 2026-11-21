// /app/page.jsx

import { Pixelify_Sans } from 'next/font/google';
import PixelIcon from './home/PixelIcon';
import './home/desktop.css';

const pixel = Pixelify_Sans({ subsets: ['latin'], weight: ['400', '700'] });

const LINKS = [
  { href: '/archive', label: 'archive', icon: 'archive' },
  { href: '/sequencer', label: 'sequencer', icon: 'sequencer' },
  { href: '/blog', label: 'blog', icon: 'blog' },
  { href: '/units', label: 'units', icon: 'units' },
  { href: 'https://reservetempo.github.io/sap-computer/', label: 'sap-1', icon: 'chip' },
  { href: 'https://reservetempo.github.io/logic-king/', label: 'logic king', icon: 'crown' },
  { href: '/dump', label: 'dump', icon: 'truck' },
  { href: 'https://reservetempo.github.io/html-dump/', label: 'html dump', icon: 'code' },
  { href: 'https://reservetempo.github.io/learning-feed/', label: 'learning feed', icon: 'book' },
  { href: 'https://reservetempo.github.io/desktop-manager-plan/', label: 'desktop manager plan', icon: 'computer' },
  { href: 'https://reservetempo.github.io/project-manager-tree/', label: 'project manager tree', icon: 'tree' },
];

export default function Home() {
  return (
    <div className={`mac-desktop ${pixel.className}`}>
      <div className="mac-menubar">
        <span className="mac-menu-mark">✻</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Special</span>
      </div>

      <section className="mac-window" aria-label="dominic">
        <header className="mac-titlebar">
          <span className="mac-closebox" aria-hidden="true" />
          <h1 className="mac-title">dominic</h1>
        </header>
        <div className="mac-infobar">
          <span>{LINKS.length} items</span>
          <span>here and elsewhere</span>
        </div>
        <ul className="mac-icons">
          {LINKS.map(({ href, label, icon }) => (
            <li key={href}>
              <a href={href} className="mac-icon">
                <PixelIcon name={icon} size={48} />
                <span className="mac-icon-label">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
