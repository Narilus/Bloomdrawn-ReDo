import { playContext, validate, type Command } from './combat.ts';
import type { OpCall, Registry } from './defs.ts';
import type { OpContext, Preview } from './operation.ts';
import { getOp } from './ops/index.ts';
import type { CardInstance, CombatState } from './state.ts';

/**
 * What playing a card would do, from the same code that resolves it. Runs the card's
 * operations in order on a scratch copy so later operations see earlier ones. Triggers are
 * not previewed. Returns undefined if the command would be rejected.
 */
export function previewCard(
  state: CombatState,
  command: Extract<Command, { type: 'playCard' }>,
  registry: Registry,
): Preview[] | undefined {
  if (validate(state, command, registry) !== undefined) return undefined;
  const scratch = structuredClone(state);
  const index = scratch.piles.hand.findIndex((c) => c.uid === command.card);
  const [card] = scratch.piles.hand.splice(index, 1) as [CardInstance];
  const def = registry.cards[card.card];
  if (!def) return undefined;
  scratch.mana -= def.cost;
  return previewOps(scratch, def.effects, playContext(card, command.target), registry);
}

function previewOps(scratch: CombatState, calls: readonly OpCall[], ctx: OpContext, registry: Registry): Preview[] {
  const out: Preview[] = [];
  for (const call of calls) {
    const op = getOp(registry, call.op);
    if (!op || op.validate?.(scratch, call, ctx, registry) !== undefined) continue;
    const previews = op.preview(scratch, call, ctx, registry);
    const result = op.resolve(scratch, call, ctx, registry);
    const last = previews.at(-1);
    if (result.then?.length && last) {
      const branchCtx = result.consumed === undefined ? ctx : { ...ctx, consumed: result.consumed };
      last.branch = previewOps(scratch, result.then, branchCtx, registry);
    }
    out.push(...previews);
  }
  return out;
}
