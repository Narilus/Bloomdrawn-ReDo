import { useState } from 'react';
import { ITEM_TAGS, ITEMS, type ItemTag } from '../content/items.ts';
import { BLOOM, type Profile } from '../game/profile.ts';
import { Icon } from './icons.tsx';
import { Currencies } from './MainMenu.tsx';

// The inventory (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct): everything the profile holds,
// in a tab per item tag. Every item shows, held or not, so the player learns what exists; a chosen
// one shows what it's for.

/** Purified Blooms are the profile's pulls, not an item, but they're shown with the currencies. */
const BLOOMS = 'pulls';

interface Entry {
  id: string;
  name: string;
  icon: string;
  text: string;
  n: number;
}

function entriesOf(profile: Profile, tag: ItemTag | 'all'): Entry[] {
  const blooms: Entry = { id: BLOOMS, name: `${BLOOM}s`, icon: 'bloom', text: 'One pull on a banner. Runs, ascensions and milestones give them; nothing sells them.', n: profile.pulls };
  const items = Object.entries(ITEMS)
    .filter(([, item]) => tag === 'all' || item.tag === tag)
    .map(([id, item]) => ({ id, name: item.name, icon: item.icon, text: item.text, n: profile.items?.[id] ?? 0 }));
  return tag === 'all' || tag === 'currency' ? [blooms, ...items] : items;
}

export function Inventory({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const [tab, setTab] = useState<ItemTag | 'all'>('all');
  const entries = entriesOf(profile, tab);
  const [chosen, setChosen] = useState<string>(BLOOMS);
  const shown = entries.find((e) => e.id === chosen) ?? entries[0];
  const tabs: [ItemTag | 'all', string][] = [['all', 'All'], ...(Object.entries(ITEM_TAGS) as [ItemTag, string][])];

  return (
    <div className="inventory-screen">
      <Currencies profile={profile} />
      <h2 className="panel-title">Inventory</h2>
      <div className="inventory-tabs" role="tablist" aria-label="Item kinds">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className="inventory-tab" onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="inventory-body" role="tabpanel">
        <ul className="inventory-grid">
          {entries.map((e) => (
            <li key={e.id}>
              <button className={`inventory-item${e.n === 0 ? ' none' : ''}`} aria-pressed={e.id === shown?.id} aria-label={`${e.name}: ${e.n.toLocaleString('en-GB')}`} onClick={() => setChosen(e.id)}>
                <Icon name={e.icon} className={`item-icon item-${e.icon}`} />
                <span className="inventory-name">{e.name}</span>
                <strong>{e.n.toLocaleString('en-GB')}</strong>
              </button>
            </li>
          ))}
        </ul>
        {shown && (
          <aside className="inventory-detail" aria-label="Item">
            <Icon name={shown.icon} className={`item-icon item-${shown.icon}`} />
            <h3>{shown.name}</h3>
            <p className="inventory-held">Held: {shown.n.toLocaleString('en-GB')}</p>
            <p>{shown.text}</p>
          </aside>
        )}
      </div>
      <button className="ghost inventory-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
