import { describe, expect, it } from 'vitest';
import type { CardDef } from '../engine/index.ts';
import { registry } from '../content/registry.ts';
import { cardArt, cardArtName } from './cardArt.ts';

const card = (id: string, extra: Partial<CardDef> = {}): CardDef => ({ id, name: id, cost: 1, target: 'none', effects: [], ...extra });

describe('card art', () => {
  it("Strike and Defense share one picture per Domain, whoever's card it is", () => {
    expect(cardArtName(card('maelia.strike', { owner: 'maelia', slot: 'strike' }), 'flesh')).toBe('strike-flesh');
    expect(cardArtName(card('virelle.strike', { owner: 'virelle', slot: 'strike' }), 'flesh')).toBe('strike-flesh');
    expect(cardArtName(card('kibane.defense', { owner: 'kibane', slot: 'defense' }), 'spirit')).toBe('defense-spirit');
  });

  it('every other card has its own, and a dupe level’s version shares its card’s', () => {
    expect(cardArtName(card('maelia.bud-cutting', { owner: 'maelia', slot: 'flavourB' }), 'flesh')).toBe('maelia-bud-cutting');
    expect(cardArtName(card('maelia.ripened-womb', { owner: 'maelia', slot: 'transcend' }), 'flesh')).toBe('maelia-ripened-womb');
    expect(cardArtName(card('symptom.sweet-rot'), undefined)).toBe('symptom-sweet-rot');
    expect(cardArtName(card('virelle.open-the-wound-c3', { variantOf: 'virelle.open-the-wound' }), 'flesh')).toBe('virelle-open-the-wound');
    expect(cardArtName(card('agathe.strike-c5', { slot: 'strike', variantOf: 'agathe.strike' }), 'rapture')).toBe('strike-rapture');
  });

  it('every card in the game has its picture (M6.11a)', () => {
    const missing = Object.values(registry.cards).filter((def) => {
      const ownerless = def.owner === undefined && def.domain === undefined;
      const domain = ownerless ? undefined : (def.domain ?? (def.owner ? registry.characters[def.owner]?.domain : undefined));
      return cardArt(def, domain) === undefined;
    });
    expect(missing.map((def) => def.id)).toEqual([]);
  });
});
