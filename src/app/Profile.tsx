import { useState } from 'react';
import { CHARACTER_BANNER } from '../content/banners.ts';
import { registry } from '../content/registry.ts';
import type { SelectResult } from '../game/gacha.ts';
import { DEPTH_MAX } from '../game/depth.ts';
import { ASCENSIONS } from '../game/levels.ts';
import { BLOOM, plural, type Profile } from '../game/profile.ts';
import { depthExpMultiplier, levelProgress, PROFILE_EXP, PROFILE_EXP_PER_DEPTH, PROFILE_MAX, SELECTOR_LEVELS, unclaimed, type ClaimResult } from '../game/profileLevel.ts';
import { Currencies } from './MainMenu.tsx';
import { Art } from './Roster.tsx';

// The profile page (docs/notes/m6-depth.md, "Profile level"; owner, 31 Oct and 1 Nov): the level
// and EXP toward the next, the level rewards to claim, and the stats. How EXP is earned and what
// the levels give sit behind a "?". Every number comes from the profile and src/game/profileLevel.ts.

const STAT_ROWS: [keyof NonNullable<Profile['stats']>, string][] = [
  ['won', 'Runs won'],
  ['lost', 'Runs lost'],
  ['fights', 'Fights won'],
  ['elites', 'Elites beaten'],
  ['bosses', 'Bosses beaten'],
  ['trials', 'Trials won'],
];

const SOURCES: [keyof typeof PROFILE_EXP, string][] = [
  ['fight', 'A fight won'],
  ['elite', 'An elite beaten'],
  ['boss', 'A Boss beaten'],
  ['trial', 'A Trial won'],
  ['firstTrial', "A Trial tier's first clear"],
  ['ssr', 'An SSR pulled'],
];

interface ProfilePageProps {
  profile: Profile;
  onClaim: () => Promise<ClaimResult>;
  onBack: () => void;
}

