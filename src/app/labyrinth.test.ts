import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import type { Board, TileKind } from '../game/board.ts';
import { hexKey, neighbours, parseHex } from '../game/hex.ts';
import { findStranding, generateBoard, M3_LABYRINTH } from '../game/labyrinth.ts';
import { parseMotif } from '../game/motif.ts';

// The M3 board with the real motifs (src/content/motifs/). Here because the game layer may not
// import content.

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const boards = SEEDS.map((seed) => generateBoard(seed, M3_LABYRINTH, registry.motifs));

/** Steps from the entrance to every tile it can reach, never entering a tile `blocked` refuses. */
function distances(board: Board, blocked: (kind: TileKind) => boolean = () => false): Map<string, number> {
  const out = new Map([[board.at, 0]]);
  const queue = [board.at];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const n of neighbours(parseHex(here)).map(hexKey)) {
      const tile = board.tiles[n];
      if (!tile || out.has(n) || blocked(tile.kind)) continue;
      out.set(n, out.get(here)! + 1);
      queue.push(n);
    }
  }
  return out;
}
const count = (board: Board, kind: TileKind) => Object.values(board.tiles).filter((t) => t.kind === kind).length;
const range = (values: number[]) => [Math.min(...values), Math.max(...values)];

describe('the M3 Labyrinth', () => {
  it('every motif parses', () => {
    for (const m of Object.values(registry.motifs)) expect(() => parseMotif(m.rows), m.id).not.toThrow();
  });

  it('never strands the player, and every tile can be reached', () => {
    for (const [i, board] of boards.entries()) {
      expect(findStranding(board), `seed ${SEEDS[i]}`).toBeUndefined();
      expect(distances(board).size, `seed ${SEEDS[i]}`).toBe(Object.keys(board.tiles).length);
    }
  });

  it("stays within the owner's baseline (docs/notes/m3-labyrinth.md)", () => {
    const boss = (b: Board) => Object.keys(b.tiles).find((k) => b.tiles[k]!.kind === 'boss')!;
    const tiles = range(boards.map((b) => Object.keys(b.tiles).length));
    expect(tiles[0]).toBeGreaterThanOrEqual(60);
    expect(tiles[1]).toBeLessThanOrEqual(80);
    const steps = range(boards.map((b) => distances(b).get(boss(b))!));
    expect(steps[0]).toBeGreaterThanOrEqual(14);
    expect(steps[1]).toBeLessThanOrEqual(18);
    const fights = range(boards.map((b) => count(b, 'fight')));
    expect(fights[0]).toBeGreaterThanOrEqual(5);
    expect(fights[1]).toBeLessThanOrEqual(7);
    for (const [kind, low, high] of [['elite', 2, 2], ['event', 3, 4], ['shop', 1, 2], ['camp', 2, 2], ['symptom', 1, 2], ['boss', 1, 1]] as const) {
      const [min, max] = range(boards.map((b) => count(b, kind)));
      expect(min, kind).toBeGreaterThanOrEqual(low);
      expect(max, kind).toBeLessThanOrEqual(high);
    }
  });

  it("the temptation loop's Shop can't be reached without a Collapsing tile or the Symptom", () => {
    for (const [i, board] of boards.entries()) {
      const free = distances(board, (kind) => kind === 'collapsing' || kind === 'symptom');
      const shops = Object.keys(board.tiles).filter((k) => board.tiles[k]!.kind === 'shop');
      expect(shops.filter((k) => !free.has(k)), `seed ${SEEDS[i]}`).toHaveLength(1);
    }
  });

  it('fills fights from the pools without repeats while they last, and every encounter exists', () => {
    for (const board of boards) {
      for (const tile of Object.values(board.tiles)) {
        if (tile.kind === 'fight' || tile.kind === 'elite' || tile.kind === 'boss') expect(registry.encounters[tile.content!]).toBeDefined();
      }
      const elites = Object.values(board.tiles).filter((t) => t.kind === 'elite').map((t) => t.content);
      expect(new Set(elites).size).toBe(elites.length);
    }
  });
});
