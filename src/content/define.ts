import type { CardDef, CharacterDef, DomainDef, EncounterDef, EnemyDef, EventDef, MotifDef, RelicDef, StatusDef } from '../engine/index.ts';

// Typed helpers for content files. They return plain JSON-shaped data tagged with `kind`,
// which is how the registry finds definitions among a module's exports.

export const card = (def: CardDef) => ({ kind: 'card' as const, ...def });

/** Takes the card definitions themselves, so a character can't list a card that doesn't exist. */
export const character = (def: Omit<CharacterDef, 'cards'> & { cards: CardDef[] }) => ({
  kind: 'character' as const,
  ...def,
  cards: def.cards.map((c) => c.id),
});

export const enemy = (def: EnemyDef) => ({ kind: 'enemy' as const, ...def });
export const status = (def: StatusDef) => ({ kind: 'status' as const, ...def });
export const relic = (def: RelicDef) => ({ kind: 'relic' as const, ...def });
export const domain = (def: DomainDef) => ({ kind: 'domain' as const, ...def });
export const encounter = (def: EncounterDef) => ({ kind: 'encounter' as const, ...def });
export const motif = (def: MotifDef) => ({ kind: 'motif' as const, ...def });
export const event = (def: EventDef) => ({ kind: 'event' as const, ...def });
