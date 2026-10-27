import { useState } from 'react';
import { STANDARD_BANNER } from '../content/banners.ts';
import { ITEM_NAMES } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import type { BannerDef } from '../engine/index.ts';
import { HARD_PITY, pityOf, POLLEN_PER_OVERFLOW, POLLEN_PER_PULL, RATES, TEN_PULL, type PullRecord, type PullResult } from '../game/gacha.ts';
import { BLOOM, plural, type Profile } from '../game/profile.ts';
import { battleArt } from '../stage/art.ts';

// The banner screen (docs/notes/m5-collection.md, "The gacha"): Pull 1 and Pull 10, the odds, the
// pity counter, the pool and the recent history. Odds, pity and history are always on screen (DESIGN.md).

const RARITY: Record<PullRecord['rarity'], string> = { ssr: 'SSR', sr: 'SR', r: 'R' };
const HISTORY_SHOWN = 20;

const itemName = (id: string) => ITEM_NAMES[id] ?? id;
const itemsText = (items: Record<string, number>) =>
  Object.entries(items)
    .map(([id, n]) => `${n} ${itemName(id)}`)
    .join(', ');
const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

/** What a pull gave, in words: the character and her dupe handling, or the items, Pollen last. */
export function pullText(record: PullRecord): string {
  const { pollen: _pollen, ...rest } = record.items;
  if (record.character) {
    const name = registry.characters[record.character]?.name ?? record.character;
    const dupe = record.dupe === 'new' ? 'new' : record.dupe === 'overflow' ? `past C5: +${POLLEN_PER_OVERFLOW} Pollen` : `C${record.dupe}`;
    return `${name} (${dupe})`;
  }
  return itemsText(rest);
}

/** Why a rarity was certain, for the history. */
const guaranteeText = (record: PullRecord) => (record.guarantee === 'pity' ? 'pity' : record.guarantee === 'tenPull' ? 'ten-pull' : '');

interface BannerProps {
  profile: Profile;
  onPull: (banner: BannerDef, count: 1 | typeof TEN_PULL) => Promise<PullResult>;
  onBack: () => void;
}

export function Banner({ profile: initial, onPull, onBack }: BannerProps) {
  const banner = STANDARD_BANNER;
  const [profile, setProfile] = useState(initial);
  const [last, setLast] = useState<PullRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pity = pityOf(profile, banner);
  const history = (profile.gacha?.history ?? []).slice(-HISTORY_SHOWN).reverse();
  // Pollen always, then whatever else the profile has banked.
  const banked = Object.keys(ITEM_NAMES).filter((id) => id === 'pollen' || profile.items?.[id]);

  const act = (count: 1 | typeof TEN_PULL) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    onPull(banner, count)
      .then((result) => {
        if (!result.ok) return setError(result.reason);
        setProfile(result.profile);
        setLast(result.records);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="banner-screen">
      <section className="banner-main">
        <h2>{banner.name} banner</h2>
        <p className="banner-blooms">
          {BLOOM}s <strong>{profile.pulls}</strong>
          <span>{banked.map((id) => `${itemName(id)} ${profile.items?.[id] ?? 0}`).join(' · ')}</span>
        </p>
        <div className="banner-pool" aria-label="Pool">
          {banner.ssr.map((id) => {
            const def = registry.characters[id];
            const dupes = profile.dupes?.[id];
            const owned = profile.owned.includes(id);
            return (
              <div key={id} className={`banner-pool-tile domain-${def?.domain ?? ''}`}>
                <div className="banner-pool-art">{battleArt[id] && <img src={battleArt[id]} alt="" draggable={false} />}</div>
                <strong>{def?.name ?? id}</strong>
                <span>{owned ? `Owned${dupes ? `, C${dupes}` : ''}` : 'Not owned'}</span>
              </div>
            );
          })}
        </div>
        <table className="banner-odds">
          <tbody>
            <tr>
              <th>SSR</th>
              <td>{percent(RATES.ssr)}</td>
              <td>One of the four above, each as likely</td>
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
        </ul>
        <div className="panel-buttons">
          <button className="end-turn" disabled={busy || profile.pulls < 1} onClick={() => act(1)}>
            Pull 1 <small>{plural(1, BLOOM)}</small>
          </button>
          <button className="end-turn" disabled={busy || profile.pulls < TEN_PULL} onClick={() => act(TEN_PULL)}>
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
                <th>Blooms</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.n} className={`rarity-${r.rarity}`}>
                  <td>{r.n}</td>
                  <td>
                    <em>{RARITY[r.rarity]}</em> {pullText(r)}
                    {r.guarantee && <small> ({guaranteeText(r)})</small>}
                  </td>
                  <td>
                    {r.pityBefore} → {r.pityAfter}
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
