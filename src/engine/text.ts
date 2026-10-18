import type { CardDef, Registry } from './defs.ts';
import { evaluate, formulaText } from './formula.ts';
import { pipeline } from './modifiers.ts';
import type { ShowAmount } from './operation.ts';
import { getOp } from './ops/index.ts';
import type { CardInstance, CombatState } from './state.ts';

/** Generated card text with formulas shown as written: `Deal 6 + Attack damage.` */
export function describeCard(def: CardDef, registry: Registry, show: ShowAmount = formulaText): string {
  const parts = def.effects.map((call) => getOp(registry, call.op)?.describe(call, show, registry) ?? call.op);
  return parts.map((p) => `${p}.`).join(' ');
}

/**
 * Generated card text with live numbers for this card in this state: the owner's stats and
 * outgoing modifiers applied, no target yet (`Deal 9 damage.`).
 */
export function describeCardLive(card: CardInstance, state: CombatState, registry: Registry): string {
  const def = registry.cards[card.card];
  if (!def) return card.card;
  const ctx = { source: card.owner, owner: card.owner };
  const show: ShowAmount = (f, value) =>
    String(value ? pipeline(value, f, state, ctx, registry) : Math.floor(evaluate(f, state, ctx, registry)));
  return describeCard(def, registry, show);
}
