'use client';

// The homepage: an old-school desktop with folders that open into windows.
// The folders and links come from tree.json (see scripts/add-link.mjs).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DitherDefs } from './icons';
import Figurine from './Figurine';
import styles from './desktop.module.css';

const SITE_NAME = 'dominic_my_website';
const WINDOW_W = 480;

const cx = (...names) => names.filter(Boolean).join(' ');
const isFolder = (item) => Array.isArray(item.items);
const visible = (items) => (items || []).filter((item) => !item.hidden);
const isExternal = (href) => /^https?:\/\//.test(href);
const joinPath = (scope, name) => (scope ? `${scope}/${name}` : name);
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function findFolder(root, path) {
  if (!path) return root;
  let node = root;
  for (const name of path.split('/')) {
    node = visible(node.items).find((item) => isFolder(item) && item.name === name);
    if (!node) return null;
  }
  return node;
}

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
function decodeHash(hash) {
  try {
    return hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean).join('/');
  } catch {
    return '';
  }
}

// Each request to focus a window gets a new number, so asking again moves focus again.
let focusSeq = 0;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Where a new window goes: cascaded from the top left, kept on screen.
function placeWindow(count, area) {
  const w = Math.min(WINDOW_W, area.w - 24);
  const start = area.w >= 800 ? 64 : 12;
  const x = clamp(start + count * 24, 12, Math.max(12, area.w - w - 12));
  const y = clamp(16 + count * 24, 12, Math.max(12, area.h - 160));
  return { x, y };
}

