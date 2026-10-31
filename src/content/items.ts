// Profile items by ID, with their working names on screen (docs/notes/m5-collection.md, "Names"),
// a tag that files each under an inventory tab (owner, 31 Oct), an icon key and what each is for.
// Code keeps plain IDs; only the screens use the names.

export type ItemTag = 'currency' | 'memory' | 'material';

/** Inventory tabs in order, by tag. */
export const ITEM_TAGS: Record<ItemTag, string> = { currency: 'Currencies', memory: 'Memories', material: 'Materials' };

export interface ItemDef {
  name: string;
  /** Names with a plural of their own; Pollen and Ducats read the same for any count. */
  plural?: string;
  tag: ItemTag;
  icon: string;
  text: string;
}

export const ITEMS: Record<string, ItemDef> = {
  money: { name: 'Ducats', tag: 'currency', icon: 'ducat', text: "The profile's coin. Pays for levels, ascensions and team presets." },
  pollen: { name: 'Pollen', tag: 'currency', icon: 'poison', text: 'Every pull gives some, a lost 50/50 more, and a copy past C5 more again. The Profile Shop will take it for dupes.' },
  'memory.faint': { name: 'Faint Memory', plural: 'Faint Memories', tag: 'memory', icon: 'memory', text: "100 EXP toward a character's next level." },
  'memory.clear': { name: 'Clear Memory', plural: 'Clear Memories', tag: 'memory', icon: 'memory', text: "500 EXP toward a character's next level. What a level doesn't use comes back as Faint Memories." },
  'memory.vivid': { name: 'Vivid Memory', plural: 'Vivid Memories', tag: 'memory', icon: 'memory', text: "2,000 EXP toward a character's next level. What a level doesn't use comes back as smaller Memories." },
  'material.flesh': { name: 'Flesh Sac', plural: 'Flesh Sacs', tag: 'material', icon: 'sac', text: 'Ascends a Flesh character at level 10, 20 or 30.' },
  'material.rapture': { name: 'Rapture Tendril', plural: 'Rapture Tendrils', tag: 'material', icon: 'tentacle', text: 'Ascends a Rapture character at level 10, 20 or 30.' },
  'material.spirit': { name: 'Spirit Shard', plural: 'Spirit Shards', tag: 'material', icon: 'shard', text: 'Ascends a Spirit character at level 10, 20 or 30.' },
  'material.unbound': { name: 'Unbound Badge', plural: 'Unbound Badges', tag: 'material', icon: 'badge', text: 'Ascends an Unbound character at level 10, 20 or 30.' },
};

export const ITEM_NAMES: Record<string, string> = Object.fromEntries(Object.entries(ITEMS).map(([id, item]) => [id, item.name]));

/** A count of an item as it reads: "1 Faint Memory", "3 Faint Memories", "1,500 Ducats". */
export const itemCount = (id: string, n: number) => `${n.toLocaleString('en-GB')} ${(n === 1 ? undefined : ITEMS[id]?.plural) ?? ITEMS[id]?.name ?? id}`;
