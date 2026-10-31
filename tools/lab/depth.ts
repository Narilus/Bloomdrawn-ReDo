// The depth model (docs/notes/m6-depth.md, "Depth tiers"; owner, 31 Oct): what a party at each level
// can take and deal, the enemy scaling that keeps a depth as hard as its level, and the reward
// multiplier that keeps levelling to 40 to a bounded number of runs. A measuring tool, not a test.
// Run `npm run lab:depth -- [--seeds 40] [--turns 6] [--growth 0.025] [--attack 1]`.
// `--growth` tries another per-level growth and `--attack` weighs Attack more in every card formula,
// both on a copy of the content; the game is unchanged.
import { parseArgs } from 'node:util';
import { LEVEL_GROWTH, statsAtLevel, type CardDef, type Formula, type Registry } from '../../src/engine/index.ts';
import { ASCENSIONS, expToNext, MAX_LEVEL, moneyToNext } from '../../src/game/levels.ts';
import { M3_EXPEDITION } from '../../src/game/expedition.ts';
import { fight, mean, type Setup } from './play.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '40' },
    turns: { type: 'string', default: '6' },
    growth: { type: 'string', default: String(LEVEL_GROWTH) },
    attack: { type: 'string', default: '1' },
    fights: { type: 'string', default: '6' },
    elites: { type: 'string', default: '2' },
  },
});
const SEEDS = Number(values.seeds);
const TURNS = Number(values.turns);
const GROWTH = Number(values.growth);
const ATTACK = Number(values.attack);
/** A won run's fights: normal fights and elites, then the Boss. */
const FIGHTS = Number(values.fights);
const ELITES = Number(values.elites);
const LEVELS = [1, 5, 10, 15, 20, 25, 30, 35, 40];
const DEPTH_MAX = 50;

const PARTIES: Omit<Setup, 'ultimates'>[] = [
  { name: 'Starters', party: ['agathe', 'maelia', 'anthe', 'leonora'] },
  { name: 'Flesh', party: ['maelia', 'virelle', 'leonora', 'hester'] },
  { name: 'Rapture', party: ['agathe', 'isadora', 'leonora', 'hester'] },
  { name: 'Spirit', party: ['anthe', 'kibane', 'leonora', 'hester'] },
];

/** Every `k × Attack` term in a formula weighed `by` more: `attack` alone becomes `by × attack`. */
function weighAttack(f: Formula, by: number): Formula {
  if (typeof f !== 'object') return f;
  if ('stat' in f && f.stat === 'attack') return { mul: [by, f] };
  if ('add' in f) return { add: f.add.map((t) => weighAttack(t, by)) };
  if ('mul' in f) return f.mul.some((t) => typeof t === 'object' && 'stat' in t) ? { mul: [by, ...f.mul] } : { mul: f.mul.map((t) => weighAttack(t, by)) };
  return f;
}
const weighCalls = (calls: CardDef['effects'], by: number): CardDef['effects'] =>
  calls.map((c) => ({ ...c, ...(c.amount !== undefined ? { amount: weighAttack(c.amount as Formula, by) } : {}), ...(Array.isArray(c.branch) ? { branch: weighCalls(c.branch as CardDef['effects'], by) } : {}) }));

/**
 * The content at a level under the model's growth: each character's base stats grown as `statsAtLevel`
 * would at GROWTH, and fought at level 1, so the engine's own growth adds nothing.
 */
function atLevel(base: Registry, level: number): Registry {
  const grow = (n: number) => Math.round(n * (1 + GROWTH * (level - 1)));
  const characters = Object.fromEntries(
    Object.entries(base.characters).map(([id, c]) => [id, { ...c, stats: { hp: grow(c.stats.hp), attack: grow(c.stats.attack), defense: grow(c.stats.defense) } }]),
  );
  return { ...base, characters };
}

const content = await loadRegistry();
const weighed: Registry = ATTACK === 1 ? content : { ...content, cards: Object.fromEntries(Object.entries(content.cards).map(([id, c]) => [id, { ...c, effects: weighCalls(c.effects, ATTACK) }])) };

// 1. The party at each level: HP pool, a Defense card's Shield, and damage per turn over a fight.
interface Row {
  level: number;
  hp: number;
  shield: number;
  damage: number;
}
const rows: Row[] = LEVELS.map((level) => {
  const registry = atLevel(weighed, level);
  const hp = mean(PARTIES.map((p) => p.party.reduce((n, id) => n + registry.characters[id]!.stats.hp, 0)));
  const shield = mean(PARTIES.flatMap((p) => p.party.map((id) => 5 + registry.characters[id]!.stats.defense)));
  const damage = mean(
    PARTIES.map((p) => {
      const fights = Array.from({ length: SEEDS }, (_, i) => fight(i + 1, { ...p, ultimates: true }, registry, { turns: TURNS, enemies: 1 }));
      return mean(fights.map((f) => f.perTurn.reduce((a, b) => a + b, 0) / TURNS));
    }),
  );
  return { level, hp, shield, damage };
});
const first = rows[0]!;
const pct = (n: number) => `${Math.round(n * 100)}%`;

