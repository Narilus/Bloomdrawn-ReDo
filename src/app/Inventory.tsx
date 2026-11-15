import { useState } from 'react';
import { itemCount, ITEM_TAGS, ITEMS, type ItemTag } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { WeaponDef } from '../engine/index.ts';
import type { SelectResult } from '../game/gacha.ts';
import { BLOOM, type Profile } from '../game/profile.ts';
import { SSR_SELECTOR } from '../game/profileLevel.ts';
import { MAX_STEP, presetsWith, SALVAGE, type WeaponResult } from '../game/weapons.ts';
import { Icon } from './icons.tsx';
import { Currencies } from './MainMenu.tsx';
import { selectedText, SelectorPicker } from './Profile.tsx';
import { SideList } from './SideList.tsx';
import { sortWeapons, WeaponCard, WeaponTile } from './Weapons.tsx';

// The inventory (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct): everything the profile holds,
// in a list down the left like the main menu's (owner, 14 Nov), one entry per item tag and Weapons,
// with no All (owner, 15 Nov: categories only, as gacha inventories have). Every item shows, held or not, so the player learns what exists; a chosen
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

function entriesOf(profile: Profile, tag: ItemTag): Entry[] {
  const blooms: Entry = { id: BLOOMS, name: `${BLOOM}s`, icon: 'bloom', text: 'One pull on a banner. Runs, ascensions and milestones give them; nothing sells them.', n: profile.pulls };
  const items = Object.entries(ITEMS)
    .filter(([, item]) => item.tag === tag)
    .map(([id, item]) => ({ id, name: item.name, icon: item.icon, text: item.text, n: profile.items?.[id] ?? 0, ...(item.flag && { flag: item.flag }) }));
  return tag === 'currency' ? [blooms, ...items] : items;
}

interface InventoryProps {
  profile: Profile;
  onSelect: (character: string) => Promise<SelectResult>;
  onReinforce: (weapon: string) => Promise<WeaponResult>;
  onSalvage: (weapon: string, count: number) => Promise<WeaponResult>;
  onBack: () => void;
}

type Kind = ItemTag | 'weapons';

