import { useState } from 'react';
import { ITEM_NAMES } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { BannerDef } from '../engine/index.ts';
import {
  FOCUS_CHANCE,
  focusOf,
  HARD_PITY,
  lossesOf,
  LOSSES_TO_GUARANTEE,
  MAX_DUPES,
  pityOf,
  POLLEN_PER_LOSS,
  POLLEN_PER_OVERFLOW,
  POLLEN_PER_PULL,
  RATES,
  TEN_PULL,
  type PullRecord,
  type PullResult,
} from '../game/gacha.ts';
import { BLOOM, plural, type Profile } from '../game/profile.ts';
import { MAX_STEP, SALVAGE, type WeaponSettings } from '../game/weapons.ts';
import { Icon } from './icons.tsx';
import { Currencies } from './MainMenu.tsx';
import { Art } from './Roster.tsx';
import { playCue } from './sound.ts';
import { WeaponCard, WeaponGlyph } from './Weapons.tsx';

// The banner screen (docs/notes/m5-collection.md, "The gacha"; owner, 29 Oct): the Focus large,
// the Purified Blooms top right, and along the bottom Back, Rules (the odds and every rule), History
// (every pull, under the 50/50 status), Switch (the pool, to change the Focus), Pull 1 and Pull 10.
// The pity counter stays on screen. No gendered words here: the roster may not stay all women.
// The weapon banner is the same screen on signature weapons, with its own pity and Focus; both
// carry the two weapon tickboxes, since SR and R weapons come from both (docs/notes/weapons.md).

const RARITY: Record<PullRecord['rarity'], string> = { ssr: 'SSR', sr: 'SR', r: 'R' };
const FIFTY_FIFTY: Record<NonNullable<PullRecord['fiftyFifty']>, string> = { won: '50/50 won', lost: '50/50 lost', guaranteed: 'Focus guaranteed' };
const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

const itemName = (id: string) => ITEM_NAMES[id] ?? id;
const itemsText = (items: Record<string, number>) =>
  Object.entries(items)
    .map(([id, n]) => `${n} ${itemName(id)}`)
    .join(', ');
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
/** A character's or a weapon's name. */
const nameOf = (id: string) => registry.characters[id]?.name ?? registry.weapons[id]?.name ?? id;

/** What a pull gave, in words: the character or weapon and what became of the copy, or the items, Pollen last. */
export function pullText(record: PullRecord): string {
  const { pollen: _pollen, ...rest } = record.items;
  const lost = record.fiftyFifty === 'lost' ? `, +${POLLEN_PER_LOSS} Pollen` : '';
  if (record.character) {
    const dupe = record.dupe === 'new' ? 'new' : record.dupe === 'overflow' ? `past P5: +${POLLEN_PER_OVERFLOW} Pollen` : `P${record.dupe}`;
    return `${nameOf(record.character)} (${dupe}${lost})`;
  }
  if (record.weapon) {
    const copy =
      record.copy === 'new' ? 'new' : record.copy === 'spare' || record.copy === 'kept' ? 'a spare' : record.copy === 'salvaged' ? `salvaged: +${SALVAGE[record.rarity]} Pollen` : `reinforced to +${record.copy}`;
    return `${nameOf(record.weapon)} (${copy}${lost})`;
  }
  return itemsText(rest);
}

/** For the history: why a rarity was certain, and an SSR's 50/50. */
const notesText = (record: PullRecord) =>
  [record.guarantee === 'pity' ? 'pity' : record.guarantee === 'tenPull' ? 'ten-pull' : '', record.fiftyFifty ? FIFTY_FIFTY[record.fiftyFifty] : '']
    .filter(Boolean)
    .join(', ');

/** Owned or not, and the Potential, or the weapon's step and spares. */
function ownedText(profile: Profile, id: string): string {
  if (registry.weapons[id]) {
    const held = profile.weapons?.[id];
    return held ? `Owned, +${held.step ?? 0}${held.spares ? `, ${plural(held.spares, 'spare')}` : ''}` : 'Not owned';
  }
  return profile.owned.includes(id) ? `Owned${profile.dupes?.[id] ? `, P${profile.dupes[id]}` : ''}` : 'Not owned';
}

