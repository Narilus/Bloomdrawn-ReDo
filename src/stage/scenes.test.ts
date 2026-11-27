import { describe, expect, it } from 'vitest';
import { sceneName } from './scenes.ts';

// Battle backgrounds (owner, 27 Nov): a band's fights draw from its pool, a Boss may have its own.

const names = ['band1-1', 'band1-2', 'band1-3', 'band1-10', 'band2-1', 'hollow-abbess'];

describe('sceneName', () => {
  it("a fight draws from its depth's band, the seed choosing, so the same fight keeps its scene", () => {
    expect(sceneName(names, { depth: 1, seed: 0 })).toBe('band1-1');
    expect(sceneName(names, { depth: 10, seed: 1 })).toBe('band1-2');
    expect(sceneName(names, { depth: 7, seed: 3 })).toBe('band1-10');
    expect(sceneName(names, { depth: 7, seed: 5 })).toBe(sceneName(names, { depth: 7, seed: 5 }));
    expect(sceneName(names, { depth: 11, seed: 9 })).toBe('band2-1');
    const seen = new Set(Array.from({ length: 40 }, (_, seed) => sceneName(names, { depth: 4, seed })));
    expect([...seen].sort()).toEqual(['band1-1', 'band1-10', 'band1-2', 'band1-3']);
  });

  it('a Boss stands in its own scene, else in its band like any fight', () => {
    expect(sceneName(names, { depth: 10, boss: 'encounter.hollow-abbess', seed: 2 })).toBe('hollow-abbess');
    expect(sceneName(names, { depth: 10, boss: 'encounter.gathered-beast', seed: 2 })).toBe('band1-3');
  });

  it('a band with no art yet has none, so the drawn backdrop stays', () => {
    expect(sceneName(names, { depth: 25, seed: 0 })).toBeUndefined();
    expect(sceneName([], { depth: 1, seed: 0 })).toBeUndefined();
  });
});
