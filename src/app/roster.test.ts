import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { describeCharacter } from '../engine/index.ts';

// The roster's character page (docs/notes/m5-collection.md) shows a kit outside combat.

describe('the character page', () => {
  it("shows a character's passive and ultimate with the numbers her stats fix", () => {
    expect(describeCharacter(registry.characters.maelia!)).toEqual({
      passive: 'The first time each turn a card gains Embryo, gain 1 more.',
      ultimate: 'Consume all Embryo. The party heals 3 and gains 4 Shield per Embryo consumed.',
      transcended: 'Consume all Embryo. The party heals 3 and gains 4 Shield per Embryo consumed, and every enemy gains Poison equal to the Embryo consumed.',
    });
  });
});
