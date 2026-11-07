// /app/page.jsx

import { STYLE_CONFIG } from './config/styles';

const LINKS = [
  { href: '/archive', label: 'archive' },
  { href: '/sequencer', label: 'sequencer' },
  { href: '/blog', label: 'blog' },
  { href: '/units', label: 'units' },
  { href: 'https://reservetempo.github.io/sap-computer/', label: 'sap-1' },
  { href: 'https://reservetempo.github.io/logic-king/', label: 'logic king' },
  { href: '/dump', label: 'dump' },
  { href: 'https://reservetempo.github.io/html-dump/', label: 'html dump' },
];

export default function Home() {
  return (
    <div className="min-h-screen font-sans bg-[#ff0000]" style={{ color: STYLE_CONFIG.brandColor }}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ul className="flex flex-col gap-2">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <a href={href} className={STYLE_CONFIG.navLinkClasses}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
