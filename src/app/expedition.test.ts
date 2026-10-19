import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { startCombat, type CombatState } from '../engine/index.ts';
import { createBoard, type Tile } from '../game/board.ts';
import {
  canMove,
  chooseExpeditionRelic,
  expeditionFight,
  finishExpeditionFight,
  leaveTile,
  M3_EXPEDITION,
  move,
  startExpedition,
  turnBack,
  type Expedition,
} from '../game/expedition.ts';
import { hexKey } from '../game/hex.ts';

// The Labyrinth run rules (src/game/expedition.ts) with the real content. Here because the game
// layer may not import content.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
const row = (...tiles: Tile[]) => Object.fromEntries(tiles.map((t, q) => [hexKey({ q, r: 0 }), t]));
/** A fresh expedition on a hand-made row of tiles. */
const on = (...tiles: Tile[]): Expedition => ({ ...startExpedition(1, PARTY, M3_EXPEDITION, registry.motifs), board: createBoard(row(...tiles), '0,0') });
const go = (exp: Expedition, to: string) => {
  const states = move(exp, to);
  if (!states) throw new Error(`No way to ${to}`);
  return states;
};
/** The fight the party stands on, ended as given. */
function ended(exp: Expedition, outcome: 'victory' | 'defeat', hp: number): CombatState {
  const state = startCombat(expeditionFight(exp, registry), registry).state;
  return { ...state, phase: 'ended', outcome, party: { ...state.party, hp }, members: state.members.map((m) => ({ ...m, gauge: 40 })) };
}
const HOUND = { kind: 'fight', content: 'encounter.hound' } as const;

describe('the expedition', () => {
  it('starts on a generated board at the entrance, at full HP with empty gauges', () => {
    const exp = startExpedition(3, PARTY, M3_EXPEDITION, registry.motifs);
    expect(exp.board.tiles[exp.board.at]!.kind).toBe('entrance');
    expect([exp.phase, exp.hp, exp.gauges]).toEqual(['map', null, [0, 0, 0, 0]]);
  });

  it('walks tile by tile and stops on a fight, which then uses that tile’s encounter', () => {
    const states = go(on({ kind: 'entrance' }, { kind: 'path' }, HOUND), '2,0');
    expect(states.map((s) => [s.board.at, s.phase])).toEqual([
      ['1,0', 'map'],
      ['2,0', 'fight'],
    ]);
    expect(expeditionFight(states[1]!, registry).enemies).toEqual(['enemy.bloom-rib-hound']);
  });

  it('a won fight clears the tile and carries HP and gauges into the next fight', () => {
    const fighting = go(on({ kind: 'entrance' }, HOUND, HOUND), '1,0').at(-1)!;
    const after = finishExpeditionFight(fighting, ended(fighting, 'victory', 150), M3_EXPEDITION);
    expect([after.phase, after.hp, after.gauges, after.board.tiles['1,0']]).toEqual(['map', 150, [40, 40, 40, 40], { kind: 'path' }]);
    const next = expeditionFight(go(after, '2,0').at(-1)!, registry);
    expect([next.partyHp, next.gauges]).toEqual([150, [40, 40, 40, 40]]);
  });

  it('an elite offers three relics; the Boss ends the run in victory; a loss ends it in defeat', () => {
    const elite = go(on({ kind: 'entrance' }, { kind: 'elite', content: 'encounter.thorn-wall' }), '1,0').at(-1)!;
    const reward = finishExpeditionFight(elite, ended(elite, 'victory', 120), M3_EXPEDITION);
    expect(reward.phase).toBe('reward');
    expect(reward.offered).toHaveLength(3);
    const picked = chooseExpeditionRelic(reward, reward.offered[0]!);
    expect([picked.phase, picked.relics]).toEqual(['map', [reward.offered[0]]]);

    const boss = go(on({ kind: 'entrance' }, { kind: 'boss', content: 'encounter.hound-mother' }), '1,0').at(-1)!;
    expect(finishExpeditionFight(boss, ended(boss, 'victory', 60), M3_EXPEDITION).phase).toBe('won');
    expect(finishExpeditionFight(boss, ended(boss, 'defeat', 0), M3_EXPEDITION).phase).toBe('lost');
  });

  it('on an unpaid Symptom the party must take it or turn back; it cannot walk on past', () => {
    const toll = go(on({ kind: 'entrance' }, { kind: 'symptom' }, { kind: 'path' }), '1,0').at(-1)!;
    expect([toll.phase, canMove(toll), move(toll, '2,0')]).toEqual(['tile', false, undefined]);
    expect(turnBack(toll)!.board.at).toBe('0,0');
    const paid = leaveTile(toll);
    expect([paid.phase, paid.board.tiles['1,0']!.paid]).toEqual(['map', true]);
    expect(go(paid, '2,0').at(-1)!.board.at).toBe('2,0');
  });

  it('a Shop is looked at and left, and stays; an Event is used up', () => {
    const shop = go(on({ kind: 'entrance' }, { kind: 'shop' }, { kind: 'event' }), '1,0').at(-1)!;
    expect([shop.phase, canMove(shop)]).toEqual(['tile', true]);
    const event = go(shop, '2,0').at(-1)!;
    expect(event.board.tiles['1,0']!.kind).toBe('shop');
    expect(leaveTile(event).board.tiles['2,0']).toEqual({ kind: 'path' });
  });
});
