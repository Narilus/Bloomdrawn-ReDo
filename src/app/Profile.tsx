import { useState } from 'react';
import { CHARACTER_BANNER } from '../content/banners.ts';
import { registry } from '../content/registry.ts';
import type { SelectResult } from '../game/gacha.ts';
import { BLOOM, plural, type Profile } from '../game/profile.ts';
import { levelProgress, PROFILE_EXP, PROFILE_MAX, SELECTOR_LEVELS, SSR_SELECTOR, unclaimed, type ClaimResult } from '../game/profileLevel.ts';
import { Currencies } from './MainMenu.tsx';
import { Art } from './Roster.tsx';

// The profile page (docs/notes/m6-depth.md, "Profile level"; owner,
// 31 Oct): the level and EXP toward the next, the level rewards to claim, the SSR selector, and
// the stats. Every number comes from the profile and src/game/profileLevel.ts.

const STAT_ROWS: [keyof NonNullable<Profile['stats']>, string][] = [
  ['won', 'Runs won'],
  ['lost', 'Runs lost'],
  ['fights', 'Fights won'],
  ['elites', 'Elites beaten'],
  ['bosses', 'Bosses beaten'],
  ['trials', 'Trials won'],
];

const SOURCES: [keyof typeof PROFILE_EXP, string][] = [
  ['fight', 'a fight won'],
  ['elite', 'an elite beaten'],
  ['boss', 'a Boss beaten'],
  ['trial', 'a Trial won'],
  ['firstTrial', "a Trial tier's first clear"],
  ['ssr', 'an SSR pulled'],
];

const characterName = (id: string) => registry.characters[id]?.name ?? id;

/** What a selector gave, as it reads. */
const selectedText = (id: string, result: Extract<SelectResult, { ok: true }>) =>
  result.dupe === 'new'
    ? `${characterName(id)} joins the roster.`
    : result.dupe === 'overflow'
      ? `${characterName(id)} is past C5: ${result.pollen} Pollen instead.`
      : `${characterName(id)} reaches C${result.dupe}.`;

interface ProfilePageProps {
  profile: Profile;
  onClaim: () => Promise<ClaimResult>;
  onSelect: (character: string) => Promise<SelectResult>;
  onBack: () => void;
}

export function ProfilePage({ profile: initial, onClaim, onSelect, onBack }: ProfilePageProps) {
  const [profile, setProfile] = useState(initial);
  const [note, setNote] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { level, into, need } = levelProgress(profile.exp);
  const waiting = unclaimed(profile);
  const selectors = profile.items?.[SSR_SELECTOR] ?? 0;
  const waitingSelectors = waiting.filter((l) => SELECTOR_LEVELS.includes(l)).length;

  const run = async <R extends { ok: true; profile: Profile } | { ok: false; reason: string }>(job: () => Promise<R>, said: (r: Extract<R, { ok: true }>) => string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await job();
      if (result.ok) {
        setProfile(result.profile);
        setNote(said(result as Extract<R, { ok: true }>));
      } else setNote(result.reason);
    } finally {
      setBusy(false);
    }
  };
  const claim = () =>
    run(onClaim, (r) => `Claimed ${[plural(r.pulls, BLOOM), ...(r.selectors > 0 ? [plural(r.selectors, 'SSR Selector')] : [])].join(' and ')}.`);
  const select = (id: string) =>
    run(
      () => onSelect(id),
      (r) => {
        setChoosing(false);
        setChosen(undefined);
        return selectedText(id, r);
      },
    );

  return (
    <div className="profile-screen">
      <Currencies profile={profile} />
      <h2 className="panel-title">Profile</h2>
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
            <p className="profile-small">Levels 25 and 50 also give an SSR Selector. Profile levels 5, 10 and 15 allow the ascensions at 10, 20 and 30.</p>
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
          <h3>Profile EXP</h3>
          <ul className="profile-sources">
            {SOURCES.map(([key, label]) => (
              <li key={key}>
                <strong>{PROFILE_EXP[key]}</strong> for {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="profile-panel" aria-label="SSR Selectors">
          <h3>SSR Selectors</h3>
          <p className="profile-held">Held: {selectors}</p>
          <p className="profile-small">An SSR character of your choice from the banner, as a pulled copy: new, a dupe level, or Pollen past C5. Pity is untouched.</p>
          <button className="end-turn" disabled={busy || selectors === 0} onClick={() => setChoosing(true)}>
            Choose a character
          </button>
        </section>
      </div>

      {choosing && (
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
          <div className="panel-buttons">
            <button className="ghost" onClick={() => (setChoosing(false), setChosen(undefined))}>
              Cancel
            </button>
            <button className="end-turn" disabled={busy || !chosen} onClick={() => chosen && void select(chosen)}>
              {chosen ? `Take ${characterName(chosen)}` : 'Take'}
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
