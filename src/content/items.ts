// Profile items by ID, with their working names on screen (docs/notes/m5-collection.md, "Names").
// Code keeps plain IDs; only the screens use the names.
export const ITEM_NAMES: Record<string, string> = {
  pollen: 'Pollen',
  money: 'Ducats',
  'memory.faint': 'Faint Memory',
  'memory.clear': 'Clear Memory',
  'memory.vivid': 'Vivid Memory',
  'material.flesh': 'Flesh Sac',
  'material.rapture': 'Rapture Tendril',
  'material.spirit': 'Spirit Shard',
  'material.unbound': 'Unbound Badge',
};

/** Names with a plural of their own; Pollen and Ducats read the same for any count. */
const PLURALS: Record<string, string> = {
  'memory.faint': 'Faint Memories',
  'memory.clear': 'Clear Memories',
  'memory.vivid': 'Vivid Memories',
  'material.flesh': 'Flesh Sacs',
  'material.rapture': 'Rapture Tendrils',
  'material.spirit': 'Spirit Shards',
  'material.unbound': 'Unbound Badges',
};

/** A count of an item as it reads: "1 Faint Memory", "3 Faint Memories", "1,500 Ducats". */
export const itemCount = (id: string, n: number) => `${n.toLocaleString('en-GB')} ${(n === 1 ? undefined : PLURALS[id]) ?? ITEM_NAMES[id] ?? id}`;
