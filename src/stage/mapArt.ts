import { DEPTH_BAND } from '../game/depth.ts';

// Labyrinth map art (M6.11; owner, 28 Nov). Each hex is a slab cut from its band's floor
// (`floor-band1.webp`…), at an offset and turn of its own so neighbouring slabs differ; tiles with
// contents carry a symbol (`fight.png`, `shop.png`…) on a drawn gold-rimmed disc, except a Collapsing
// tile, which has cracks painted over its whole slab (`cracks.png`); the party is a painted marker (`party.png`). Without art, the map keeps its drawn colours and labels.

const FLOORS = import.meta.glob<string>('../assets/map/floor-band*.webp', { eager: true, query: '?url', import: 'default' });
const ICONS = import.meta.glob<string>('../assets/map/*.png', { eager: true, query: '?url', import: 'default' });
const byName = (files: Record<string, string>, ext: string) => new Map(Object.entries(files).map(([path, url]) => [new RegExp(`([^/]+)\\.${ext}$`).exec(path)?.[1] ?? '', url]));
const FLOOR_URLS = byName(FLOORS, 'webp');
const ICON_URLS = byName(ICONS, 'png');

/** The band a run's depth is in, from 1. */
export const bandOf = (depth: number): number => Math.ceil(Math.max(1, depth) / DEPTH_BAND);

export interface MapArt {
  /** The floor texture for a band, if it has one. */
  floor: (band: number) => string | undefined;
  /** A tile kind's symbol, `party` for the party's marker, or `cracks` for a Collapsing tile's overlay. */
  icon: (kind: string) => string | undefined;
}

/** The game's own map art: a band past the last with a floor keeps the deepest one there is. */
export const mapArt: MapArt = {
  floor: (band) => {
    for (let b = band; b >= 1; b--) {
      const url = FLOOR_URLS.get(`floor-band${b}`);
      if (url) return url;
    }
    return undefined;
  },
  icon: (kind) => ICON_URLS.get(kind),
};

/** Where a tile's slab is cut from its floor: a point well inside the texture, and a turn of 0–5 sixths, both fixed by the tile's key. */
export function slab(key: string, room: number): { x: number; y: number; turn: number } {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  return { x: next() * room, y: next() * room, turn: Math.floor(next() * 6) };
}
