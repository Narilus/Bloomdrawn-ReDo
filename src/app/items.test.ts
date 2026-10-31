import { describe, expect, it } from 'vitest';
import { CHARACTER_BANNER } from '../content/banners.ts';
import { ITEM_TAGS, ITEMS } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { M3_EXPEDITION } from '../game/expedition.ts';
import { MEMORIES, MONEY } from '../game/levels.ts';
import { hasIcon } from './icons.tsx';

// Items on screen (M6.2): every item the game banks, gives or spends is defined, filed under an
// inventory tab, drawn with an icon that exists, and says what it's for.

describe('items', () => {
  it('every item the game banks, gives or spends is defined', () => {
    const { items, materials } = M3_EXPEDITION.banking;
    const used = new Set([
      MONEY,
      'pollen',
      ...MEMORIES.map((m) => m.item),
      ...Object.values(registry.domains).flatMap((d) => (d.material ? [d.material] : [])),
      ...Object.values(items).flatMap((share) => Object.keys(share)),
      ...materials,
      ...CHARACTER_BANNER.sr.one,
      ...Object.keys(CHARACTER_BANNER.r),
    ]);
    expect([...used].filter((id) => !ITEMS[id])).toEqual([]);
  });

  it('every item has an inventory tab, an icon and a line on what it is for', () => {
    const faults = Object.entries(ITEMS).filter(([, item]) => !ITEM_TAGS[item.tag] || !hasIcon(item.icon) || item.text.trim() === '');
    expect(faults.map(([id]) => id)).toEqual([]);
  });
});
