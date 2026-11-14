// Weapons (docs/notes/weapons.md, "The lab"; owner, 14 Nov): how much a weapon moves a party. Seeded
// fights against practice dummies at level 40 with every ascension, played by the lab's simple
// player, for each party with no weapons, a set of four distinct Rs or SRs (a weapon at most once
// per team, owner 15 Nov), the SR set's main stats alone (blank copies), their signatures and their
// main stats alone, the signatures passed one place along (on the wrong characters), and +5. The dummies never strike, so Shield is
// counted, not tested. A measuring tool, not a test. Run `npm run lab:weapons -- [--seeds 100] [--turns 10] [--enemies 1]`.
import { parseArgs } from 'node:util';
import type { Registry, WeaponDef, Wielded } from '../../src/engine/index.ts';
import { DUMMY, fight, mean, type Setup } from './play.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '100' },
    turns: { type: 'string', default: '10' },
    enemies: { type: 'string', default: '1' },
    level: { type: 'string', default: '40' },
  },
});
const SEEDS = Number(values.seeds);
const TURNS = Number(values.turns);
const ENEMIES = Number(values.enemies);
const LEVEL = Number(values.level);
const ASCENSIONS = LEVEL >= 30 ? 3 : LEVEL >= 20 ? 2 : LEVEL >= 10 ? 1 : 0;

const PARTIES: Setup[] = [
  { name: 'Starters', party: ['maelia', 'agathe', 'anthe', 'leonora'], ultimates: true },
  { name: 'Flesh', party: ['maelia', 'virelle', 'leonora', 'hester'], ultimates: true },
  { name: 'Rapture', party: ['agathe', 'isadora', 'leonora', 'hester'], ultimates: true },
  { name: 'Spirit', party: ['anthe', 'kibane', 'leonora', 'hester'], ultimates: true },
];

const registry = await loadRegistry();
const weapons = Object.values(registry.weapons);
const signatureOf = (character: string) => weapons.find((w) => w.signature === character)!;
const domainOf = (character: string) => registry.characters[character]!.domain;

/**
 * A set of distinct weapons of one rarity, one per member front first (owner, 15 Nov: a weapon at most
 * once per team): her own Domain's Attack weapon if it's free, else any free Attack weapon of that
 * rarity (the Domains in order), else any free one.
 */
function distinctSet(party: string[], rarity: WeaponDef['rarity']): string[] {
  const used = new Set<string>();
  const pool = weapons.filter((w) => w.rarity === rarity);
  return party.map((c) => {
    const free = pool.filter((w) => !used.has(w.id));
    const pick = free.find((w) => w.domain === domainOf(c) && w.main.stat === 'attack') ?? free.find((w) => w.main.stat === 'attack') ?? free[0]!;
    used.add(pick.id);
    return pick.id;
  });
}

// A blank copy of every weapon: its main stat, no effect.
const blank = (id: string) => `lab.blank.${id}`;
const blanks = Object.fromEntries(weapons.map((w) => [blank(w.id), { ...w, id: blank(w.id), steps: w.steps.map((s) => ({ text: s.text })) }]));
// The dummy has 9,999 HP, which a level-40 party breaks; here it can't fall, so damage isn't capped.
const content: Registry = {
  ...registry,
  weapons: { ...registry.weapons, ...blanks },
  enemies: { ...registry.enemies, [DUMMY]: { ...registry.enemies[DUMMY]!, hp: 1e9 } },
};

const LOADOUTS: [string, (party: string[]) => (Wielded | null)[]][] = [
  ['None', (p) => p.map(() => null)],
  ['R set', (p) => distinctSet(p, 'r').map((weapon) => ({ weapon }))],
  ['SR set', (p) => distinctSet(p, 'sr').map((weapon) => ({ weapon }))],
  ['SR set, main stats only', (p) => distinctSet(p, 'sr').map((id) => ({ weapon: blank(id) }))],
  ['Signatures', (p) => p.map((c) => ({ weapon: signatureOf(c).id }))],
  ['Signatures, main stats only', (p) => p.map((c) => ({ weapon: blank(signatureOf(c).id) }))],
  ['Signatures, passed along', (p) => p.map((_, i) => ({ weapon: signatureOf(p[(i + 1) % p.length]!).id }))],
  ['Signatures at +5', (p) => p.map((c) => ({ weapon: signatureOf(c).id, step: 5 }))],
];

const pct = (x: number, of: number) => (of === 0 ? '—' : `${x >= of ? '+' : ''}${Math.round(((x - of) / of) * 100)}%`);

console.log(`\n### Damage and Shield over ${TURNS} turns, level ${LEVEL} with ${ASCENSIONS} ascensions, ${SEEDS} seeds, against ${ENEMIES === 1 ? 'one dummy' : `${ENEMIES} dummies`}\n`);
console.log('| Party | Loadout | Damage | vs none | Shield | vs none |');
console.log('|---|---|---:|---:|---:|---:|');
for (const setup of PARTIES) {
  let base: { damage: number; shield: number } | undefined;
  for (const [name, loadout] of LOADOUTS) {
    const fights = Array.from({ length: SEEDS }, (_, i) =>
      fight(i + 1, setup, content, { turns: TURNS, enemies: ENEMIES, level: LEVEL, ascensions: ASCENSIONS, weapons: loadout(setup.party) }),
    );
    const damage = mean(fights.map((f) => f.perTurn.reduce((a, b) => a + b, 0)));
    const shield = mean(fights.map((f) => f.shield));
    base ??= { damage, shield };
    console.log(`| ${setup.name} | ${name} | ${Math.round(damage)} | ${pct(damage, base.damage)} | ${Math.round(shield)} | ${pct(shield, base.shield)} |`);
  }
}
console.log('\nSignatures on the wrong characters keep their main stats; only effects that fit the wielder apply.\n');
const short = (id: string) => registry.weapons[id]!.name;
for (const setup of PARTIES) console.log(`- ${setup.name}: R set ${distinctSet(setup.party, 'r').map(short).join(', ')}; SR set ${distinctSet(setup.party, 'sr').map(short).join(', ')}.`);
