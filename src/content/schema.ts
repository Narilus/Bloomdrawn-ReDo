import { z } from 'zod';
import { EVENT_TYPES, formulaSchema } from '../engine/index.ts';

// Shape checks for each definition family. Operation arguments are checked separately
// against each operation's own schema (see registry.ts).

const id = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'IDs are lowercase, namespaced with dots and dashes');
const opCall = z.looseObject({ op: z.string().min(1) });

const trigger = z.strictObject({
  on: z.enum(EVENT_TYPES),
  filter: z
    .strictObject({
      source: z.enum(['self', 'other']).optional(),
      target: z.literal('self').optional(),
      resource: z.string().optional(),
      direct: z.literal(true).optional(),
      slots: z.array(z.enum(['strike', 'defense', 'transcend', 'flavourA', 'flavourB'])).optional(),
    })
    .optional(),
  once: z.literal('turn').optional(),
  do: z.array(opCall).min(1),
});

const modifier = z.strictObject({
  value: z.enum(['damage', 'shield']),
  step: z.enum(['flat', 'outgoingMul', 'incomingMul']),
  amount: formulaSchema,
});

const hooks = {
  triggers: z.array(trigger).optional(),
  modifiers: z.array(modifier).optional(),
};

export const schemas = {
  card: z.strictObject({
    kind: z.literal('card'),
    id,
    name: z.string().min(1),
    owner: id.optional(),
    domain: id.optional(),
    reward: z.literal(true).optional(),
    slot: z.enum(['strike', 'defense', 'transcend', 'flavourA', 'flavourB']).optional(),
    cost: z.int().min(0),
    target: z.enum(['none', 'self', 'party', 'chosenEnemy', 'allEnemies']),
    keywords: z.array(z.enum(['retain', 'ritual', 'exhaust'])).optional(),
    generated: z.boolean().optional(),
    text: z.string().min(1).optional(),
    charge: z.int().positive().optional(),
    effects: z.array(opCall).min(1),
  }),
  character: z.strictObject({
    kind: z.literal('character'),
    id,
    name: z.string().min(1),
    domain: z.enum(['flesh', 'rapture', 'spirit', 'unbound']),
    stats: z.strictObject({ hp: z.int().positive(), attack: z.int().min(0), defense: z.int().min(0) }),
    cards: z.array(id),
    passive: z.strictObject({ name: z.string().min(1), scope: z.enum(['combat', 'run']), text: z.string().min(1), ...hooks }).optional(),
    ultimate: z
      .strictObject({
        name: z.string().min(1),
        text: z.string().min(1),
        effects: z.array(opCall).min(1),
        transcended: z.strictObject({ text: z.string().min(1), effects: z.array(opCall).min(1) }).optional(),
      })
      .optional(),
  }),
  enemy: z.strictObject({
    kind: z.literal('enemy'),
    id,
    name: z.string().min(1),
    hp: z.int().positive(),
    intents: z.array(z.strictObject({ id, name: z.string().min(1), effects: z.array(opCall).min(1) })).optional(),
    traits: z.array(z.literal('resistsControl')).optional(),
    size: z.enum(['small', 'normal', 'large']).optional(),
    ...hooks,
  }),
  status: z.strictObject({
    kind: z.literal('status'),
    id,
    stacking: z.enum(['add', 'refresh', 'highest']),
    icon: z.string().min(1).optional(),
    help: z.string().min(1).optional(),
    skipsAction: z.enum(['advance', 'hold']).optional(),
    resistedAs: id.optional(),
    endsAfterAction: z.boolean().optional(),
    lasts: z.enum(['ownTurns', 'opposingTurns']).optional(),
    ...hooks,
  }),
  relic: z.strictObject({
    kind: z.literal('relic'),
    id,
    name: z.string().min(1),
    tier: z.enum(['common', 'uncommon', 'rare', 'cursed']),
    text: z.string().min(1),
    ...hooks,
  }),
  motif: z.strictObject({
    kind: z.literal('motif'),
    id,
    place: z.enum(['start', 'route', 'end', 'side']),
    // Cells from the legend in src/game/motif.ts, or spaces.
    rows: z.array(z.string().regex(/^[EXo.FLBVSCYK ]*$/, 'only legend characters and spaces')).min(1),
  }),
  event: z.strictObject({
    kind: z.literal('event'),
    id,
    name: z.string().min(1),
    text: z.string().min(1),
    choices: z
      .array(
        z.strictObject({
          label: z.string().min(1),
          outcomes: z.array(
            z.discriminatedUnion('do', [
              z.strictObject({ do: z.literal('obols'), amount: z.int().positive() }),
              z.strictObject({ do: z.literal('pay'), amount: z.int().positive() }),
              z.strictObject({ do: z.literal('relic'), tier: z.enum(['common', 'uncommon', 'rare', 'cursed']) }),
              z.strictObject({ do: z.literal('loseHp'), percent: z.number().positive().max(100) }),
              z.strictObject({ do: z.literal('heal'), percent: z.number().positive().max(100) }),
              z.strictObject({ do: z.literal('charge'), amount: z.int().positive() }),
              z.strictObject({ do: z.literal('symptom') }),
              z.strictObject({ do: z.literal('tick'), count: z.int().positive() }),
            ]),
          ),
        }),
      )
      .min(2)
      .max(3),
  }),
  encounter: z.strictObject({
    kind: z.literal('encounter'),
    id,
    tier: z.enum(['normal', 'elite', 'boss']),
    enemies: z.array(z.union([id, z.strictObject({ enemy: id, hp: z.int().positive() })])).min(1).max(4),
  }),
  domain: z.strictObject({
    kind: z.literal('domain'),
    id,
    name: z.string().min(1),
    resources: z.array(z.strictObject({ id, name: z.string().min(1), start: z.int().min(0).optional() })),
    anyTeam: z.literal(true).optional(),
    triggers: hooks.triggers,
    counter: z
      .strictObject({
        label: z.string().min(1),
        icon: z.string().min(1).optional(),
        help: z.string().min(1).optional(),
        count: formulaSchema,
        each: formulaSchema.optional(),
      })
      .optional(),
  }),
};

export type Kind = keyof typeof schemas;
export const KINDS = Object.keys(schemas) as Kind[];
