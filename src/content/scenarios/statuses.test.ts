import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
  damage,
  intentOf,
  previewCard,
  previewIntent,
  startCombat,
  type CardDef,
  type CombatState,
  type Command,
  type EnemyDef,
  type Registry,
} from '../../engine/index.ts';
import { registry as gameRegistry } from '../registry.ts';
import { STARTER_PARTY } from '../testing/scenario.ts';

// The launch statuses (DESIGN.md, docs/notes/m2-content.md). Damage over time on enemies lands at
// the end of the party's turn, on the party after the enemy phase. Turn counts drop at the end of
// the turns they matter on, except the turn they land in (owner, 19 Oct). Agathe's First Hymn
// Tentacle (3 damage) hits at every end of turn.

const stunCard: CardDef = { id: 'test.stun', name: 'Stun', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [applyStatus({ id: 'status.stun' }, 1)] };
const delayCard: CardDef = { ...stunCard, id: 'test.delay', effects: [applyStatus({ id: 'status.delay' }, 1)] };
const vulnerableCard: CardDef = { ...stunCard, id: 'test.vulnerable', effects: [applyStatus({ id: 'status.vulnerable' }, 1)] };
const weakCard: CardDef = { ...stunCard, id: 'test.weak', effects: [applyStatus({ id: 'status.weak' }, 1)] };
const resister: EnemyDef = { ...gameRegistry.enemies['enemy.bloom-rib-hound']!, id: 'test.resister', traits: ['resistsControl'] };
// Hex: the party gains Vulnerable 1; then Strike 10.
const hexer: EnemyDef = {
  id: 'test.hexer', name: 'Hexer', hp: 100,
  intents: [
    { id: 'hex', name: 'Hex', effects: [applyStatus({ id: 'status.vulnerable' }, 1)] },
    { id: 'strike', name: 'Strike', effects: [damage(10, { target: 'party' })] },
  ],
};
const testCards = [stunCard, delayCard, vulnerableCard, weakCard];
const registry: Registry = {
  ...gameRegistry,
  cards: { ...gameRegistry.cards, ...Object.fromEntries(testCards.map((c) => [c.id, c])) },
  enemies: { ...gameRegistry.enemies, [resister.id]: resister, [hexer.id]: hexer },
};
const HOUND = 'enemy.bloom-rib-hound';
// The Hound's HP is tuned often; these tests are about the statuses, not the number.
const HOUND_HP = gameRegistry.enemies[HOUND]!.hp;

