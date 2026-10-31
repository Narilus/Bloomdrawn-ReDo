import { describe, expect, it } from 'vitest';
import type { MotifDef } from '../engine/index.ts';
import { createBoard, type Tile } from './board.ts';
import { hexKey } from './hex.ts';
import { findStranding, generateBoard, poolsAt, type LabyrinthDef } from './labyrinth.ts';
import { parseMotif, rotate } from './motif.ts';

const row = (...kinds: Tile['kind'][]) => Object.fromEntries(kinds.map((kind, q) => [hexKey({ q, r: 0 }), { kind }]));

describe('motifs', () => {
  it('parse from drawn rows, with the joint at 0,0', () => {
    const m = parseMotif(['  . F', ' E   . X']);
    // The row above sits half a hex left of the odd row below it.
    expect(m.tiles).toEqual({ '1,-1': 'path', '2,-1': 'fight', '0,0': 'joint', '2,0': 'path', '3,0': 'exit' });
    expect(m.exit).toBe('3,0');
  });

  it('reject a cell between cells, a missing joint and a second exit', () => {
    expect(() => parseMotif(['E  .'])).toThrow(/between cells/);
    expect(() => parseMotif(['. . X'])).toThrow(/exactly one E/);
    expect(() => parseMotif(['E X X'])).toThrow(/at most one X/);
  });

  it('turn about the joint: six sixths is a full turn', () => {
    expect(rotate({ q: 2, r: -1 }, 1)).toEqual({ q: 1, r: 1 });
    expect(rotate({ q: 2, r: -1 }, 6)).toEqual({ q: 2, r: -1 });
  });
});

describe('the never-stranded check', () => {
  it('finds the trap in a lone Collapsing bridge: step on, step back, and the Boss is cut off', () => {
    const board = createBoard(row('entrance', 'collapsing', 'path', 'boss'), '0,0');
    expect(findStranding(board)).toEqual({ at: '0,0', ruined: ['1,0'] });
  });

  // Two parallel ways from the entrance (0,0) to 1,1, then the Boss.
  const pair = (second: Tile['kind']) =>
    createBoard({ '0,0': { kind: 'entrance' }, '1,0': { kind: 'collapsing' }, '0,1': { kind: second }, '1,1': { kind: 'path' }, '2,1': { kind: 'boss' } }, '0,0');

  it('finds the trap in two Collapsing tiles side by side: on one, across to the other, back off', () => {
    expect(findStranding(pair('collapsing'))).toEqual({ at: '0,0', ruined: ['0,1', '1,0'] });
  });

  it("passes a Collapsing tile beside a Symptom, as in the owner's loop: the Symptom can always be paid", () => {
    expect(findStranding(pair('symptom'))).toBeUndefined();
    expect(findStranding(createBoard(row('entrance', 'symptom', 'boss'), '0,0'))).toBeUndefined();
  });
});

describe('generating a board', () => {
  const motifs: Record<string, MotifDef> = {
    start: { id: 'start', place: 'start', rows: ['E o X'] },
    trap: { id: 'trap', place: 'route', rows: ['E K X'] },
    middle: { id: 'middle', place: 'route', rows: ['E F . X'] },
    end: { id: 'end', place: 'end', rows: ['E . B'] },
    nook: { id: 'nook', place: 'side', rows: ['E . C'] },
  };
  const def: LabyrinthDef = {
    route: [['start'], ['middle'], ['end']],
    sides: [['nook']],
    bands: [{ fight: ['f'], elite: [], boss: ['b'] }],
    events: [],
    symptoms: [],
  };

  it('is the same board for the same seed, and starts at the entrance', () => {
    const a = generateBoard(7, def, motifs);
    expect(generateBoard(7, def, motifs)).toEqual(a);
    expect(a.at).toBe('0,0');
    expect(a.tiles['0,0']!.kind).toBe('entrance');
    expect(Object.values(a.tiles).filter((t) => t.kind === 'boss')).toEqual([{ kind: 'boss', content: 'b' }]);
    expect(Object.keys(a.tiles)).toHaveLength(3 + 4 + 3 + 3);
  });

  it('refuses motifs that can only strand the player', () => {
    expect(() => generateBoard(7, { ...def, route: [['start'], ['trap'], ['end']] }, motifs)).toThrow(/No valid board/);
  });
});

describe('pools by depth band', () => {
  const band = (n: number) => ({ fight: [`f${n}`], elite: [`e${n}`], boss: [`b${n}`] });
  const bands = [band(1), band(2), band(3)];

  it('a depth draws from its own band and the one before', () => {
    expect(poolsAt(bands, 1)).toEqual(band(1));
    expect(poolsAt(bands, 10)).toEqual(band(1));
    expect(poolsAt(bands, 11)).toEqual({ fight: ['f1', 'f2'], elite: ['e1', 'e2'], boss: ['b1', 'b2'] });
    expect(poolsAt(bands, 23)).toEqual({ fight: ['f2', 'f3'], elite: ['e2', 'e3'], boss: ['b2', 'b3'] });
  });

  it('a depth past the last band draws as the last', () => {
    expect(poolsAt(bands, 50)).toEqual(poolsAt(bands, 30));
    expect(poolsAt([band(1)], 37)).toEqual(band(1));
  });

  it('the board fills its fights from the depth\'s pools', () => {
    const motifs: Record<string, MotifDef> = {
      start: { id: 'start', place: 'start', rows: ['E o X'] },
      middle: { id: 'middle', place: 'route', rows: ['E F . X'] },
      end: { id: 'end', place: 'end', rows: ['E . B'] },
    };
    const def: LabyrinthDef = { route: [['start'], ['middle'], ['end']], sides: [], bands, events: [], symptoms: [] };
    const contents = (depth: number) => Object.values(generateBoard(7, def, motifs, depth).tiles).flatMap((t) => (t.content ? [t.content] : []));
    expect(contents(1).sort()).toEqual(['b1', 'f1']);
    expect(contents(25).every((id) => /[23]$/.test(id))).toBe(true);
  });
});
