import { useState } from 'react';
import { itemCount, ITEM_TAGS, ITEMS, type ItemTag } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { SelectResult } from '../game/gacha.ts';
import { BLOOM, type Profile } from '../game/profile.ts';
import { SSR_SELECTOR } from '../game/profileLevel.ts';
import { MAX_STEP, salvageValue, wielderOf, type WeaponResult } from '../game/weapons.ts';
import { Icon } from './icons.tsx';
import { Currencies } from './MainMenu.tsx';
import { selectedText, SelectorPicker } from './Profile.tsx';
import { SideList } from './SideList.tsx';
import { sortCopies, WeaponCard, WeaponTile } from './Weapons.tsx';

// The inventory (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct): everything the profile holds,
// in a list down the left like the main menu's (owner, 14 Nov), one entry per item tag and Weapons. Every item shows, held or not, so the player learns what exists; a chosen
// one shows what it's for. A rare item waiting to be used carries a "!", and the SSR Selector is
// used from here (owner, 1 Nov).

/** Purified Blooms are the profile's pulls, not an item, but they're shown with the currencies. */
const BLOOMS = 'pulls';

interface Entry {
  id: string;
  name: string;
  icon: string;
  text: string;
  n: number;
  flag?: true;
}

function entriesOf(profile: Profile, tag: ItemTag | 'all'): Entry[] {
  const blooms: Entry = { id: BLOOMS, name: `${BLOOM}s`, icon: 'bloom', text: 'One pull on a banner. Runs, ascensions and milestones give them; nothing sells them.', n: profile.pulls };
  const items = Object.entries(ITEMS)
    .filter(([, item]) => tag === 'all' || item.tag === tag)
    .map(([id, item]) => ({ id, name: item.name, icon: item.icon, text: item.text, n: profile.items?.[id] ?? 0, ...(item.flag && { flag: item.flag }) }));
  return tag === 'all' || tag === 'currency' ? [blooms, ...items] : items;
}

interface InventoryProps {
  profile: Profile;
  onSelect: (character: string) => Promise<SelectResult>;
  onReinforce: (uid: string, fodder: string) => Promise<WeaponResult>;
  onSalvage: (uid: string) => Promise<WeaponResult>;
  onLock: (uid: string) => Promise<WeaponResult>;
  onBack: () => void;
}

type Kind = ItemTag | 'all' | 'weapons';

export function Inventory({ profile: initial, onSelect, onReinforce, onSalvage, onLock, onBack }: InventoryProps) {
  const [profile, setProfile] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [tab, setTab] = useState<Kind>('all');
  const entries = tab === 'weapons' ? [] : entriesOf(profile, tab);
  const [chosen, setChosen] = useState<string>(BLOOMS);
  const shown = entries.find((e) => e.id === chosen) ?? entries[0];
  const tabs: [Kind, string][] = [['all', 'All'], ['currency', ITEM_TAGS.currency], ['memory', ITEM_TAGS.memory], ['material', ITEM_TAGS.material], ['weapons', 'Weapons'], ['special', ITEM_TAGS.special]];
  const take = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onSelect(id);
      setPicking(false);
      if (!result.ok) return setNote(result.reason);
      setProfile(result.profile);
      setNote(selectedText(id, result));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inventory-screen">
      <Currencies profile={profile} />
      <nav className="inventory-nav" aria-label="Inventory">
        <h2 className="panel-title">Inventory</h2>
        <SideList label="Item kinds" items={tabs} chosen={tab} onChoose={(t) => (setTab(t), setNote(undefined))} />
        <button className="ghost side-back" onClick={onBack}>
          Back
        </button>
      </nav>
      {tab === 'weapons' ? (
        <WeaponsPanel profile={profile} onChange={setProfile} onReinforce={onReinforce} onSalvage={onSalvage} onLock={onLock} />
      ) : (
        <div className="inventory-body" role="tabpanel">
          <ul className="inventory-grid">
            {entries.map((e) => (
              <li key={e.id}>
                <button className={`inventory-item${e.n === 0 ? ' none' : ''}`} aria-pressed={e.id === shown?.id} aria-label={`${e.name}: ${e.n.toLocaleString('en-GB')}${e.flag && e.n > 0 ? ', ready to use' : ''}`} onClick={() => setChosen(e.id)}>
                  <Icon name={e.icon} className={`item-icon item-${e.icon}`} />
                  <span className="inventory-name">{e.name}</span>
                  <strong>{e.n.toLocaleString('en-GB')}</strong>
                  {e.flag && e.n > 0 && (
                    <em className="item-flag" aria-hidden="true">
                      !
                    </em>
                  )}
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
              {shown.id === SSR_SELECTOR && (
                <button className="end-turn" disabled={busy || shown.n === 0} onClick={() => (setNote(undefined), setPicking(true))}>
                  Choose a character
                </button>
              )}
              {note && shown.id === SSR_SELECTOR && (
                <p className="inventory-note" role="status">
                  {note}
                </p>
              )}
            </aside>
          )}
        </div>
      )}
      {picking && <SelectorPicker profile={profile} busy={busy} onTake={(id) => void take(id)} onCancel={() => setPicking(false)} />}
    </div>
  );
}

