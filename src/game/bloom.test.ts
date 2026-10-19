import { describe, expect, it } from 'vitest';
import { createStreams } from '../engine/index.ts';
import { bloomTick, bossDirection, PODS, stageOf, ticksToNext } from './bloom.ts';
import { createBoard, routeTo, stopsOn, visibleKind, type Board, type Tile } from './board.ts';
import { hexDistance, hexKey, parseHex } from './hex.ts';

const row = (...kinds: Tile['kind'][]) => Object.fromEntries(kinds.map((kind, q) => [hexKey({ q, r: 0 }), { kind }]));
const pools = { fight: ['fight.a'], elite: ['elite.a'] };
const rng = () => createStreams(7, ['bloom'] as const);
const tickFrom = (board: Board, before: number, streams = rng()) => bloomTick(board, before, streams, 'bloom', pools);

/** A disc of path tiles of the given radius around 0,0, the party at the centre. */
function disc(radius: number): Board {
  const tiles: Record<string, Tile> = {};
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (hexDistance({ q: 0, r: 0 }, { q, r }) <= radius) tiles[hexKey({ q, r })] = { kind: 'path' };
    }
  }
  tiles['0,0'] = { kind: 'entrance' };
  return createBoard(tiles, '0,0');
}
const pods = (board: Board) => Object.keys(board.tiles).filter((k) => board.tiles[k]!.kind === 'pod');

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

describe('Fruiting', () => {
  it('swells pods on path tiles near the party with every tick, from the tick that reaches it', () => {
    const board = disc(5);
    expect(pods(tickFrom(board, 10))).toEqual([]);
    const first = tickFrom(board, 11);
    expect(pods(first)).toHaveLength(PODS.perTick);
    const second = tickFrom(first, 12);
    expect(pods(second)).toHaveLength(PODS.perTick * 2);
    for (const key of pods(second)) {
      expect(hexDistance(parseHex(key), { q: 0, r: 0 })).toBeLessThanOrEqual(PODS.within);
      expect(key).not.toBe('0,0');
      expect(board.tiles[key]!.kind).toBe('path');
      expect(second.tiles[key]!.content).toBe('fight.a');
    }
  });

  it('pods are marked even where only the layout is revealed, stop a walk, and are routed around', () => {
    const far = createBoard({ ...row('entrance', 'path', 'path'), '3,0': { kind: 'pod', content: 'fight.a' } }, '0,0');
    expect(visibleKind(far, '3,0')).toBe('pod'); // 3 away: layout only
    expect(stopsOn(far.tiles['3,0']!)).toBe(true);
    // A pod in the lane is walked around when there is room.
    const lane = createBoard(
      { ...row('entrance', 'pod', 'path'), '1,-1': { kind: 'path' }, '2,-1': { kind: 'path' } },
      '0,0',
    );
    expect(routeTo(lane, '2,0')).toEqual(['1,-1', '2,-1', '2,0']);
  });

  it('only uses path tiles, and is seeded', () => {
    const fights = createBoard({ ...row('entrance', 'fight', 'shop', 'camp'), '0,1': { kind: 'path' } }, '0,0');
    expect(pods(tickFrom(fights, 11))).toEqual(['0,1']);
    expect(tickFrom(disc(5), 11, rng())).toEqual(tickFrom(disc(5), 11, rng()));
  });
});
