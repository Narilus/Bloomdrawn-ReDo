import { chargeOf } from './combat.ts';
import type { CardDef, OpCall, Registry } from './defs.ts';
import { evaluate, formulaSchema, formulaText, titleCase, type Formula } from './formula.ts';
import { pipeline } from './modifiers.ts';
import type { ShowAmount } from './operation.ts';
import { getOp } from './ops/index.ts';
import type { CardInstance, CombatState, EntityId } from './state.ts';

/** Which pipeline a formula's live number goes through, by the operation and argument holding it. */
const VALUE_OF: Record<string, Record<string, 'damage' | 'shield'>> = {
  damage: { amount: 'damage' },
  volley: { damage: 'damage' },
  gainShield: { amount: 'shield' },
};

interface Slot {
  formula: Formula;
  value?: 'damage' | 'shield';
}

/** Finds the formula a template slot points at, e.g. `effects.0.amount`. */
export function slotAt(root: unknown, path: string): Slot | undefined {
  const keys = path.split('.');
  let parent: unknown;
  let node: unknown = root;
  for (const key of keys) {
    parent = node;
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  }
  if (!formulaSchema.safeParse(node).success) return undefined;
  const op = typeof parent === 'object' && parent !== null ? (parent as OpCall).op : undefined;
  const value = op === undefined ? undefined : VALUE_OF[op]?.[keys.at(-1) as string];
  return value ? { formula: node as Formula, value } : { formula: node as Formula };
}

/** The `{path}` slots in a template. */
export const templateSlots = (template: string): string[] => [...template.matchAll(/\{([\w.]+)\}/g)].map((m) => m[1] as string);

/** Fills a template's slots from formulas inside `root`. */
export function renderTemplate(template: string, root: unknown, show: ShowAmount): string {
  return template.replace(/\{([\w.]+)\}/g, (whole, path: string) => {
    const slot = slotAt(root, path);
    return slot ? show(slot.formula, slot.value) : whole;
  });
}

/** Text generated from operations: `Deal 6 + Attack damage. Draw 1 card.` */
export function describeCalls(calls: readonly OpCall[], registry: Registry, show: ShowAmount = formulaText): string {
  return calls.map((call) => `${getOp(registry, call.op)?.describe(call, show, registry) ?? call.op}.`).join(' ');
}

/**
 * Card text with formulas shown as written: keywords, then the authored template or text
 * generated from the effects, then the ultimate charge (unless the caller shows it separately).
 */
export function describeCard(def: CardDef, registry: Registry, show: ShowAmount = formulaText, options: { charge?: boolean } = {}): string {
  const keywords = (def.keywords ?? []).map((k) => `${titleCase(k)}.`);
  const body = def.text ? renderTemplate(def.text, def, show) : describeCalls(def.effects, registry, show);
  const charge = options.charge === false ? '' : describeCalls(chargeOf(def), registry, show);
  return [...keywords, body, charge].filter(Boolean).join(' ');
}

/** Live numbers for one party member: her stats and outgoing modifiers, no target yet. */
export function showFor(state: CombatState, owner: EntityId, registry: Registry): ShowAmount {
  const ctx = { source: owner, owner };
  return (f, value) => String(value ? pipeline(value, f, state, ctx, registry) : Math.floor(evaluate(f, state, ctx, registry)));
}

/** Card text with live numbers for this card in this state (`Deal 9 damage.`). */
export function describeCardLive(card: CardInstance, state: CombatState, registry: Registry, options: { charge?: boolean } = {}): string {
  const def = registry.cards[card.card];
  return def ? describeCard(def, registry, showFor(state, card.owner, registry), options) : card.card;
}

/** A member's passive and ultimate text with live numbers. */
export function describeKit(state: CombatState, member: EntityId, registry: Registry) {
  const m = state.members.find((x) => x.id === member);
  const def = m ? registry.characters[m.character] : undefined;
  const show = showFor(state, member, registry);
  const passive = def?.passive?.text ? renderTemplate(def.passive.text, def.passive, show) : undefined;
  const ultimate = def?.ultimate ? renderTemplate(def.ultimate.text, def.ultimate, show) : undefined;
  return { passive, ultimate };
}
