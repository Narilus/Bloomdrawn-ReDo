import type { CombatState, Registry } from '../engine/index.ts';
import type { Expedition } from './expedition.ts';

// A saved run names content only by ID. Before a save is resumed, every ID it holds must still
// exist; a run that names something the game no longer has can't go on (docs/notes/m4-run.md).

/** The first ID in this run (and its fight) that the registry lacks, as "kind id"; undefined if none. */
export function missingContent(exp: Expedition, combat: CombatState | undefined, registry: Registry): string | undefined {
  const wanted: [keyof Registry, string][] = [
    ...exp.party.map((id) => ['characters', id] as [keyof Registry, string]),
    ...[...exp.relics, ...exp.offered].map((id) => ['relics', id] as [keyof Registry, string]),
    ...[...exp.deck, ...exp.offeredCards].map((c) => ['cards', c.card] as [keyof Registry, string]),
    ...Object.values(exp.shops).flatMap((shop) => shop.relics.map((r) => ['relics', r.relic] as [keyof Registry, string])),
  ];
  for (const tile of Object.values(exp.board.tiles)) {
    if (tile.content) wanted.push([tile.kind === 'event' ? 'events' : 'encounters', tile.content]);
    if (tile.card) wanted.push(['cards', tile.card]);
  }
  if (combat) {
    wanted.push(...combat.members.map((m) => ['characters', m.character] as [keyof Registry, string]));
    wanted.push(...combat.enemies.map((e) => ['enemies', e.enemy] as [keyof Registry, string]));
    wanted.push(...combat.relics.map((r) => ['relics', r.relic] as [keyof Registry, string]));
    const piles = [...combat.piles.draw, ...combat.piles.hand, ...combat.piles.discard, ...combat.piles.graveyard];
    wanted.push(...piles.map((c) => ['cards', c.card] as [keyof Registry, string]));
    const statuses = [...combat.party.statuses, ...combat.enemies.flatMap((e) => e.statuses)];
    wanted.push(...statuses.map((s) => ['statuses', s.status] as [keyof Registry, string]));
  }
  const found = wanted.find(([table, id]) => !(id in (registry[table] as Record<string, unknown>)));
  return found && `${found[0]} ${found[1]}`;
}
