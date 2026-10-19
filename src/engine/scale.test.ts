import { describe, expect, it } from 'vitest';
import { apply, startCombat } from './combat.ts';
import type { Registry } from './defs.ts';
import { damage } from './ops/damage.ts';
import { summon } from './ops/summon.ts';
import { previewCard, previewIntent } from './preview.ts';
import { STARTERS, withCardInHand, withCards } from './testing/fixtures.ts';

// The fight-wide enemy scale (the run's Bloom stage): enemies arrive with more HP and deal more
// damage, and previews show the same numbers that resolve.

const base = withCards({ id: 'test.strike', name: 'Strike', owner: 'test.a', cost: 1, target: 'chosenEnemy', effects: [damage(6)] });
const registry: Registry = {
  ...base,
  enemies: {
    ...base.enemies,
    'test.biter': {
      id: 'test.biter',
      name: 'Biter',
      hp: 40,
      intents: [
        { id: 'bite', name: 'Bite', effects: [damage(10, { target: 'party' })] },
        { id: 'call', name: 'Call', effects: [summon({ id: 'test.dummy' }, 1, 1)] },
      ],
    },
  },
};
const start = (enemyScale?: number) =>
  startCombat({ seed: 1, party: STARTERS, enemies: ['test.biter', { enemy: 'test.frail', hp: 10 }], ...(enemyScale ? { enemyScale } : {}) }, registry).state;
const endTurn = (state: ReturnType<typeof start>) => {
  const result = apply(state, { type: 'endTurn' }, registry);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
};

describe('enemy scale', () => {
  it('raises max HP, including encounter overrides, rounding down', () => {
    expect(start(35).enemies.map((e) => [e.hp, e.maxHp])).toEqual([
      [54, 54],
      [13, 13],
    ]);
    expect(start().enemies.map((e) => e.maxHp)).toEqual([40, 10]);
  });

  it("raises an enemy's damage, and the intent preview shows what resolves", () => {
    const state = start(50);
    expect(previewIntent(state, state.enemies[0]!.id, registry).find((p) => p.op === 'damage')?.amount).toBe(15);
    expect(state.party.hp - endTurn(state).party.hp).toBe(15);
    const plain = start();
    expect(plain.party.hp - endTurn(plain).party.hp).toBe(10);
  });

  it("leaves the party's damage alone", () => {
    const [state, card] = withCardInHand(start(50), 'test.strike');
    const command = { type: 'playCard', card: card.uid, target: state.enemies[0]!.id } as const;
    expect(previewCard(state, command, registry)?.find((p) => p.op === 'damage')?.amount).toBe(6);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.enemies[0]!.hp).toBe(60 - 6);
  });

  it('applies to enemies summoned mid-fight', () => {
    const state = endTurn(endTurn(start(20)));
    const summoned = state.enemies.find((e) => e.enemy === 'test.dummy');
    expect(summoned?.maxHp).toBe(48);
  });
});
