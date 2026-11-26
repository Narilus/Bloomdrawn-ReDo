import { useEffect, useRef, useState } from 'react';
import { plural, SOUND_GROUPS, soundOf, type Profile, type Sound, type SoundGroup } from '../game/profile.ts';
import { SideList } from './SideList.tsx';
import { playCue } from './sound.ts';

// Options (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct), in tabs like the inventory's
// (owner, 27 Nov). Profile moves saves between browsers with a file and resets the profile. A reset
// can't be undone, so it waits for a ticked box and "RESET" typed before Confirm works. Sound:
// volume, mute, and each kind of sound muted on its own (M6.10), kept a moment after the last
// change, with a click at the new volume.

export const RESET_WORD = 'RESET';

type Tab = 'profile' | 'sound';
const TABS: [Tab, string][] = [
  ['profile', 'Profile'],
  ['sound', 'Sound'],
];

/** Each kind of sound as Options names it, with what it covers. */
const KINDS: Record<SoundGroup, [string, string]> = {
  interface: ['Interface', 'button presses'],
  cards: ['Cards', 'played and drawn'],
  combat: ['Combat', 'hits, blocks, statuses, enemies acting and falling'],
  moments: ['Big moments', 'ultimates, Transcends, Boss phases, wins and losses'],
  banners: ['Banners', 'pull results'],
};

interface OptionsProps {
  profile: Profile;
  onExport: () => Promise<void>;
  /** Throws if the file is refused. */
  onImport: (text: string) => Promise<void>;
  onReset: () => Promise<void>;
  /** Applies and keeps the sound settings. */
  onSound: (settings: Sound) => Promise<void>;
  onBack: () => void;
}

export function Options({ profile, onExport, onImport, onReset, onSound, onBack }: OptionsProps) {
  const [tab, setTab] = useState<Tab>('profile');
  const [sound, setSound] = useState(() => soundOf(profile));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void onSound(sound).then(() => playCue('click'));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [sound, onSound]);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [typed, setTyped] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const act = (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    job().finally(() => setBusy(false));
  };
  const canReset = understood && typed === RESET_WORD && !busy;

  const toggle = (kind: SoundGroup, muted: boolean) =>
    setSound((s) => ({ ...s, off: muted ? SOUND_GROUPS.filter((g) => g === kind || s.off.includes(g)) : s.off.filter((g) => g !== kind) }));

  return (
    <div className="options-screen">
      <nav className="options-nav" aria-label="Options">
        <h2 className="panel-title">Options</h2>
        <SideList label="Options" items={TABS} chosen={tab} onChoose={setTab} />
        <button className="ghost side-back" onClick={onBack}>
          Back
        </button>
      </nav>
      {tab === 'sound' ? (
        <section className="options-panel" role="tabpanel" aria-label="Sound">
          <h3>Sound</h3>
          <label className="options-volume">
            Volume
            <input type="range" min={0} max={100} step={5} value={sound.volume} disabled={sound.muted} onChange={(e) => setSound((s) => ({ ...s, volume: Number(e.target.value) }))} />
            <output>{sound.volume}</output>
          </label>
          <label className="options-check">
            <input type="checkbox" checked={sound.muted} onChange={(e) => setSound((s) => ({ ...s, muted: e.target.checked }))} />
            Mute all
          </label>
          <h4>Mute</h4>
          <div className="options-kinds" role="group" aria-label="Mute kinds of sound">
            {SOUND_GROUPS.map((kind) => (
              <label key={kind} className="options-check">
                <input type="checkbox" checked={sound.off.includes(kind)} onChange={(e) => toggle(kind, e.target.checked)} />
                <span>
                  {KINDS[kind][0]}
                  <small>{KINDS[kind][1]}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="options-panel" role="tabpanel" aria-label="Profile">
          <h3>Profile</h3>
          <p className="options-summary">This profile has ended {plural(profile.runs, 'expedition')}.</p>

          <h4>Backup</h4>
          <p>A save file holds this profile and any expedition in progress, to keep or to load in another browser.</p>
          <div className="options-files">
            <button className="ghost" onClick={() => act(onExport)}>
              Export save
            </button>
            <button className="ghost" onClick={() => file.current?.click()}>
              Import save
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                e.target.value = '';
                if (!chosen) return;
                act(async () => {
                  try {
                    setImportError(null);
                    await onImport(await chosen.text());
                  } catch (err) {
                    setImportError(err instanceof Error ? err.message : String(err));
                  }
                });
              }}
            />
          </div>
          {importError && (
            <p className="options-error" role="alert">
              That file couldn't be imported: {importError} Nothing was changed.
            </p>
          )}

          <h4>Reset</h4>
          <div className="options-reset">
            <p>Reset deletes this profile for good: characters, levels, items, pulls, history and any expedition in progress. It can't be undone.</p>
            <label className="options-check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />I understand everything on this profile will be lost.
            </label>
            <label className="options-type">
              Type {RESET_WORD} to confirm
              <input type="text" value={typed} spellCheck={false} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
            </label>
            <button className="ghost danger" disabled={!canReset} onClick={() => act(onReset)}>
              Confirm reset
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
