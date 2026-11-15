import type { CardDef, CharacterDef, DomainDef, DupeDef, EncounterDef, EnemyDef, EventDef, MotifDef, RelicDef, StatusDef, WeaponDef, WeaponStep } from '../engine/index.ts';

// Typed helpers for content files. They return plain JSON-shaped data tagged with `kind`,
// which is how the registry finds definitions among a module's exports.

export const card = (def: CardDef) => ({ kind: 'card' as const, ...def });

/**
 * A Potential level's version of one of a character's five cards: the card with changes, under its own ID.
 * The ID keeps the old `-c<level>` suffix (from when levels were C1–C5), since saved runs store card IDs.
 */
export const variant = (base: CardDef, level: number, changes: Partial<CardDef>) => {
  const { kind: _kind, ...def } = base as CardDef & { kind?: string };
  return card({ ...def, ...changes, id: `${base.id}-c${level}`, variantOf: base.id });
};

/**
 * P2 is one rule for everyone for now (owner, 25 Oct; docs/notes/banner-kits.md): +10% HP, rounded,
 * +3 Attack and +3 Defense. Both were +1 before level-1 Attack and Defense tripled in the M6 retune (owner, 31 Oct).
 */
export const p2 = (stats: CharacterDef['stats']): DupeDef => ({
  text: '+10% HP, +3 Attack and +3 Defense.',
  stats: { hp: Math.round(stats.hp * 1.1), attack: stats.attack + 3, defense: stats.defense + 3 },
});

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

/** A percentage for rules text: 15, 22.5. */
export const pct = (x: number) => String(Math.round(x * 10) / 10);

/** Reinforcement steps: +0 to +5, each adding a tenth of the effect's +0 strength (docs/notes/weapons.md). */
export const WEAPON_STEPS = 6;
export const REINFORCE_PER_STEP = 0.1;

/**
 * A weapon, its effect written once as a function of `power`: 1 at +0, 1.5 at +5. Scale the effect's
 * bonus by it (a 20% boost is `1 + 0.2 × power`), and write the text from it too.
 */
export const weapon = (def: Omit<WeaponDef, 'steps'> & { effect: (power: number) => WeaponStep }) => {
  const { effect, ...rest } = def;
  return {
    kind: 'weapon' as const,
    ...rest,
    steps: Array.from({ length: WEAPON_STEPS }, (_, step) => effect(1 + REINFORCE_PER_STEP * step)),
  };
};
