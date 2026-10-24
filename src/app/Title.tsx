import { useEffect, useRef, useState } from 'react';
import { runBanking } from '../game/profile.ts';
import type { RunSave } from '../save/run.ts';
import { Banking, DEF, Labyrinth, newRun } from './Labyrinth.tsx';
import { browserSaves, type Boot } from './saves.ts';

// The title screen (docs/notes/m4-run.md, "Save and resume"): Continue a saved run, start a new one,
// see the banked pulls, and move saves between browsers with a file.

type Screen = { kind: 'loading' } | { kind: 'title'; boot: Boot } | { kind: 'run'; save: RunSave };

export function Game() {
  const saves = browserSaves();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const load = () => saves.boot(DEF).then((boot) => setScreen({ kind: 'title', boot }));
  // Boot once: a second boot would find an unreadable run already banked and lose the notice.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void load();
  });

  const startNew = async () => {
    const save = newRun();
    await saves.start(save);
    setScreen({ kind: 'run', save });
  };
  const toTitle = () => {
    setScreen({ kind: 'loading' });
    void load();
  };

  if (screen.kind === 'loading') return <div className="title-screen" />;
  if (screen.kind === 'run') {
    return <Labyrinth key={screen.save.id} initial={screen.save} saves={saves} onAgain={() => void startNew()} onTitle={toTitle} />;
  }
  return (
    <Title
      boot={screen.boot}
      onContinue={(save) => setScreen({ kind: 'run', save })}
      onNew={async (saved) => {
        if (saved) await saves.end(runBanking(saved.exp, 'abandoned', DEF));
        await startNew();
      }}
      onExport={async () => {
        const text = await saves.exportFile();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        link.download = 'bloomdrawn-save.json';
        link.click();
        URL.revokeObjectURL(link.href);
      }}
      onImport={async (text) => {
        await saves.importFile(text);
        toTitle();
      }}
    />
  );
}

interface TitleProps {
  boot: Boot;
  onContinue: (save: RunSave) => void;
  /** Starts a new run, abandoning the saved one (given) first. */
  onNew: (saved: RunSave | null) => Promise<void>;
  onExport: () => Promise<void>;
  /** Throws if the file is refused. */
  onImport: (text: string) => Promise<void>;
}

function Title({ boot, onContinue, onNew, onExport, onImport }: TitleProps) {
  const { profile, run, ended } = boot;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const act = (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    job().finally(() => setBusy(false));
  };

  return (
    <div className="title-screen">
      <h1>Bloomdrawn</h1>
      <p className="title-pulls">
        Banked pulls <strong>{profile.pulls}</strong>
        <span>
          {profile.runs} {profile.runs === 1 ? 'run' : 'runs'}
        </span>
      </p>
      {ended && (
        <div className="title-notice" role="status">
          <p>The saved run couldn't be resumed ({ended.reason}), so it ended as abandoned.</p>
          <Banking banked={ended.banked} profile={undefined} />
        </div>
      )}
      {confirming && run ? (
        <div className="title-notice" role="dialog" aria-label="New run">
          <p>Start a new run? The saved run ends as abandoned and banks only its share:</p>
          <Banking banked={runBanking(run.exp, 'abandoned', DEF)} profile={undefined} />
          <div className="panel-buttons">
            <button className="end-turn" onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button className="ghost" onClick={() => act(() => onNew(run))}>
              Abandon and start
            </button>
          </div>
        </div>
      ) : (
        <div className="title-buttons">
          {run && (
            <button className="end-turn" onClick={() => onContinue(run)}>
              Continue
            </button>
          )}
          <button className="end-turn" onClick={() => (run ? setConfirming(true) : act(() => onNew(null)))}>
            New run
          </button>
        </div>
      )}
      <div className="title-files">
        <button onClick={() => act(onExport)}>Export save</button>
        <button onClick={() => file.current?.click()}>Import save</button>
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
        <p className="title-error" role="alert">
          That file couldn't be imported: {importError} Nothing was changed.
        </p>
      )}
    </div>
  );
}
