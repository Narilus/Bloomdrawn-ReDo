import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { CombatState } from '../engine/index.ts';
import { Battlefield } from './Battlefield.ts';
import { HEIGHT, WIDTH } from './layout.ts';

interface Props {
  /** Read once at mount; remount (change `key`) for a new combat. */
  initialState: CombatState;
  /** Current frame scale, so the canvas renders at device resolution. */
  scale: number;
  onReady: (field: Battlefield | null) => void;
}

/** Mounts the PixiJS battlefield directly inside a React component. */
export function StageView({ initialState, scale, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const init = useRef({ initialState, scale, onReady });

  useEffect(() => {
    const { initialState: state, scale: s, onReady: ready } = init.current;
    const app = new Application();
    let field: Battlefield | null = null;
    let cancelled = false;
    const started = app
      .init({ width: WIDTH, height: HEIGHT, resolution: s * window.devicePixelRatio, autoDensity: true, antialias: true, background: '#1E1519' })
      .then(async () => {
        if (cancelled) return;
        host.current?.appendChild(app.canvas);
        appRef.current = app;
        field = await Battlefield.create(app, state);
        if (cancelled) return;
        ready(field);
      });
    return () => {
      cancelled = true;
      ready(null);
      void started.then(() => {
        field?.destroy();
        appRef.current = null;
        app.destroy(true, { children: true });
      });
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    app.renderer.resolution = scale * window.devicePixelRatio;
    app.renderer.resize(WIDTH, HEIGHT);
  }, [scale]);

  return <div ref={host} className="stage" />;
}
