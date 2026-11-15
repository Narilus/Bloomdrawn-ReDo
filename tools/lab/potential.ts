// Starter Potential (docs/notes/starter-kits.md, "Potential"; owner, 15 Nov: model the draft, which
// may give too many resources): how much each P level moves a party's damage and Shield, for the
// draft (A), a lighter set that adds little Tentacles, Embryo or Essence (B), and the banner four's
// real P1–P5 as the yardstick. Each member in turn climbs P1 to P5 while the rest stay at P0. Seeded
// fights against practice dummies at level 40 with every ascension, played by the lab's simple player.
// The draft levels live only here, in a copy of the content, until the owner approves some.
// A measuring tool, not a test. Run `npm run lab:potential -- [--seeds 50] [--turns 10] [--enemies 1]`.
import { parseArgs } from 'node:util';
import {
  add,
  applyStatus,
  cardHeld,
  changeCost,
  damage,
  draw,
  eventAmount,
  gainMana,
  gainResource,
  gainShield,
  gte,
  handCount,
  heal,
  heldTurns,
  ifConsume,
  manaDebt,
  manaSpent,
  mul,
  percentOf,
  resource,
  consumed,
  stat,
  when,
  type CardDef,
  type CharacterDef,
  type DupeDef,
  type PassiveDef,
  type Registry,
  type UltimateDef,
} from '../../src/engine/index.ts';
import { p2, variant } from '../../src/content/define.ts';
import { tentacleVolley } from '../../src/content/domains/rapture.ts';
import { poison } from '../../src/content/statuses/poison.ts';
import * as agathe from '../../src/content/characters/agathe.ts';
import * as maelia from '../../src/content/characters/maelia.ts';
import * as anthe from '../../src/content/characters/anthe.ts';
import * as leonora from '../../src/content/characters/leonora.ts';
import { DUMMY, fight, mean, type Setup } from './play.ts';
import { loadRegistry } from './registry.ts';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '50' },
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

const cards: Record<string, CardDef> = {};
const keep = (c: CardDef) => ((cards[c.id] = c), c);
type Triggers = NonNullable<PassiveDef['triggers']>;
const passive = (base: PassiveDef, triggers: Triggers): PassiveDef & { triggers: Triggers } => ({ ...base, text: 'Lab.', triggers });
const ultimate = (base: UltimateDef, effects: UltimateDef['effects'], transcended: UltimateDef['effects']): UltimateDef => ({
  ...base,
  text: 'Lab.',
  effects,
  transcended: { text: 'Lab.', effects: transcended },
});
const level = (text: string, def: Omit<DupeDef, 'text'>): DupeDef => ({ text, ...def });

// Agathe.
const A_HYMN = agathe.agathe.passive!;
const hymn = (start: number, extra: Triggers = []) => passive(A_HYMN, [{ on: 'combatStart', do: [gainResource('tentacles', start)] }, ...extra]);
const A_ULT = agathe.agathe.ultimate!;
const agatheA: DupeDef[] = [
  level('First Hymn gives 2 Tentacles.', { passive: hymn(2) }),
  p2(agathe.agathe.stats),
  level('Censer Rite costs 2.', { cards: { [agathe.censerRite.id]: keep(variant(agathe.censerRite, 3, { cost: 2 })).id } }),
  level('Hymn gains 5 Tentacles.', { ultimate: ultimate(A_ULT, [gainResource('tentacles', 5)], [gainResource('tentacles', 5), tentacleVolley()]) }),
  level('First Hymn also gains 1 Tentacle each turn.', { passive: hymn(2, [{ on: 'turnStart', do: [gainResource('tentacles', 1)] }]) }),
];
const shieldHymn = [{ on: 'combatStart' as const, do: [gainShield(mul(2, stat('defense')))] }];
const choirB = keep(
  variant(agathe.callTheChoir, 3, { effects: [gainResource('tentacles', 2), draw(1)], text: 'Gain {effects.0.amount} Tentacles. Draw {effects.1.count} card.' }),
);
const strikeB = keep(
  variant(agathe.strike, 5, { effects: [damage(mul(2.5, stat('attack'))), when(gte(resource('tentacles'), 4), [tentacleVolley()])], text: 'Lab.' }),
);
const agatheB: DupeDef[] = [
  level('First Hymn also gives the party Shield equal to twice her Defense.', { passive: hymn(1, shieldHymn) }),
  p2(agathe.agathe.stats),
  level('Call the Choir always draws its card.', { cards: { [agathe.callTheChoir.id]: choirB.id } }),
  level('Hymn of the Hundred Arms also triggers a volley before it Transcends.', { ultimate: ultimate(A_ULT, [gainResource('tentacles', 3), tentacleVolley()], A_ULT.transcended!.effects) }),
  level('Her Strike triggers a volley with 4 or more Tentacles.', { cards: { [agathe.strike.id]: strikeB.id } }),
];

