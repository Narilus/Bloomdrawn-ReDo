import { describe, expect, it } from 'vitest';
import type { MotifDef } from '../engine/index.ts';
import { createBoard, type Tile } from './board.ts';
import { hexKey } from './hex.ts';
import { findStranding, generateBoard, type LabyrinthDef } from './labyrinth.ts';
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
    encounters: { fight: ['f'], elite: [], boss: ['b'] },
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
