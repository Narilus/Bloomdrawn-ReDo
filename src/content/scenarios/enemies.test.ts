import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
  intentOf,
  isAlive,
  previewIntent,
  startCombat,
  type CardDef,
  type CombatState,
  type Command,
  type EnemyEntry,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// The M2 roster (docs/notes/m2-content.md). The party only ends turns here, so every change comes
// from the enemies (and Agathe's 3-damage First Hymn Tentacle at each end of turn).

const stunCard: CardDef = { id: 'test.stun', name: 'Stun', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [applyStatus({ id: 'status.stun' }, 1)] };
const registry: Registry = { ...gameRegistry, cards: { ...gameRegistry.cards, [stunCard.id]: stunCard } };

const begin = (enemies: EnemyEntry[]) => startCombat({ seed: 6, party: STARTER_PARTY, enemies }, registry).state;
const fromEncounter = (id: string) => begin(registry.encounters[id]!.enemies);
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const endTurn: Command = { type: 'endTurn' };
const turns = (state: CombatState, n: number) => Array.from({ length: n }).reduce<CombatState>((s) => run(s, endTurn).state, state);
const living = (s: CombatState) => s.enemies.filter(isAlive);

describe('Root-Mat (defender)', () => {
  it('Thicken: 14 Shield that lasts your turn; Shelter: every enemy gains 6', () => {
    const one = turns(fromEncounter('encounter.roots-and-smoke'), 1);
    // Thicken happens on its turn, after your Tentacle (which hit the lower-HP Acolyte), so all 14 stand through your next turn.
    expect(one.enemies[0]!.shield).toBe(14);
    const three = turns(one, 2);
    expect(three.enemies.map((e) => e.shield)).toEqual([6, 6]);
  });
});

describe('Censer Acolyte (debuffer)', () => {
  it('Smoke puts Weak on the whole party; Incense puts Vulnerable', () => {
    const state = begin(['enemy.censer-acolyte']);
    const one = turns(state, 1);
    // Weak 2, minus the party tick right after the enemy phase.
    expect(one.party.statuses).toEqual([{ status: 'status.weak', stacks: 1 }]);
    const three = turns(one, 2);
    expect(three.party.statuses).toEqual([{ status: 'status.vulnerable', stacks: 1 }]);
  });
});

describe('Pod-Thrower (summoner)', () => {
  it('Sow brings a Seedling into a free slot; it acts from the next round; at most two alive', () => {
    const start = fromEncounter('encounter.pods-and-lantern');
    expect(start.enemySlots).toBe(4);
    const sowed = turns(start, 2);
    const seedling = sowed.enemies.find((e) => e.enemy === 'enemy.seedling')!;
    expect(seedling.slot).toBe(2);
    // The round it arrived, it did not act: only the Pod-Thrower's Sow and the Surveyor acted.
    const acted = run(turns(start, 1), endTurn).events.filter((e) => e.type === 'enemyActed').map((e) => e.source);
    expect(acted).not.toContain(seedling.id);
    const later = turns(sowed, 6);
    expect(later.enemies.filter((e) => e.enemy === 'enemy.seedling' && isAlive(e))).toHaveLength(2);
  });
});

describe('Lantern Surveyor (buffer)', () => {
  it('Tend heals the weakest ally 10, never past its maximum', () => {
    const state = begin(['enemy.root-mat', 'enemy.lantern-surveyor']);
    state.enemies[0]!.hp = 30;
    const after = run(state, endTurn).state;
    // The Tentacle hit the Mat (lowest HP) for 3, then Tend healed it 10.
    expect(after.enemies[0]!.hp).toBe(30 - 3 + 10);
  });
});

describe('Thorn-Wall Matron (elite)', () => {
  it('Wall 25 Shield, then Thorn Lash 14 with 2 Bleed on the party; she resists control', () => {
    const state = fromEncounter('encounter.thorn-wall');
    const card = { uid: `c${state.nextUid++}`, card: 'test.stun', owner: 'm3' };
    state.piles.hand.push(card);
    const faltered = run(state, { type: 'playCard', card: card.uid, target: state.enemies[0]!.id }).state;
    expect(faltered.enemies[0]!.statuses).toEqual([{ status: 'status.falter', stacks: 1 }]);
    const one = run(faltered, endTurn).state;
    expect(one.enemies[0]!.shield).toBe(Math.floor(25 * 0.75));
    const two = run(one, endTurn).state;
    // Bleed 2 ticks once after the enemy phase: 14 + 2.
    expect(two.party.hp).toBe(210 - 14 - 2);
    expect(two.party.statuses).toEqual([{ status: 'status.bleed', stacks: 1 }]);
  });
});

describe('Hound Mother (elite)', () => {
  it('Howl summons two whelps into the flanking slots; a dead whelp frees its slot for the next Howl', () => {
    const start = fromEncounter('encounter.hound-mother');
    expect(start.enemySlots).toBe(3);
    const howled = run(start, endTurn).state;
    expect(howled.enemies.filter((e) => e.enemy === 'enemy.bloom-rib-whelp').map((e) => e.slot)).toEqual([1, 2]);
    howled.enemies[1]!.hp = 0;
    const again = turns(howled, 2);
    const whelps = again.enemies.filter((e) => e.enemy === 'enemy.bloom-rib-whelp');
    expect(whelps.map((e) => [e.slot, isAlive(e)])).toEqual([[1, false], [2, true], [1, true]]);
  });
});

describe('every encounter', () => {
  it.each(Object.keys(gameRegistry.encounters))('%s: shown intent damage always equals damage dealt', (id) => {
    let state = fromEncounter(id);
    for (let turn = 0; turn < 8 && state.phase === 'player'; turn++) {
      const shown = new Map(
        living(state).map((e) => [e.id, previewIntent(state, e.id, registry).filter((p) => p.op === 'damage').map((p) => p.amount)]),
      );
      const { state: next, events } = run(state, endTurn);
      for (const [enemy, amounts] of shown) {
        const dealt = events.filter((e) => e.type === 'damageDealt' && e.source === enemy && e.target === 'party').map((e) => e.amount);
        expect(dealt, `${id} turn ${turn} ${enemy}`).toEqual(amounts);
      }
      state = next;
    }
  });

  it('two Hounds take their HP from the encounter', () => {
    expect(fromEncounter('encounter.two-hounds').enemies.map((e) => [e.hp, e.maxHp])).toEqual([[70, 70], [70, 70]]);
    expect(intentOf(fromEncounter('encounter.two-hounds').enemies[1]!, registry)?.name).toBe('Bite');
  });
});
