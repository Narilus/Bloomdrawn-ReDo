import { describe, expect, it } from 'vitest';
import { apply, startCombat } from './combat.ts';
import { MAX_CHAIN_DEPTH } from './state.ts';
import { fixtureRegistry as registry, STARTERS, withCardInHand } from './testing/fixtures.ts';

const begin = (party: string[], enemies: string[], relics: string[]) =>
  startCombat({ seed: 11, party, enemies, relics }, registry).state;

describe('trigger dispatch', () => {
  it('fires in fixed order: source, party slots, relics by acquisition, enemy slots', () => {
    const state = begin(['test.w0', 'test.w1', 'test.w2', 'test.w3'], ['test.watcher', 'test.watcher'], [
      'test.watch1',
      'test.watch0',
    ]);
    const relicIds = state.relics.map((r) => r.id);
    const enemyIds = state.enemies.map((e) => e.id);
    const [ready, card] = withCardInHand(state, 'test.w2.gain', 'm2');
    const result = apply(ready, { type: 'playCard', card: card.uid }, registry);
    if (!result.ok) throw new Error(result.reason);

    const marks = result.events.filter((e) => e.resource === 'order').map((e) => e.source);
    expect(marks).toEqual(['m2', 'm0', 'm1', 'm3', ...relicIds, ...enemyIds]);
    // The card's own operation resolves before any triggered operation (FIFO).
    expect(result.events[1]).toMatchObject({ type: 'resourceGained', resource: 'essence' });
  });

  it('a trigger cannot re-fire from its own chain', () => {
    const [state, card] = withCardInHand(begin(STARTERS, ['test.dummy'], ['test.again']), 'test.a.gain');
    const result = apply(state, { type: 'playCard', card: card.uid }, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.filter((e) => e.resource === 'again')).toHaveLength(1);
    expect(result.events.some((e) => e.type === 'chainCapped')).toBe(false);
  });

  it(`a looping chain stops at depth ${MAX_CHAIN_DEPTH} with a log event`, () => {
    const loop = Array.from({ length: 10 }, (_, i) => `test.loop${i}`);
    const [state, card] = withCardInHand(begin(STARTERS, ['test.dummy'], loop), 'test.loop-card');
    const result = apply(state, { type: 'playCard', card: card.uid }, registry);
    if (!result.ok) throw new Error(result.reason);

    const gains = result.events.filter((e) => e.type === 'resourceGained');
    // The card's own gain (depth 0) plus one per triggered depth 1..8.
    expect(gains).toHaveLength(1 + MAX_CHAIN_DEPTH);
    expect(result.events.at(-1)).toMatchObject({ type: 'chainCapped' });
    expect(result.state.resources['loop8']).toBe(1);
    expect(result.state.resources['loop9']).toBeUndefined();
  });
});