// Maelia.
const M_HANDS = maelia.maelia.passive!;
const hands = (more: number, every = false, extra: Triggers[number]['do'] = []) =>
  passive(M_HANDS, [{ on: 'resourceGained', filter: { resource: 'embryo', direct: true }, ...(every ? {} : { once: 'turn' as const }), do: [gainResource('embryo', more), ...extra] }]);
const M_ULT = maelia.maelia.ultimate!;
const bloom = (x: number, poisonToo: boolean) => [
  ifConsume('embryo', resource('embryo'), [
    heal(mul(percentOf(1.43 * x, 'maxHp'), consumed())),
    gainShield(mul(mul(0.8 * x, stat('defense')), consumed())),
    ...(poisonToo ? [applyStatus(poison, mul(mul(0.34, stat('attack')), consumed()), 'allEnemies')] : []),
  ]),
];
const budC3 = keep(variant(maelia.budCutting, 3, { cost: 2 }));
const maeliaA: DupeDef[] = [
  level("Midwife's Hands gives 2 more.", { passive: hands(2) }),
  p2(maelia.maelia.stats),
  level('Bud Cutting costs 2.', { cards: { [maelia.budCutting.id]: budC3.id } }),
  level('Birthing Bloom heals and Shields half as much again.', { ultimate: ultimate(M_ULT, bloom(1.5, false), bloom(1.5, true)) }),
  level("Midwife's Hands works every time.", { passive: hands(2, true) }),
];
const maeliaB: DupeDef[] = [
  level("Midwife's Hands also gives the party Shield equal to her Defense.", { passive: hands(1, false, [gainShield(stat('defense'))]) }),
  p2(maelia.maelia.stats),
  level('Bud Cutting costs 2.', { cards: { [maelia.budCutting.id]: budC3.id } }),
  level('Birthing Bloom heals and Shields half as much again.', { ultimate: ultimate(M_ULT, bloom(1.5, false), bloom(1.5, true)) }),
  level('When Embryo is consumed, every enemy gains Poison for each.', {
    passive: {
      ...hands(1, false, [gainShield(stat('defense'))]),
      triggers: [
        ...hands(1, false, [gainShield(stat('defense'))]).triggers,
        { on: 'resourceConsumed', filter: { resource: 'embryo' }, do: [applyStatus(poison, mul(0.34, stat('attack'), eventAmount()), 'allEnemies')] },
      ],
    },
  }),
];

// Anthe.
const T_VIGIL = anthe.anthe.passive!;
const vigil = (per: number, extra: Triggers[number]['do'] = [], more: Triggers = []) =>
  passive(T_VIGIL, [{ on: 'turnEnd', do: [gainResource('essence', mul(per, handCount('ritual'))), ...extra] }, ...more]);
const T_ULT = anthe.anthe.ultimate!;
const candle = (per: number) => damage(mul(stat('attack'), add(2.67, mul(per, resource('essence')))));
const candleC3 = keep(variant(anthe.votiveCandle, 3, { effects: [candle(3)] }));
const candleC5 = keep({ ...variant(anthe.votiveCandle, 5, { effects: [candle(3), gainResource('essence', cardHeld())], text: 'Lab.' }) });
const antheA: DupeDef[] = [
  level('Vigil gives 3 Essence per Ritual.', { passive: vigil(3) }),
  p2(anthe.anthe.stats),
  level('Votive Candle deals 3 per Essence.', { cards: { [anthe.votiveCandle.id]: candleC3.id } }),
  level('Hours Kept gives 2 per turn held.', { ultimate: ultimate(T_ULT, [gainResource('essence', mul(2, heldTurns('ritual')))], [gainResource('essence', mul(3, heldTurns('ritual')))]) }),
  // In the game this would be a trigger on any Ritual she plays; her only starting Ritual is Votive Candle.
  level('Playing a Ritual gains 1 Essence per turn it was held.', { cards: { [candleC3.id]: candleC5.id } }),
];
const shieldVigil = [gainShield(mul(stat('defense'), handCount('ritual')))];
const antheB: DupeDef[] = [
  level('Vigil also gives the party Shield equal to her Defense for each Ritual in hand.', { passive: vigil(2, shieldVigil) }),
  p2(anthe.anthe.stats),
  level('Votive Candle costs 4.', { cards: { [anthe.votiveCandle.id]: keep(variant(anthe.votiveCandle, 3, { cost: 4 })).id } }),
  level('Hours Kept also draws 1 card.', {
    ultimate: ultimate(T_ULT, [gainResource('essence', heldTurns('ritual')), draw(1)], [gainResource('essence', mul(2, heldTurns('ritual'))), draw(1)]),
  }),
  level('Held Rituals cost 2 less at cleanup, not 1.', { passive: vigil(2, [...shieldVigil, changeCost(-1, 'hand', 'ritual')]) }),
];

