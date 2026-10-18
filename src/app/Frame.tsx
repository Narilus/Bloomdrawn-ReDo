import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { HEIGHT, WIDTH, type Fit, type Point } from '../stage/layout.ts';

interface FrameApi {
  fit: Fit;
  /** Screen-space layer behind the frame for the canvas, which must not be CSS-scaled. */
  stageHost: HTMLElement | null;
  /** Converts a pointer position to logical frame coordinates. */
  toLogical: (e: { clientX: number; clientY: number }) => Point;
}

/**
 * Fits 1920×1080 into the window. The device-pixel width is a multiple of 16, so the 16:9 height
 * is whole too, and the offsets are floored to whole device pixels: a canvas at a fractional size
 * or position gets resampled by the browser and goes soft.
 */
export function computeFit(innerWidth: number, innerHeight: number, dpr: number): Fit {
  const raw = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  const deviceWidth = Math.max(16, Math.floor((WIDTH * raw * dpr) / 16) * 16);
  const width = deviceWidth / dpr;
  const height = (deviceWidth * HEIGHT) / WIDTH / dpr;
  return {
    scale: width / WIDTH,
    width,
    height,
    left: Math.floor(((innerWidth - width) / 2) * dpr) / dpr,
    top: Math.floor(((innerHeight - height) / 2) * dpr) / dpr,
    dpr,
  };
}

const fitWindow = () => computeFit(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);

const FrameContext = createContext<FrameApi>({
  fit: computeFit(WIDTH, HEIGHT, 1),
  stageHost: null,
  toLogical: (e) => ({ x: e.clientX, y: e.clientY }),
});
export const useFrame = () => useContext(FrameContext);

/** A 1920×1080 logical frame, scaled to fit the window and centred. */
export function Frame({ children }: { children: ReactNode }) {
  const [fit, setFit] = useState(fitWindow);
  const [stageHost, setStageHost] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setFit(fitWindow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const api: FrameApi = {
    fit,
    stageHost,
    toLogical: (e) => {
      const rect = ref.current?.getBoundingClientRect();
      return rect ? { x: (e.clientX - rect.left) / fit.scale, y: (e.clientY - rect.top) / fit.scale } : { x: 0, y: 0 };
    },
  };

  return (
    <div className="frame-outer">
      <div ref={setStageHost} className="stage-layer" style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }} />
      <div
        ref={ref}
        className="frame"
        style={{ width: WIDTH, height: HEIGHT, transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})` }}
      >
        <FrameContext.Provider value={api}>{children}</FrameContext.Provider>
      </div>
    </div>
  );
}