const begin = (enemies = [HOUND]) => startCombat({ seed: 4, party: STARTER_PARTY, enemies }, registry).state;
function run(state: CombatState, command: Command) {
  const result = apply(state, command, registry);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const endTurn: Command = { type: 'endTurn' };
function hold(state: CombatState, card: string) {
  const owner = state.members.find((m) => m.character === registry.cards[card]?.owner)!;
  const instance = { uid: `c${state.nextUid++}`, card, owner: owner.id };
  state.piles.hand.push(instance);
  return instance;
}
const hound = (s: CombatState) => s.enemies[0]!;

describe('Bleed', () => {
  it('on an enemy: at the end of your turn, damage equal to stacks through Shield, then −1', () => {
    const state = begin();
    hound(state).statuses.push({ status: 'status.bleed', stacks: 4 });
    hound(state).shield = 50;
    const after = run(state, endTurn).state;
    // The Tentacle's 3 hits the Shield; Bleed's 4 goes straight to HP.
    expect(hound(after).hp).toBe(HOUND_HP - 4);
    expect(hound(after).statuses).toEqual([{ status: 'status.bleed', stacks: 3 }]);
  });

  it('on the party: ticks after the enemy phase, and is gone at 0', () => {
    const state = begin();
    state.party.statuses.push({ status: 'status.bleed', stacks: 1 });
    const { state: after, events } = run(state, endTurn);
    const types = events.map((e) => (e.type === 'damageDealt' ? `hit:${e.source}` : e.type));
    expect(types.indexOf('hit:party')).toBeGreaterThan(types.indexOf('enemyActed'));
    expect(after.party.hp).toBe(210 - 12 - 1);
    expect(after.party.statuses).toEqual([]);
  });
});

describe('Poison', () => {
  it('on the party: ticks after the enemy phase, Shield first, and never decays', () => {
    const state = begin();
    state.party.statuses.push({ status: 'status.poison', stacks: 5 });
    state.party.shield = 14;
    const after = run(state, endTurn).state;
    // Bite 12 leaves 2 Shield; Poison 5 takes it and 3 HP.
    expect(after.party.hp).toBe(210 - 3);
    expect(after.party.statuses).toEqual([{ status: 'status.poison', stacks: 5 }]);
  });
});

describe('Vulnerable and Weak', () => {
  it('Vulnerable on an enemy: your hits deal 50% more, previewed, until the end of your turn', () => {
    const state = begin();
    hound(state).statuses.push({ status: 'status.vulnerable', stacks: 1 });
    const strike = hold(state, 'leonora.strike');
    const command: Command = { type: 'playCard', card: strike.uid, target: hound(state).id };
    expect(previewCard(state, command, registry)?.find((p) => p.op === 'damage')?.amount).toBe(16);
    const played = run(state, command).state;
    expect(hound(played).hp).toBe(HOUND_HP - 16);
    expect(hound(run(played, endTurn).state).statuses).toEqual([]);
  });

  it('Weak on the party: every member and the Tentacles deal 25% less, then it counts down at the end of your turn', () => {
    const state = begin();
    state.party.statuses.push({ status: 'status.weak', stacks: 2 });
    const strike = hold(state, 'leonora.strike');
    const played = run(state, { type: 'playCard', card: strike.uid, target: hound(state).id }).state;
    expect(hound(played).hp).toBe(HOUND_HP - 8); // 11 × 0.75, rounded down
    const after = run(played, endTurn).state;
    expect(hound(after).hp).toBe(HOUND_HP - 8 - 2); // the Tentacle's 3 × 0.75
    expect(after.party.statuses).toEqual([{ status: 'status.weak', stacks: 1 }]);
  });

  it("Vulnerable on the party and Weak on the Hound change the Hound's shown and dealt damage alike", () => {
    // Both matter on the enemies' turn and count down at its end, so a single stack covers the bite.
    const cases = [
      ['party', 1, 18],
      ['hound', 1, 9],
    ] as const;
    for (const [side, stacks, expected] of cases) {
      const state = begin();
      if (side === 'party') state.party.statuses.push({ status: 'status.vulnerable', stacks });
      else hound(state).statuses.push({ status: 'status.weak', stacks });
      expect(previewIntent(state, hound(state).id, registry)[0]?.amount).toBe(expected);
      const after = run(state, endTurn).state;
      expect(after.party.hp).toBe(210 - expected);
      expect([...after.party.statuses, ...hound(after).statuses]).toEqual([]);
    }
  });

  it('Vulnerable you put on an enemy: the rest of this turn, then your whole next turn', () => {
    const state = begin();
    const vulnerable = hold(state, 'test.vulnerable');
    const marked = run(state, { type: 'playCard', card: vulnerable.uid, target: hound(state).id }).state;
    const strike = (s: CombatState) => run(s, { type: 'playCard', card: hold(s, 'leonora.strike').uid, target: hound(s).id }).state;
    expect(HOUND_HP - hound(strike(marked)).hp).toBe(16);
    // It landed this turn, so this turn's end doesn't count.
    const next = run(marked, endTurn).state;
    expect(hound(next).statuses).toEqual([{ status: 'status.vulnerable', stacks: 1 }]);
    expect(hound(next).hp - hound(strike(next)).hp).toBe(16);
    expect(hound(run(next, endTurn).state).statuses).toEqual([]);
  });

  it('Weak you put on an enemy: its next action, then gone', () => {
    const state = begin();
    const weak = hold(state, 'test.weak');
    const marked = run(state, { type: 'playCard', card: weak.uid, target: hound(state).id }).state;
    expect(previewIntent(marked, hound(marked).id, registry)[0]?.amount).toBe(9);
    const after = run(marked, endTurn).state;
    expect(after.party.hp).toBe(210 - 9);
    expect(hound(after).statuses).toEqual([]);
  });

  it('Vulnerable an enemy puts on the party: it shows through your turn and lasts through the next enemy turn', () => {
    const hexed = run(begin(['test.hexer']), endTurn).state;
    // It landed in the enemy turn, so that turn's end doesn't count.
    expect(hexed.party.statuses).toEqual([{ status: 'status.vulnerable', stacks: 1 }]);
    expect(previewIntent(hexed, hound(hexed).id, registry)[0]?.amount).toBe(15);
    const after = run(hexed, endTurn).state;
    expect(hexed.party.hp - after.party.hp).toBe(15);
    expect(after.party.statuses).toEqual([]);
  });

  it("the enemies' turn is one moment: Vulnerable an enemy applies doesn't boost the enemies after it that turn", () => {
    const state = begin(['test.hexer', HOUND]);
    const houndOf = (s: CombatState) => s.enemies[1]!;
    expect(previewIntent(state, houndOf(state).id, registry)[0]?.amount).toBe(12);
    const hexed = run(state, endTurn).state;
    expect(210 - hexed.party.hp).toBe(12);
    // From the next enemy turn it holds: Bristle's 6 becomes 9.
    expect(previewIntent(hexed, houndOf(hexed).id, registry).find((p) => p.op === 'damage')?.amount).toBe(9);
  });
});

describe('Stun, Delay and Falter', () => {
  it('Stun: the Hound skips its action, that intent is lost, and the next is revealed', () => {
    const state = begin();
    const card = hold(state, 'test.stun');
    const stunned = run(state, { type: 'playCard', card: card.uid, target: hound(state).id }).state;
    expect(previewIntent(stunned, hound(stunned).id, registry)).toEqual([]);
    const after = run(stunned, endTurn).state;
    expect(after.party.hp).toBe(210);
    expect(intentOf(hound(after), registry)?.name).toBe('Bristle');
    expect(hound(after).statuses).toEqual([]);
  });

  it('Delay: the Hound skips its action, and the same intent stays shown', () => {
    const state = begin();
    const card = hold(state, 'test.delay');
    const after = run(run(state, { type: 'playCard', card: card.uid, target: hound(state).id }).state, endTurn).state;
    expect(after.party.hp).toBe(210);
    expect(intentOf(hound(after), registry)?.name).toBe('Bite');
  });

  it('control resistance: Stun lands as Falter, which cuts its next action by 25%, then ends', () => {
    const state = begin(['test.resister']);
    const card = hold(state, 'test.stun');
    const faltered = run(state, { type: 'playCard', card: card.uid, target: hound(state).id }).state;
    expect(hound(faltered).statuses).toEqual([{ status: 'status.falter', stacks: 1 }]);
    expect(previewIntent(faltered, hound(faltered).id, registry)[0]?.amount).toBe(9);
    const after = run(faltered, endTurn).state;
    expect(after.party.hp).toBe(210 - 9);
    expect(hound(after).statuses).toEqual([]);
    expect(intentOf(hound(after), registry)?.name).toBe('Bristle');
  });
});
