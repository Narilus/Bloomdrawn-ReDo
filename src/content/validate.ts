import type { z } from 'zod';
import { getOp, slotAt, templateSlots, type CardSlot, type Hooks, type OpCall, type Registry } from '../engine/index.ts';
import { KINDS, schemas, type Kind } from './schema.ts';

/** The folders content lives in. registry.ts globs these; tools outside Vite (tools/lab) walk them. */
export const CONTENT_FOLDERS = ['characters', 'symptoms', 'enemies', 'statuses', 'relics', 'domains', 'encounters', 'motifs', 'events'] as const;

/** Docs/DESIGN.md cost bands by personal card slot. */
const COST_BANDS: Record<CardSlot, [number, number]> = {
  strike: [1, 1],
  defense: [1, 1],
  transcend: [3, 5],
  flavourA: [2, 5],
  flavourB: [2, 5],
};

const SLOTS = Object.keys(COST_BANDS) as CardSlot[];

const FAMILY = {
  card: 'cards',
  character: 'characters',
  enemy: 'enemies',
  status: 'statuses',
  relic: 'relics',
  domain: 'domains',
  encounter: 'encounters',
  motif: 'motifs',
  event: 'events',
} as const;

type Modules = Record<string, Record<string, unknown>>;
interface Found {
  file: string;
  kind: Kind;
  def: { id: string } & Record<string, unknown>;
}

/**
 * Collects every exported definition from content modules, validates each against its
 * schema, then cross-checks references. Every error names the file and the ID.
 */
