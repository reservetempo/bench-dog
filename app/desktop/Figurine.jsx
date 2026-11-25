'use client';

// A homepage icon drawn as a colourful low-poly figurine (see render-figurine.js and models/). It rests at a
// three-quarter view and turns while hovered or selected. Until it's drawn, and wherever WebGL
// or the model is missing, the pixel folder or document icon stands in.

import { useEffect, useRef, useState } from 'react';
import { PixelIcon } from './icons';
import { SIZE, PX, REST_ANGLE, hasModel, prepare, draw } from './render-figurine';

const TURN = 1.4; // radians per second

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Figurine({ name, kind, selected, open, lineClass, fillClass }) {
  const canvasRef = useRef(null);
  const angle = useRef(REST_ANGLE);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const model = hasModel(name);

  useEffect(() => {
    if (!model) return undefined;
    let live = true;
    prepare(name).then((ok) => live && setReady(ok));
    return () => {
      live = false;
    };
  }, [name, model]);

  // Hovering anywhere on the icon, label included, turns the figurine.
  useEffect(() => {
    const item = ready && canvasRef.current?.parentElement;
    if (!item) return undefined;
    const on = () => setHover(true);
    const off = () => setHover(false);
    item.addEventListener('pointerenter', on);
    item.addEventListener('pointerleave', off);
    return () => {
      item.removeEventListener('pointerenter', on);
      item.removeEventListener('pointerleave', off);
    };
  }, [ready]);

  const spinning = ready && (hover || selected) && !reducedMotion();

  useEffect(() => {
    if (!ready) return undefined;
    const colours = { selected, open };
    if (!spinning) {
      draw(canvasRef.current, name, { ...colours, angle: angle.current });
      return undefined;
    }
    let raf = 0;
    let last = performance.now();
    let busy = false;
    const tick = (now) => {
      angle.current += ((now - last) / 1000) * TURN;
      last = now;
      if (!busy && canvasRef.current) {
        busy = true;
        draw(canvasRef.current, name, { ...colours, angle: angle.current }).finally(() => {
          busy = false;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, spinning, selected, open, name]);

  if (!model || !ready) {
    // The same footprint as a figurine, so nothing moves when one is drawn.
    return (
      <span style={{ display: 'grid', placeItems: 'center', width: SIZE, height: SIZE }}>
        <PixelIcon kind={kind} lineClass={lineClass} fillClass={fillClass} />
      </span>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={PX}
      height={PX}
      aria-hidden="true"
      style={{ display: 'block', width: SIZE, height: SIZE }}
    />
  );
}
