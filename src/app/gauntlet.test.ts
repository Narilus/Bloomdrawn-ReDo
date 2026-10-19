import { describe, expect, it } from 'vitest';
import { registry } from '../content/registry.ts';
import { apply, startCombat, validate, type CombatState, type Command } from '../engine/index.ts';
import { chooseRelic, fightSetup, finishFight, M2_GAUNTLET, startRun, type RunState } from '../game/run.ts';

// The M2 gauntlet run rules (src/game/run.ts) with the real content. They live here because the
// game layer may not import content.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];

/** Fire a charged ultimate, else play the first playable card at the first living enemy, else end the turn. */
function policy(state: CombatState): Command {
  const charged = state.members.find((m) => validate(state, { type: 'fireUltimate', member: m.id }, registry) === undefined);
  if (charged) return { type: 'fireUltimate', member: charged.id };
  const target = state.enemies.find((e) => e.hp > 0)?.id;
  for (const card of state.piles.hand) {
    for (const command of [{ type: 'playCard', card: card.uid }, { type: 'playCard', card: card.uid, target }] as Command[]) {
      if (validate(state, command, registry) === undefined) return command;
    }
  }
  return { type: 'endTurn' };
}

function fight(run: RunState): CombatState {
  let state = startCombat(fightSetup(run, registry), registry).state;
  for (let step = 0; step < 300 && state.phase !== 'ended'; step++) {
    const result = apply(state, policy(state), registry);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
  }
  return state;
}

/** Ends a fight at once with the given outcome, keeping everything else. */
const ended = (run: RunState, outcome: 'victory' | 'defeat', hp = 150): CombatState => {
  const state = startCombat(fightSetup(run, registry), registry).state;
  return { ...state, phase: 'ended', outcome, party: { ...state.party, hp }, members: state.members.map((m, i) => ({ ...m, gauge: 10 * (i + 1) })) };
};

describe('the gauntlet', () => {
  it('draws two different normal encounters, then an elite, all fixed by the seed', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = startRun(seed, PARTY, M2_GAUNTLET);
      const tiers = run.encounters.map((id) => registry.encounters[id]?.tier);
      expect(tiers).toEqual(['normal', 'normal', 'elite']);
      expect(run.encounters[0]).not.toBe(run.encounters[1]);
      expect(startRun(seed, PARTY, M2_GAUNTLET)).toEqual(run);
    }
  });

  it('starts with gauges at 0, then carries HP and gauges into the next fight', () => {
    const run = startRun(1, PARTY, M2_GAUNTLET);
    expect(fightSetup(run, registry).gauges).toEqual([0, 0, 0, 0]);
    const reward = finishFight(run, ended(run, 'victory', 150), M2_GAUNTLET);
    const next = chooseRelic(reward, reward.offered[0] ?? null);
    const setup = fightSetup(next, registry);
    expect([setup.partyHp, setup.gauges, setup.relics]).toEqual([150, [10, 20, 30, 40], [reward.offered[0]]]);
  });

  it('a win offers three relics not already held; taking nothing is allowed', () => {
    const run = startRun(2, PARTY, M2_GAUNTLET);
    const reward = finishFight(run, ended(run, 'victory'), M2_GAUNTLET);
    expect(reward.phase).toBe('reward');
    expect(new Set(reward.offered).size).toBe(3);
    const second = finishFight(chooseRelic(reward, reward.offered[1]!), ended(run, 'victory'), M2_GAUNTLET);
    expect(second.offered).not.toContain(reward.offered[1]);
    expect(chooseRelic(second, null).relics).toEqual([reward.offered[1]]);
    expect(() => chooseRelic(second, 'relic.not-offered')).toThrow();
  });

  it('a loss ends the run; winning the last fight wins it', () => {
    const run = startRun(3, PARTY, M2_GAUNTLET);
    expect(finishFight(run, ended(run, 'defeat', 0), M2_GAUNTLET).phase).toBe('lost');
    const last = { ...run, fight: 2 };
    expect(finishFight(last, ended(last, 'victory'), M2_GAUNTLET).phase).toBe('won');
  });

  // Golden replay: a fixed seed and policy give the same gauntlet. Update on purpose with `npx vitest -u`.
  it('a scripted gauntlet replays exactly', async () => {
    let run = startRun(7, PARTY, M2_GAUNTLET);
    const log: string[] = [];
    while (run.phase === 'fighting') {
      const state = fight(run);
      log.push(
        `fight ${run.fight + 1}: ${run.encounters[run.fight]} -> ${state.outcome} on turn ${state.turn}, HP ${state.party.hp}, gauges ${state.members.map((m) => m.gauge).join('/')}`,
      );
      run = finishFight(run, state, M2_GAUNTLET);
      if (run.phase === 'reward') {
        log.push(`  offered ${run.offered.join(', ')}; took ${run.offered[0]}`);
        run = chooseRelic(run, run.offered[0] ?? null);
      }
    }
    log.push(`run ${run.phase}: HP ${run.hp}, relics ${run.relics.join(', ')}`);
    await expect(log.join('\n') + '\n').toMatchFileSnapshot('golden/gauntlet.txt');
  });
});
