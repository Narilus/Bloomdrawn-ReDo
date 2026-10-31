// The depth model (docs/notes/m6-scaling.md, 4.10; owner, 31 Oct): what an Average and a Strong
// build deal and can take at each level, the enemy curves that keep a depth's turns-to-kill and threat
// where they are at Depth 1, and the reward multiplier (docs/notes/m6-depth.md). A measuring tool, not a test.
// Run `npm run lab:depth -- [--seeds 20] [--fights 6] [--elites 2]`.
//
// - Average build: every member at the depth's level (40 at most) with every ascension due made, C0,
//   no ultimates, the lab's simple player, averaged over the four parties.
// - Strong build: the same at C2 with ultimates fired. A single-Domain team needs four of a Domain and
//   the game has two each, so the three Domain pairs stand in for it.
// - Enemy HP (with Shield and heals) follows the Average build's damage, and enemy damage its HP, each
//   as a share of level 1, so every depth plays like Depth 1. Past 40 enemy HP climbs until a Strong
//   build at Depth 50 meets what an Average build meets at 40. The engine's curve (`ENEMY_CURVE`) is
//   set from this fit; its damage past 40 is the owner's call, not the fit's.
// - Real encounters: the Average build plays each encounter at a depth with the engine's curve, for
//   turns to win and threat. Level-1 enemies are tuned against these (owner, 31 Oct).
import { parseArgs } from 'node:util';
import { statsAt, withDupes, type EnemyDef, type Registry } from '../../src/engine/index.ts';
import { M3_EXPEDITION } from '../../src/game/expedition.ts';
import { ASCENSIONS, expToNext, MAX_LEVEL, moneyToNext } from '../../src/game/levels.ts';
import { encounterFight, fight, mean, type Setup } from './play.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '20' },
    fights: { type: 'string', default: '6' },
    elites: { type: 'string', default: '2' },
  },
});
const SEEDS = Number(values.seeds);
/** A won run's fights: normal fights and elites, then the Boss. */
const FIGHTS = Number(values.fights);
const ELITES = Number(values.elites);
const DEPTH_MAX = 50;
const SHOWN = [1, 10, 20, 30, 40, 50];

const PARTIES: Omit<Setup, 'ultimates'>[] = [
  { name: 'Starters', party: ['agathe', 'maelia', 'anthe', 'leonora'] },
  { name: 'Flesh', party: ['maelia', 'virelle', 'leonora', 'hester'] },
  { name: 'Rapture', party: ['agathe', 'isadora', 'leonora', 'hester'] },
  { name: 'Spirit', party: ['anthe', 'kibane', 'leonora', 'hester'] },
];
const STRONG = PARTIES.slice(1);

/** The owner's targets (m6-scaling.md, 4.10): turns an Average build takes, and an unkilled tier's damage a turn as a share of party HP. */
const TIERS = { normal: { window: 3 }, elite: { window: 6 }, boss: { window: 12 } } as const;
type Tier = keyof typeof TIERS;
const TIER_LIST = Object.keys(TIERS) as Tier[];

const content = await loadRegistry();
// A dummy nothing can kill, so long windows at high levels count every hit.
const registry: Registry = { ...content, enemies: { ...content.enemies, 'enemy.practice-dummy': { ...content.enemies['enemy.practice-dummy']!, hp: 1e9 } } };

/** Ascensions due at a level: every gate at or below it is made. */
const ascensionsAt = (level: number) => ASCENSIONS.filter((a) => a.at <= level).length;
const partyLevel = (depth: number) => Math.min(depth, MAX_LEVEL);

function partyHp(parties: Omit<Setup, 'ultimates'>[], level: number, dupes: number): number {
  return mean(
    parties.map((p) =>
      p.party.reduce((n, id) => {
        const c = withDupes(registry.characters[id]!, dupes);
        return n + statsAt(c.stats, c.role, level, ascensionsAt(level)).hp;
      }, 0),
    ),
  );
}

function dpt(parties: Omit<Setup, 'ultimates'>[], level: number, opts: { turns: number; enemies: number; ultimates: boolean; dupes: number }): number {
  return mean(
    parties.map((p) => {
      const fights = Array.from({ length: SEEDS }, (_, i) =>
        fight(i + 1, { ...p, ultimates: opts.ultimates }, registry, { turns: opts.turns, enemies: opts.enemies, level, ascensions: ascensionsAt(level), dupes: opts.dupes }),
      );
      return mean(fights.map((f) => f.perTurn.reduce((a, b) => a + b, 0) / opts.turns));
    }),
  );
}

// Level-1 enemies by tier, from the content: HP (every bar) and damage a turn (the mean of its
// intents' damage to the party), summed over a fight's enemies and averaged over its encounters.
type Call = { op: string; amount?: unknown; times?: unknown; branch?: unknown };
const intentDamage = (calls: readonly Call[]): number =>
  calls.reduce((n, c) => {
    if (c.op === 'damage' && typeof c.amount === 'number') return n + c.amount;
    if (c.op === 'repeat' && Array.isArray(c.branch)) return n + Number(c.times ?? 1) * intentDamage(c.branch as Call[]);
    return n;
  }, 0);
