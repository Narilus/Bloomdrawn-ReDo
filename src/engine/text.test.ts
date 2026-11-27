import { describe, expect, it } from 'vitest';
import { add, stat } from './formula.ts';
import { applyStatus, damage, draw, gainResource, gainShield, ifConsume, volley } from './ops/index.ts';
import { mul, resource } from './formula.ts';
import { cardCategory, describeCard, describeCardLive, showStats, slotAt, templateSlots } from './text.ts';
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

describe('card text outside combat', () => {
  it("shows a character's stats as numbers, and anything that depends on the fight as written", () => {
    const vigil = { ...card, effects: [damage(add(10, mul(3, resource('essence')))), gainShield(add(2, mul(2, stat('defense'))))] };
    expect(describeCard(card, registry, showStats({ hp: 50, attack: 4, defense: 1 }))).toBe('Deal 10 damage. Gain 3 Shield. Draw 1 card.');
    expect(describeCard(vigil, registry, showStats({ hp: 50, attack: 4, defense: 5 }))).toBe('Deal 10 + 3 × Essence damage. Gain 12 Shield.');
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
    expect(describeCard(pod, reg)).toBe("Ritual. Gain 3 Embryo. Deal 6 + Attack damage. Charge its owner's ultimate by 10.");
  });

  it('live text runs damage slots through the pipeline', () => {
    const [state, instance] = withCardInHand(fixtureCombat(['test.dummy'], ['test.plus3'], reg), pod.id);
    expect(describeCardLive(instance, state, reg)).toBe("Ritual. Gain 3 Embryo. Deal 12 damage. Charge its owner's ultimate by 10.");
  });

  it('finds formulas by path, and nothing else', () => {
    expect(slotAt(pod, 'effects.1.amount')).toEqual({ formula: add(6, stat('attack')), value: 'damage' });
    expect(slotAt(pod, 'effects.0.amount')).toEqual({ formula: 3 });
    expect(slotAt(pod, 'effects.0.resource')).toBeUndefined();
    expect(slotAt(pod, 'effects.9.amount')).toBeUndefined();
    expect(templateSlots(pod.text)).toEqual(['effects.0.amount', 'effects.1.amount']);
  });
});


describe('card category', () => {
  const base = { id: 'test.a.x', name: 'X', owner: 'test.a', cost: 1, target: 'none' as const };
  it('a card that deals damage is an Attack: a hit, a volley, or a hit inside a branch', () => {
    expect(cardCategory({ ...base, effects: [damage(6)] })).toBe('attack');
    expect(cardCategory({ ...base, effects: [volley(2, 3)] })).toBe('attack');
    expect(cardCategory({ ...base, effects: [gainShield(4), ifConsume('embryo', 1, [draw(1), damage(4)])] })).toBe('attack');
  });
  it('one that gains Shield and deals no damage is a Shield; any other is a Skill', () => {
    expect(cardCategory({ ...base, effects: [gainShield(4), applyStatus({ id: 'status.weak' }, 1)] })).toBe('shield');
    expect(cardCategory({ ...base, effects: [draw(1), ifConsume('embryo', 1, [gainResource('embryo', 1)])] })).toBe('skill');
  });
  it('a Transcend card is a Transcend, and the party\'s own cards are Symptoms, whatever they do', () => {
    expect(cardCategory({ ...base, slot: 'transcend', effects: [damage(6)] })).toBe('transcend');
    const { owner: _, ...ownerless } = base;
    expect(cardCategory({ ...ownerless, effects: [damage(6)] })).toBe('symptom');
    expect(cardCategory({ ...ownerless, domain: 'flesh', effects: [damage(6)] })).toBe('attack');
  });
});
