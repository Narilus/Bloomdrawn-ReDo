import type { z } from 'zod';
import { getOp, type CardSlot, type Hooks, type OpCall, type Registry } from '../engine/index.ts';
import { KINDS, schemas, type Kind } from './schema.ts';

/** Docs/DESIGN.md cost bands by personal card slot. */
const COST_BANDS: Record<CardSlot, [number, number]> = {
  strike: [1, 1],
  defense: [1, 1],
  transcend: [3, 5],
  flavourA: [2, 5],
  flavourB: [2, 5],
};

const FAMILY = { card: 'cards', character: 'characters', enemy: 'enemies', status: 'statuses', relic: 'relics' } as const;

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
  const registry = { cards: {}, characters: {}, enemies: {}, statuses: {}, relics: {} } as {
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
      // Convention: an argument named `status` is a status ID.
      if (typeof call.status === 'string' && !reg.statuses[call.status]) {
        fail(where(kind, defId), defId, `${path}: unknown status "${call.status}"`);
      }
      if (op.children) checkCalls(kind, defId, op.children(call), `${path}.branch`);
    });
  };
  const checkHooks = (kind: Kind, defId: string, hooks: Hooks | undefined, at: string) =>
    hooks?.triggers?.forEach((t, i) => checkCalls(kind, defId, t.do, `${at}triggers[${i}].do`));

  for (const card of Object.values(reg.cards)) {
    const owner = reg.characters[card.owner];
    if (!owner) fail(where('card', card.id), card.id, `owner "${card.owner}" is not a character`);
    else if (!owner.cards.includes(card.id)) fail(where('card', card.id), card.id, `not listed in ${card.owner}'s cards`);
    if (card.slot) {
      const [min, max] = COST_BANDS[card.slot];
      if (card.cost < min || card.cost > max) {
        fail(where('card', card.id), card.id, `${card.slot} cost ${card.cost} is outside ${min === max ? min : `${min}–${max}`}`);
      }
    }
    checkCalls('card', card.id, card.effects, 'effects');
  }
  for (const c of Object.values(reg.characters)) {
    for (const cardId of c.cards) {
      const card = reg.cards[cardId];
      if (!card) fail(where('character', c.id), c.id, `card "${cardId}" does not exist`);
      else if (card.owner !== c.id) fail(where('character', c.id), c.id, `card "${cardId}" is owned by ${card.owner}`);
    }
    checkHooks('character', c.id, c.passive, 'passive.');
  }
  for (const e of Object.values(reg.enemies)) checkHooks('enemy', e.id, e, '');
  for (const s of Object.values(reg.statuses)) checkHooks('status', s.id, s, '');
  for (const r of Object.values(reg.relics)) checkHooks('relic', r.id, r, '');

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

/** The game's content registry, built from every content file. */
export const registry: Registry = buildRegistry(
  import.meta.glob(['./characters/**/*.ts', './enemies/**/*.ts', './statuses/**/*.ts', './relics/**/*.ts', '!**/*.test.ts'], {
    eager: true,
  }),
);