function enemyNumbers(e: EnemyDef) {
  const intents = [...(e.intents ?? []), ...(e.phases ?? []).flatMap((p) => p.intents)];
  const hits = intents.map((i) => intentDamage(i.effects as Call[]));
  return { hp: e.hp + (e.phases ?? []).reduce((n, p) => n + p.hp, 0), perTurn: mean(hits), biggest: Math.max(0, ...hits) };
}
function tierAtLevel1(tier: Tier) {
  const list = Object.values(registry.encounters)
    .filter((en) => en.tier === tier && en.id !== 'encounter.training' && !en.id.endsWith('full-bloom'))
    .map((en) => {
      const all = en.enemies.map((entry) => {
        const n = enemyNumbers(registry.enemies[typeof entry === 'string' ? entry : entry.enemy]!);
        return typeof entry === 'string' ? n : { ...n, hp: entry.hp };
      });
      return { count: all.length, hp: all.reduce((n, x) => n + x.hp, 0), perTurn: all.reduce((n, x) => n + x.perTurn, 0), biggest: Math.max(...all.map((x) => x.biggest)) };
    });
  return { count: Math.round(mean(list.map((x) => x.count))), hp: mean(list.map((x) => x.hp)), perTurn: mean(list.map((x) => x.perTurn)), biggest: mean(list.map((x) => x.biggest)) };
}
const level1 = Object.fromEntries(TIER_LIST.map((t) => [t, tierAtLevel1(t)])) as Record<Tier, ReturnType<typeof tierAtLevel1>>;

// The Average build at every level 1 to 40, and the Strong build where it's shown.
const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
const build = (parties: Omit<Setup, 'ultimates'>[], level: number, strong: boolean) => ({
  hp: partyHp(parties, level, strong ? 2 : 0),
  dpt: Object.fromEntries(TIER_LIST.map((t) => [t, dpt(parties, level, { turns: TIERS[t].window, enemies: level1[t].count, ultimates: strong, dupes: strong ? 2 : 0 })])) as Record<Tier, number>,
});
const average = levels.map((level) => build(PARTIES, level, false));
const strongBuilds = new Map(SHOWN.map((d) => partyLevel(d)).map((level) => [level, build(STRONG, level, true)]));

// Fit curve(L) = 1 + a (L − 1) + b × ascensions due, least squares over levels 1 to 40: HP from the
// Average build's elite-window damage, damage from its HP.
function fit(ys: number[]): { a: number; b: number } {
  const xs = levels.map((l) => [l - 1, ascensionsAt(l)] as const);
  const r = ys.map((y) => y - 1);
  const sxx = xs.reduce((n, [x]) => n + x * x, 0);
  const sxs = xs.reduce((n, [x, s]) => n + x * s, 0);
  const sss = xs.reduce((n, [, s]) => n + s * s, 0);
  const sxy = xs.reduce((n, [x], i) => n + x * r[i]!, 0);
  const ssy = xs.reduce((n, [, s], i) => n + s * r[i]!, 0);
  const det = sxx * sss - sxs * sxs;
  return { a: (sxy * sss - ssy * sxs) / det, b: (sxx * ssy - sxs * sxy) / det };
}
const first = average[0]!;
const top = average[MAX_LEVEL - 1]!;
const strongTop = strongBuilds.get(MAX_LEVEL)!;
const hpFit = fit(average.map((r) => r.dpt.elite / first.dpt.elite));
const dmgFit = fit(average.map((r) => r.hp / first.hp));
const pastHp = (strongTop.dpt.elite / top.dpt.elite - 1) / (DEPTH_MAX - MAX_LEVEL);
const pastDmg = (strongTop.hp / top.hp - 1) / (DEPTH_MAX - MAX_LEVEL);
const curve = (f: { a: number; b: number }, past: number, depth: number) => {
  const on = 1 + f.a * (Math.min(depth, MAX_LEVEL) - 1) + f.b * ascensionsAt(Math.min(depth, MAX_LEVEL));
  return on * (1 + past * Math.max(0, depth - MAX_LEVEL));
};

