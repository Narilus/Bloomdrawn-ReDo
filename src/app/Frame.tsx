import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { HEIGHT, WIDTH, type Point } from '../stage/layout.ts';

interface FrameApi {
  scale: number;
  /** Converts a pointer position to logical frame coordinates. */
  toLogical: (e: { clientX: number; clientY: number }) => Point;
}

const FrameContext = createContext<FrameApi>({ scale: 1, toLogical: (e) => ({ x: e.clientX, y: e.clientY }) });
export const useFrame = () => useContext(FrameContext);

const fit = () => Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);

/** A 1920×1080 logical frame, scaled to fit the window and centred. */
export function Frame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fit);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const api: FrameApi = {
    scale,
    toLogical: (e) => {
      const rect = ref.current?.getBoundingClientRect();
      return rect ? { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale } : { x: 0, y: 0 };
    },
  };

  return (
    <div className="frame-outer">
      <div
        ref={ref}
        className="frame"
        style={{
          width: WIDTH,
          height: HEIGHT,
          transform: `translate(${(window.innerWidth - WIDTH * scale) / 2}px, ${(window.innerHeight - HEIGHT * scale) / 2}px) scale(${scale})`,
        }}
      >
        <FrameContext.Provider value={api}>{children}</FrameContext.Provider>
      </div>
    </div>
  );
}
