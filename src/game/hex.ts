// Hex coordinates for the Labyrinth: axial (q, r), pointy-top. A tile is addressed by its key "q,r",
// so boards stay plain JSON.

export interface Hex {
  q: number;
  r: number;
}

export const hexKey = ({ q, r }: Hex): string => `${q},${r}`;

export function parseHex(key: string): Hex {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

/** The six neighbours' offsets, clockwise from east. */
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const neighbours = (h: Hex): Hex[] => DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