const round = (n: number) => Math.round(n).toLocaleString('en-GB');
const pct = (n: number) => `${Math.round(n)}%`;
console.log(`\n## The depth model (${SEEDS} seeds)\n`);
console.log(
  `Level-1 enemies from the content: a normal fight ${round(level1.normal.hp)} HP over ${level1.normal.count} enemies, dealing ${round(level1.normal.perTurn)} a turn; an elite ${round(level1.elite.hp)} HP, ${round(level1.elite.perTurn)} a turn; the Boss ${round(level1.boss.hp)} HP, ${round(level1.boss.perTurn)} a turn (biggest hit ${round(level1.boss.biggest)}).\n`,
);
console.log(
  `Fitted (share of level 1): HP 1 + ${hpFit.a.toFixed(4)} × (level − 1) + ${hpFit.b.toFixed(3)} × ascensions due; damage 1 + ${dmgFit.a.toFixed(4)} × (level − 1) + ${dmgFit.b.toFixed(3)} × ascensions due. Past 40, HP +${(pastHp * 100).toFixed(1)}% and damage +${(pastDmg * 100).toFixed(1)}% of level 40's a level.\n`,
);
const header = ['Depth', 'Party HP (Avg / Strong)', 'Damage a turn, elite window (Avg / Strong)', 'Normal fight HP', 'Elite HP', 'Boss HP', 'Normal dmg a turn', 'Elite dmg a turn', 'Boss dmg a turn (biggest)', 'HP ×', 'Dmg ×'];
console.log(`| ${header.join(' | ')} |`);
console.log(`|${header.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`);
const rows = SHOWN.map((depth) => ({ depth, avg: average[partyLevel(depth) - 1]!, strong: strongBuilds.get(partyLevel(depth))!, hpX: curve(hpFit, pastHp, depth), dmgX: curve(dmgFit, pastDmg, depth) }));
for (const { depth, avg, strong, hpX, dmgX } of rows) {
  console.log(
    `| ${depth} | ${round(avg.hp)} / ${round(strong.hp)} | ${round(avg.dpt.elite)} / ${round(strong.dpt.elite)} | ${round(level1.normal.hp * hpX)} | ${round(level1.elite.hp * hpX)} | ${round(level1.boss.hp * hpX)} | ${round(level1.normal.perTurn * dmgX)} | ${round(level1.elite.perTurn * dmgX)} | ${round(level1.boss.perTurn * dmgX)} (${round(level1.boss.biggest * dmgX)}) | ×${hpX.toFixed(2)} | ×${dmgX.toFixed(2)} |`,
  );
}
// Threat is what a tier deals a turn while it's unkilled: its intents' plain damage (not statuses or
// summons) as a share of party HP. Turns come from the real encounters below, which count enemy
// Shield, heals and summons that a dummy can't.
console.log(`\n### Threat against the targets\n`);
console.log('| Depth | Normal fight | Elite | Boss (biggest hit) |');
console.log('|---|---:|---:|---:|');
for (const { depth, avg, dmgX } of rows) {
  const threat = (t: Tier) => pct((100 * level1[t].perTurn * dmgX) / avg.hp);
  console.log(`| ${depth} | ${threat('normal')} | ${threat('elite')} | ${threat('boss')} (${pct((100 * level1.boss.biggest * dmgX) / avg.hp)}) |`);
}
console.log(`\nTargets: normal 2–3 turns (Strong about 1), 15–25% a turn; elite 5–6 (2–3), 25–35%; Boss 10–12 (4–5), 40–60% on big hits.`);

// The real encounters, played by the Average build at a depth with the engine's own enemy curve:
// turns to win and the damage the enemies deal a turn (before Shield) as a share of party HP.
const immortal: Registry = {
  ...registry,
  characters: Object.fromEntries(Object.entries(registry.characters).map(([id, c]) => [id, { ...c, stats: { ...c.stats, hp: c.stats.hp * 1000 }, ...(c.dupes && { dupes: c.dupes.map((d) => (d.stats ? { ...d, stats: { ...d.stats, hp: d.stats.hp * 1000 } } : d)) }) }])),
};
const MAX_TURNS = 30;
console.log(`\n### Real encounters, Average build (engine curve)\n`);
console.log('| Encounter | Tier | ' + [1, 20, 40].map((d) => `Depth ${d}: turns · threat a turn · worst turn`).join(' | ') + ' |');
console.log('|---|---|' + [1, 20, 40].map(() => '---:').join('|') + '|');
for (const en of Object.values(registry.encounters).filter((e) => e.id !== 'encounter.training' && !e.id.endsWith('full-bloom'))) {
  const cells = [1, 20, 40].map((depth) => {
    const level = partyLevel(depth);
    const runs = PARTIES.flatMap((p) =>
      Array.from({ length: Math.max(2, Math.round(SEEDS / 4)) }, (_, i) =>
        encounterFight(i + 1, { ...p, ultimates: false }, immortal, en.enemies, { level, ascensions: ascensionsAt(level), dupes: 0, enemyLevel: depth, maxTurns: MAX_TURNS }),
      ),
    );
    const hp = partyHp(PARTIES, level, 0);
    const turns = mean(runs.map((r) => r.turns));
    const threat = mean(runs.map((r) => mean(r.incoming.map((n) => n ?? 0)))) / hp;
    const worst = mean(runs.map((r) => Math.max(0, ...r.incoming.map((n) => n ?? 0)))) / hp;
    const lost = runs.filter((r) => !r.won).length;
    return `${turns.toFixed(1)}${lost ? ` (${lost} unwon)` : ''} · ${pct(threat * 100)} · ${pct(worst * 100)}`;
  });
  console.log(`| ${en.id.replace('encounter.', '')} | ${en.tier} | ${cells.join(' | ')} |`);
}

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
