import { describe, expect, it } from 'vitest';
import { add, stat } from './formula.ts';
import { damage, draw, gainShield } from './ops/index.ts';
import { describeCard, describeCardLive } from './text.ts';
import { fixtureCombat, withCardInHand, withCards } from './testing/fixtures.ts';

const card = {
  id: 'test.a.combo', name: 'Combo', owner: 'test.a', cost: 1, target: 'chosenEnemy' as const,
  effects: [damage(add(6, stat('attack'))), gainShield(add(2, stat('defense'))), draw(1)],
};
const registry = withCards(card);

describe('card text', () => {
  it('generated text shows formulas as written', () => {
    expect(describeCard(card, registry)).toBe('Deal 6 + Attack damage. Gain 2 + Defense Shield. Draw 1 card.');
  });

  it('live text shows the owner\'s numbers with outgoing modifiers', () => {
    const [state, instance] = withCardInHand(fixtureCombat(['test.dummy'], ['test.plus3'], registry), card.id);
    // Attack 3, Defense 2, +3 flat damage relic.
    expect(describeCardLive(instance, state, registry)).toBe('Deal 12 damage. Gain 4 Shield. Draw 1 card.');
  });
});