export function validateContent(modules: Modules): { registry: Registry; errors: string[] } {
  const errors: string[] = [];
  const registry = { cards: {}, characters: {}, enemies: {}, statuses: {}, relics: {}, domains: {}, encounters: {}, motifs: {}, events: {} } as {
    [K in keyof typeof FAMILY as (typeof FAMILY)[K]]: Record<string, never>;
  };
  const fileOf = new Map<string, string>();
  const fail = (file: string, defId: string, message: string) => errors.push(`${file} › ${defId}: ${message}`);

  for (const found of collect(modules)) {
    const { file, kind, def } = found;
    const parsed = schemas[kind].safeParse(def);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fail(file, String(def.id), `${pathOf(issue)}${issue.message}`);
      continue;
    }
    const table: Record<string, unknown> = registry[FAMILY[kind]];
    const key = `${kind}:${def.id}`;
    if (fileOf.has(key)) {
      fail(file, def.id, `duplicate ${kind} ID (also in ${fileOf.get(key)})`);
      continue;
    }
    fileOf.set(key, file);
    table[def.id] = def;
  }

  const reg = registry as unknown as Registry;
  const where = (kind: Kind, defId: string) => fileOf.get(`${kind}:${defId}`) ?? '?';
  const checkCalls = (kind: Kind, defId: string, calls: readonly OpCall[], at: string) => {
    calls.forEach((call, i) => {
      const path = `${at}[${i}]`;
      const op = getOp(reg, call.op);
      if (!op) return fail(where(kind, defId), defId, `${path}: unknown operation "${call.op}"`);
      const args = op.args.safeParse(call);
      if (!args.success) {
        for (const issue of args.error.issues) fail(where(kind, defId), defId, `${path}.${pathOf(issue)}${issue.message}`);
        return;
      }
      // Conventions: an argument named `status` is a status ID, and one named `card` a card ID.
      if (typeof call.status === 'string' && !reg.statuses[call.status]) {
        fail(where(kind, defId), defId, `${path}: unknown status "${call.status}"`);
      }
      if (typeof call.card === 'string' && !reg.cards[call.card]) {
        fail(where(kind, defId), defId, `${path}: unknown card "${call.card}"`);
      }
      if (call.op === 'summon' && typeof call.enemy === 'string' && !reg.enemies[call.enemy]) {
        fail(where(kind, defId), defId, `${path}: unknown enemy "${call.enemy}"`);
      }
      if (op.children) checkCalls(kind, defId, op.children(call), `${path}.branch`);
    });
  };
  const checkHooks = (kind: Kind, defId: string, hooks: Hooks | undefined, at: string) =>
    hooks?.triggers?.forEach((t, i) => checkCalls(kind, defId, t.do, `${at}triggers[${i}].do`));
  // Every `{path}` slot in authored text must point at a formula inside its own definition.
  const checkText = (kind: Kind, defId: string, text: string | undefined, root: unknown, at: string) => {
    for (const path of templateSlots(text ?? '')) {
      if (!slotAt(root, path)) fail(where(kind, defId), defId, `${at}text: slot {${path}} is not a formula`);
    }
  };

  for (const card of Object.values(reg.cards)) {
    const owner = card.owner === undefined ? undefined : reg.characters[card.owner];
    const at = where('card', card.id);
    // A Domain's generic card is a card reward that goes to a member of its Domain when gained.
    if (card.domain !== undefined) {
      if (card.owner !== undefined || card.slot || card.generated) fail(at, card.id, "a Domain's generic card has no owner or personal slot and is not generated");
      if (!card.reward) fail(at, card.id, "a Domain's generic card must be a card reward");
      if (!reg.domains[card.domain]) fail(at, card.id, `domain "${card.domain}" is not defined`);
    } else if (card.owner === undefined) {
      // The party's own cards (Symptoms) have no owner, and so no personal slot.
      if (card.slot || card.generated) fail(at, card.id, 'a card without an owner has no personal slot and is not generated');
      if (card.reward) fail(at, card.id, 'a card reward needs an owner or a Domain');
    } else if (!owner) fail(at, card.id, `owner "${card.owner}" is not a character`);
    else if (card.generated && card.slot) fail(at, card.id, 'a generated card has no personal slot');
    else if (card.reward) {
      if (card.slot || card.generated) fail(at, card.id, 'a card reward has no personal slot and is not generated');
      if (owner.cards.includes(card.id)) fail(at, card.id, `a card reward is not one of ${card.owner}'s five cards`);
    } else if (!card.generated && !owner.cards.includes(card.id)) fail(at, card.id, `not listed in ${card.owner}'s cards`);
    if (card.slot) {
      const [min, max] = COST_BANDS[card.slot];
      if (card.cost < min || card.cost > max) {
        fail(where('card', card.id), card.id, `${card.slot} cost ${card.cost} is outside ${min === max ? min : `${min}–${max}`}`);
      }
    }
    checkCalls('card', card.id, card.effects, 'effects');
    checkText('card', card.id, card.text, card, '');
  }
  for (const c of Object.values(reg.characters)) {
    for (const cardId of c.cards) {
      const card = reg.cards[cardId];
      if (!card) fail(where('character', c.id), c.id, `card "${cardId}" does not exist`);
      else if (card.owner !== c.id) fail(where('character', c.id), c.id, `card "${cardId}" is owned by ${card.owner}`);
    }
    // DESIGN.md: exactly five personal cards, one in each slot.
    const slots = c.cards.map((id) => reg.cards[id]?.slot);
    if (slots.length !== SLOTS.length || SLOTS.some((slot) => slots.filter((s) => s === slot).length !== 1)) {
      fail(where('character', c.id), c.id, `needs exactly one card in each slot (${SLOTS.join(', ')})`);
    }
    checkHooks('character', c.id, c.passive, 'passive.');
    checkText('character', c.id, c.passive?.text, c.passive, 'passive.');
    if (c.ultimate) {
      checkCalls('character', c.id, c.ultimate.effects, 'ultimate.effects');
      checkText('character', c.id, c.ultimate.text, c.ultimate, 'ultimate.');
      const up = c.ultimate.transcended;
      if (up) {
        checkCalls('character', c.id, up.effects, 'ultimate.transcended.effects');
        checkText('character', c.id, up.text, up, 'ultimate.transcended.');
      }
    }
    if (!reg.domains[c.domain]) fail(where('character', c.id), c.id, `domain "${c.domain}" is not defined`);
  }
  for (const e of Object.values(reg.enemies)) {
    checkHooks('enemy', e.id, e, '');
    e.intents?.forEach((intent, i) => checkCalls('enemy', e.id, intent.effects, `intents[${i}].effects`));
    e.phases?.forEach((phase, p) => {
      checkCalls('enemy', e.id, phase.rouse.effects, `phases[${p}].rouse.effects`);
      phase.intents.forEach((intent, i) => checkCalls('enemy', e.id, intent.effects, `phases[${p}].intents[${i}].effects`));
    });
  }
  for (const s of Object.values(reg.statuses)) {
    checkHooks('status', s.id, s, '');
    if (s.resistedAs && !reg.statuses[s.resistedAs]) fail(where('status', s.id), s.id, `resistedAs "${s.resistedAs}" is not a status`);
  }
  for (const r of Object.values(reg.relics)) checkHooks('relic', r.id, r, '');
  for (const d of Object.values(reg.domains)) checkHooks('domain', d.id, d, '');
  for (const en of Object.values(reg.encounters)) {
    for (const entry of en.enemies) {
      const id = typeof entry === 'string' ? entry : entry.enemy;
      if (!reg.enemies[id]) fail(where('encounter', en.id), en.id, `enemy "${id}" does not exist`);
    }
    if (en.fruiting !== undefined && !reg.encounters[en.fruiting]) fail(where('encounter', en.id), en.id, `fruiting encounter "${en.fruiting}" does not exist`);
  }

  return { registry: reg, errors };
}

export function buildRegistry(modules: Modules): Registry {
  const { registry, errors } = validateContent(modules);
  if (errors.length > 0) throw new Error(`Content validation failed:\n  ${errors.join('\n  ')}`);
  return registry;
}

function collect(modules: Modules): Found[] {
  const found: Found[] = [];
  for (const [path, exports] of Object.entries(modules)) {
    const file = path.replace(/^\.\//, 'src/content/');
    for (const value of Object.values(exports)) {
      if (isDef(value)) found.push({ file, kind: value.kind, def: value });
    }
  }
  return found;
}

function isDef(value: unknown): value is { kind: Kind; id: string } & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    KINDS.includes((value as { kind?: Kind }).kind as Kind) &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

const pathOf = (issue: z.core.$ZodIssue) => (issue.path.length ? `${issue.path.join('.')}: ` : '');
