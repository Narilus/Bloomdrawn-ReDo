import { useState } from 'react';
import { itemCount } from '../content/items.ts';
import { BLOOM, runBanking, type Profile } from '../game/profile.ts';
import type { RunSave } from '../save/run.ts';
import { Icon } from './icons.tsx';
import { Banking, DEF } from './Labyrinth.tsx';
import { Art } from './Roster.tsx';
import type { Boot } from './saves.ts';

// The main menu (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct): Expedition, Trials, Roster,
// Banners, Inventory, Options and Exit down the left, the chosen team's front character on the
// right, and Ducats and Purified Blooms top right. Expedition and Banners open a sub-menu in place.

/** Ducats and Purified Blooms as icons and numbers, each named in a tooltip. */
export function Currencies({ profile }: { profile: Profile }) {
  const counts = [
    { icon: 'ducat', name: 'Ducats', n: profile.items?.money ?? 0 },
    { icon: 'bloom', name: `${BLOOM}s`, n: profile.pulls },
  ];
  return (
    <div className="currencies">
      {counts.map(({ icon, name, n }) => (
        <p key={icon} className={`currency currency-${icon}`} data-tip={name} tabIndex={0}>
          <Icon name={icon} />
          <span className="sr-only">{name}</span>
          <strong>{n.toLocaleString('en-GB')}</strong>
        </p>
      ))}
    </div>
  );
}

interface MenuProps {
  boot: Boot;
  /** The character shown beside the menu: the front of the chosen team. */
  featured: string | undefined;
  onContinue: (save: RunSave) => void;
  /** Goes on to party select for a new expedition, abandoning the saved run (given) first. */
  onNew: (saved: RunSave | null) => Promise<void>;
  onRoster: () => void;
  onBanner: () => void;
  onOptions: () => void;
}

type Open = 'expedition' | 'banners' | null;

export function MainMenu({ boot, featured, onContinue, onNew, onRoster, onBanner, onOptions }: MenuProps) {
  const { profile, run, ended } = boot;
  // A saved run opens the menu on Continue.
  const [open, setOpen] = useState<Open>(run ? 'expedition' : null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  const toggle = (menu: Open) => setOpen((was) => (was === menu ? null : menu));
  const startNew = (saved: RunSave | null) => {
    if (busy) return;
    setBusy(true);
    void onNew(saved).finally(() => setBusy(false));
  };
  // A page can only close a window it opened, so a browser tab usually stays; the desktop build will quit.
  const exit = () => {
    window.close();
    setExiting(true);
  };

  return (
    <div className="main-menu">
      {featured && <Art id={featured} className="menu-art" />}
      <Currencies profile={profile} />
      <div className="menu-column">
        <h1>Bloomdrawn</h1>
        <nav className="menu-list" aria-label="Main menu">
          <button className="menu-item" aria-expanded={run ? open === 'expedition' : undefined} onClick={() => (run ? toggle('expedition') : startNew(null))}>
            Expedition
          </button>
          {run && open === 'expedition' && (
            <div className="menu-sub">
              <button className="menu-item" onClick={() => onContinue(run)}>
                Continue
              </button>
              <button className="menu-item" onClick={() => setConfirming(true)}>
                New expedition
              </button>
            </div>
          )}
          <button className="menu-item" disabled>
            Trials <small>soon</small>
          </button>
          <button className="menu-item" onClick={onRoster}>
            Roster
          </button>
          <button className="menu-item" aria-expanded={open === 'banners'} onClick={() => toggle('banners')}>
            Banners
          </button>
          {open === 'banners' && (
            <div className="menu-sub">
              <button className="menu-item" onClick={onBanner}>
                Character banner
              </button>
              <button className="menu-item" disabled>
                Weapon banner <small>soon</small>
              </button>
            </div>
          )}
          <button className="menu-item" disabled>
            Inventory <small>soon</small>
          </button>
          <button className="menu-item" onClick={onOptions}>
            Options
          </button>
          <button className="menu-item" onClick={exit}>
            Exit
          </button>
        </nav>
      </div>
      {ended && (
        <div className="menu-notice" role="status">
          <p>The saved run couldn't be resumed ({ended.reason}), so it ended as abandoned.</p>
          <Banking banked={ended.banked} profile={undefined} />
        </div>
      )}
      {exiting && (
        <div className="menu-notice" role="status">
          <p>The browser keeps this tab open. Your progress is saved, so it can be closed now.</p>
          <button className="end-turn" autoFocus onClick={() => setExiting(false)}>
            Stay
          </button>
        </div>
      )}
      {confirming && run && (
        <div className="result reward menu-dialog" role="dialog" aria-label="New expedition">
          <h2 className="panel-title">New expedition</h2>
          <p className="result-line">The saved run ends now as abandoned and banks only its share:</p>
          <Banking banked={runBanking(run.exp, 'abandoned', DEF, itemCount)} profile={undefined} />
          <div className="panel-buttons">
            <button className="end-turn" autoFocus onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button className="ghost" onClick={() => startNew(run)}>
              Abandon it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
