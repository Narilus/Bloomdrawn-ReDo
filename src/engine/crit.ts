import type { Registry } from './defs.ts';
import { characterOf } from './dupes.ts';
import { critOf } from './levels.ts';
import type { OpContext } from './operation.ts';
import { nextFloat } from './rng.ts';
import { PARTY, type CombatState } from './state.ts';

// Crit (docs/notes/m6-scaling.md, 4.6; owner, 31 Oct): only the party's `damage` hits crit, Tentacle
// volleys included, each hit rolled on its own from the `crit` stream. Status ticks, `loseHp`, heals,
// Shields and anything an enemy does never crit, so intents stay exact. Previews never roll.

/** The crit chance and bonus of a hit's source: its owner's, or the party's average for a hit the party itself makes. None for an enemy. */
export function critChance(state: CombatState, ctx: OpContext, registry: Registry): { rate: number; damage: number } | undefined {
  const owner = state.members.find((m) => m.id === (ctx.owner ?? ctx.source));
  if (owner) return critOf(characterOf(owner, registry)!.stats);
  if (ctx.source !== PARTY || state.members.length === 0) return undefined;
  const all = state.members.map((m) => critOf(characterOf(m, registry)!.stats));
  const avg = (key: 'rate' | 'damage') => all.reduce((n, c) => n + c[key], 0) / all.length;
  return { rate: avg('rate'), damage: avg('damage') };
}

/** Rolls one hit's crit on the draft's `crit` stream: the multiplier for the hit (1 if not a crit), and whether it crit. */
export function rollCrit(draft: CombatState, ctx: OpContext, registry: Registry): { mul: number; crit: boolean } {
  const chance = critChance(draft, ctx, registry);
  if (!chance || chance.rate <= 0) return { mul: 1, crit: false };
  // A combat saved before crit existed starts its stream from the shuffle's, so it stays deterministic.
  draft.rng.crit ??= (draft.rng.shuffle ^ 0x9e3779b9) >>> 0;
  const crit = nextFloat(draft.rng, 'crit') * 100 < chance.rate;
  return crit ? { mul: 1 + chance.damage / 100, crit } : { mul: 1, crit };
}
