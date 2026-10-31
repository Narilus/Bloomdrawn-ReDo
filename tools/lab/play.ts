import {
  apply,
  cardCost,
  hasKeyword,
  previewCard,
  startCombat,
  validate,
  type CombatState,
  type Command,
  type EngineEvent,
  type Preview,
  type Registry,
} from '../../src/engine/index.ts';

// The lab's simple player and its seeded fights against practice dummies, shared by the damage
// curves (curves.ts) and the depth model (depth.ts). A measuring tool, not a test.

export const DUMMY = 'enemy.practice-dummy';

export interface Setup {
  name: string;
  party: string[];
  /** Play a Ritual only once it costs this or less. */
  holdRitualsAt?: number;
  ultimates: boolean;
}

export interface FightOptions {
  turns: number;
  /** How many dummies stand in the fight: cards that hit every enemy are worth more against several. */
  enemies: number;
  /** Every member's level; 1 if absent. */
  level?: number;
  /** Every member's ascensions; none if absent. */
  ascensions?: number;
}

export interface Fight {
  /** Damage on each turn, the player's turn and its end together. */
  perTurn: number[];
  /** Of which from ultimates. */
  ultimate: number[];
  cards: number;
  /** Resources at the start of turn 6. */
  turn6: Record<string, number>;
}

const flatten = (previews: Preview[]): Preview[] => previews.flatMap((p) => [p, ...(p.resolves === false ? [] : flatten(p.branch ?? []))]);
const previewDamage = (previews: Preview[]) =>
  flatten(previews).filter((p) => p.op === 'damage' || p.op === 'volley' || p.op === 'loseHp').reduce((n, p) => n + (p.amount ?? 0), 0);
const enemyDamage = (events: EngineEvent[], state: CombatState) =>
  events.filter((e) => e.type === 'damageDealt' && state.enemies.some((x) => x.id === e.target)).reduce((n, e) => n + (e.amount ?? 0), 0);

/** The simple player: a ready ultimate, the Transcend, cards that deal no damage, damage cards by damage shown, Defense last. */
function choose(state: CombatState, registry: Registry, setup: Setup): Command | undefined {
  if (setup.ultimates) {
    for (const m of state.members) {
      const fire: Command = { type: 'fireUltimate', member: m.id };
      if (validate(state, fire, registry) === undefined) return fire;
    }
  }
  const target = state.enemies.find((e) => e.hp > 0)?.id;
  let best: { command: Command; score: number } | undefined;
  for (const card of state.piles.hand) {
    const def = registry.cards[card.card];
    if (!def) continue;
    if (setup.holdRitualsAt !== undefined && hasKeyword(def.keywords, 'ritual') && cardCost(state, card, registry) > setup.holdRitualsAt) continue;
    const command: Command = def.target === 'chosenEnemy' && target ? { type: 'playCard', card: card.uid, target } : { type: 'playCard', card: card.uid };
    const preview = previewCard(state, command, registry);
    if (!preview) continue;
    const damage = previewDamage(preview);
    const score = def.slot === 'transcend' ? 1e6 : def.slot === 'defense' ? -1 : damage === 0 ? 1e5 : damage;
    if (!best || score > best.score) best = { command, score };
  }
  return best?.command;
}

export function fight(seed: number, setup: Setup, registry: Registry, options: FightOptions): Fight {
  const { turns, enemies, level = 1, ascensions = 0 } = options;
  const party = setup.party;
  let state = startCombat({ seed, party, enemies: Array<string>(enemies).fill(DUMMY), levels: party.map(() => level), ascensions: party.map(() => ascensions) }, registry).state;
  const perTurn = Array<number>(turns).fill(0);
  const ultimate = Array<number>(turns).fill(0);
  let cards = 0;
  let turn6: Record<string, number> = {};
  while (state.turn <= turns && state.phase === 'player') {
    const turn = state.turn;
    if (turn === 6 && Object.keys(turn6).length === 0) turn6 = { ...state.resources };
    const command = choose(state, registry, setup) ?? ({ type: 'endTurn' } as const);
    const result = apply(state, command, registry);
    if (!result.ok) throw new Error(`${setup.name}, seed ${seed}: ${result.reason}`);
    const dealt = enemyDamage(result.events, result.state);
    perTurn[turn - 1]! += dealt;
    if (command.type === 'fireUltimate') ultimate[turn - 1]! += dealt;
    if (command.type === 'playCard') cards += 1;
    state = result.state;
  }
  return { perTurn, ultimate, cards, turn6 };
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
