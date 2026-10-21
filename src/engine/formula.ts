import { z } from 'zod';
import type { Keyword, Registry } from './defs.ts';
import type { OpContext } from './operation.ts';
import { PARTY, type CombatState } from './state.ts';

/** A typed amount expression. JSON data, never strings or eval. */
export type Formula =
  | number
  | { stat: StatName }
  | { resource: string }
  | { add: Formula[] }
  | { mul: Formula[] }
  | { handSize: true }
  /** Cards in hand with this keyword. */
  | { handCount: Keyword }
  /** Turns held, summed over cards in hand with this keyword. */
  | { heldTurns: Keyword }
  /** Stacks of a status on the source (the bearer, for a status's own triggers). */
  | { stacks: string }
  | { manaSpent: true }
  | { turn: true }
  | { consumed: true }
  /** A share of the party's current or max HP, so costs scale with a levelled team (owner, 19 Oct). */
  | { percent: number; of: PartyHp };

export type PartyHp = 'hp' | 'maxHp';

export type StatName = 'hp' | 'attack' | 'defense';

export const add = (...terms: Formula[]): Formula => ({ add: terms });
export const mul = (...terms: Formula[]): Formula => ({ mul: terms });
export const stat = (name: StatName): Formula => ({ stat: name });
export const resource = (id: string): Formula => ({ resource: id });
export const handSize = (): Formula => ({ handSize: true });
export const handCount = (keyword: Keyword): Formula => ({ handCount: keyword });
export const heldTurns = (keyword: Keyword): Formula => ({ heldTurns: keyword });
export const stacks = (status: { id: string } | string): Formula => ({ stacks: typeof status === 'string' ? status : status.id });
export const manaSpent = (): Formula => ({ manaSpent: true });
export const turn = (): Formula => ({ turn: true });
/** The amount the enclosing ifConsume just spent. */
export const consumed = (): Formula => ({ consumed: true });
/** `percent`% of the party's current (`hp`) or max HP, before rounding down. */
export const percentOf = (percent: number, of: PartyHp): Formula => ({ percent, of });
export const shareOf = (f: { percent: number; of: PartyHp }, party: Record<PartyHp, number>): number => (party[f.of] * f.percent) / 100;

export const formulaSchema: z.ZodType<Formula> = z.lazy(() =>
  z.union([
    z.number(),
    z.strictObject({ stat: z.enum(['hp', 'attack', 'defense']) }),
    z.strictObject({ resource: z.string().min(1) }),
    z.strictObject({ add: z.array(formulaSchema).min(1) }),
    z.strictObject({ mul: z.array(formulaSchema).min(1) }),
    z.strictObject({ handSize: z.literal(true) }),
    z.strictObject({ handCount: z.enum(['retain', 'ritual', 'exhaust']) }),
    z.strictObject({ heldTurns: z.enum(['retain', 'ritual', 'exhaust']) }),
    z.strictObject({ stacks: z.string().min(1) }),
    z.strictObject({ manaSpent: z.literal(true) }),
    z.strictObject({ turn: z.literal(true) }),
    z.strictObject({ consumed: z.literal(true) }),
    z.strictObject({ percent: z.number().positive(), of: z.enum(['hp', 'maxHp']) }),
  ]),
);

/** Reads owner stats, pooled resources, the hand, status stacks, Mana spent, the turn, party HP and the amount just consumed. */
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
  if ('handCount' in f) return withKeyword(state, registry, f.handCount).length;
  if ('heldTurns' in f) return withKeyword(state, registry, f.heldTurns).reduce((sum, c) => sum + (c.held ?? 0), 0);
  if ('stacks' in f) {
    // The party and its members share one set of statuses.
    const party = ctx.source === PARTY || state.members.some((m) => m.id === ctx.source);
    const statuses = party ? state.party.statuses : state.enemies.find((e) => e.id === ctx.source)?.statuses;
    return statuses?.find((s) => s.status === f.stacks)?.stacks ?? 0;
  }
  if ('manaSpent' in f) return state.manaSpent;
  if ('turn' in f) return state.turn;
  if ('percent' in f) return shareOf(f, state.party);
  return ctx.consumed ?? 0;
}

/** Cards in hand with a keyword. Ritual implies Retain. */
export function withKeyword(state: CombatState, registry: Registry, keyword: Keyword) {
  return state.piles.hand.filter((c) => hasKeyword(registry.cards[c.card]?.keywords, keyword));
}

export const hasKeyword = (keywords: readonly Keyword[] | undefined, keyword: Keyword): boolean =>
  !!keywords?.includes(keyword) || (keyword === 'retain' && !!keywords?.includes('ritual'));

export const titleCase = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

/** Generated text for a formula: `6 + Attack`, `2 × (1 + Essence)`. */
export function formulaText(f: Formula): string {
  if (typeof f === 'number') return String(f);
  if ('stat' in f) return titleCase(f.stat === 'hp' ? 'HP' : f.stat);
  if ('resource' in f) return titleCase(f.resource);
  if ('add' in f) return f.add.map(formulaText).join(' + ');
  if ('mul' in f) return f.mul.map((t) => (typeof t === 'object' && 'add' in t ? `(${formulaText(t)})` : formulaText(t))).join(' × ');
  if ('handSize' in f) return 'cards in hand';
  if ('handCount' in f) return `${titleCase(f.handCount)}s in hand`;
  if ('heldTurns' in f) return `turns your ${titleCase(f.heldTurns)}s have been held`;
  if ('stacks' in f) return titleCase(f.stacks.replace(/^status\./, ''));
  if ('manaSpent' in f) return 'the Mana spent this turn';
  if ('turn' in f) return 'the turn number';
  if ('percent' in f) return `${f.percent}% of the party's ${f.of === 'hp' ? 'current' : 'max'} HP`;
  return 'the amount consumed';
}
