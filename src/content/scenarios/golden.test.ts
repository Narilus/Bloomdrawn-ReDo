import { expect, it } from 'vitest';
import { apply, startCombat, validate, type CombatState, type Command, type EngineEvent } from '../../engine/index.ts';
import { registry } from '../registry.ts';

// Golden replay: a fixed seed and a fixed play policy must give the same events and state.
// When a rule or number changes on purpose, review the diff and update with `npx vitest -u`.

const PARTY = ['agathe', 'maelia', 'anthe', 'leonora'];
// The M1 fight.
const ENEMIES = ['enemy.bloom-rib-hound'];

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

const line = (e: EngineEvent) =>
  [e.type, e.source && `src=${e.source}`, e.target && `tgt=${e.target}`, e.card && `card=${e.card}`, e.resource, e.status, e.amount !== undefined && `amt=${e.amount}`, e.absorbed ? `abs=${e.absorbed}` : '', e.crit && 'crit', e.outcome]
    .filter(Boolean)
    .join(' ');

it('the slice fight replays exactly', async () => {
  const begin = startCombat({ seed: 2026, party: PARTY, enemies: ENEMIES, gauges: [70, 70, 70, 70] }, registry);
  let state = begin.state;
  const log = begin.events.map(line);
  for (let step = 0; step < 80 && state.phase === 'player'; step++) {
    const command = policy(state);
    const card = command.type === 'playCard' ? state.piles.hand.find((c) => c.uid === command.card)?.card : undefined;
    log.push(`> ${command.type}${card ? ` ${card}` : ''}${command.type === 'fireUltimate' ? ` ${command.member}` : ''}`);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(result.reason);
    log.push(...result.events.map((e) => `  ${line(e)}`));
    state = result.state;
  }
  log.push('', `final: ${JSON.stringify({ turn: state.turn, outcome: state.outcome, party: state.party, enemies: state.enemies.map((e) => e.hp), resources: state.resources, gauges: state.members.map((m) => m.gauge) })}`);
  await expect(log.join('\n') + '\n').toMatchFileSnapshot('golden/slice.txt');
});