interface BannerProps {
  banner: BannerDef;
  profile: Profile;
  onPull: (banner: BannerDef, count: 1 | typeof TEN_PULL) => Promise<PullResult>;
  /** Saves a new Focus and gives back the profile. */
  onFocus: (banner: BannerDef, id: string) => Promise<Profile>;
  /** Saves the two weapon tickboxes and gives back the profile. */
  onSettings: (settings: WeaponSettings) => Promise<Profile>;
  onBack: () => void;
}

/** Which container is open over the banner. */
type Open = 'switch' | 'history' | 'rules' | 'results' | null;

export function Banner({ banner, profile: initial, onPull, onFocus, onSettings, onBack }: BannerProps) {
  const [profile, setProfile] = useState(initial);
  const [last, setLast] = useState<PullRecord[]>([]);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pity = pityOf(profile, banner);
  const losses = lossesOf(profile, banner);
  const weapons = banner.kind === 'weapon';
  const focus = focusOf(profile, banner);
  const weapon = focus ? registry.weapons[focus] : undefined;
  // The character on show: the Focus, or the one a signature weapon is for.
  const shown = focus ? (weapon ? weapon.signature : focus) : undefined;
  const def = shown ? registry.characters[shown] : undefined;
  const settings = profile.weaponSettings ?? {};
  const maxed = weapon && (profile.weapons?.[weapon.id]?.step ?? 0) >= MAX_STEP;
  const history = [...(profile.gacha?.history ?? [])].reverse();
  // Pollen always, then whatever else the profile has banked.
  const banked = Object.keys(ITEM_NAMES).filter((id) => id === 'pollen' || profile.items?.[id]);

  const act = (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    job()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };
  const pullOn = (count: 1 | typeof TEN_PULL) =>
    act(async () => {
      const result = await onPull(banner, count);
      if (!result.ok) return setError(result.reason);
      setProfile(result.profile);
      setLast(result.records);
      setOpen('results');
      playCue(result.records.some((r) => r.rarity === 'ssr') ? 'ssr' : 'pull');
    });
  // The box shows its new state at once; the saved profile follows.
  const tick = (key: keyof WeaponSettings, on: boolean) => {
    const next: WeaponSettings = { ...settings, [key]: on || undefined };
    setProfile((p) => ({ ...p, weaponSettings: next }));
    act(async () => setProfile(await onSettings(next)));
  };
  const focusOn = (id: string) =>
    act(async () => {
      if (id !== focus) setProfile(await onFocus(banner, id));
      setOpen(null);
    });

  const close = (
    <div className="panel-buttons">
      <button className="ghost" onClick={() => setOpen(null)}>
        Close
      </button>
    </div>
  );

  return (
    <div className={`banner-screen domain-${def?.domain ?? ''}`}>
      <header className="banner-header">
        <h2>{banner.name} banner</h2>
      </header>
      <Currencies profile={profile} only="bloom" />

      <section className="banner-stage">
        {focus && weapon ? (
          <>
            <div className="banner-focus-info">
              <em className="banner-focus-tag">Focus</em>
              <WeaponCard def={weapon} />
              <p className="banner-focus-owned">{ownedText(profile, focus)}</p>
              {maxed && (
                <p className="banner-warning" role="alert">
                  You hold it at +{MAX_STEP}: {settings.autoSalvage ? `further copies are salvaged for ${SALVAGE.ssr} Pollen each` : 'further copies are kept as spares'}.
                </p>
              )}
            </div>
            {shown && <Art id={shown} className="banner-focus-art faded" />}
          </>
        ) : focus && def ? (
          <>
            <div className="banner-focus-info">
              <em className="banner-focus-tag">Focus</em>
              <h3>{def.name}</h3>
              {def.title && <p className="banner-focus-title">{def.title}</p>}
              <p className="banner-focus-owned">
                {DOMAIN_LABEL[def.domain] ?? def.domain} · {ownedText(profile, focus)}
              </p>
              {(profile.dupes?.[focus] ?? 0) >= MAX_DUPES && (
                <p className="banner-warning" role="alert">
                  {def.name} is at P{MAX_DUPES}: any further copy becomes {POLLEN_PER_OVERFLOW} Pollen.
                </p>
              )}
            </div>
            <Art id={focus} className="banner-focus-art" />
          </>
        ) : (
          <p className="banner-no-focus">
            Choose a Focus with <strong>Switch</strong>: the {weapons ? 'signature weapon' : 'character'} each SSR's 50/50 is for.
          </p>
        )}
      </section>

      <footer className="banner-footer">
        <div className="panel-buttons">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <button className="ghost" onClick={() => setOpen('rules')}>
            Rules
          </button>
          <button className="ghost" onClick={() => setOpen('history')}>
            History
          </button>
        </div>
        <div className="banner-middle">
          <p className="banner-pity">
            SSR guaranteed within <strong>{HARD_PITY - pity}</strong> {HARD_PITY - pity === 1 ? 'pull' : 'pulls'}
          </p>
          <div className="banner-ticks" role="group" aria-label="Weapon duplicates">
            <label>
              <input type="checkbox" checked={!!settings.autoReinforce} disabled={busy} onChange={(e) => tick('autoReinforce', e.target.checked)} /> Auto-reinforce duplicates
            </label>
            <label>
              <input type="checkbox" checked={!!settings.autoSalvage} disabled={busy} onChange={(e) => tick('autoSalvage', e.target.checked)} /> Auto-salvage duplicates of maxed weapons
            </label>
          </div>
        </div>
        <div className="panel-buttons">
          <button className={`ghost banner-switch${focus ? '' : ' urgent'}`} disabled={busy} onClick={() => setOpen('switch')}>
            <Icon name="switch" /> Switch
          </button>
          <button className="end-turn" disabled={busy || !focus || profile.pulls < 1} onClick={() => pullOn(1)}>
            Pull 1 <small>{plural(1, BLOOM)}</small>
          </button>
          <button className="end-turn" disabled={busy || !focus || profile.pulls < TEN_PULL} onClick={() => pullOn(TEN_PULL)}>
            Pull 10 <small>{plural(TEN_PULL, BLOOM)}</small>
          </button>
        </div>
        {error && (
          <p className="title-error banner-error" role="alert">
            {error}
          </p>
        )}
      </footer>

      {open === 'switch' && (
        <div className="team-picker banner-dialog" role="dialog" aria-label="Choose a Focus">
          <h3>Choose a Focus</h3>
          <div className="team-picker-grid">
            {banner.pool.map((id) => {
              const tile = registry.characters[id];
              const arm = registry.weapons[id];
              if (arm)
                return (
                  <button
                    key={id}
                    className={`weapon-tile rarity-${arm.rarity}`}
                    aria-label={arm.name}
                    aria-pressed={id === focus}
                    disabled={busy}
                    onClick={() => focusOn(id)}
                  >
                    <WeaponGlyph def={arm} />
                    <span className="weapon-tile-name">{arm.name}</span>
                    <span className="weapon-tile-wielder">{ownedText(profile, id)}</span>
                    {id === focus && <em className="banner-focus-tag">Focus</em>}
                  </button>
                );
              return (
                <button
                  key={id}
                  className={`roster-tile domain-${tile?.domain ?? ''}${id === focus ? ' chosen' : ''}`}
                  aria-label={nameOf(id)}
                  aria-pressed={id === focus}
                  disabled={busy}
                  onClick={() => focusOn(id)}
                >
                  <Art id={id} className="roster-art" />
                  <strong>{nameOf(id)}</strong>
                  <span>{ownedText(profile, id)}</span>
                  {id === focus && <em className="banner-focus-tag">Focus</em>}
                </button>
              );
            })}
          </div>
          <p className="banner-dialog-note">Pity and 50/50 losses carry over when you change your Focus.</p>
          {close}
        </div>
      )}

      {open === 'history' && (
        <div className="team-picker banner-dialog" role="dialog" aria-label="History">
          <header className="banner-dialog-header">
            <h3>History</h3>
            <p className="banner-focus" role="status">
              {!focus ? (
                <>No Focus chosen.</>
              ) : losses >= LOSSES_TO_GUARANTEE ? (
                <>
                  Your next SSR is guaranteed to be <strong>{nameOf(focus)}</strong>.
                </>
              ) : (
                <>
                  50/50s lost in a row: <strong>{losses}</strong> of {LOSSES_TO_GUARANTEE}. After {LOSSES_TO_GUARANTEE}, the next SSR is your Focus.
                </>
              )}
            </p>
            <p className="banner-banked">Banked: {banked.map((id) => `${itemName(id)} ${profile.items?.[id] ?? 0}`).join(' · ')}</p>
          </header>
          <div className="banner-history-scroll">
            {history.filter((r) => r.banner === banner.id).length === 0 ? (
              <p className="banner-empty">No pulls yet.</p>
            ) : (
              <table className="banner-history" aria-label="Pulls">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Result</th>
                    <th>Focus</th>
                    <th>Pity</th>
                    <th>Losses</th>
                    <th>Blooms</th>
                  </tr>
                </thead>
                <tbody>
                  {history.filter((r) => r.banner === banner.id).map((r) => (
                    <tr key={r.n} className={`rarity-${r.rarity}`}>
                      <td>{r.n}</td>
                      <td>
                        <em>{RARITY[r.rarity]}</em> {pullText(r)}
                        {notesText(r) && <small> ({notesText(r)})</small>}
                      </td>
                      <td>{r.focus ? nameOf(r.focus) : ''}</td>
                      <td>
                        {r.pityBefore} → {r.pityAfter}
                      </td>
                      <td>
                        {r.lossesBefore} → {r.lossesAfter}
                      </td>
                      <td>
                        {r.bloomsBefore} → {r.bloomsAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {close}
        </div>
      )}

      {open === 'rules' && (
        <div className="team-picker banner-dialog" role="dialog" aria-label="Rules">
          <h3>Rules</h3>
          <div className="banner-rules-body">
            <table className="banner-odds">
              <tbody>
                <tr>
                  <th>SSR</th>
                  <td>{percent(RATES.ssr)}</td>
                  <td>
                    {percent(FOCUS_CHANCE)} your Focus, else one of the other {banner.pool.length - 1}, each as likely (+{POLLEN_PER_LOSS} Pollen)
                  </td>
                </tr>
                <tr>
                  <th>SR</th>
                  <td>{percent(RATES.sr)}</td>
                  <td>One of the {banner.sr.length} SR weapons, each as likely</td>
                </tr>
                <tr>
                  <th>R</th>
                  <td>{percent(RATES.r)}</td>
                  <td>
                    {percent(banner.r.chance)} one of the {banner.r.weapons.length} R weapons, else {itemsText(banner.r.items)}
                  </td>
                </tr>
              </tbody>
            </table>
            <ul className="banner-rules">
              <li>
                An SSR comes by the {HARD_PITY}th pull after the last one at the latest. Pulls since the last SSR: {pity}.
              </li>
              <li>After {LOSSES_TO_GUARANTEE} lost 50/50s in a row, the next SSR is your Focus.</li>
              <li>Pity and 50/50 losses carry over when you change your Focus.</li>
              <li>Every ten-pull has an SR or better.</li>
              {weapons ? (
                <li>A signature weapon pulled is a weapon copy, never the character.</li>
              ) : (
                <li>
                  A character's copies after the first raise their Potential from P1 to P{MAX_DUPES}; past P{MAX_DUPES}, each becomes {POLLEN_PER_OVERFLOW} Pollen.
                </li>
              )}
              <li>
                A weapon's duplicates are kept as spares, unless a tickbox says otherwise: auto-reinforce raises a weapon below +{MAX_STEP} a step, and auto-salvage turns a duplicate of a weapon at +{MAX_STEP} into Pollen ({SALVAGE.r} for an R, {SALVAGE.sr} for an SR, {SALVAGE.ssr} for an SSR). Reinforcing goes first; the weapon itself is never salvaged.
              </li>
              <li>Every pull costs one {BLOOM} and gives {POLLEN_PER_PULL} Pollen.</li>
            </ul>
          </div>
          {close}
        </div>
      )}

      {open === 'results' && (
        <div className="result reward banner-dialog" role="dialog" aria-label="Results">
          <div className={`banner-results${last.length > 1 ? ' ten' : ''}`}>
            {last.map((r) => (
              <div key={r.n} className={`banner-result rarity-${r.rarity}`}>
                {r.character && <Art id={r.character} className="banner-result-art" />}
                {r.weapon && registry.weapons[r.weapon] && <WeaponGlyph def={registry.weapons[r.weapon]!} className="large banner-result-glyph" />}
                <em>{RARITY[r.rarity]}</em>
                <span>{pullText(r)}</span>
                {r.fiftyFifty && <small>{FIFTY_FIFTY[r.fiftyFifty]}</small>}
              </div>
            ))}
          </div>
          {close}
        </div>
      )}
    </div>
  );
}