export function ProfilePage({ profile: initial, onClaim, onBack }: ProfilePageProps) {
  const [profile, setProfile] = useState(initial);
  const [note, setNote] = useState<string>();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const { level, into, need } = levelProgress(profile.exp);
  const waiting = unclaimed(profile);
  const waitingSelectors = waiting.filter((l) => SELECTOR_LEVELS.includes(l)).length;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onClaim();
      if (!result.ok) return setNote(result.reason);
      setProfile(result.profile);
      const selectors = result.selectors > 0 ? ` and ${plural(result.selectors, 'SSR Selector')} (in your Inventory)` : '';
      setNote(`Claimed ${plural(result.pulls, BLOOM)}${selectors}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-screen">
      <Currencies profile={profile} />
      <h2 className="panel-title">
        Profile
        <button className="help-button" aria-label="How profile level works" onClick={() => setHelp(true)}>
          ?
        </button>
      </h2>
      <div className="profile-body">
        <section className="profile-panel profile-level" aria-label="Profile level">
          <div className="profile-ring big" style={{ '--progress': `${(need === 0 ? 1 : into / need) * 360}deg` } as React.CSSProperties}>
            <strong>{level}</strong>
          </div>
          <h3>Level {level}</h3>
          <p className="profile-exp">{need === 0 ? `The highest level, ${PROFILE_MAX}.` : `${into.toLocaleString('en-GB')} / ${need.toLocaleString('en-GB')} EXP to level ${level + 1}`}</p>
          <div className="profile-rewards">
            <p>
              {waiting.length === 0
                ? 'Each level gives a Purified Bloom.'
                : `Level ${waiting.length === 1 ? waiting[0] : `${waiting[0]}–${waiting.at(-1)}`}: ${plural(waiting.length, BLOOM)}${waitingSelectors > 0 ? ` and ${plural(waitingSelectors, 'SSR Selector')}` : ''} to claim.`}
            </p>
            <button className="end-turn" disabled={busy || waiting.length === 0} onClick={() => void claim()}>
              Claim
            </button>
          </div>
          {note && (
            <p className="profile-note" role="status">
              {note}
            </p>
          )}
        </section>

        <section className="profile-panel" aria-label="Stats">
          <h3>Stats</h3>
          <dl className="profile-stats">
            {STAT_ROWS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{(profile.stats?.[key] ?? 0).toLocaleString('en-GB')}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {help && (
        <div className="team-picker banner-dialog" role="dialog" aria-label="Profile level">
          <h3>Profile level</h3>
          <div className="banner-rules-body profile-help">
            <p>Your profile levels up from play, never from Memories, up to level {PROFILE_MAX}. Each level takes a little more EXP than the last.</p>
            <table className="banner-odds profile-sources">
              <tbody>
                {SOURCES.map(([key, label]) => (
                  <tr key={key}>
                    <th>{label}</th>
                    <td>{PROFILE_EXP[key]} EXP</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              A run's fights, elites and Boss give {Math.round(PROFILE_EXP_PER_DEPTH * 100)}% more EXP for each depth past 1 (×{depthExpMultiplier(DEPTH_MAX).toFixed(2)} at Depth {DEPTH_MAX}). A lost or
              abandoned run still counts the fights and elites it won.
            </p>
            <ul className="banner-rules">
              <li>Each level gives a {BLOOM}, claimed here with Claim.</li>
              <li>Levels {SELECTOR_LEVELS.join(' and ')} also give an SSR Selector: an SSR of your choice from the banner. Use it from your Inventory.</li>
              <li>Ascending a character needs profile level {ASCENSIONS.map((a) => `${a.profile} (at level ${a.at})`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</li>
              <li>Stats count runs won and lost (an abandoned run is lost) and fights won by kind.</li>
            </ul>
          </div>
          <div className="panel-buttons">
            <button className="ghost" onClick={() => setHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <button className="ghost inventory-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

const characterName = (id: string) => registry.characters[id]?.name ?? id;

/** What a selector gave, as it reads. */
export const selectedText = (id: string, result: Extract<SelectResult, { ok: true }>) =>
  result.dupe === 'new'
    ? `${characterName(id)} joins the roster.`
    : result.dupe === 'overflow'
      ? `${characterName(id)} is past C5: ${result.pollen} Pollen instead.`
      : `${characterName(id)} reaches C${result.dupe}.`;

/** Choosing the banner character an SSR Selector gives: a tile each, then Take. */
export function SelectorPicker({ profile, busy, onTake, onCancel }: { profile: Profile; busy: boolean; onTake: (id: string) => void; onCancel: () => void }) {
  const [chosen, setChosen] = useState<string>();
  return (
    <div className="team-picker banner-dialog" role="dialog" aria-label="Choose an SSR">
      <h3>Choose an SSR</h3>
      <div className="team-picker-grid">
        {CHARACTER_BANNER.pool.map((id) => (
          <button
            key={id}
            className={`roster-tile domain-${registry.characters[id]?.domain ?? ''}${id === chosen ? ' chosen' : ''}`}
            aria-label={characterName(id)}
            aria-pressed={id === chosen}
            disabled={busy}
            onClick={() => setChosen(id)}
          >
            <Art id={id} className="roster-art" />
            <strong>{characterName(id)}</strong>
            <span>{profile.owned.includes(id) ? `Owned${profile.dupes?.[id] ? `, C${profile.dupes[id]}` : ''}` : 'Not owned'}</span>
          </button>
        ))}
      </div>
      <p className="banner-dialog-note">A pulled copy: new, a dupe level, or Pollen past C5. Pity is untouched.</p>
      <div className="panel-buttons">
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="end-turn" disabled={busy || !chosen} onClick={() => chosen && onTake(chosen)}>
          {chosen ? `Take ${characterName(chosen)}` : 'Take'}
        </button>
      </div>
    </div>
  );
}
