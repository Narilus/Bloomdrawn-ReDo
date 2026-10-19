import { describe, expect, it } from 'vitest';
import {
  apply,
  applyStatus,
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

// The launch statuses (DESIGN.md, docs/notes/m2-content.md). Enemies' statuses tick at the end of
// the party's turn, the party's after the enemy phase (owner, 19 Oct). Agathe's First Hymn Tentacle
// (3 damage) hits at every end of turn.

const stunCard: CardDef = { id: 'test.stun', name: 'Stun', owner: 'leonora', cost: 0, target: 'chosenEnemy', effects: [applyStatus({ id: 'status.stun' }, 1)] };
const delayCard: CardDef = { ...stunCard, id: 'test.delay', effects: [applyStatus({ id: 'status.delay' }, 1)] };
const resister: EnemyDef = { ...gameRegistry.enemies['enemy.bloom-rib-hound']!, id: 'test.resister', traits: ['resistsControl'] };
const registry: Registry = {
  ...gameRegistry,
  cards: { ...gameRegistry.cards, [stunCard.id]: stunCard, [delayCard.id]: delayCard },
  enemies: { ...gameRegistry.enemies, [resister.id]: resister },
};
const HOUND = 'enemy.bloom-rib-hound';

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
    expect(hound(after).hp).toBe(150 - 4);
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
  it('Vulnerable on an enemy: your hits deal 50% more, previewed, until the end of its own turn', () => {
    const state = begin();
    hound(state).statuses.push({ status: 'status.vulnerable', stacks: 1 });
    const strike = hold(state, 'leonora.strike');
    const command: Command = { type: 'playCard', card: strike.uid, target: hound(state).id };
    expect(previewCard(state, command, registry)?.find((p) => p.op === 'damage')?.amount).toBe(16);
    const played = run(state, command).state;
    expect(hound(played).hp).toBe(150 - 16);
    expect(hound(run(played, endTurn).state).statuses).toEqual([]);
  });

  it('Weak on the party: every member and the Tentacles deal 25% less, then it counts down at the end of your turn', () => {
    const state = begin();
    state.party.statuses.push({ status: 'status.weak', stacks: 2 });
    const strike = hold(state, 'leonora.strike');
    const played = run(state, { type: 'playCard', card: strike.uid, target: hound(state).id }).state;
    expect(hound(played).hp).toBe(150 - 8); // 11 × 0.75, rounded down
    const after = run(played, endTurn).state;
    expect(hound(after).hp).toBe(150 - 8 - 2); // the Tentacle's 3 × 0.75
    expect(after.party.statuses).toEqual([{ status: 'status.weak', stacks: 1 }]);
  });

  it("Vulnerable on the party and Weak on the Hound change the Hound's shown and dealt damage alike", () => {
    // Turn counts drop at the end of their bearer's own turn (owner, 19 Oct): the party's Vulnerable 1
    // runs out before the Hound bites, Vulnerable 2 doesn't, and the Hound's Weak 1 lasts through its bite.
    const cases = [
      ['party', 1, 12],
      ['party', 2, 18],
      ['hound', 1, 9],
    ] as const;
    for (const [side, stacks, expected] of cases) {
      const state = begin();
      if (side === 'party') state.party.statuses.push({ status: 'status.vulnerable', stacks });
      else hound(state).statuses.push({ status: 'status.weak', stacks });
      expect(previewIntent(state, hound(state).id, registry)[0]?.amount).toBe(expected);
      const after = run(state, endTurn).state;
      expect(after.party.hp).toBe(210 - expected);
    }
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
