import { useEffect, useRef, useState } from 'react';
import { itemCount } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { STARTERS } from '../content/roster.ts';
import type { Growth } from '../game/expedition.ts';
import { MAX_LEVEL } from '../game/levels.ts';
import { ownedCharacters, presetCost, runBanking, teamsOf, type Profile } from '../game/profile.ts';
import type { RunSave } from '../save/run.ts';
import { Banner } from './Banner.tsx';
import { DEF, Labyrinth, newRun } from './Labyrinth.tsx';
import { MainMenu } from './MainMenu.tsx';
import { Options } from './Options.tsx';
import { PartySelect, Roster } from './Roster.tsx';
import { browserSaves, type Boot } from './saves.ts';

// The game's screens (docs/notes/m4-run.md, "Save and resume"; m5-collection.md; m6-depth.md): the
// main menu, and the run, party select, roster, banner and options it leads to.

type Screen =
  | { kind: 'loading' }
  | { kind: 'title'; boot: Boot }
  | { kind: 'party'; profile: Profile }
  | { kind: 'roster'; profile: Profile }
  | { kind: 'banner'; profile: Profile }
  | { kind: 'options'; profile: Profile }
  | { kind: 'run'; save: RunSave };

/** Dev builds only: `?owned=all` fields every character, to try kits before the gacha gives them. Nothing is saved. */
const OWN_ALL = import.meta.env.DEV && new URLSearchParams(window.location.search).get('owned') === 'all';
const devNumber = (name: string, max: number) =>
  import.meta.env.DEV ? Math.min(max, Math.max(0, Math.floor(Number(new URLSearchParams(window.location.search).get(name)) || 0))) : 0;
/** Dev builds only: `?dupes=N` (1 to 5) puts every character with dupe levels at CN, on the roster and in new runs. Nothing is saved. */
const DEV_DUPES = devNumber('dupes', 5);
/** Dev builds only: `?level=N` (2 to 40) puts every character at level N, on the roster and in new runs. Nothing is saved. */
const DEV_LEVEL = devNumber('level', MAX_LEVEL);
/** The profile's dupe levels and levels, or `?dupes`'s and `?level`'s. */
const growthOf = (profile: Profile): Growth => ({
  dupes: DEV_DUPES ? Object.fromEntries(Object.values(registry.characters).filter((c) => c.dupes?.length).map((c) => [c.id, DEV_DUPES])) : profile.dupes,
  levels: DEV_LEVEL > 1 ? Object.fromEntries(Object.keys(registry.characters).map((id) => [id, DEV_LEVEL])) : profile.levels,
});

/** The characters a profile can field, leaving out any the game no longer has. */
const ownedBy = (profile: Profile) =>
  ownedCharacters(OWN_ALL ? { ...profile, owned: Object.keys(registry.characters) } : profile, STARTERS).filter((id) => registry.characters[id]);

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

  const startNew = async (party: readonly string[], growth: Growth) => {
    const save = newRun(party, growth);
    await saves.start(save);
    setScreen({ kind: 'run', save });
  };
  const toTitle = () => {
    setScreen({ kind: 'loading' });
    void load();
  };
  // Party select reads the profile afresh, so it opens on the presets as last saved.
  const chooseParty = () => {
    setScreen({ kind: 'loading' });
    void saves.profile().then((profile) => setScreen({ kind: 'party', profile }));
  };

  if (screen.kind === 'loading') return <div className="title-screen" />;
  if (screen.kind === 'run') {
    return <Labyrinth key={screen.save.id} initial={screen.save} saves={saves} onAgain={chooseParty} onTitle={toTitle} />;
  }
  if (screen.kind === 'party') {
    const owned = ownedBy(screen.profile);
    return (
      <PartySelect
        // A bought preset opens party select afresh on it.
        key={screen.profile.teams?.length ?? 0}
        owned={owned}
        teams={teamsOf(screen.profile, owned)}
        team={screen.profile.team ?? 0}
        money={screen.profile.items?.money ?? 0}
        presetCost={presetCost(screen.profile)}
        onBuy={async () => {
          const result = await saves.buyPreset(owned);
          if (result.ok) setScreen({ kind: 'party', profile: result.profile });
        }}
        onChange={(teams, team) => void saves.teams(teams, team)}
        onStart={(party) => void startNew(party, growthOf(screen.profile))}
        onBack={toTitle}
      />
    );
  }
  if (screen.kind === 'roster') {
    // An action that went through shows the profile it saved; a refusal changes nothing.
    const act = async <R extends { ok: true; profile: Profile } | { ok: false; reason: string }>(job: Promise<R>) => {
      const result = await job;
      if (result.ok) setScreen({ kind: 'roster', profile: result.profile });
      return result;
    };
    return (
      <Roster
        owned={ownedBy(screen.profile)}
        profile={screen.profile}
        growth={growthOf(screen.profile)}
        onLevelUp={(id, levels) => act(saves.levelUp(id, levels))}
        onAscend={(id) => act(saves.ascend(id))}
        onBack={toTitle}
      />
    );
  }
  if (screen.kind === 'banner') {
    // The seed only starts the gacha's stream on a profile's first pull; after that the profile carries it.
    return (
      <Banner
        profile={screen.profile}
        onPull={(banner, count) => saves.pull(banner, count, Math.floor(Math.random() * 2 ** 31))}
        onFocus={saves.focus}
        onBack={toTitle}
      />
    );
  }
  if (screen.kind === 'options') {
    return (
      <Options
        profile={screen.profile}
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
        onReset={async () => {
          await saves.reset();
          toTitle();
        }}
        onBack={toTitle}
      />
    );
  }
  const { profile } = screen.boot;
  const owned = ownedBy(profile);
  return (
    <MainMenu
      boot={screen.boot}
      featured={teamsOf(profile, owned)[profile.team ?? 0]?.members.find((id) => id !== null) ?? undefined}
      onContinue={(save) => setScreen({ kind: 'run', save })}
      onNew={async (saved) => {
        if (saved) await saves.end(runBanking(saved.exp, 'abandoned', DEF, itemCount));
        chooseParty();
      }}
      onRoster={() => setScreen({ kind: 'roster', profile })}
      onBanner={() => setScreen({ kind: 'banner', profile })}
      onOptions={() => setScreen({ kind: 'options', profile })}
    />
  );
}
