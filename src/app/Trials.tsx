import { useCallback, useState } from 'react';
import { itemCount, ITEMS } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { TRIALS } from '../content/trials.ts';
import type { CombatSetup, CombatState } from '../engine/index.ts';
import { BLOOM, plural, type Profile } from '../game/profile.ts';
import { TRIAL_TIERS, trialCleared, trialOpen, type TrialResult } from '../game/trials.ts';
import { Combat } from './Combat.tsx';
import { Currencies } from './MainMenu.tsx';
import { Art } from './Roster.tsx';

// Trials (docs/notes/trials.md; owner, 31 Oct): a Domain's boss, fought straight at a tier's level,
// with no map. Tier 1 is open, and each tier's first win opens the next. Every number comes from
// src/game/trials.ts and the content.

const bossOf = (encounter: string) => {
  const entry = registry.encounters[encounter]?.enemies[0];
  return typeof entry === 'string' ? entry : (entry?.enemy ?? '');
};
const domainName = (domain: string) => registry.domains[domain]?.name ?? domain;
const materialOf = (domain: string) => registry.domains[domain]?.material ?? '';

/** The Trial's label in the fight: its Domain and tier. */
export const trialLabel = (domain: string, tier: number) => `${domainName(domain)} Trial · Tier ${tier}`;

interface TrialsProps {
  profile: Profile;
  /** The Domain and tier the screen opens on, as last chosen. */
  initial?: { domain: string; tier: number } | undefined;
  /** Goes on to party select for this Trial. */
  onChoose: (domain: string, tier: number) => void;
  onBack: () => void;
}

/** The four Trials down the left, each with its best tier won; the one chosen, with its tiers, on the right. */
export function Trials({ profile, initial, onChoose, onBack }: TrialsProps) {
  const [domain, setDomain] = useState(initial?.domain ?? TRIALS[0]!.domain);
  const open = trialOpen(profile, domain);
  const [tier, setTier] = useState(Math.min(initial?.domain === domain ? initial.tier : open, open));
  const choose = (next: string) => {
    setDomain(next);
    setTier(trialOpen(profile, next));
  };
  const trial = TRIALS.find((t) => t.domain === domain)!;
  const boss = bossOf(trial.encounter);
  const cleared = trialCleared(profile, domain);
  const def = TRIAL_TIERS[tier - 1]!;

  return (
    <div className="trials-screen">
      <Currencies profile={profile} />
      <h2 className="panel-title">Trials</h2>
      <div className="trials-body">
        <ul className="trial-list" aria-label="Trials">
          {TRIALS.map((t) => {
            const best = trialCleared(profile, t.domain);
            return (
              <li key={t.domain}>
                <button className={`trial-card domain-${t.domain}${t.domain === domain ? ' chosen' : ''}`} aria-pressed={t.domain === domain} onClick={() => choose(t.domain)}>
                  <Art id={bossOf(t.encounter)} className="trial-card-art" />
                  <span className="trial-card-text">
                    <strong>{domainName(t.domain)}</strong>
                    <span>{registry.enemies[bossOf(t.encounter)]?.name}</span>
                    <em>{best === 0 ? 'Not yet won' : best === TRIAL_TIERS.length ? 'Every tier won' : `Tier ${best} won`}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className={`trial-detail domain-${domain}`} aria-label={`${domainName(domain)} Trial`}>
          <Art id={boss} className="trial-detail-art" />
          <div className="trial-detail-text">
            <h3>{registry.enemies[boss]?.name}</h3>
            <p className="trial-pays">Each win pays {domainName(domain)}'s ascension material, {ITEMS[materialOf(domain)]?.plural}.</p>
            <ol className="trial-tiers" aria-label="Tiers">
              {TRIAL_TIERS.map((t) => {
                const locked = t.tier > open;
                return (
                  <li key={t.tier}>
                    <button className={`trial-tier${t.tier === tier ? ' chosen' : ''}`} aria-pressed={t.tier === tier} disabled={locked} onClick={() => setTier(t.tier)}>
                      <strong>Tier {t.tier}</strong>
                      <span>Level {t.level}</span>
                      <span>{locked ? `Win Tier ${t.tier - 1} first` : `Pays ${itemCount(materialOf(domain), t.pay)}`}</span>
                      <em>{t.tier <= cleared ? 'Won' : locked ? '' : `First win: ${plural(t.firstClear, BLOOM)}`}</em>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="trial-note">One fight against the boss at level {def.level}, with no map. A defeat pays nothing, and you can try again whenever you like.</p>
            <button className="end-turn" onClick={() => onChoose(domain, tier)}>
              Choose party
            </button>
          </div>
        </section>
      </div>
      <button className="ghost inventory-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

interface TrialFightProps {
  domain: string;
  tier: number;
  setup: CombatSetup;
  /** Settles the fight: pays a win, and refuses a tier not open. */
  onEnd: (won: boolean) => Promise<TrialResult>;
  onAgain: () => void;
  onBack: () => void;
}

/** A Trial's one fight, then what it paid. "Give up" leaves it as a defeat. */
export function TrialFight({ domain, tier, setup, onEnd, onAgain, onBack }: TrialFightProps) {
  const [result, setResult] = useState<TrialResult | null>(null);
  const [leaving, setLeaving] = useState(false);
  const settle = useCallback((won: boolean) => void onEnd(won).then(setResult), [onEnd]);
  const ended = useCallback((combat: CombatState) => settle(combat.outcome === 'victory'), [settle]);

  return (
    <>
      <Combat setup={setup} label={trialLabel(domain, tier)} onEnd={ended} />
      {!result && (
        <button className="trial-leave plaque" onClick={() => setLeaving(true)}>
          Give up
        </button>
      )}
      {leaving && !result && (
        <div className="result reward" role="dialog" aria-label="Give up">
          <h2 className="panel-title">Give up this Trial?</h2>
          <p className="result-line">It ends as a defeat, which pays nothing. You can try again whenever you like.</p>
          <div className="panel-buttons">
            <button className="end-turn" onClick={() => setLeaving(false)}>
              Keep fighting
            </button>
            <button className="ghost" onClick={() => settle(false)}>
              Give up
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="result" role="dialog" aria-label={result.ok && result.won ? 'Victory' : 'Defeat'}>
          <h2>{result.ok && result.won ? 'Victory' : 'Defeat'}</h2>
          {result.ok ? (
            result.won ? (
              <>
                <p className="result-line">The Trial pays {itemCount(materialOf(domain), result.material)}.</p>
                {result.first && (
                  <p className="result-line">
                    First win at Tier {tier}: {plural(result.pulls, BLOOM)}
                    {tier < TRIAL_TIERS.length ? `, and Tier ${tier + 1} is open.` : '.'}
                  </p>
                )}
              </>
            ) : (
              <p className="result-line">A defeat pays nothing. Try again whenever you like.</p>
            )
          ) : (
            <p className="result-line">{result.reason}</p>
          )}
          <div className="panel-buttons">
            <button className="ghost" onClick={onBack}>
              Trials
            </button>
            <button className="end-turn" autoFocus onClick={onAgain}>
              Fight again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
