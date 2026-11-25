'use client';

import { useEffect, useRef } from 'react';
import { MODELS } from '../desktop/models';
import { SIZE, PX, REST_ANGLE, prepare, draw } from '../desktop/render-figurine';

const ANGLES = [REST_ANGLE, REST_ANGLE + Math.PI / 2, REST_ANGLE + Math.PI, REST_ANGLE + (3 * Math.PI) / 2];

function Cell({ name, angle }) {
  const ref = useRef(null);
  useEffect(() => {
    prepare(name).then((ok) => ok && draw(ref.current, name, { angle }));
  }, [name, angle]);
  return (
    <canvas
      ref={ref}
      width={PX}
      height={PX}
      style={{ width: SIZE * 2, height: SIZE * 2, background: '#f00' }}
    />
  );
}

export default function Sheet({ only }) {
  const names = Object.keys(MODELS).filter((n) => !only || n === only);
  return (
    <div style={{ padding: 16, fontFamily: 'monospace', background: '#fff' }}>
      {names.map((name) => (
        <section key={name} style={{ marginBottom: 12 }}>
          <div>{name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            {ANGLES.map((a) => (
              <Cell key={a} name={name} angle={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
