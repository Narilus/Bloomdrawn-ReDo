// Weapons (docs/notes/weapons.md, "The lab"; owner, 14 Nov): how much a weapon moves a party. Seeded
// fights against practice dummies at level 40 with every ascension, played by the lab's simple
// player, for each party with no weapons, an R or an SR of each member's Domain (the Attack ones),
// their signatures, the signatures' main stats alone (a blank copy), the signatures passed one place
// along (on the wrong characters), and the signatures at +5. The dummies never strike, so Shield is
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
/** The Domain's weapon of a rarity whose main stat is Attack. */
const attackWeapon = (domain: string, rarity: WeaponDef['rarity']) => weapons.find((w) => w.domain === domain && w.rarity === rarity && w.main.stat === 'attack')!;
const domainOf = (character: string) => registry.characters[character]!.domain;

// A blank copy of each signature: its main stat, no effect.
const blanks = Object.fromEntries(signaturesBlank().map((w) => [w.id, w]));
function signaturesBlank(): WeaponDef[] {
  return weapons.filter((w) => w.signature).map((w) => ({ ...w, id: `lab.blank.${w.id}`, steps: w.steps.map((s) => ({ text: s.text })) }));
}
// The dummy has 9,999 HP, which a level-40 party breaks; here it can't fall, so damage isn't capped.
const content: Registry = {
  ...registry,
  weapons: { ...registry.weapons, ...blanks },
  enemies: { ...registry.enemies, [DUMMY]: { ...registry.enemies[DUMMY]!, hp: 1e9 } },
};

const LOADOUTS: [string, (party: string[]) => (Wielded | null)[]][] = [
  ['None', (p) => p.map(() => null)],
  ['R (Domain, Attack)', (p) => p.map((c) => ({ weapon: attackWeapon(domainOf(c), 'r').id }))],
  ['SR (Domain, Attack)', (p) => p.map((c) => ({ weapon: attackWeapon(domainOf(c), 'sr').id }))],
  ['Signatures', (p) => p.map((c) => ({ weapon: signatureOf(c).id }))],
  ['Signatures, main stat only', (p) => p.map((c) => ({ weapon: `lab.blank.${signatureOf(c).id}` }))],
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
console.log('\nSignatures on the wrong characters keep their main stats; only effects that fit the wielder apply.');