/**
 * Weapons (docs/notes/weapons.md, "The inventory"): every copy as a tile, the chosen one's card,
 * and Reinforce (with a duplicate), Salvage (after a confirm that shows the Pollen) and Lock. The
 * game refuses what can't be done; the panel shows why.
 */
function WeaponsPanel({ profile, onChange, onReinforce, onSalvage, onLock }: { profile: Profile; onChange: (p: Profile) => void } & Pick<InventoryProps, 'onReinforce' | 'onSalvage' | 'onLock'>) {
  const copies = sortCopies(profile.weapons ?? []);
  const [chosen, setChosen] = useState<string | undefined>(copies[0]?.uid);
  const [open, setOpen] = useState<'reinforce' | 'salvage' | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const copy = copies.find((c) => c.uid === chosen) ?? copies[0];
  const def = copy && registry.weapons[copy.weapon];
  const act = (job: () => Promise<WeaponResult>, done: (p: Profile) => string) => {
    if (busy) return;
    setBusy(true);
    job()
      .then((r) => {
        if (!r.ok) return setNote(r.reason);
        onChange(r.profile);
        setNote(done(r.profile));
      })
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
      .finally(() => {
        setBusy(false);
        setOpen(null);
      });
  };
  if (!copy || !def) {
    return (
      <div className="inventory-body" role="tabpanel">
        <p className="inventory-empty">No weapons yet. Banner pulls give them: an SR is always a weapon, an R often is.</p>
      </div>
    );
  }
  const fodder = copies.filter((c) => c.weapon === copy.weapon && c.uid !== copy.uid && !c.locked && !wielderOf(profile, c.uid));
  const step = copy.step ?? 0;
  return (
    <div className="inventory-body" role="tabpanel">
      <ul className="weapon-grid inventory-weapons">
        {copies.map((c) => (
          <li key={c.uid}>
            <WeaponTile copy={c} wielder={wielderOf(profile, c.uid)} pressed={c.uid === copy.uid} onClick={() => (setChosen(c.uid), setNote(undefined))} />
          </li>
        ))}
      </ul>
      <aside className="inventory-detail weapon-detail" aria-label="Weapon">
        <WeaponCard def={def} step={step} wielder={wielderOf(profile, copy.uid) ?? ''} />
        <div className="panel-buttons">
          <button className="end-turn" disabled={busy || step >= MAX_STEP || fodder.length === 0} onClick={() => (setNote(undefined), setOpen('reinforce'))}>
            Reinforce
          </button>
          <button className="ghost" disabled={busy} onClick={() => (setNote(undefined), setOpen('salvage'))}>
            Salvage
          </button>
          <button className="ghost" disabled={busy} onClick={() => act(() => onLock(copy.uid), () => (copy.locked ? 'Unlocked.' : 'Locked: it is never salvaged.'))}>
            {copy.locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
        <p className="inventory-note" role="status">
          {note ?? (step < MAX_STEP && fodder.length === 0 ? 'Reinforcing needs a duplicate that no one wields.' : '')}
        </p>
        {open === 'salvage' && (
          <div className="weapon-confirm" role="alertdialog" aria-label="Salvage">
            <p>
              Salvage {def.name} +{step} for {itemCount('pollen', salvageValue(copy, registry))}?
            </p>
            <div className="panel-buttons">
              <button className="end-turn" disabled={busy} onClick={() => act(() => onSalvage(copy.uid), (p) => `Salvaged. Pollen held: ${(p.items?.pollen ?? 0).toLocaleString('en-GB')}.`)}>
                Salvage
              </button>
              <button className="ghost" onClick={() => setOpen(null)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </aside>
      {open === 'reinforce' && (
        <div className="team-picker weapon-picker" role="dialog" aria-label="Choose a duplicate">
          <h3>Reinforce {def.name}</h3>
          <ul className="weapon-grid">
            {fodder.map((c) => (
              <li key={c.uid}>
                <WeaponTile copy={c} onClick={() => act(() => onReinforce(copy.uid, c.uid), () => `Reinforced to +${Math.min(MAX_STEP, step + 1 + (c.step ?? 0))}.`)} />
              </li>
            ))}
          </ul>
          <div className="panel-buttons">
            <button className="ghost" onClick={() => setOpen(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
