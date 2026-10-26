// Damage curves (docs/notes/banner-kits.md, "Spirit against Rapture"): seeded fights against the
// practice dummy, played by one simple player, for a Flesh, a Rapture and a Spirit pair, each with
// Leonora and Hester. Spirit is played two ways: Rituals fired when affordable, or held until cheap.
// A measuring tool, not a test. Run `npm run lab -- [--seeds 200] [--turns 10] [--variant a,b]`.
// Variants try Spirit's levers from the note on a copy of the registry; the game's content is unchanged.
import { parseArgs } from 'node:util';
import {
  apply,
  cardCost,
  hasKeyword,
  previewCard,
  startCombat,
  validate,
  type CardDef,
  type CombatState,
  type Command,
  type Formula,
  type EngineEvent,
  type Preview,
  type Registry,
} from '../../src/engine/index.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: { seeds: { type: 'string', default: '200' }, turns: { type: 'string', default: '10' }, variant: { type: 'string', default: '' } },
});
const SEEDS = Number(values.seeds);
const TURNS = Number(values.turns);
const DUMMY = 'enemy.practice-dummy';
/** The hold policy plays a Ritual only once it costs this or less. */
const HOLD_AT = 2;

interface Setup {
  name: string;
  party: string[];
  holdRituals?: boolean;
  ultimates: boolean;
}

const PAIRS: Omit<Setup, 'ultimates'>[] = [
  { name: 'Flesh (Maelia, Virelle)', party: ['maelia', 'virelle', 'leonora', 'hester'] },
  { name: 'Rapture (Agathe, Isadora)', party: ['agathe', 'isadora', 'leonora', 'hester'] },
  { name: 'Spirit, fire (Anthe, Kibane)', party: ['anthe', 'kibane', 'leonora', 'hester'] },
  { name: `Spirit, hold to ${HOLD_AT} (Anthe, Kibane)`, party: ['anthe', 'kibane', 'leonora', 'hester'], holdRituals: true },
];

const flatten = (previews: Preview[]): Preview[] => previews.flatMap((p) => [p, ...(p.resolves === false ? [] : flatten(p.branch ?? []))]);
const previewDamage = (previews: Preview[]) =>
  flatten(previews).filter((p) => p.op === 'damage' || p.op === 'volley' || p.op === 'loseHp').reduce((n, p) => n + (p.amount ?? 0), 0);
const enemyDamage = (events: EngineEvent[], state: CombatState) =>
  events.filter((e) => e.type === 'damageDealt' && state.enemies.some((x) => x.id === e.target)).reduce((n, e) => n + (e.amount ?? 0), 0);

/** The simple player: a ready ultimate, the Transcend, cards that deal no damage, damage cards by damage shown, Defense last. */
function choose(state: CombatState, registry: Registry, setup: Setup): Command | undefined {
  if (setup.ultimates) {
    for (const m of state.members) {
      const fire: Command = { type: 'fireUltimate', member: m.id };
      if (validate(state, fire, registry) === undefined) return fire;
    }
  }
  const target = state.enemies.find((e) => e.hp > 0)?.id;
  let best: { command: Command; score: number } | undefined;
  for (const card of state.piles.hand) {
    const def = registry.cards[card.card];
    if (!def) continue;
    if (setup.holdRituals && hasKeyword(def.keywords, 'ritual') && cardCost(state, card, registry) > HOLD_AT) continue;
    const command: Command = def.target === 'chosenEnemy' && target ? { type: 'playCard', card: card.uid, target } : { type: 'playCard', card: card.uid };
    const preview = previewCard(state, command, registry);
    if (!preview) continue;
    const damage = previewDamage(preview);
    const score = def.slot === 'transcend' ? 1e6 : def.slot === 'defense' ? -1 : damage === 0 ? 1e5 : damage;
    if (!best || score > best.score) best = { command, score };
  }
  return best?.command;
}

interface Fight {
  /** Damage on each turn, the player's turn and its end together. */
  perTurn: number[];
  /** Of which from ultimates. */
  ultimate: number[];
  cards: number;
  /** Resources at the start of turn 6. */
  turn6: Record<string, number>;
}

