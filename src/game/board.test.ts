import { describe, expect, it } from 'vitest';
import { createBoard, resolveTile, routeTo, stopsOn, visibleKind, walk, type Board, type Tile } from './board.ts';
import { hexDistance, hexKey, neighbours } from './hex.ts';

/** A straight row of tiles along q at r = 0, from the given kinds. */
function row(...kinds: Tile['kind'][]): Record<string, Tile> {
  return Object.fromEntries(kinds.map((kind, q) => [hexKey({ q, r: 0 }), { kind }]));
}
const go = (board: Board, to: string) => {
  const result = walk(board, to);
  if (!result) throw new Error(`No way to ${to}`);
  return result;
};

describe('hexes', () => {
  it('have six neighbours, each one step away', () => {
    const centre = { q: 2, r: -1 };
    expect(neighbours(centre).map((n) => hexDistance(centre, n))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3);
  });
});

describe('walking', () => {
  it('takes the shortest route over revealed tiles, and fogged tiles cannot be targeted', () => {
    const board = createBoard(row('entrance', 'path', 'path', 'path', 'path'), '0,0');
    expect(routeTo(board, '2,0')).toEqual(['1,0', '2,0']);
    expect(routeTo(board, '4,0')).toBeUndefined(); // 4 away: still fogged
    expect(go(board, '2,0').board.at).toBe('2,0');
  });

  it('stops on the first fight or Event, and goes around one when it can', () => {
    const straight = createBoard(row('entrance', 'fight', 'path'), '0,0');
    const stopped = go(straight, '2,0');
    expect(stopped.steps).toEqual(['1,0']);
    expect(stopsOn(stopped.board.tiles['1,0']!)).toBe(true);

    // The same row with a longer way round above the fight.
    const detour = createBoard({ ...row('entrance', 'fight', 'path'), '1,-1': { kind: 'path' }, '2,-1': { kind: 'path' } }, '0,0');
    expect(routeTo(detour, '2,0')).toEqual(['1,-1', '2,-1', '2,0']);
  });

  it('a fight, once dealt with, becomes path', () => {
    const board = go(createBoard(row('entrance', 'fight', 'path'), '0,0'), '1,0').board;
    const cleared = resolveTile(board);
    expect(cleared.tiles['1,0']).toEqual({ kind: 'path' });
    expect(go(cleared, '2,0').steps).toEqual(['2,0']);
  });

  it('never crosses a Collapsing tile or an unpaid Symptom on its own; clicking one goes onto it', () => {
    const board = createBoard(row('entrance', 'collapsing', 'path'), '0,0');
    expect(routeTo(board, '2,0')).toBeUndefined();
    expect(routeTo(board, '1,0')).toEqual(['1,0']);

    const toll = createBoard(row('entrance', 'symptom', 'path'), '0,0');
    expect(routeTo(toll, '2,0')).toBeUndefined();
    const onToll = go(toll, '1,0').board;
    expect(stopsOn(onToll.tiles['1,0']!)).toBe(true);
    // Paid, it is free to pass.
    const paid = resolveTile(onToll);
    expect(paid.tiles['1,0']).toEqual({ kind: 'symptom', paid: true });
    expect(routeTo({ ...paid, at: '0,0' }, '2,0')).toEqual(['1,0', '2,0']);
  });

  it('a Collapsing tile is gone once the party steps off it', () => {
    const board = go(createBoard(row('entrance', 'collapsing', 'path'), '0,0'), '1,0').board;
    const off = go(board, '2,0').board;
    expect(off.tiles['1,0']!.kind).toBe('ruin');
    expect(visibleKind(off, '1,0')).toBe('ruin');
    expect(routeTo(off, '0,0')).toBeUndefined();
  });
});

describe('fog of war', () => {
  it('reveals layout within 2, contents next to the party, and landmarks within 4', () => {
    const board = createBoard(row('entrance', 'fight', 'event', 'collapsing', 'shop', 'boss'), '0,0');
    expect(visibleKind(board, '1,0')).toBe('fight'); // adjacent: contents shown
    expect(visibleKind(board, '2,0')).toBe('unknown'); // 2 away: layout only
    expect(visibleKind(board, '3,0')).toBeUndefined(); // 3 away: fogged
    expect(visibleKind(board, '4,0')).toBe('shop'); // a landmark, 4 away
    expect(visibleKind(board, '5,0')).toBeUndefined(); // the Boss, 5 away
  });

  it('marks Collapsing and Symptom tiles as soon as their layout is revealed', () => {
    const board = createBoard(row('entrance', 'path', 'collapsing'), '0,0');
    expect(visibleKind(board, '2,0')).toBe('collapsing');
  });

  it('stays lifted where the party has been', () => {
    const board = go(createBoard(row('entrance', 'path', 'path', 'path', 'path', 'event'), '0,0'), '2,0').board;
    const back = go(board, '0,0').board;
    expect(visibleKind(back, '3,0')).toBe('path');
    expect(visibleKind(back, '4,0')).toBe('unknown');
  });
});

describe("the temptation loop (the owner's diagram)", () => {
  // Main route along r = 0. From the entrance, Collapsing A and the Symptom side by side lead up to
  // the Shop; Collapsing B leads from the Shop back down to the route.
  const loop = createBoard(
    {
      ...row('entrance', 'path', 'path', 'path'),
      '0,-1': { kind: 'collapsing' }, // A
      '1,-1': { kind: 'symptom', content: 'symptom.test' },
      '1,-2': { kind: 'shop', content: 'shop.test' },
      '2,-2': { kind: 'collapsing' }, // B
      '2,-1': { kind: 'path' },
    },
    '0,0',
  );

  it('the first visit is free: in through one Collapsing tile, out through the other, both gone', () => {
    let board = go(loop, '0,-1').board; // onto A
    board = go(board, '1,-2').board; // the Shop; A is gone
    board = go(board, '2,-2').board; // onto B
    board = go(board, '2,0').board; // back on the route; B is gone
    expect([board.tiles['0,-1']!.kind, board.tiles['2,-2']!.kind]).toEqual(['ruin', 'ruin']);
    // Any return to the Shop is through the Symptom.
    expect(routeTo(board, '1,-2')).toBeUndefined();
    const toll = go(board, '1,-1');
    expect(toll.board.at).toBe('1,-1');
    expect(go(resolveTile(toll.board), '1,-2').board.at).toBe('1,-2');
  });

  it('taking the Symptom on the way in keeps both Collapsing tiles', () => {
    let board = resolveTile(go(loop, '1,-1').board);
    board = go(board, '1,-2').board;
    board = go(board, '0,0').board;
    expect([board.tiles['0,-1']!.kind, board.tiles['2,-2']!.kind]).toEqual(['collapsing', 'collapsing']);
  });
});
