import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CombatState } from '../engine/index.ts';
import { Battlefield } from './Battlefield.ts';
import type { Fit } from './layout.ts';

interface Props {
  /** Read once at mount; remount (change `key`) for a new combat. */
  initialState: CombatState;
  /** Where the frame sits on screen. The canvas is sized to it exactly and scales its own content. */
  fit: Fit;
  /** A screen-space element outside any CSS transform, so the canvas is never resampled. */
  host: HTMLElement;
  onReady: (field: Battlefield | null) => void;
}

/** Mounts the PixiJS battlefield directly inside a React component. */
export function StageView({ initialState, fit, host, onReady }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const fieldRef = useRef<Battlefield | null>(null);
  const init = useRef({ initialState, fit, onReady });
  // The latest fit, for an app that finishes starting after a resize.
  const latest = useRef(fit);

  useEffect(() => {
    const { initialState: state, fit: f, onReady: ready } = init.current;
    const app = new Application();
    let field: Battlefield | null = null;
    let cancelled = false;
    const started = app
      .init({ width: f.width, height: f.height, resolution: f.dpr, autoDensity: true, antialias: true, background: '#1E1519' })
      .then(async () => {
        if (cancelled) return;
        applyFit(app, latest.current);
        mount.current?.appendChild(app.canvas);
        appRef.current = app;
        field = await Battlefield.create(app, state);
        if (cancelled) return;
        field.fitTo(latest.current);
        fieldRef.current = field;
        ready(field);
      });
    return () => {
      cancelled = true;
      ready(null);
      void started.then(() => {
        field?.destroy();
        // Under StrictMode this cleanup can run after the remounted app has set the refs; only
        // clear our own, or the live canvas never hears about a resize again.
        if (appRef.current === app) appRef.current = null;
        if (fieldRef.current === field) fieldRef.current = null;
        app.destroy(true, { children: true });
      });
    };
  }, []);

  useEffect(() => {
    latest.current = fit;
    if (appRef.current) applyFit(appRef.current, fit);
    fieldRef.current?.fitTo(fit);
  }, [fit]);

  return createPortal(<div ref={mount} className="stage" />, host);
}

function applyFit(app: Application, fit: Fit) {
  app.renderer.resolution = fit.dpr;
  app.renderer.resize(fit.width, fit.height);
  app.stage.scale.set(fit.scale);
}
