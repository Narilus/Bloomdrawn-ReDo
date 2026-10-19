import { hexKey, type Hex } from './hex.ts';

// Motifs are drawn as text: one string per row of hexes, cells two characters apart, odd rows
// shifted right by one character (pointy-top hexes, "odd-r" offset). Legend:
//
//   E  the joint: where the motif meets the previous exit or a socket (the entrance, in a start motif)
//   X  the exit: where the next route motif joins
//   o  a socket: a path tile where a side motif may join
//   .  path         F  fight      L  elite     B  boss
//   V  event        S  shop       C  camp      Y  Symptom     K  Collapsing
//
// A space is no tile. Example (a fork around a fight):
//
//   "  . F .  "
//   " E     . X"
//   "  . V .  "

export type Role = 'joint' | 'exit' | 'socket' | 'path' | 'fight' | 'elite' | 'boss' | 'event' | 'shop' | 'camp' | 'symptom' | 'collapsing';

export const LEGEND: Readonly<Record<string, Role>> = {
  E: 'joint',
  X: 'exit',
  o: 'socket',
  '.': 'path',
  F: 'fight',
  L: 'elite',
  B: 'boss',
  V: 'event',
  S: 'shop',
  C: 'camp',
  Y: 'symptom',
  K: 'collapsing',
};

export interface ParsedMotif {
  /** Roles by hex key, with the joint at 0,0. */
  tiles: Record<string, Role>;
  exit?: string;
  sockets: string[];
}

/** Parses a drawn motif. Throws on a malformed drawing, naming the row and column. */
export function parseMotif(rows: readonly string[]): ParsedMotif {
  const cells: { hex: Hex; role: Role }[] = [];
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const char = row[i]!;
      if (char === ' ') continue;
      const role = LEGEND[char];
      if (!role) throw new Error(`Row ${y}, column ${i}: unknown cell "${char}".`);
      if ((i - (y & 1)) % 2 !== 0) throw new Error(`Row ${y}, column ${i}: "${char}" is between cells.`);
      const x = (i - (y & 1)) / 2;
      // Odd-r offset to axial.
      cells.push({ hex: { q: x - (y - (y & 1)) / 2, r: y }, role });
    }
  });
  const joints = cells.filter((c) => c.role === 'joint');
  if (joints.length !== 1) throw new Error(`A motif needs exactly one E; found ${joints.length}.`);
  const exits = cells.filter((c) => c.role === 'exit');
  if (exits.length > 1) throw new Error(`A motif has at most one X; found ${exits.length}.`);
  const origin = joints[0]!.hex;
  const local = (h: Hex) => hexKey({ q: h.q - origin.q, r: h.r - origin.r });
  const tiles = Object.fromEntries(cells.map((c) => [local(c.hex), c.role]));
  const exit = exits[0] && local(exits[0].hex);
  const sockets = cells.filter((c) => c.role === 'socket').map((c) => local(c.hex));
  return exit === undefined ? { tiles, sockets } : { tiles, exit, sockets };
}

/** Rotates a hex by `turns` sixths of a turn clockwise about 0,0. */
export function rotate(h: Hex, turns: number): Hex {
  let { q, r } = h;
  for (let i = 0; i < ((turns % 6) + 6) % 6; i++) [q, r] = [-r, q + r];
  return { q, r };
}
