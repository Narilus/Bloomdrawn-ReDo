import { describe, expect, it } from 'vitest';
import { createStreams } from '../engine/index.ts';
import { bloomTick, bossDirection, stageOf, ticksToNext } from './bloom.ts';
import { createBoard, type Board, type Tile } from './board.ts';
import { hexKey } from './hex.ts';

const row = (...kinds: Tile['kind'][]) => Object.fromEntries(kinds.map((kind, q) => [hexKey({ q, r: 0 }), { kind }]));
const pools = { elite: ['elite.a'] };
const rng = () => createStreams(7, ['bloom'] as const);
const tickFrom = (board: Board, before: number, streams = rng()) => bloomTick(board, before, streams, 'bloom', pools);

describe('the Bloom clock', () => {
  it('moves through its stages at 3, 6, 9 and 12 ticks', () => {
    expect([0, 2, 3, 5, 6, 8, 9, 11, 12, 30].map((n) => stageOf(n).id)).toEqual([
      'dormant',
      'dormant',
      'seeded',
      'seeded',
      'rooted',
      'rooted',
      'flowering',
      'flowering',
      'fruiting',
      'fruiting',
    ]);
    expect([0, 2, 3, 11, 12].map(ticksToNext)).toEqual([3, 1, 3, 1, undefined]);
  });

  it('scales enemies more at each stage', () => {
    const scales = [0, 3, 6, 9, 12].map((n) => stageOf(n).enemyScale);
    expect(scales).toEqual([0, 10, 20, 35, 50]);
  });

  it('shows the way to the Boss from Flowering on', () => {
    const board = createBoard(row('entrance', 'path', 'boss'), '0,0');
    expect(bossDirection(board, 8)).toBeUndefined();
    expect(bossDirection(board, 9)).toBe('2,0');
  });
});

describe('Flowering', () => {
  // Fights 1 and 2 away are known; fights 5 and more away are not.
  const kinds: Tile['kind'][] = ['entrance', 'fight', 'fight', 'path', 'path', ...Array<Tile['kind']>(40).fill('fight')];
  const board = createBoard(Object.fromEntries(kinds.map((kind, q) => [hexKey({ q, r: 0 }), { kind, ...(kind === 'fight' ? { content: 'fight.a' } : {}) }])), '0,0');

  it('on arrival, some unseen normal fights draw from the elite roster; fights already seen keep theirs', () => {
    const after = tickFrom(board, 8);
    const drawn = Object.keys(after.tiles).filter((k) => after.tiles[k]!.content === 'elite.a');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(40);
    expect(drawn.every((k) => !board.known.includes(k) && after.tiles[k]!.kind === 'fight')).toBe(true);
    expect([after.tiles['1,0']!.content, after.tiles['2,0']!.content]).toEqual(['fight.a', 'fight.a']);
  });

  it('draws only once, on the tick that reaches it', () => {
    expect(tickFrom(board, 7)).toEqual(board);
    expect(tickFrom(board, 9)).toEqual(board);
  });
});
