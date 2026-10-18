import { describe, expect, it } from 'vitest';
import { add, stat } from './formula.ts';
import { damage, draw, gainResource, gainShield } from './ops/index.ts';
import { describeCard, describeCardLive, slotAt, templateSlots } from './text.ts';
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

describe('authored text', () => {
  const pod = {
    id: 'test.a.pod', name: 'Pod', owner: 'test.a', cost: 2, target: 'chosenEnemy' as const, keywords: ['ritual' as const], charge: 10,
    effects: [gainResource('embryo', 3), damage(add(6, stat('attack')))],
    text: 'Gain {effects.0.amount} Embryo. Deal {effects.1.amount} damage.',
  };
  const reg = withCards(pod);

  it('fills slots from the card, shows keywords first and the charge last', () => {
    expect(describeCard(pod, reg)).toBe('Ritual. Gain 3 Embryo. Deal 6 + Attack damage. Charge her ultimate by 10.');
  });

  it('live text runs damage slots through the pipeline', () => {
    const [state, instance] = withCardInHand(fixtureCombat(['test.dummy'], ['test.plus3'], reg), pod.id);
    expect(describeCardLive(instance, state, reg)).toBe('Ritual. Gain 3 Embryo. Deal 12 damage. Charge her ultimate by 10.');
  });

  it('finds formulas by path, and nothing else', () => {
    expect(slotAt(pod, 'effects.1.amount')).toEqual({ formula: add(6, stat('attack')), value: 'damage' });
    expect(slotAt(pod, 'effects.0.amount')).toEqual({ formula: 3 });
    expect(slotAt(pod, 'effects.0.resource')).toBeUndefined();
    expect(slotAt(pod, 'effects.9.amount')).toBeUndefined();
    expect(templateSlots(pod.text)).toEqual(['effects.0.amount', 'effects.1.amount']);
  });
});
