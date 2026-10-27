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
import { battleArt } from '../stage/art.ts';

// The banner screen (docs/notes/m5-collection.md, "The gacha"): the pool, where the player picks a
// Focus (owner, 28 Oct), Pull 1 and Pull 10, the odds, the pity counter, the 50/50 losses and the
// recent history. Odds, pity and history are always on screen (DESIGN.md).

const RARITY: Record<PullRecord['rarity'], string> = { ssr: 'SSR', sr: 'SR', r: 'R' };
const FIFTY_FIFTY: Record<NonNullable<PullRecord['fiftyFifty']>, string> = { won: '50/50 won', lost: '50/50 lost', guaranteed: 'Focus guaranteed' };
const HISTORY_SHOWN = 20;

const itemName = (id: string) => ITEM_NAMES[id] ?? id;
const itemsText = (items: Record<string, number>) =>
  Object.entries(items)
    .map(([id, n]) => `${n} ${itemName(id)}`)
    .join(', ');
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
const characterName = (id: string) => registry.characters[id]?.name ?? id;

/** What a pull gave, in words: the character and her dupe handling, or the items, Pollen last. */
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

interface BannerProps {
  profile: Profile;
  onPull: (banner: BannerDef, count: 1 | typeof TEN_PULL) => Promise<PullResult>;
  /** Saves a new Focus and gives back the profile. */
  onFocus: (banner: BannerDef, character: string) => Promise<Profile>;
  onBack: () => void;
}

export function Banner({ profile: initial, onPull, onFocus, onBack }: BannerProps) {
  const banner = CHARACTER_BANNER;
  const [profile, setProfile] = useState(initial);
  const [last, setLast] = useState<PullRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pity = pityOf(profile, banner);
  const losses = lossesOf(profile, banner);
  const focus = profile.focus && banner.pool.includes(profile.focus) ? profile.focus : undefined;
  const history = (profile.gacha?.history ?? []).slice(-HISTORY_SHOWN).reverse();
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
    });
  const focusOn = (id: string) => act(async () => setProfile(await onFocus(banner, id)));

  return (
    <div className="banner-screen">
      <section className="banner-main">
        <h2>{banner.name} banner</h2>
        <p className="banner-blooms">
          {BLOOM}s <strong>{profile.pulls}</strong>
          <span>{banked.map((id) => `${itemName(id)} ${profile.items?.[id] ?? 0}`).join(' · ')}</span>
        </p>
        <div className="banner-pool" aria-label="Pool">
          {banner.pool.map((id) => {
            const def = registry.characters[id];
            const dupes = profile.dupes?.[id];
            const owned = profile.owned.includes(id);
            return (
              <button
                key={id}
                className={`banner-pool-tile domain-${def?.domain ?? ''}${id === focus ? ' focus' : ''}`}
                aria-label={characterName(id)}
                aria-pressed={id === focus}
                disabled={busy}
                onClick={() => id !== focus && focusOn(id)}
              >
                <div className="banner-pool-art">{battleArt[id] && <img src={battleArt[id]} alt="" draggable={false} />}</div>
                <strong>{characterName(id)}</strong>
                <span>{owned ? `Owned${dupes ? `, C${dupes}` : ''}` : 'Not owned'}</span>
                {id === focus && <em className="banner-focus-tag">Focus</em>}
              </button>
            );
          })}
        </div>
        <p className="banner-focus" role="status">
          {!focus ? (
            <>Choose a Focus above: the character each SSR's 50/50 is for. You can change her at any time.</>
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
        {focus && (profile.dupes?.[focus] ?? 0) >= MAX_DUPES && (
          <p className="banner-warning" role="alert">
            {characterName(focus)} is at C{MAX_DUPES}: another copy of her becomes {POLLEN_PER_OVERFLOW} Pollen.
          </p>
        )}
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
          <li className="banner-pity">
            SSR guaranteed within <strong>{HARD_PITY - pity}</strong> {HARD_PITY - pity === 1 ? 'pull' : 'pulls'} ({pity} since the last)
          </li>
          <li>Every ten-pull has an SR or better. Every pull gives {POLLEN_PER_PULL} Pollen.</li>
          <li>Pity and 50/50 losses carry over when you change your Focus.</li>
        </ul>
        <div className="panel-buttons">
          <button className="end-turn" disabled={busy || !focus || profile.pulls < 1} onClick={() => pullOn(1)}>
            Pull 1 <small>{plural(1, BLOOM)}</small>
          </button>
          <button className="end-turn" disabled={busy || !focus || profile.pulls < TEN_PULL} onClick={() => pullOn(TEN_PULL)}>
            Pull 10 <small>{plural(TEN_PULL, BLOOM)}</small>
          </button>
          <button className="ghost" onClick={onBack}>
            Back
          </button>
        </div>
        {error && (
          <p className="title-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="banner-side">
        {last.length > 0 && (
          <div className="banner-results" aria-label="Results">
            {last.map((r) => (
              <div key={r.n} className={`banner-result rarity-${r.rarity}`}>
                <em>{RARITY[r.rarity]}</em>
                <span>{pullText(r)}</span>
              </div>
            ))}
          </div>
        )}
        <h3>History</h3>
        {history.length === 0 ? (
          <p className="banner-empty">No pulls yet.</p>
        ) : (
          <table className="banner-history" aria-label="History">
            <thead>
              <tr>
                <th>#</th>
                <th>Result</th>
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
      </section>
    </div>
  );
}
