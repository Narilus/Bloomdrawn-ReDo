import { describe, expect, it } from 'vitest';
import { bandOf, mapArt, slab } from './mapArt.ts';

describe('map art (M6.11)', () => {
  it('a depth is in its band of ten', () => {
    expect([1, 10, 11, 20, 41, 50].map(bandOf)).toEqual([1, 1, 2, 2, 5, 5]);
  });

  it("a tile's slab is fixed by its key, inside the room given, and neighbours differ", () => {
    const a = slab('2,0', 300);
    expect(slab('2,0', 300)).toEqual(a);
    const cuts = ['0,0', '1,0', '2,0', '0,1', '1,1', '-1,1'].map((key) => slab(key, 300));
    for (const cut of cuts) {
      expect(cut.x).toBeGreaterThanOrEqual(0);
      expect(cut.x).toBeLessThan(300);
      expect(cut.y).toBeGreaterThanOrEqual(0);
      expect(cut.y).toBeLessThan(300);
      expect([0, 1, 2, 3, 4, 5]).toContain(cut.turn);
    }
    expect(new Set(cuts.map((c) => `${Math.round(c.x)},${Math.round(c.y)}`)).size).toBe(cuts.length);
  });

  it("every band has its floor, every tile that holds something its symbol, Collapsing its cracks, and the party its marker (owner's picks)", () => {
    // A band without a floor would borrow the one before, so each must be its own.
    expect(new Set([1, 2, 3, 4, 5].map((band) => mapArt.floor(band))).size).toBe(5);
    expect(mapArt.floor(1)).toBeDefined();
    const kinds = ['entrance', 'fight', 'elite', 'boss', 'event', 'shop', 'camp', 'symptom', 'bloom', 'party', 'cracks'];
    expect(kinds.filter((kind) => mapArt.icon(kind) === undefined)).toEqual([]);
  });
});