export function Inventory({ profile: initial, onSelect, onReinforce, onSalvage, onBack }: InventoryProps) {
  const [profile, setProfile] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [tab, setTab] = useState<Kind>('currency');
  const entries = tab === 'weapons' ? [] : entriesOf(profile, tab);
  const [chosen, setChosen] = useState<string>(BLOOMS);
  const shown = entries.find((e) => e.id === chosen) ?? entries[0];
  const tabs: [Kind, string][] = [['currency', ITEM_TAGS.currency], ['memory', ITEM_TAGS.memory], ['material', ITEM_TAGS.material], ['weapons', 'Weapons'], ['special', ITEM_TAGS.special]];
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
        <WeaponsPanel profile={profile} onChange={setProfile} onReinforce={onReinforce} onSalvage={onSalvage} />
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
 * Weapons (docs/notes/weapons.md, "The inventory"; owner, 15 Nov): each weapon owned as one tile with
 * its step and spares; the chosen one's card, the presets it's in, Reinforce (a spare for a step) and
 * Salvage (spares for Pollen, after a confirm). The weapon itself is never salvaged. The game refuses
 * what can't be done; the panel shows why.
 */
function WeaponsPanel({ profile, onChange, onReinforce, onSalvage }: { profile: Profile; onChange: (p: Profile) => void } & Pick<InventoryProps, 'onReinforce' | 'onSalvage'>) {
  const owned = profile.weapons ?? {};
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [domain, setDomain] = useState<string>('all');
  const ids = sortWeapons(owned).filter((w) => (rarity === 'all' || registry.weapons[w]!.rarity === rarity) && (domain === 'all' || domainOf(w) === domain));
  const [chosen, setChosen] = useState<string | undefined>(ids[0]);
  const [salvaging, setSalvaging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const id = chosen && ids.includes(chosen) ? chosen : ids[0];
  const def = id ? registry.weapons[id] : undefined;
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
        setSalvaging(null);
      });
  };
  const filters = (
    <div className="inventory-filters">
      <Filter label="Rarity" options={RARITIES} chosen={rarity} onChoose={(r) => (setRarity(r), setNote(undefined), setSalvaging(null))} />
      <Filter label="Domain" options={DOMAINS} chosen={domain} onChoose={(d) => (setDomain(d), setNote(undefined), setSalvaging(null))} />
    </div>
  );
  if (Object.keys(owned).length === 0) {
    return (
      <div className="inventory-body" role="tabpanel">
        <p className="inventory-empty">No weapons yet. Banner pulls give them: an SR is always a weapon, an R often is.</p>
      </div>
    );
  }
  if (!id || !def) {
    return (
      <div className="inventory-body" role="tabpanel">
        <div className="inventory-column">
          {filters}
          <p className="inventory-empty">No weapons held match.</p>
        </div>
      </div>
    );
  }
  const held = owned[id]!;
  const step = held.step ?? 0;
  const spares = held.spares ?? 0;
  const presets = presetsWith(profile.teams ?? [], id);
  return (
    <div className="inventory-body" role="tabpanel">
      <div className="inventory-column">
        {filters}
        <ul className="weapon-grid inventory-weapons">
          {ids.map((w) => (
            <li key={w}>
              <WeaponTile id={w} owned={owned[w]!} pressed={w === id} onClick={() => (setChosen(w), setNote(undefined), setSalvaging(null))} />
            </li>
          ))}
        </ul>
      </div>
      <aside className="inventory-detail weapon-detail" aria-label="Weapon">
        <WeaponCard def={def} step={step} spares={spares} />
        <p className="weapon-presets">{presets.length === 0 ? 'In no team preset.' : `In ${presets.map((p) => `${p.team} (${registry.characters[p.member]?.name ?? p.member})`).join(', ')}.`}</p>
        <div className="panel-buttons">
          <button className="end-turn" disabled={busy || step >= MAX_STEP || spares === 0} onClick={() => act(() => onReinforce(id), (p) => `Reinforced to +${p.weapons?.[id]?.step ?? 0}.`)}>
            Reinforce
          </button>
          <button className="ghost" disabled={busy || spares === 0} onClick={() => (setNote(undefined), setSalvaging(1))}>
            Salvage
          </button>
          {spares > 1 && (
            <button className="ghost" disabled={busy} onClick={() => (setNote(undefined), setSalvaging(spares))}>
              Salvage all
            </button>
          )}
        </div>
        <p className="inventory-note" role="status">
          {note ?? (spares === 0 ? (step < MAX_STEP ? 'A duplicate pulled is a spare: it reinforces this weapon or is salvaged.' : `At +${MAX_STEP}.`) : '')}
        </p>
        {salvaging !== null && (
          <div className="weapon-confirm" role="alertdialog" aria-label="Salvage">
            <p>
              Salvage {salvaging === 1 ? 'a spare' : `${salvaging} spares`} of {def.name} for {itemCount('pollen', SALVAGE[def.rarity] * salvaging)}?
            </p>
            <div className="panel-buttons">
              <button className="end-turn" disabled={busy} onClick={() => act(() => onSalvage(id, salvaging), (p) => `Salvaged. Pollen held: ${(p.items?.pollen ?? 0).toLocaleString('en-GB')}.`)}>
                Salvage
              </button>
              <button className="ghost" onClick={() => setSalvaging(null)}>
                Keep them
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

type Rarity = WeaponDef['rarity'];
const RARITIES: [Rarity | 'all', string][] = [['all', 'All'], ['ssr', 'SSR'], ['sr', 'SR'], ['r', 'R']];
const DOMAINS: [string, string][] = [['all', 'All'], ...Object.entries(registry.domains).map(([id, d]): [string, string] => [id, d.name])];
/** A signature weapon's Domain is its character's. */
const domainOf = (weapon: string) => {
  const def = registry.weapons[weapon];
  return def?.domain ?? (def?.signature ? registry.characters[def.signature]?.domain : undefined);
};

/** Weapons narrowed by rarity and by Domain (owner, 15 Nov: filters where a category has enough to sort). */
function Filter<T extends string>({ label, options, chosen, onChoose }: { label: string; options: readonly [T, string][]; chosen: T; onChoose: (key: T) => void }) {
  return (
    <div className="inventory-filter" role="group" aria-label={label}>
      <span>{label}</span>
      {options.map(([key, text]) => (
        <button key={key} className="filter-chip" aria-pressed={chosen === key} onClick={() => onChoose(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}
