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
    owner: id,
    slot: z.enum(['strike', 'defense', 'transcend', 'flavourA', 'flavourB']).optional(),
    cost: z.int().min(0),
    target: z.enum(['none', 'self', 'party', 'chosenEnemy', 'allEnemies']),
    keywords: z.array(z.enum(['retain', 'ritual'])).optional(),
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
    ultimate: z.strictObject({ name: z.string().min(1), text: z.string().min(1), effects: z.array(opCall).min(1) }).optional(),
  }),
  enemy: z.strictObject({
    kind: z.literal('enemy'),
    id,
    name: z.string().min(1),
    hp: z.int().positive(),
    intents: z.array(z.strictObject({ id, name: z.string().min(1), effects: z.array(opCall).min(1) })).optional(),
    ...hooks,
  }),
  status: z.strictObject({ kind: z.literal('status'), id, stacking: z.enum(['add', 'refresh', 'highest']), ...hooks }),
  relic: z.strictObject({ kind: z.literal('relic'), id, ...hooks }),
  domain: z.strictObject({
    kind: z.literal('domain'),
    id,
    name: z.string().min(1),
    resources: z.array(z.strictObject({ id, name: z.string().min(1), start: z.int().min(0).optional() })),
    triggers: hooks.triggers,
  }),
};

export type Kind = keyof typeof schemas;
export const KINDS = Object.keys(schemas) as Kind[];
