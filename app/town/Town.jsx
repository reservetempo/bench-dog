'use client';

// The homepage: a low-poly town on a plain. Each top-level folder in tree.json is one
// building; click it to go inside, where each item in the folder is a fixture (a server rack
// in the AI data center) with a name tag. Click a tag or a fixture for a card with a Visit
// button. The sun, clouds, rain, snow and the season follow Montreal's time and weather.
// Links: /#<folder> opens a folder's building straight away.

import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutTown, LABELS, prettyHref, isFolder, shown } from './layout';
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
const places = (n) => `${n} ${n === 1 ? 'place' : 'places'}`;

export default function Town({ tree, fontClass }) {
  const layout = useMemo(() => layoutTown(tree), [tree]);
  // Every building and every fixture inside one, by id.
  const byId = useMemo(() => {
    const m = new Map();
    for (const b of layout.buildings) {
      m.set(b.id, b);
      for (const f of b.fixtures) m.set(f.id, f);
    }
    return m;
  }, [layout]);

  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const tagsRef = useRef(null);
  const cardRef = useRef(null);
  const townRef = useRef(null);
  const tagEls = useRef(new Map());
  const handlers = useRef({});
  const overridesRef = useRef({});
  const conditionsRef = useRef(null);
  const instantRef = useRef(false);
  const restoredRef = useRef(false);
  const keyboardRef = useRef(false);
  const focusAfterRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [townId, setTownId] = useState(0); // bumps each time the 3D scene is (re)built
  const [inside, setInside] = useState(null); // the building being entered or shown (id)
  const [here, setHere] = useState(null); // the building whose inside is on screen (id)
  const [selected, setSelected] = useState(null); // building or fixture id
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(null);
  const [touched, setTouched] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const goal = inside ? byId.get(inside) : null;
  const room = here ? byId.get(here) : null;
  const sel = selected ? byId.get(selected) : null;
  const card = sel && sel.parent === here ? sel : null;
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

  // Build the 3D town once the clock is known (the season colours the plain).
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
        // A new scene starts outside: go straight into the open building.
        instantRef.current = true;
        setHere(null);
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

  // Keep the address on the open building, so it can be shared. (Declared before the effect
  // that reads the address, so it doesn't wipe the address before that has been read.)
  useEffect(() => {
    if (!restoredRef.current) return;
    let path = goal?.path ? encodePath(goal.path) : '';
    if (path && sel?.folder && sel.parent === inside) path += `/${encodeURIComponent(sel.name)}`;
    const hash = path ? `#${path}` : '';
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [goal, sel, inside]);

  // Open the building (and folder inside it) named in the address, now and when it changes.
  // An address changed to none (the Back button, say) goes back out to the town.
  useEffect(() => {
    const apply = (e) => {
      const [path, sub] = decodeHash(window.location.hash);
      const b = path && layout.buildings.find((x) => x.folder && x.path.toLowerCase() === path.toLowerCase());
      if (!b) {
        if (!path && e) {
          setInside(null);
          setSelected(null);
        }
        return;
      }
      setInside(b.id);
      const f = sub && b.fixtures.find((x) => x.folder && x.name === sub);
      setSelected(f ? f.id : null);
    };
    apply();
    restoredRef.current = true;
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [layout]);

  // Hand the place, the selection and the weather to the scene (again when it's rebuilt).
  useEffect(() => {
    townRef.current?.enter(inside, { instant: instantRef.current });
    if (townRef.current) instantRef.current = false;
  }, [inside, townId]);

  useEffect(() => {
    townRef.current?.select(selected);
  }, [selected, townId]);

  useEffect(() => {
    if (conditions) townRef.current?.setConditions(conditions);
  }, [conditions, townId]);

  // Keyboard users land on the first tag inside a building, or back on the building they
  // came out of, once that place is on screen; then on the card.
  useEffect(() => {
    const id = focusAfterRef.current ?? (room ? room.fixtures[0]?.id : null);
    focusAfterRef.current = null;
    if (keyboardRef.current && id) tagEls.current.get(id)?.focus();
  }, [room]);
  useEffect(() => {
    if (keyboardRef.current && card) cardRef.current?.querySelector('a, button:not([data-close])')?.focus();
  }, [card]);

  // Escape closes the card, then leaves the building.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selected) {
        // Focus moves once React has re-rendered.
        const id = selected;
        setSelected(null);
        setTimeout(() => tagEls.current.get(id)?.focus(), 0);
      } else if (inside) {
        keyboardRef.current = true;
        focusAfterRef.current = inside;
        setInside(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, inside]);

  const enterBuilding = (id, e) => {
    keyboardRef.current = e?.detail === 0;
    setTouched(true);
    setSelected(null);
    setInside(id);
  };
  const toggle = (id, e) => {
    keyboardRef.current = e?.detail === 0;
    setTouched(true);
    setSelected((s) => (s === id ? null : id));
  };
  const goHome = (e) => {
    keyboardRef.current = e?.detail === 0;
    setSelected(null);
    if (inside) {
      focusAfterRef.current = inside;
      setInside(null);
    } else townRef.current?.home();
  };

  // Put the floating tags and the card over the 3D view, every frame.
  function placeOverlay() {
    const town = townRef.current;
    if (!town) return;
    const veil = town.veil();
    if (tagsRef.current) tagsRef.current.style.opacity = veil > 0.002 ? String(1 - veil) : '';
    const where = town.where();
    const list = where == null ? layout.buildings : byId.get(where)?.fixtures || [];
    const raise = where == null ? 0.5 : 0.3;
    const els = tagEls.current;
    const setPos = (el, x, y, visible) => {
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
      el.style.visibility = visible ? 'visible' : 'hidden';
    };
    // Read every size first, then write, so the browser lays out once.
    const tags = [];
    for (const o of list) {
      const el = els.get(o.id);
      const a = el && town.anchor(o.id);
      if (!a) continue;
      const p = town.project(a.x, a.y + raise, a.z);
      tags.push({ el, x: p.x, y: p.y, visible: p.visible, w: el.offsetWidth, h: el.offsetHeight });
    }
    const cardEl = card ? cardRef.current : null;
    const cardSize = cardEl ? { w: cardEl.offsetWidth, h: cardEl.offsetHeight } : null;
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

    if (cardEl && W > 720) {
      const a = town.anchor(card.id);
      if (!a) return;
      const p = town.project(a.x, a.y * 0.45, a.z);
      let x = p.x + 90;
      if (x + cardSize.w > W - 12) x = p.x - 90 - cardSize.w;
      const y = Math.min(Math.max(p.y - cardSize.h / 2, 44), H - cardSize.h - 64);
      cardEl.style.transform = `translate3d(${Math.round(Math.max(12, x))}px, ${Math.round(y)}px, 0)`;
    } else if (cardEl) {
      cardEl.style.transform = '';
    }
  }

  handlers.current = {
    onPick(hit) {
      keyboardRef.current = false;
      setTouched(true);
      const o = hit.type === 'object' ? byId.get(hit.id) : null;
      if (!o) setSelected(null);
      else if (o.folder && o.parent == null) enterBuilding(o.id);
      else setSelected((s) => (s === o.id ? null : o.id));
    },
    onPlace(where) {
      setHere(where);
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
  const loose = layout.buildings.filter((b) => !b.folder);
  return (
    <div className={`${styles.root} ${fontClass || ''}`} ref={hostRef}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <header className={styles.bar}>
        <nav className={styles.crumbs} aria-label="Where you are">
          <button type="button" className={styles.crumbHome} onClick={goHome}>
            {SITE_NAME}
          </button>
          {goal && (
            <>
              <span className={styles.sep} aria-hidden="true">
                /
              </span>
              <span className={styles.crumbArea}>
                <span className={styles.swatch} style={{ background: goal.color }} aria-hidden="true" />
                {goal.name}
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
        <div className={styles.tags} ref={tagsRef}>
          {here == null &&
            layout.buildings.map((b) => (
              <button
                key={b.id}
                ref={tagRef(b.id)}
                type="button"
                className={`${styles.tag} ${styles.buildingTag} ${b.id === selected ? styles.tagOn : ''}`}
                aria-pressed={b.folder ? undefined : b.id === selected}
                aria-label={b.folder ? `${b.name}: go inside, ${places(b.fixtures.length)}` : undefined}
                onClick={(e) => (b.folder ? enterBuilding(b.id, e) : toggle(b.id, e))}
              >
                <span className={styles.swatch} style={{ background: b.color }} aria-hidden="true" />
                {b.name}
                {b.folder && (
                  <span className={styles.count} aria-hidden="true">
                    {b.fixtures.length}
                  </span>
                )}
              </button>
            ))}
          {room?.fixtures.map((f) => (
            <button
              key={f.id}
              ref={tagRef(f.id)}
              type="button"
              className={`${styles.tag} ${f.id === selected ? styles.tagOn : ''}`}
              aria-pressed={f.id === selected}
              onClick={(e) => toggle(f.id, e)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {card && (
        <div className={styles.card} ref={cardRef} role="dialog" aria-label={card.name}>
          <div className={styles.cardHead}>
            <span className={styles.cardKind}>{card.parent ? card.label : LABELS[card.theme]}</span>
            <button type="button" data-close className={styles.cardClose} aria-label="Close" onClick={() => setSelected(null)}>
              ×
            </button>
          </div>
          <h2 className={styles.cardTitle}>{card.name}</h2>
          {card.folder ? (
            <LinkList items={card.item.items} className={styles.cardList} />
          ) : (
            <>
              <p className={styles.cardHref}>{prettyHref(card.item.href)}</p>
              <a className={styles.visit} href={card.item.href}>
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
          <button type="button" className={styles.ctrl} aria-label={inside ? 'Back outside' : 'Whole town'} onClick={goHome}>
            <PixelGlyph rows={inside ? DOOR : HOUSE} />
          </button>
        </div>
      )}

      {status === 'ready' && (
        <p className={`${styles.hint} ${touched || inside ? styles.hintGone : ''}`} aria-hidden="true">
          {coarse ? 'drag to look around · pinch to zoom · tap a building to go in' : 'drag to look around · scroll to zoom · Q/E to turn · click a building to go in'}
        </p>
      )}

      {status === 'loading' && <p className={styles.loading}>building the town…</p>}

      <nav className={status === 'failed' ? styles.fallback : styles.visuallyHidden} aria-label="All pages">
        <h2>{status === 'failed' ? "The 3D town couldn't load here, so these are its pages:" : 'All pages'}</h2>
        {layout.buildings
          .filter((b) => b.folder)
          .map((b) => (
            <section key={b.id}>
              <h3>{b.name}</h3>
              <LinkList items={b.item.items} />
            </section>
          ))}
        {loose.length > 0 && (
          <section>
            <h3>town</h3>
            <LinkList items={loose.map((b) => b.item)} />
          </section>
        )}
      </nav>
    </div>
  );
}

function LinkList({ items, className }) {
  return (
    <ul className={className}>
      {shown(items).map((item) => (
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
const DOOR = ['.iiiiii.', '.i....i.', '.i....i.', '.i....i.', '.i..i.i.', '.i....i.', '.i....i.', 'iiiiiiii'];

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
