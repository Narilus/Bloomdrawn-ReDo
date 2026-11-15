import { useState } from 'react';
import { ITEMS } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { Profile } from '../game/profile.ts';
import { buyDupe, DUPE_PRICE, type ShopResult } from '../game/shop.ts';
import { Icon } from './icons.tsx';
import { Currencies } from './MainMenu.tsx';
import { Art } from './Roster.tsx';
import { SideList } from './SideList.tsx';

// The Profile Shop (docs/notes/m6-depth.md, "Profile Shop"; owner, 31 Oct): character dupes for
// Pollen, the starters' included. Laid out like the inventory: a list down the left, a grid of what's
// for sale, the chosen one's detail. The game says what can be bought and why not; a purchase asks first.

interface ShopProps {
  profile: Profile;
  /** Every character the profile can field, the starters included. */
  owned: readonly string[];
  onBuy: (character: string) => Promise<ShopResult>;
  onBack: () => void;
}

const levelsOf = (id: string) => registry.characters[id]?.dupes?.length ?? 0;

export function Shop({ profile: initial, owned, onBuy, onBack }: ShopProps) {
  const [profile, setProfile] = useState(initial);
  const [chosen, setChosen] = useState(owned[0]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const pollen = profile.items?.pollen ?? 0;
  const id = chosen && owned.includes(chosen) ? chosen : owned[0];
  const def = id ? registry.characters[id] : undefined;
  const level = id ? (profile.dupes?.[id] ?? 0) : 0;
  // What a purchase would do, from the game: bought, or why not.
  const check = id ? buyDupe(profile, id, owned, levelsOf(id)) : undefined;
  const choose = (next: string) => (setChosen(next), setConfirming(false), setNote(undefined));
  const buy = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const result = await onBuy(id);
      if (!result.ok) return setNote(result.reason);
      setProfile(result.profile);
      setNote(`${def?.name ?? id} is now P${result.level}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="inventory-screen shop-screen">
      <Currencies profile={profile} />
      <nav className="inventory-nav" aria-label="Shop">
        <h2 className="panel-title">Shop</h2>
        <p className="shop-purse" aria-label={`Pollen: ${pollen.toLocaleString('en-GB')}`}>
          <Icon name={ITEMS.pollen!.icon} className={`item-icon item-${ITEMS.pollen!.icon}`} />
          <span>Pollen</span>
          <strong>{pollen.toLocaleString('en-GB')}</strong>
        </p>
        <SideList label="Wares" items={[['dupes', 'Character dupes']] as const} chosen="dupes" onChoose={() => undefined} />
        <button className="ghost side-back" onClick={onBack}>
          Back
        </button>
      </nav>
      <div className="inventory-body" role="tabpanel">
        <ul className="shop-grid">
          {owned.map((c) => {
            const d = registry.characters[c];
            const p = profile.dupes?.[c] ?? 0;
            return (
              <li key={c}>
                <button
                  className={`roster-tile shop-tile domain-${d?.domain ?? ''}`}
                  aria-pressed={c === id}
                  aria-label={levelsOf(c) ? `${d?.name ?? c}, P${p}` : `${d?.name ?? c}, no Potential levels yet`}
                  onClick={() => choose(c)}
                >
                  <Art id={c} className="roster-art" />
                  <strong>{d?.name ?? c}</strong>
                  {levelsOf(c) ? <em className="roster-level">P{p}</em> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {id && def && (
          <aside className="inventory-detail shop-detail" aria-label="Character dupe">
            <h3>{def.name}</h3>
            {def.dupes?.length ? (
              <>
                <p className="inventory-held">
                  P{level} of {def.dupes.length}
                </p>
                <ol className="character-dupes" aria-label="Potential">
                  {def.dupes.map((d, i) => (
                    <li key={i} className={i < level ? 'reached' : i === level ? 'next' : undefined}>
                      <em>P{i + 1}</em>
                      {d.text}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p>No Potential levels yet, so none to buy.</p>
            )}
            {level < (def.dupes?.length ?? 0) && (
              <>
                <p className="shop-price">
                  P{level + 1} for {DUPE_PRICE} Pollen
                </p>
                <button className="end-turn" disabled={busy || !check?.ok} onClick={() => (setNote(undefined), setConfirming(true))}>
                  Buy
                </button>
              </>
            )}
            <p className="inventory-note" role="status">
              {note ?? (check && !check.ok && def.dupes?.length ? check.reason : '')}
            </p>
            {confirming && (
              <div className="weapon-confirm" role="alertdialog" aria-label="Confirm purchase">
                <p>
                  Buy {def.name}'s P{level + 1} for {DUPE_PRICE} Pollen?
                </p>
                <div className="panel-buttons">
                  <button className="end-turn" autoFocus disabled={busy} onClick={() => void buy()}>
                    Buy
                  </button>
                  <button className="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