console.log(`\n## The party by level\n`);
console.log(`Growth ${GROWTH * 100}% of base per level${ATTACK === 1 ? '' : `, Attack weighed ×${ATTACK} in cards`}. Means over ${PARTIES.map((p) => p.name).join(', ')}; damage is per turn over ${TURNS} turns, ${SEEDS} seeds, against one dummy.\n`);
console.log('| Level | Party HP | vs L1 | Defense Shield | vs L1 | Damage per turn | vs L1 |');
console.log('|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) console.log(`| ${r.level} | ${Math.round(r.hp)} | ${pct(r.hp / first.hp)} | ${r.shield.toFixed(1)} | ${pct(r.shield / first.shield)} | ${Math.round(r.damage)} | ${pct(r.damage / first.damage)} |`);

// 2. Enemies: HP follows the party's damage and damage follows its HP, so a depth at the party's
// level lasts as long and hurts as much as Depth 1 at level 1. Fitted as straight lines to 40;
// past 40 the party stops growing, and enemies go on by CHALLENGE a level, compounding.
const CHALLENGE = 0.04;
const slope = (ys: number[]) => {
  // Least squares through (1, 1): y − 1 = a (level − 1).
  const xs = rows.map((r) => r.level - 1);
  return xs.reduce((n, x, i) => n + x * (ys[i]! - 1), 0) / xs.reduce((n, x) => n + x * x, 0);
};
const hpSlope = slope(rows.map((r) => r.damage / first.damage));
const damageSlope = slope(rows.map((r) => r.hp / first.hp));
const curve = (a: number, level: number) => (1 + a * (Math.min(level, MAX_LEVEL) - 1)) * (1 + CHALLENGE) ** Math.max(0, level - MAX_LEVEL);

console.log(`\n## Enemies by level\n`);
console.log(`Fitted: enemy HP +${(hpSlope * 100).toFixed(2)}% of level 1 per level (the party's damage), enemy damage +${(damageSlope * 100).toFixed(2)}% per level (the party's HP); past ${MAX_LEVEL}, both +${CHALLENGE * 100}% a level, compounding.\n`);
console.log('| Enemy level | HP | Damage |');
console.log('|---:|---:|---:|');
for (const level of [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) console.log(`| ${level} | ×${curve(hpSlope, level).toFixed(2)} | ×${curve(damageSlope, level).toFixed(2)} |`);

// 3. Rewards: what each band of ten levels costs one character, what a won run pays at Depth 1,
// and a multiplier rising with depth so that about one won run (no Fruiting) levels one character
// through the band at its depths.
const { items } = M3_EXPEDITION.banking;
const EXP: Record<string, number> = { 'memory.faint': 100, 'memory.clear': 500, 'memory.vivid': 2000 };
const share = (s: Readonly<Record<string, number>>, key: 'exp' | 'money') =>
  Object.entries(s).reduce((n, [id, k]) => n + (key === 'money' ? (id === 'money' ? k : 0) : (EXP[id] ?? 0) * k), 0);
const runExp = FIGHTS * share(items.fight, 'exp') + ELITES * share(items.elite, 'exp') + share(items.boss, 'exp');
const runMoney = FIGHTS * share(items.fight, 'money') + ELITES * share(items.elite, 'money') + share(items.boss, 'money');
const bands = [0, 1, 2, 3].map((k) => {
  const from = Math.max(1, 10 * k);
  let exp = 0;
  let money = ASCENSIONS[k]?.money ?? 0;
  for (let level = from; level < 10 * (k + 1); level++) {
    exp += expToNext(level);
    money += moneyToNext(level);
  }
  return { from, to: 10 * (k + 1), exp, money, mid: 10 * k + 5 };
});
const PER_DEPTH = 0.25;
const multiplier = (depth: number) => 1 + PER_DEPTH * (depth - 1);

console.log(`\n## Rewards by depth\n`);
console.log(`A won run of ${FIGHTS} fights, ${ELITES} elites and the Boss pays ${runExp.toLocaleString('en-GB')} EXP and ${runMoney.toLocaleString('en-GB')} Ducats at Depth 1 (before Fruiting). Multiplier: 1 + ${PER_DEPTH} × (depth − 1).\n`);
console.log('| Levels | EXP | Ducats (with ascension) | At depth | Multiplier | Runs for EXP | Runs for Ducats |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const b of bands) {
  const m = multiplier(b.mid);
  console.log(`| ${b.from}–${b.to} | ${b.exp.toLocaleString('en-GB')} | ${b.money.toLocaleString('en-GB')} | ${b.mid} | ×${m.toFixed(2)} | ${(b.exp / (runExp * m)).toFixed(2)} | ${(b.money / (runMoney * m)).toFixed(2)} |`);
}
const total = bands.reduce((n, b) => n + b.exp, 0);
console.log(`\nLevel 1 to 40 is ${total.toLocaleString('en-GB')} EXP: ${(total / runExp).toFixed(0)} won runs at Depth 1, or about ${bands.reduce((n, b) => n + b.exp / (runExp * multiplier(b.mid)), 0).toFixed(1)} raising the depth with the band.`);
console.log(`\n| Depth | 1 | 10 | 20 | 30 | 40 | ${DEPTH_MAX} |\n|---|---:|---:|---:|---:|---:|---:|\n| Multiplier | ${[1, 10, 20, 30, 40, DEPTH_MAX].map((d) => `×${multiplier(d).toFixed(2)}`).join(' | ')} |`);

// A check that the model's growth at the game's own rate matches the engine's.
if (GROWTH === LEVEL_GROWTH) {
  const engine = statsAtLevel(content.characters['maelia']!.stats, 40);
  const model = atLevel(content, 40).characters['maelia']!.stats;
  if (JSON.stringify(engine) !== JSON.stringify(model)) throw new Error(`The model's growth ${JSON.stringify(model)} differs from the engine's ${JSON.stringify(engine)}`);
}
