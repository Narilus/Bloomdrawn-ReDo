import { useState } from 'react';
import { CHARACTER_BANNER } from '../content/banners.ts';
import { ITEM_NAMES } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { BannerDef } from '../engine/index.ts';
import {
  FOCUS_CHANCE,
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
import { Icon } from './icons.tsx';
import { Art } from './Roster.tsx';

// The banner screen (docs/notes/m5-collection.md, "The gacha"; owner, 29 Oct): the Focus large,
// the Purified Blooms top right, and along the bottom Back, Rules (the odds and every rule), History
// (every pull, under the 50/50 status), Switch (the pool, to change the Focus), Pull 1 and Pull 10.
// The pity counter stays on screen. No gendered words here: the roster may not stay all women.

const RARITY: Record<PullRecord['rarity'], string> = { ssr: 'SSR', sr: 'SR', r: 'R' };
const FIFTY_FIFTY: Record<NonNullable<PullRecord['fiftyFifty']>, string> = { won: '50/50 won', lost: '50/50 lost', guaranteed: 'Focus guaranteed' };
const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

const itemName = (id: string) => ITEM_NAMES[id] ?? id;
const itemsText = (items: Record<string, number>) =>
  Object.entries(items)
    .map(([id, n]) => `${n} ${itemName(id)}`)
    .join(', ');
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
const characterName = (id: string) => registry.characters[id]?.name ?? id;

/** What a pull gave, in words: the character and the dupe handling, or the items, Pollen last. */
export function pullText(record: PullRecord): string {
  const { pollen: _pollen, ...rest } = record.items;
  if (record.character) {
    const dupe = record.dupe === 'new' ? 'new' : record.dupe === 'overflow' ? `past C5: +${POLLEN_PER_OVERFLOW} Pollen` : `C${record.dupe}`;
    const lost = record.fiftyFifty === 'lost' ? `, +${POLLEN_PER_LOSS} Pollen` : '';
    return `${characterName(record.character)} (${dupe}${lost})`;
  }
  return itemsText(rest);
}

/** For the history: why a rarity was certain, and an SSR's 50/50. */
const notesText = (record: PullRecord) =>
  [record.guarantee === 'pity' ? 'pity' : record.guarantee === 'tenPull' ? 'ten-pull' : '', record.fiftyFifty ? FIFTY_FIFTY[record.fiftyFifty] : '']
    .filter(Boolean)
    .join(', ');

/** Owned or not, and the dupe level. */
const ownedText = (profile: Profile, id: string) => (profile.owned.includes(id) ? `Owned${profile.dupes?.[id] ? `, C${profile.dupes[id]}` : ''}` : 'Not owned');

interface BannerProps {
  profile: Profile;
  onPull: (banner: BannerDef, count: 1 | typeof TEN_PULL) => Promise<PullResult>;
  /** Saves a new Focus and gives back the profile. */
  onFocus: (banner: BannerDef, character: string) => Promise<Profile>;
  onBack: () => void;
}

/** Which container is open over the banner. */
type Open = 'switch' | 'history' | 'rules' | 'results' | null;

export function Banner({ profile: initial, onPull, onFocus, onBack }: BannerProps) {
  const banner = CHARACTER_BANNER;
  const [profile, setProfile] = useState(initial);
  const [last, setLast] = useState<PullRecord[]>([]);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pity = pityOf(profile, banner);
  const losses = lossesOf(profile, banner);
  const focus = profile.focus && banner.pool.includes(profile.focus) ? profile.focus : undefined;
  const def = focus ? registry.characters[focus] : undefined;
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
    });
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
        <p className="banner-blooms">
          {BLOOM}s <strong>{profile.pulls}</strong>
        </p>
      </header>

      <section className="banner-stage">
        {focus && def ? (
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
                  {def.name} is at C{MAX_DUPES}: any further copy becomes {POLLEN_PER_OVERFLOW} Pollen.
                </p>
              )}
            </div>
            <Art id={focus} className="banner-focus-art" />
          </>
        ) : (
          <p className="banner-no-focus">
            Choose a Focus with <strong>Switch</strong>: the character each SSR's 50/50 is for.
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
        <p className="banner-pity">
          SSR guaranteed within <strong>{HARD_PITY - pity}</strong> {HARD_PITY - pity === 1 ? 'pull' : 'pulls'}
        </p>
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
              return (
                <button
                  key={id}
                  className={`roster-tile domain-${tile?.domain ?? ''}${id === focus ? ' chosen' : ''}`}
                  aria-label={characterName(id)}
                  aria-pressed={id === focus}
                  disabled={busy}
                  onClick={() => focusOn(id)}
                >
                  <Art id={id} className="roster-art" />
                  <strong>{characterName(id)}</strong>
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
                  Your next SSR is guaranteed to be <strong>{characterName(focus)}</strong>.
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
            {history.length === 0 ? (
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
                  {history.map((r) => (
                    <tr key={r.n} className={`rarity-${r.rarity}`}>
                      <td>{r.n}</td>
                      <td>
                        <em>{RARITY[r.rarity]}</em> {pullText(r)}
                        {notesText(r) && <small> ({notesText(r)})</small>}
                      </td>
                      <td>{r.focus ? characterName(r.focus) : ''}</td>
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
                  <td>
                    {banner.sr.amount} of {banner.sr.one.map(itemName).join(', ')}, one at random
                  </td>
                </tr>
                <tr>
                  <th>R</th>
                  <td>{percent(RATES.r)}</td>
                  <td>{itemsText(banner.r)}</td>
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
              <li>
                A character's copies after the first raise their level from C1 to C{MAX_DUPES}; past C{MAX_DUPES}, each becomes {POLLEN_PER_OVERFLOW} Pollen.
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
