import { useEffect, useRef, useState } from 'react';
import { plural, soundOf, type Profile } from '../game/profile.ts';
import { playCue } from './sound.ts';

// Options (docs/notes/m6-depth.md, "Main menu"; owner, 31 Oct). Profile management moves saves
// between browsers with a file and resets the profile. A reset can't be undone, so it waits for a
// ticked box and "RESET" typed before Confirm works. Sound: volume and mute (M6.10), kept a moment
// after the slider stops, with a click at the new volume.

export const RESET_WORD = 'RESET';

interface OptionsProps {
  profile: Profile;
  onExport: () => Promise<void>;
  /** Throws if the file is refused. */
  onImport: (text: string) => Promise<void>;
  onReset: () => Promise<void>;
  /** Applies and keeps volume and mute. */
  onSound: (settings: { volume: number; muted: boolean }) => Promise<void>;
  onBack: () => void;
}

export function Options({ profile, onExport, onImport, onReset, onSound, onBack }: OptionsProps) {
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

  return (
    <div className="options-screen">
      <h2 className="panel-title">Options</h2>
      <div className="options-panels">
      <section className="options-panel" aria-label="Sound">
        <h3>Sound</h3>
        <div className="options-sound">
          <label className="options-volume">
            Volume
            <input type="range" min={0} max={100} step={5} value={sound.volume} disabled={sound.muted} onChange={(e) => setSound((s) => ({ ...s, volume: Number(e.target.value) }))} />
            <output>{sound.volume}</output>
          </label>
          <label className="options-check">
            <input type="checkbox" checked={sound.muted} onChange={(e) => setSound((s) => ({ ...s, muted: e.target.checked }))} />
            Mute
          </label>
        </div>
      </section>
      <section className="options-panel" aria-label="Profile management">
        <h3>Profile management</h3>
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
      </div>
      <button className="ghost options-back" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
