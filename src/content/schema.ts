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
    })
    .optional(),
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
    owner: id,
    slot: z.enum(['strike', 'defense', 'transcend', 'flavourA', 'flavourB']).optional(),
    cost: z.int().min(0),
    target: z.enum(['none', 'self', 'party', 'chosenEnemy', 'allEnemies']),
    effects: z.array(opCall).min(1),
  }),
  character: z.strictObject({
    kind: z.literal('character'),
    id,
    domain: z.enum(['flesh', 'rapture', 'spirit', 'unbound']),
    stats: z.strictObject({ hp: z.int().positive(), attack: z.int().min(0), defense: z.int().min(0) }),
    cards: z.array(id),
    passive: z.strictObject(hooks).optional(),
  }),
  enemy: z.strictObject({ kind: z.literal('enemy'), id, hp: z.int().positive(), ...hooks }),
  status: z.strictObject({ kind: z.literal('status'), id, stacking: z.enum(['add', 'refresh', 'highest']), ...hooks }),
  relic: z.strictObject({ kind: z.literal('relic'), id, ...hooks }),
};

export type Kind = keyof typeof schemas;
export const KINDS = Object.keys(schemas) as Kind[];
