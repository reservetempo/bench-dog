'use client';

// The homepage: a voxel town on an island. Each folder in tree.json is an area of the town
// and each link in it is a building. Click an area to fly in and see its buildings' names;
// click a building for a card with a Visit button. The sun, clouds, rain, snow and the
// season follow Montreal's time and weather. Links: /#<area> opens an area straight away.

import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutTown, LABELS, GROUND_Y, prettyHref, isFolder } from './layout';
import { clockText, computeConditions, parseOverrides } from './conditions';
import styles from './town.module.css';

const SITE_NAME = 'dominic_my_website';

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
function decodeHash(hash) {
  try {
    return hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean);
  } catch {
    return [];
  }
}

export default function Town({ tree, fontClass }) {
  const layout = useMemo(() => layoutTown(tree), [tree]);
  const byId = useMemo(() => {
    const m = new Map();
    for (const a of layout.areas) for (const b of a.buildings) m.set(b.id, b);
    return m;
  }, [layout]);

  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const townRef = useRef(null);
  const tagEls = useRef(new Map());
  const handlers = useRef({});
  const overridesRef = useRef({});
  const conditionsRef = useRef(null);
  const instantRef = useRef(false);
  const restoredRef = useRef(false);
  const keyboardRef = useRef(false);

  const [status, setStatus] = useState('loading');
  const [townId, setTownId] = useState(0); // bumps each time the 3D scene is (re)built
  const [active, setActive] = useState(null); // area index
  const [selected, setSelected] = useState(null); // building id
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(null);
  const [touched, setTouched] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const area = active != null ? layout.areas[active] : null;
  const sel = selected ? byId.get(selected) : null;
  const conditions = useMemo(
    () => (now ? computeConditions({ date: now, weather, overrides: overridesRef.current }) : null),
    [now, weather]
  );
  conditionsRef.current = conditions;

  // Montreal's clock, and its weather every 10 minutes.
  useEffect(() => {
    overridesRef.current = parseOverrides(window.location.search);
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let stopped = false;
    const load = () =>
      fetch('/api/weather')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!stopped && d && !d.error) setWeather(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  // Build the 3D town once the clock is known (the season picks the trees).
  const hasClock = now != null;
  useEffect(() => {
    if (!hasClock) return undefined;
    let disposed = false;
    let town = null;
    import('./scene')
      .then(({ createTown }) => {
        if (disposed) return;
        town = createTown({
          host: hostRef.current,
          canvas: canvasRef.current,
          layout,
          conditions: conditionsRef.current,
          handlers,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        });
        townRef.current = town;
        window.__town = town;
        // A new scene starts at the whole-town view: jump straight to the open area.
        instantRef.current = true;
        setTownId((n) => n + 1);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('town:', err);
        if (!disposed) setStatus('failed');
      });
    return () => {
      disposed = true;
      town?.dispose();
      townRef.current = null;
    };
  }, [layout, hasClock]);

  // Keep the address on the open area, so it can be shared. (Declared before the effect
  // that reads the address, so it doesn't wipe the address before that has been read.)
  useEffect(() => {
    if (!restoredRef.current) return;
    let path = area?.path ? encodePath(area.path) : '';
    if (path && sel?.folder && sel.area === active) path += `/${encodeURIComponent(sel.name)}`;
    const hash = path ? `#${path}` : '';
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [area, sel, active]);

  // Open the area (and folder building) named in the address, now and when it changes.
  useEffect(() => {
    const apply = () => {
      const [areaPath, sub] = decodeHash(window.location.hash);
      const a = areaPath && layout.areas.find((x) => x.path === areaPath);
      if (!a) return;
      setActive(a.index);
      const b = sub && a.buildings.find((x) => x.folder && x.name === sub);
      setSelected(b ? b.id : null);
    };
    apply();
    restoredRef.current = true;
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [layout]);

  // Hand the open area, the selection and the weather to the scene (again when it's rebuilt).
  useEffect(() => {
    townRef.current?.focusArea(active, { instant: instantRef.current });
    if (townRef.current) instantRef.current = false;
  }, [active, townId]);

  useEffect(() => {
    townRef.current?.select(selected);
  }, [selected, townId]);

  useEffect(() => {
    if (conditions) townRef.current?.setConditions(conditions);
  }, [conditions, townId]);

  // Keyboard users land on the first building of an area, then on the card.
  useEffect(() => {
    if (keyboardRef.current && area) tagEls.current.get(area.buildings[0]?.id)?.focus();
  }, [area]);
  useEffect(() => {
    if (keyboardRef.current && sel) cardRef.current?.querySelector('a, button:not([data-close])')?.focus();
  }, [sel]);

  // Escape closes the card, then leaves the area.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Focus moves once React has re-rendered (the area's tag is hidden until then).
      if (selected) {
        const id = selected;
        setSelected(null);
        setTimeout(() => tagEls.current.get(id)?.focus(), 0);
      } else if (active != null) {
        const id = layout.areas[active].id;
        setActive(null);
        setTimeout(() => tagEls.current.get(id)?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, active, layout]);

  const openArea = (index, e) => {
    keyboardRef.current = e?.detail === 0;
    setTouched(true);
    setActive(index);
    setSelected(null);
  };
  const toggleBuilding = (id, e) => {
    keyboardRef.current = e?.detail === 0;
    setSelected((s) => (s === id ? null : id));
  };
  const goHome = () => {
    setActive(null);
    setSelected(null);
    townRef.current?.home();
  };

  // Put the floating tags and the card over the 3D view, every frame.
  function placeOverlay() {
    const town = townRef.current;
    if (!town) return;
    const els = tagEls.current;
    const setPos = (el, x, y, visible) => {
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
      el.style.visibility = visible ? 'visible' : 'hidden';
    };
    for (const a of layout.areas) {
      const el = els.get(a.id);
      if (!el) continue;
      const top = Math.max(GROUND_Y + 2.5, ...a.buildings.map((b) => town.buildingTop(b.id))) + 0.8;
      const p = town.project(a.center.x, top, a.center.z);
      setPos(el, p.x, p.y, p.visible);
    }
    if (!area) return;
    // Read every size first, then write, so the browser lays out once.
    const tags = area.buildings
      .map((b) => {
        const el = els.get(b.id);
        if (!el) return null;
        const p = town.project(b.center.x, town.buildingTop(b.id) + 0.3, b.center.z);
        return { el, x: p.x, y: p.y, visible: p.visible, w: el.offsetWidth, h: el.offsetHeight };
      })
      .filter(Boolean);
    const card = sel && sel.area === active ? cardRef.current : null;
    const cardSize = card ? { w: card.offsetWidth, h: card.offsetHeight } : null;
    const host = hostRef.current;
    const W = host.clientWidth;
    const H = host.clientHeight;

    // Nearest tags (lowest on screen) keep their place; the others step up out of the way.
    tags.sort((p, q) => q.y - p.y);
    const placed = [];
    for (const t of tags) {
      for (let i = 0; i < 8; i += 1) {
        const hit = placed.find((o) => Math.abs(o.x - t.x) < (o.w + t.w) / 2 + 4 && t.y > o.y - o.h - 2 && t.y - t.h < o.y + 2);
        if (!hit) break;
        t.y = hit.y - hit.h - 3;
      }
      placed.push(t);
      // Keep the tag on screen, below the top bar.
      const x = Math.min(Math.max(t.x, t.w / 2 + 6), W - t.w / 2 - 6);
      const y = Math.max(t.y, t.h + 44);
      setPos(t.el, x, y, t.visible);
    }

    if (card && W > 720) {
      const p = town.project(sel.center.x, GROUND_Y + 1, sel.center.z);
      let x = p.x + 90;
      if (x + cardSize.w > W - 12) x = p.x - 90 - cardSize.w;
      const y = Math.min(Math.max(p.y - cardSize.h / 2, 44), H - cardSize.h - 64);
      card.style.transform = `translate3d(${Math.round(Math.max(12, x))}px, ${Math.round(y)}px, 0)`;
    } else if (card) {
      card.style.transform = '';
    }
  }

  handlers.current = {
    onPick(hit) {
      keyboardRef.current = false;
      setTouched(true);
      if (hit.type === 'building') {
        const b = byId.get(hit.id);
        if (b.area === active) setSelected((s) => (s === b.id ? null : b.id));
        else {
          setActive(b.area);
          setSelected(null);
        }
      } else if (hit.type === 'area') {
        if (hit.id !== active) setActive(hit.id);
        setSelected(null);
      } else {
        setSelected(null);
      }
    },
    onLeave() {
      setActive(null);
      setSelected(null);
    },
    onInteract() {
      setTouched(true);
    },
    onFrame: placeOverlay,
  };

  const tagRef = (id) => (el) => {
    if (el) tagEls.current.set(id, el);
    else tagEls.current.delete(id);
  };

  const c = conditions;
  return (
    <div className={`${styles.root} ${fontClass || ''}`} ref={hostRef}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <header className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Where you are">
          <button type="button" className={styles.crumbHome} onClick={goHome}>
            {SITE_NAME}
          </button>
          {area && (
            <>
              <span className={styles.sep} aria-hidden="true">
                /
              </span>
              <span className={styles.crumbArea}>
                <span className={styles.swatch} style={{ background: area.color }} aria-hidden="true" />
                {area.name}
              </span>
            </>
          )}
        </nav>
        <div className={styles.weather}>
          {c && <WeatherIcon icon={c.icon} />}
          <span className={styles.city}>Montréal</span>
          <span className={styles.time}>{c ? clockText(c.date) : '--:--'}</span>
          {c?.live && (
            <span className={styles.desc}>
              {c.temp != null && <span className={styles.temp}>{Math.round(c.temp)}°C</span>}
              <span className={styles.descText}>{c.text}</span>
            </span>
          )}
        </div>
      </header>

      {status === 'ready' && (
        <div className={styles.tags}>
          {layout.areas.map((a) => (
            <button
              key={a.id}
              ref={tagRef(a.id)}
              type="button"
              className={`${styles.tag} ${styles.areaTag}`}
              hidden={a.index === active}
              onClick={(e) => openArea(a.index, e)}
            >
              <span className={styles.swatch} style={{ background: a.color }} aria-hidden="true" />
              {a.name}
              <span className={styles.count} aria-label={`${a.items.length} ${a.items.length === 1 ? 'place' : 'places'}`}>
                {a.items.length}
              </span>
            </button>
          ))}
          {area?.buildings.map((b) => (
            <button
              key={b.id}
              ref={tagRef(b.id)}
              type="button"
              className={`${styles.tag} ${b.id === selected ? styles.tagOn : ''}`}
              aria-pressed={b.id === selected}
              onClick={(e) => toggleBuilding(b.id, e)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {sel && sel.area === active && (
        <div className={styles.card} ref={cardRef} role="dialog" aria-label={sel.name}>
          <div className={styles.cardHead}>
            <span className={styles.cardKind}>{LABELS[sel.theme]}</span>
            <button type="button" data-close className={styles.cardClose} aria-label="Close" onClick={() => setSelected(null)}>
              ×
            </button>
          </div>
          <h2 className={styles.cardTitle}>{sel.name}</h2>
          {sel.folder ? (
            <LinkList items={sel.item.items} className={styles.cardList} />
          ) : (
            <>
              <p className={styles.cardHref}>{prettyHref(sel.item.href)}</p>
              <a className={styles.visit} href={sel.item.href}>
                Visit <span aria-hidden="true">→</span>
              </a>
            </>
          )}
        </div>
      )}

      {status === 'ready' && (
        <div className={styles.controls} role="toolbar" aria-label="Map">
          <button type="button" className={styles.ctrl} aria-label="Zoom in" onClick={() => townRef.current?.zoomBy(0.75)}>
            +
          </button>
          <button type="button" className={styles.ctrl} aria-label="Zoom out" onClick={() => townRef.current?.zoomBy(1.33)}>
            −
          </button>
          <button type="button" className={styles.ctrl} aria-label="Turn left" onClick={() => townRef.current?.rotate(-1)}>
            <PixelGlyph rows={TURN_LEFT} />
          </button>
          <button type="button" className={styles.ctrl} aria-label="Turn right" onClick={() => townRef.current?.rotate(1)}>
            <PixelGlyph rows={TURN_LEFT} flip />
          </button>
          <button type="button" className={styles.ctrl} aria-label="Whole town" onClick={goHome}>
            <PixelGlyph rows={HOUSE} />
          </button>
        </div>
      )}

      {status === 'ready' && (
        <p className={`${styles.hint} ${touched || area ? styles.hintGone : ''}`} aria-hidden="true">
          {coarse ? 'drag to look around · pinch to zoom · tap an area' : 'drag to look around · scroll to zoom · Q/E to turn · click an area'}
        </p>
      )}

      {status === 'loading' && <p className={styles.loading}>building the town…</p>}

      <nav className={status === 'failed' ? styles.fallback : styles.visuallyHidden} aria-label="All pages">
        <h2>{status === 'failed' ? "The 3D town couldn't load here, so these are its pages:" : 'All pages'}</h2>
        {layout.areas.map((a) => (
          <section key={a.id}>
            <h3>{a.name}</h3>
            <LinkList items={a.items} />
          </section>
        ))}
      </nav>
    </div>
  );
}

function LinkList({ items, className }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item.name}>
          {isFolder(item) ? (
            <>
              <span>{item.name}</span>
              <LinkList items={item.items} />
            </>
          ) : (
            <a href={item.href}>{item.name}</a>
          )}
        </li>
      ))}
    </ul>
  );
}

// Tiny pixel-art icons, one string per row.
const PALETTE = {
  y: '#f7c531',
  m: '#f1e3a6',
  w: '#ffffff',
  g: '#9aa5b1',
  k: '#5b6573',
  b: '#4fa3e0',
  s: '#dfe9f3',
  l: '#ffd33d',
  i: '#1b1f24',
};
const ICONS = {
  sun: ['...yy...', '.y.yy.y.', '..yyyy..', 'yyyyyyyy', 'yyyyyyyy', '..yyyy..', '.y.yy.y.', '...yy...'],
  moon: ['..mmmm..', '.mmm....', 'mmm.....', 'mmm.....', 'mmm.....', 'mmm.....', '.mmm....', '..mmmm..'],
  cloud: ['........', '...gg...', '..gwwg..', '.gwwwwg.', 'gwwwwwwg', 'gwwwwwwg', '.gggggg.', '........'],
  partly: ['.yy.....', 'yyyy....', 'yyygg...', '.ygwwg..', '.gwwwwg.', 'gwwwwwwg', '.gggggg.', '........'],
  partlyNight: ['.mm.....', 'mm......', 'mm.gg...', '.mgwwg..', '.gwwwwg.', 'gwwwwwwg', '.gggggg.', '........'],
  rain: ['...gg...', '..gggg..', '.gggggg.', 'gggggggg', '.gggggg.', '.b..b..b', 'b..b..b.', '........'],
  snow: ['...gg...', '..gggg..', '.gggggg.', 'gggggggg', '.gggggg.', 's..s..s.', '..s..s..', 's..s..s.'],
  storm: ['...kk...', '..kkkk..', '.kkkkkk.', 'kkkkkkkk', '.kkllkk.', '...ll...', '..ll....', '.l......'],
  fog: ['........', 'gggggg..', '........', '..gggggg', '........', 'gggggg..', '........', '..gggggg'],
};
const TURN_LEFT = ['..i.....', '.ii.....', 'iiiiii..', '.ii...i.', '..i....i', '.......i', '......i.', '..iiii..'];
const HOUSE = ['...ii...', '..iiii..', '.iiiiii.', 'iiiiiiii', '.i....i.', '.i.ii.i.', '.i.ii.i.', '.iiiiii.'];

function PixelGlyph({ rows, flip = false, size = 16 }) {
  const n = rows.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[ch]} />))
      )}
    </svg>
  );
}

function WeatherIcon({ icon }) {
  return (
    <span className={styles.icon}>
      <PixelGlyph rows={ICONS[icon] || ICONS.sun} />
    </span>
  );
}
