// Potential (docs/notes/starter-kits.md, "Potential"): how much each P level moves a party's damage and
// Shield, for every character's real P1–P5, with each member in turn climbing P1 to P5 while the rest
// stay at P0. Then the owner's question (15 Nov): Isadora's P5, a second end-of-turn attack, against
// alternatives built in a copy of the content (nothing in the game changes). Seeded fights against
// practice dummies at level 40 with every ascension, played by the lab's simple player.
// The first draft of the starters' levels, measured here on 15 Nov, is in the note and in git history.
// A measuring tool, not a test. Run `npm run lab:potential -- [--seeds 50] [--turns 10] [--enemies 1]`.
import { parseArgs } from 'node:util';
import { gte, mul, resource, volley, when, type CardDef, type DupeDef, type PassiveDef, type Registry } from '../../src/engine/index.ts';
import { variant } from '../../src/content/define.ts';
import { tentacleVolley } from '../../src/content/domains/rapture.ts';
import * as isadora from '../../src/content/characters/isadora.ts';
import { DUMMY, fight, mean, type Setup } from './play.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '50' },
    turns: { type: 'string', default: '10' },
    enemies: { type: 'string', default: '1' },
    level: { type: 'string', default: '40' },
    // Only Isadora's P5 table.
    isadora: { type: 'boolean', default: false },
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
const RAPTURE = PARTIES[2]!;

const loaded = await loadRegistry();
// The dummy has 9,999 HP, which a level-40 party breaks; here it can't fall, so damage isn't capped.
const registry: Registry = { ...loaded, enemies: { ...loaded.enemies, [DUMMY]: { ...loaded.enemies[DUMMY]!, hp: 1e9 } } };

const run = (setup: Setup, content: Registry, dupes: number[]) =>
  Array.from({ length: SEEDS }, (_, i) => fight(i + 1, setup, content, { turns: TURNS, enemies: ENEMIES, level: LEVEL, ascensions: ASCENSIONS, dupes }));
const total = (fights: ReturnType<typeof run>) => mean(fights.map((f) => f.perTurn.reduce((a, b) => a + b, 0)));
const pct = (x: number, of: number) => (of === 0 ? '—' : `${x >= of ? '+' : ''}${Math.round(((x - of) / of) * 100)}%`);
const against = `level ${LEVEL} with ${ASCENSIONS} ascensions, ${SEEDS} seeds, ${TURNS} turns against ${ENEMIES === 1 ? 'one dummy' : `${ENEMIES} dummies`}`;

if (!values.isadora) {
console.log(`\n### Party damage as one member climbs P1 to P5, ${against}\n`);
console.log("Each cell is the party's damage against everyone at P0; the last column is its Shield at P5.\n");
console.log('| Party | Member | P1 | P2 | P3 | P4 | P5 | Shield at P5 |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|');
for (const setup of PARTIES) {
  const zero = setup.party.map(() => 0);
  const base = run(setup, registry, zero);
  const baseShield = mean(base.map((f) => f.shield));
  setup.party.forEach((member, i) => {
    const cells = [1, 2, 3, 4, 5].map((p) => run(setup, registry, zero.map((z, j) => (j === i ? p : z))));
    const shield = mean(cells[4]!.map((f) => f.shield));
    console.log(`| ${setup.name} | ${registry.characters[member]!.name} | ${cells.map((c) => pct(total(c), total(base))).join(' | ')} | ${pct(shield, baseShield)} |`);
  });
}
}

// Isadora's P5 (owner, 15 Nov: Rapt on every volley from a card) and the alternatives it was chosen from.
// The P4 level's Rapt (P1's +2, once a turn) is the base the alternatives build on.
type Triggers = NonNullable<PassiveDef['triggers']>;
const P1_RAPT = isadora.isadora.dupes![0]!.passive! as PassiveDef & { triggers: Triggers };
const raptTrigger = P1_RAPT.triggers[0]!;
const rapt = (triggers: Triggers): DupeDef => ({ text: 'Lab.', passive: { ...P1_RAPT, text: 'Lab.', triggers } });
const spin3: CardDef = variant(isadora.ecstaticSpin, 5, { cost: 3, effects: [tentacleVolley(), tentacleVolley(), tentacleVolley()], text: 'Lab.' });
const ALTERNATIVES: [string, DupeDef | undefined][] = [
  ['Before: Tentacles attack twice at end of turn', rapt([raptTrigger, { on: 'turnEnd', do: [tentacleVolley()] }])],
  ['Nothing (P5 adds no effect)', { text: 'Lab.' }],
  ['The second attack at half damage', rapt([raptTrigger, { on: 'turnEnd', do: [volley(resource('tentacles'), mul(0.5, resource('potency')))] }])],
  ['The second attack only with 10 or more Tentacles', rapt([raptTrigger, { on: 'turnEnd', do: [when(gte(resource('tentacles'), 10), [tentacleVolley()])] }])],
  ['Now: Rapt answers every volley from a card, not only the first', undefined],
  // Swaps chain: by P5 her deck holds P3's Ecstatic Spin, so that's the one replaced.
  ['Ecstatic Spin triggers a volley three times', { text: 'Lab.', cards: { [isadora.ecstaticSpinC3.id]: spin3.id } }],
];
const withP5 = (p5: DupeDef | undefined): Registry => {
  if (!p5) return registry;
  const def = registry.characters['isadora']!;
  return { ...registry, cards: { ...registry.cards, [spin3.id]: spin3 }, characters: { ...registry.characters, isadora: { ...def, dupes: [...def.dupes!.slice(0, 4), p5] } } };
};

console.log(`\n### Isadora's P5 in the Rapture party (Agathe, Isadora, Leonora, Hester), ${against}\n`);
console.log("Party damage with Isadora at P5 against everyone at P0 and against her at P4; then single turns' damage at P5 against P0.\n");
const perTurn = (fights: ReturnType<typeof run>) => Array.from({ length: TURNS }, (_, t) => mean(fights.map((f) => f.perTurn[t]!)));
const zero = run(RAPTURE, registry, [0, 0, 0, 0]);
const four = run(RAPTURE, registry, [0, 4, 0, 0]);
const zeroTurns = perTurn(zero);
const shown = [1, 3, 5, 8, 10, 15, 20].filter((t) => t <= TURNS);
console.log(`| P5 | vs P0 | vs P4 | ${shown.map((t) => `T${t}`).join(' | ')} |`);
console.log(`|---|---:|---:|${shown.map(() => '---:').join('|')}|`);
for (const [name, p5] of ALTERNATIVES) {
  const five = run(RAPTURE, withP5(p5), [0, 5, 0, 0]);
  const turns = perTurn(five);
  console.log(`| ${name} | ${pct(total(five), total(zero))} | ${pct(total(five), total(four))} | ${shown.map((t) => pct(turns[t - 1]!, zeroTurns[t - 1]!)).join(' | ')} |`);
}
console.log('');
