import { z } from 'zod';
import type { Registry } from './defs.ts';
import type { OpContext } from './operation.ts';
import type { CombatState } from './state.ts';

/** A typed amount expression. JSON data, never strings or eval. */
export type Formula =
  | number
  | { stat: StatName }
  | { resource: string }
  | { add: Formula[] }
  | { mul: Formula[] }
  | { handSize: true }
  | { turn: true }
  | { consumed: true };

export type StatName = 'hp' | 'attack' | 'defense';

export const add = (...terms: Formula[]): Formula => ({ add: terms });
export const mul = (...terms: Formula[]): Formula => ({ mul: terms });
export const stat = (name: StatName): Formula => ({ stat: name });
export const resource = (id: string): Formula => ({ resource: id });
export const handSize = (): Formula => ({ handSize: true });
export const turn = (): Formula => ({ turn: true });
/** The amount the enclosing ifConsume just spent. */
export const consumed = (): Formula => ({ consumed: true });

export const formulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ stat: z.enum(['hp', 'attack', 'defense']) }),
    z.strictObject({ resource: z.string().min(1) }),
    z.strictObject({ add: z.array(formulaSchema).min(1) }),
    z.strictObject({ mul: z.array(formulaSchema).min(1) }),
    z.strictObject({ handSize: z.literal(true) }),
    z.strictObject({ turn: z.literal(true) }),
    z.strictObject({ consumed: z.literal(true) }),
  ]),
);

/** Reads owner stats, pooled resources, hand size, turn and the amount just consumed. */
export function evaluate(f: Formula, state: CombatState, ctx: OpContext, registry: Registry): number {
  if (typeof f === 'number') return f;
  if ('stat' in f) {
    const member = state.members.find((m) => m.id === ctx.owner);
    return member ? (registry.characters[member.character]?.stats[f.stat] ?? 0) : 0;
  }
  if ('resource' in f) return state.resources[f.resource] ?? 0;
  if ('add' in f) return f.add.reduce<number>((sum, t) => sum + evaluate(t, state, ctx, registry), 0);
  if ('mul' in f) return f.mul.reduce<number>((product, t) => product * evaluate(t, state, ctx, registry), 1);
  if ('handSize' in f) return state.piles.hand.length;
  if ('turn' in f) return state.turn;
  return ctx.consumed ?? 0;
}

export const titleCase = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

/** Generated text for a formula: `6 + Attack`, `2 × (1 + Essence)`. */
export function formulaText(f: Formula): string {
  if (typeof f === 'number') return String(f);
  if ('stat' in f) return titleCase(f.stat === 'hp' ? 'HP' : f.stat);
  if ('resource' in f) return titleCase(f.resource);
  if ('add' in f) return f.add.map(formulaText).join(' + ');
  if ('mul' in f) return f.mul.map((t) => (typeof t === 'object' && 'add' in t ? `(${formulaText(t)})` : formulaText(t))).join(' × ');
  if ('handSize' in f) return 'cards in hand';
  if ('turn' in f) return 'the turn number';
  return 'the amount consumed';
}
