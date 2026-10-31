import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { describeCharacter } from '../engine/index.ts';

// The roster's character page (docs/notes/m5-collection.md) shows a kit outside combat.

describe('the character page', () => {
  it("shows a character's passive and ultimate with the numbers her stats fix", () => {
    expect(describeCharacter(registry.characters.maelia!)).toEqual({
      passive: 'The first time each turn a card gains Embryo, gain 1 more.',
      // The heal is a share of the party's max HP (m6-scaling.md, 4.8), which only a fight knows: 3 for the starters.
      ultimate: "Consume all Embryo. For each Embryo consumed, heal 1.43% of the party's max HP and gain 12 Shield.",
      transcended: "Consume all Embryo. For each Embryo consumed, heal 1.43% of the party's max HP and gain 12 Shield, and every enemy gains 3 Poison.",
    });
  });
});
