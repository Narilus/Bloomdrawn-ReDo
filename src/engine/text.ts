import { chargeOf } from './combat.ts';
import type { CardDef, CharacterDef, OpCall, Registry } from './defs.ts';
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

/** What a caller shows separately, and how to mark live numbers (e.g. to colour them by kind). */
export interface TextOptions {
  charge?: boolean;
  keywords?: boolean;
  mark?: (text: string, value?: 'damage' | 'shield') => string;
}

/**
 * Card text with formulas shown as written: keywords, then the authored template or text
 * generated from the effects, then the ultimate charge (unless the caller shows them separately).
 */
export function describeCard(def: CardDef, registry: Registry, show: ShowAmount = formulaText, options: TextOptions = {}): string {
  const keywords = options.keywords === false ? [] : (def.keywords ?? []).map((k) => `${titleCase(k)}.`);
  const body = def.text ? renderTemplate(def.text, def, show) : describeCalls(def.effects, registry, show);
  const charge = options.charge === false ? '' : describeCalls(chargeOf(def), registry, show);
  return [...keywords, body, charge].filter(Boolean).join(' ');
}

/** Live numbers for one party member: her stats and outgoing modifiers, no target yet. */
export function showFor(state: CombatState, owner: EntityId, registry: Registry, mark?: TextOptions['mark']): ShowAmount {
  const ctx = { source: owner, owner };
  return (f, value) => {
    const text = String(value ? pipeline(value, f, state, ctx, registry) : Math.floor(evaluate(f, state, ctx, registry)));
    return mark ? mark(text, value) : text;
  };
}

/**
 * Numbers for a character outside combat, as a card reward shows them: a formula that reads only
 * numbers and her stats shows its value; anything that depends on the fight shows as written.
 * Outside a fight no card has been played this turn, so a count of cards played is 0.
 */
export function showStats(stats: CharacterDef['stats'], mark?: TextOptions['mark']): ShowAmount {
  const value = (f: Formula): number | undefined => {
    if (typeof f === 'number') return f;
    if ('stat' in f) return stats[f.stat];
    if ('playedThisTurn' in f) return 0;
    const terms = 'add' in f ? f.add : 'mul' in f ? f.mul : undefined;
    const values = terms?.map(value);
    if (!values || values.some((v) => v === undefined)) return undefined;
    return 'add' in f ? values.reduce((a, b) => a! + b!, 0) : values.reduce((a, b) => a! * b!, 1);
  };
  return (f, kind) => {
    const v = value(f);
    if (v === undefined) return formulaText(f);
    const text = String(Math.floor(v));
    return mark ? mark(text, kind) : text;
  };
}

/** Card text with live numbers for this card in this state (`Deal 9 damage.`). */
export function describeCardLive(card: CardInstance, state: CombatState, registry: Registry, options: TextOptions = {}): string {
  const def = registry.cards[card.card];
  return def ? describeCard(def, registry, showFor(state, card.owner, registry, options.mark), options) : card.card;
}

/** A member's passive and ultimate text with live numbers. */
export function describeKit(state: CombatState, member: EntityId, registry: Registry) {
  const m = state.members.find((x) => x.id === member);
  const def = m ? registry.characters[m.character] : undefined;
  const show = showFor(state, member, registry);
  const passive = def?.passive?.text ? renderTemplate(def.passive.text, def.passive, show) : undefined;
  const upgraded = m?.transcended ? def?.ultimate?.transcended : undefined;
  const ultimate = upgraded ? renderTemplate(upgraded.text, upgraded, show) : def?.ultimate ? renderTemplate(def.ultimate.text, def.ultimate, show) : undefined;
  return { passive, ultimate };
}

/** A character's passive and ultimate text outside combat, with the numbers her stats fix. */
export function describeCharacter(def: CharacterDef) {
  const show = showStats(def.stats);
  const { passive, ultimate } = def;
  return {
    passive: passive?.text ? renderTemplate(passive.text, passive, show) : undefined,
    ultimate: ultimate ? renderTemplate(ultimate.text, ultimate, show) : undefined,
    transcended: ultimate?.transcended ? renderTemplate(ultimate.transcended.text, ultimate.transcended, show) : undefined,
  };
}