function fight(seed: number, setup: Setup, registry: Registry): Fight {
  let state = startCombat({ seed, party: setup.party, enemies: [DUMMY] }, registry).state;
  const perTurn = Array<number>(TURNS).fill(0);
  const ultimate = Array<number>(TURNS).fill(0);
  let cards = 0;
  let turn6: Record<string, number> = {};
  while (state.turn <= TURNS && state.phase === 'player') {
    const turn = state.turn;
    if (turn === 6 && Object.keys(turn6).length === 0) turn6 = { ...state.resources };
    const command = choose(state, registry, setup) ?? ({ type: 'endTurn' } as const);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(`${setup.name}, seed ${seed}: ${result.reason}`);
    const dealt = enemyDamage(result.events, result.state);
    perTurn[turn - 1]! += dealt;
    if (command.type === 'fireUltimate') ultimate[turn - 1]! += dealt;
    if (command.type === 'playCard') cards += 1;
    state = result.state;
  }
  return { perTurn, ultimate, cards, turn6 };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const round = (n: number) => String(Math.round(n));

function report(registry: Registry, ultimates: boolean) {
  const header = ['Party', ...Array.from({ length: TURNS }, (_, i) => `T${i + 1}`), `Total T1–${TURNS}`, 'Per card', 'Ultimates'];
  const rows: string[][] = [];
  const notes: string[] = [];
  for (const pair of PAIRS) {
    const setup = { ...pair, ultimates };
    const fights = Array.from({ length: SEEDS }, (_, i) => fight(i + 1, setup, registry));
    const perTurn = Array.from({ length: TURNS }, (_, t) => mean(fights.map((f) => f.perTurn[t]!)));
    const total = perTurn.reduce((a, b) => a + b, 0);
    const cards = mean(fights.map((f) => f.cards));
    const ult = mean(fights.map((f) => f.ultimate.reduce((a, b) => a + b, 0)));
    rows.push([pair.name, ...perTurn.map(round), round(total), (total / cards).toFixed(1), round(ult)]);
    const r6 = (key: string) => mean(fights.map((f) => f.turn6[key] ?? 0)).toFixed(1);
    notes.push(`${pair.name}: at the start of turn 6, Tentacles ${r6('tentacles')} × ${r6('potency')} per hit, Essence ${r6('essence')}, Embryo ${r6('embryo')}.`);
  }
  console.log(`\n### ${ultimates ? 'With ultimates (fired when charged)' : 'Cards only (no ultimates)'}: mean damage per turn over ${SEEDS} seeds\n`);
  console.log(`| ${header.join(' | ')} |`);
  console.log(`|${header.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`);
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
  console.log('');
  for (const note of notes) console.log(`- ${note}`);
}

/** Every `k × Essence` inside a formula, multiplied by `by`. */
function scaleEssence(f: Formula, by: number): Formula {
  if (typeof f !== 'object') return f;
  if ('mul' in f) {
    const essence = f.mul.some((t) => typeof t === 'object' && 'resource' in t && t.resource === 'essence');
    return { mul: essence ? f.mul.map((t) => (typeof t === 'number' ? t * by : t)) : f.mul.map((t) => scaleEssence(t, by)) };
  }
  if ('add' in f) return { add: f.add.map((t) => scaleEssence(t, by)) };
  return f;
}
const mapAmounts = (calls: CardDef['effects'], fn: (f: Formula) => Formula): CardDef['effects'] =>
  calls.map((c) => ({ ...c, ...(c.amount !== undefined ? { amount: fn(c.amount as Formula) } : {}), ...(Array.isArray(c.branch) ? { branch: mapAmounts(c.branch as CardDef['effects'], fn) } : {}) }));

/** Rituals deal more per Essence: every k × Essence on a Ritual card becomes `by` × k (`ritual-1.6`). */
const ritualScale = (by: number) => (r: Registry): Registry => ({
  ...r,
  cards: Object.fromEntries(Object.entries(r.cards).map(([id, c]) => [id, hasKeyword(c.keywords, 'ritual') ? { ...c, effects: mapAmounts(c.effects, (f) => scaleEssence(f, by)) } : c])),
});

/** Spirit's levers (docs/notes/banner-kits.md), applied to a copy of the registry. */
const VARIANTS: Record<string, (r: Registry) => Registry> = {
  // Held Rituals give 2 Essence each at end of turn, from each passive that pays for them.
  'held-2': (r) => ({
    ...r,
    characters: Object.fromEntries(
      Object.entries(r.characters).map(([id, ch]) => {
        const triggers = ch.passive?.triggers?.map((t) =>
          t.on === 'turnEnd' ? { ...t, do: mapAmounts(t.do, (f) => (typeof f === 'object' && 'handCount' in f ? { mul: [2, f] } : f)) } : t,
        );
        return [id, ch.passive && triggers ? { ...ch, passive: { ...ch.passive, triggers } } : ch];
      }),
    ),
  }),
  // Kyubi's Judgement gives back half the Essence it consumed (her C5 draft, at C0).
  'keep-half': (r) => {
    const kibane = r.characters['kibane'];
    const keep = (calls: CardDef['effects']) =>
      calls.map((c) => (c.op === 'ifConsume' ? { ...c, branch: [...(c.branch as CardDef['effects']), { op: 'gainResource', resource: 'essence', amount: { mul: [0.5, { consumed: true }] } }] } : c));
    if (!kibane?.ultimate) return r;
    const u = kibane.ultimate;
    const ultimate = { ...u, effects: keep(u.effects), ...(u.transcended ? { transcended: { ...u.transcended, effects: keep(u.transcended.effects) } } : {}) };
    return { ...r, characters: { ...r.characters, kibane: { ...kibane, ultimate } } };
  },
};

let registry = await loadRegistry();
const variants = values.variant ? values.variant.split(',') : [];
for (const name of variants) {
  const ritual = /^ritual-([\d.]+)$/.exec(name);
  const tweak = ritual ? ritualScale(Number(ritual[1])) : VARIANTS[name];
  if (!tweak) throw new Error(`Unknown variant "${name}". Variants: ritual-<multiplier>, ${Object.keys(VARIANTS).join(', ')}`);
  registry = tweak(registry);
}
if (variants.length) console.log(`Variants: ${variants.join(', ')} (Spirit's levers, on a copy of the content)`);
report(registry, true);
report(registry, false);