// Leonora (the owner raised no worry about hers; one set).
const L_TAB = leonora.leonora.passive!;
const tab = (n: number, cheaper = false) => passive(L_TAB, [{ on: 'manaDebtPaid', do: [draw(n), ...(cheaper ? [changeCost(-1, 'next')] : [])] }]);
const L_ULT = leonora.leonora.ultimate!;
const leonoraA: DupeDef[] = [
  level('Running Tab draws 2.', { passive: tab(2) }),
  p2(leonora.leonora.stats),
  level('Promissory Note gains 5 Mana.', { cards: { [leonora.promissoryNote.id]: keep(variant(leonora.promissoryNote, 3, { effects: [gainMana(5), manaDebt(2)] })).id } }),
  level('Balance the Books also draws 2.', { ultimate: ultimate(L_ULT, [gainMana(manaSpent()), draw(2)], [gainMana(manaSpent()), draw(4)]) }),
  level('Running Tab also makes the next card cost 1 less.', { passive: tab(2, true) }),
];

const registry = await loadRegistry();
const SETS: Record<string, Record<string, DupeDef[]>> = {
  A: { agathe: agatheA, maelia: maeliaA, anthe: antheA, leonora: leonoraA },
  B: { agathe: agatheB, maelia: maeliaB, anthe: antheB, leonora: leonoraA },
};
const withSet = (set: Record<string, DupeDef[]>): Registry => ({
  ...registry,
  cards: { ...registry.cards, ...cards },
  characters: { ...registry.characters, ...Object.fromEntries(Object.entries(set).map(([id, dupes]) => [id, { ...registry.characters[id]!, dupes } satisfies CharacterDef])) },
  // The dummy has 9,999 HP, which a level-40 party breaks; here it can't fall, so damage isn't capped.
  enemies: { ...registry.enemies, [DUMMY]: { ...registry.enemies[DUMMY]!, hp: 1e9 } },
});
const CONTENT = { A: withSet(SETS.A!), B: withSet(SETS.B!) };

function measure(setup: Setup, content: Registry, dupes: number[]) {
  const fights = Array.from({ length: SEEDS }, (_, i) => fight(i + 1, setup, content, { turns: TURNS, enemies: ENEMIES, level: LEVEL, ascensions: ASCENSIONS, dupes }));
  return { damage: mean(fights.map((f) => f.perTurn.reduce((a, b) => a + b, 0))), shield: mean(fights.map((f) => f.shield)) };
}
const pct = (x: number, of: number) => (of === 0 ? '—' : `${x >= of ? '+' : ''}${Math.round(((x - of) / of) * 100)}%`);
const STARTER = new Set(['agathe', 'maelia', 'anthe', 'leonora']);

console.log(`\n### Party damage over ${TURNS} turns as one member climbs P1 to P5, level ${LEVEL} with ${ASCENSIONS} ascensions, ${SEEDS} seeds, against ${ENEMIES === 1 ? 'one dummy' : `${ENEMIES} dummies`}\n`);
console.log('Each cell is the party\'s damage against everyone at P0; the last column is its Shield at P5.\n');
console.log('| Party | Member | Set | P1 | P2 | P3 | P4 | P5 | Shield at P5 |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|');
for (const setup of PARTIES) {
  const zero = setup.party.map(() => 0);
  const base = measure(setup, CONTENT.A, zero);
  setup.party.forEach((member, i) => {
    const sets: [string, Registry][] = STARTER.has(member) ? (member === 'leonora' ? [['A', CONTENT.A]] : [['A', CONTENT.A], ['B', CONTENT.B]]) : [['banner', CONTENT.A]];
    for (const [name, content] of sets) {
      const cells = [1, 2, 3, 4, 5].map((p) => measure(setup, content, zero.map((z, j) => (j === i ? p : z))));
      const last = cells[4]!;
      console.log(`| ${setup.name} | ${registry.characters[member]!.name} | ${name} | ${cells.map((c) => pct(c.damage, base.damage)).join(' | ')} | ${pct(last.shield, base.shield)} |`);
    }
  });
}
console.log('\nA is the draft; B is the lighter set; banner is that character\'s real P1 to P5.\n');