export default function Desktop({ tree, fontClass }) {
  const areaRef = useRef(null);
  const lastPointer = useRef('mouse');
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [windows, setWindows] = useState([]); // last one is in front
  const [selected, setSelected] = useState(null);
  const [restored, setRestored] = useState(false);

  // Track the desktop's size, so windows stay reachable after a resize.
  useEffect(() => {
    const el = areaRef.current;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openFolder = useCallback(
    (path, originEl, { focus = true } = {}) => {
      const focusId = focus ? ++focusSeq : 0;
      if (!findFolder(tree, path)) return;
      const el = areaRef.current;
      let origin = null;
      if (originEl && el) {
        const a = el.getBoundingClientRect();
        const r = originEl.getBoundingClientRect();
        origin = { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height };
      }
      const size = { w: el.clientWidth, h: el.clientHeight };
      setWindows((wins) => {
        const open = wins.find((w) => w.path === path);
        if (open) return [...wins.filter((w) => w !== open), { ...open, focus: focusId || open.focus }];
        return [...wins, { path, ...placeWindow(wins.length, size), zoomed: false, origin, focus: focusId }];
      });
    },
    [tree]
  );

  const closeWindow = useCallback((path) => {
    setWindows((wins) => wins.filter((w) => w.path !== path));
    // Give focus back to the folder icon, or to the window now in front.
    requestAnimationFrame(() => {
      const icon = document.querySelector(`[data-folder="${CSS.escape(path)}"]`);
      const front = areaRef.current?.querySelector('[role="dialog"]:last-of-type');
      (icon || front)?.focus();
    });
  }, []);

  const toFront = useCallback((path) => {
    setWindows((wins) => {
      const i = wins.findIndex((w) => w.path === path);
      if (i === -1 || i === wins.length - 1) return wins;
      return [...wins.filter((w) => w.path !== path), wins[i]];
    });
  }, []);

  const moveWindow = useCallback((path, x, y) => {
    setWindows((wins) => wins.map((w) => (w.path === path ? { ...w, x, y } : w)));
  }, []);

  const toggleZoom = useCallback((path) => {
    setWindows((wins) => wins.map((w) => (w.path === path ? { ...w, zoomed: !w.zoomed } : w)));
  }, []);

  // Open the folder named in the address (#untitled%20folder/sub), and each folder above it.
  const openFromHash = useCallback(() => {
    const path = decodeHash(window.location.hash);
    if (!path || !findFolder(tree, path)) return;
    const segs = path.split('/');
    segs.forEach((_, i) => openFolder(segs.slice(0, i + 1).join('/'), null, { focus: false }));
  }, [tree, openFolder]);

  useEffect(() => {
    openFromHash();
    setRestored(true);
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [openFromHash]);

  // Keep the address on the folder in front, so it can be shared.
  useEffect(() => {
    if (!restored) return;
    const front = windows[windows.length - 1];
    const hash = front ? `#${encodePath(front.path)}` : '';
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [windows, restored]);

  const ctx = {
    selected,
    select: setSelected,
    openFolder,
    isOpen: (path) => windows.some((w) => w.path === path),
    lastPointer,
  };

  // A click on empty space (not on an icon or a box) clears the selection.
  const clearIfBackground = (e) => {
    if (!e.target.closest('a, button')) setSelected(null);
  };

  return (
    <div
      className={cx(styles.root, fontClass)}
      onPointerDownCapture={(e) => {
        lastPointer.current = e.pointerType || 'mouse';
      }}
    >
      <DitherDefs />
      <header className={styles.menubar}>
        <span className={styles.menuTitle}>{SITE_NAME}</span>
        <Clock />
      </header>
      <main className={styles.desktop} ref={areaRef} onClick={clearIfBackground}>
        <h1 className={styles.visuallyHidden}>{SITE_NAME}</h1>
        <ItemGrid items={tree.items} scope="" ctx={ctx} className={styles.desktopIcons} label="Desktop" />
        {windows.map((win, i) => {
          const folder = findFolder(tree, win.path);
          if (!folder) return null;
          return (
            <FolderWindow
              key={win.path}
              win={win}
              folder={folder}
              area={area}
              areaRef={areaRef}
              z={10 + i}
              active={i === windows.length - 1}
              ctx={ctx}
              onFront={toFront}
              onClose={closeWindow}
              onMove={moveWindow}
              onZoom={toggleZoom}
            />
          );
        })}
      </main>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return <span className={styles.clock}>{time}</span>;
}

function ItemGrid({ items, scope, ctx, className, label }) {
  return (
    <ul className={className} aria-label={label}>
      {visible(items).map((item) => (
        <li key={item.name}>
          <Item item={item} path={joinPath(scope, item.name)} ctx={ctx} />
        </li>
      ))}
    </ul>
  );
}

// Mouse: click selects, double-click opens. Touch, pen and keyboard: one tap or Enter opens.
function Item({ item, path, ctx }) {
  const folder = isFolder(item);
  const open = folder && ctx.isOpen(path);
  const className = cx(
    styles.item,
    ctx.selected === path && styles.selected,
    open && styles.open,
    !folder && isExternal(item.href) && styles.alias
  );
  const direct = (e) => e.detail === 0 || ctx.lastPointer.current === 'touch' || ctx.lastPointer.current === 'pen';
  const icon = (
    <Figurine
      name={item.name}
      kind={folder ? 'folder' : 'document'}
      selected={ctx.selected === path}
      open={open}
      lineClass={styles.iconLine}
      fillClass={styles.iconFill}
    />
  );
  const label = <span className={styles.label}>{item.name}</span>;

  if (folder) {
    return (
      <button
        type="button"
        className={className}
        data-folder={path}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => (direct(e) ? ctx.openFolder(path, e.currentTarget) : ctx.select(path))}
        onDoubleClick={(e) => ctx.openFolder(path, e.currentTarget)}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <a
      href={item.href}
      className={className}
      onClick={(e) => {
        if (direct(e) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        ctx.select(path);
      }}
      onDoubleClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        window.location.assign(item.href);
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function FolderWindow({ win, folder, area, areaRef, z, active, ctx, onFront, onClose, onMove, onZoom }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const name = nameOf(win.path);
  const count = visible(folder.items).length;

  const w = win.zoomed ? area.w - 16 : Math.min(WINDOW_W, area.w - 24);
  const x = win.zoomed ? 8 : clamp(win.x, 48 - w, area.w - 48);
  const y = win.zoomed ? 8 : clamp(win.y, 0, Math.max(0, area.h - 24));
  const style = win.zoomed
    ? { left: x, top: y, width: w, height: area.h - 16, zIndex: z }
    : { left: x, top: y, width: w, maxHeight: Math.max(120, area.h - y - 12), zIndex: z };

  // Zoom rectangles from the folder icon to the window, then focus the window.
  useLayoutEffect(() => {
    const el = ref.current;
    const host = areaRef.current;
    const o = win.origin;
    if (o && host && !prefersReducedMotion()) {
      const t = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      const frames = [
        { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, height: `${o.h}px` },
        { left: `${t.x}px`, top: `${t.y}px`, width: `${t.w}px`, height: `${t.h}px` },
      ];
      const duration = 180;
      [0, 40, 80].forEach((delay) => {
        const r = document.createElement('div');
        r.className = styles.zoomRect;
        host.appendChild(r);
        const anim = r.animate(frames, { duration, delay, easing: 'steps(6, end)', fill: 'both' });
        anim.onfinish = anim.oncancel = () => r.remove();
      });
      el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: duration + 80 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!win.focus) return;
    const first = ref.current.querySelector(`.${styles.windowBody} a, .${styles.windowBody} button`);
    (first || ref.current).focus({ preventScroll: true });
  }, [win.focus]);

  const onTitleDown = (e) => {
    if (win.zoomed || e.button !== 0 || e.target.closest('button')) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; the drag still follows moves over the title bar.
    }
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x, y };
  };
  const onTitleMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    onMove(win.path, d.x + e.clientX - d.sx, d.y + e.clientY - d.sy);
  };
  const onTitleUp = () => {
    drag.current = null;
  };

  return (
    <section
      ref={ref}
      role="dialog"
      aria-label={name}
      tabIndex={-1}
      className={cx(styles.window, active && styles.active)}
      style={style}
      onPointerDown={() => onFront(win.path)}
      onFocusCapture={() => onFront(win.path)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose(win.path);
        }
      }}
    >
      <div
        className={styles.titlebar}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
      >
        <button type="button" className={styles.closeBox} aria-label={`Close ${name}`} onClick={() => onClose(win.path)} />
        <h2 className={styles.title}>
          <span>{name}</span>
        </h2>
        <button
          type="button"
          className={styles.zoomBox}
          aria-label={win.zoomed ? `Restore ${name}` : `Zoom ${name}`}
          aria-pressed={win.zoomed}
          onClick={() => onZoom(win.path)}
        />
      </div>
      <div className={styles.infobar}>
        {count} {count === 1 ? 'item' : 'items'}
      </div>
      <div className={styles.windowBody}>
        <ItemGrid items={folder.items} scope={win.path} ctx={ctx} className={styles.windowIcons} label={name} />
      </div>
    </section>
  );
}
