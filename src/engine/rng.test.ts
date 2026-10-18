import { describe, expect, it } from 'vitest';
import { createStreams, nextFloat, nextInt, shuffleInPlace } from './rng.ts';

const NAMES = ['shuffle', 'targeting', 'intents'] as const;

describe('seeded streams', () => {
  it('the same seed gives the same sequence', () => {
    const a = createStreams(42, NAMES);
    const b = createStreams(42, NAMES);
    const seqA = Array.from({ length: 20 }, () => nextFloat(a, 'shuffle'));
    const seqB = Array.from({ length: 20 }, () => nextFloat(b, 'shuffle'));
    expect(seqA).toEqual(seqB);
  });

  it('different seeds and different streams diverge', () => {
    const a = createStreams(1, NAMES);
    const b = createStreams(2, NAMES);
    expect(nextFloat(a, 'shuffle')).not.toEqual(nextFloat(b, 'shuffle'));
    expect(a.shuffle).not.toEqual(a.targeting);
  });

  it('a draw on one stream never shifts another', () => {
    const quiet = createStreams(7, NAMES);
    const busy = createStreams(7, NAMES);
    for (let i = 0; i < 50; i++) nextFloat(busy, 'targeting');
    nextInt(busy, 'intents', 3);

    const deckA = Array.from({ length: 20 }, (_, i) => i);
    const deckB = [...deckA];
    shuffleInPlace(deckA, quiet, 'shuffle');
    shuffleInPlace(deckB, busy, 'shuffle');
    expect(deckB).toEqual(deckA);
    expect(busy.shuffle).toBe(quiet.shuffle);
  });

  it('stays in range and is JSON round-trippable', () => {
    const s = createStreams(99, NAMES);
    for (let i = 0; i < 1000; i++) {
      const n = nextInt(s, 'targeting', 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
    const copy = JSON.parse(JSON.stringify(s)) as typeof s;
    expect(nextFloat(copy, 'intents')).toBe(nextFloat(s, 'intents'));
  });
});
