import { DEPTH_BAND } from '../game/depth.ts';

// Battle backgrounds (M6.11; docs/notes/battle-backgrounds.md; owner, 27 Nov). Each band of depths
// has a biome with a pool of scenes (`band1-1.webp`, `band1-2.webp`…) that its fights and elites
// draw from, and a Boss may have its own, one or a pool (`hollow-abbess.webp`, or `hollow-abbess-1.webp`,
// `hollow-abbess-2.webp`…, after its encounter). A band without art yet keeps the drawn backdrop.

const FILES = import.meta.glob<string>('../assets/scenes/*.webp', { eager: true, query: '?url', import: 'default' });
const URLS = new Map(Object.entries(FILES).map(([path, url]) => [/([^/]+)\.webp$/.exec(path)?.[1] ?? '', url]));

export interface SceneFor {
  /** The fight's depth (a Trial's level), which sets its band. */
  depth: number;
  /** The Boss fight's encounter ID, for a scene of its own. */
  boss?: string | undefined;
  /** The fight's seed, which picks from the pool, so a resumed fight keeps its scene. */
  seed: number;
}

/** The scene a fight stands in, from the scenes there are: one of a Boss's own, else one of its band's pool, else none. */
export function sceneName(names: readonly string[], { depth, boss, seed }: SceneFor): string | undefined {
  const own = boss?.replace(/^encounter\./, '');
  const band = Math.ceil(Math.max(1, depth) / DEPTH_BAND);
  return (own ? pick(names, own, seed) : undefined) ?? pick(names, `band${band}`, seed);
}

/** The fight's seed picks from the scenes named `<base>` or `<base>-<n>`. */
function pick(names: readonly string[], base: string, seed: number): string | undefined {
  const pool = names.filter((name) => name === base || new RegExp(`^${base}-\\d+$`).test(name)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return pool.length > 0 ? pool[Math.abs(Math.trunc(seed)) % pool.length] : undefined;
}

/** The URL of a fight's scene, if there is one. */
export const sceneUrl = (fight: SceneFor): string | undefined => URLS.get(sceneName([...URLS.keys()], fight) ?? '');
