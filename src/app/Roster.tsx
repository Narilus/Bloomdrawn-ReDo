import { useEffect, useRef, useState } from 'react';
import { itemCount } from '../content/items.ts';
import { registry } from '../content/registry.ts';
import { critOf, describeCharacter, type CardDef, type Stats } from '../engine/index.ts';
import { fieldedCharacter, runCardText, type Growth } from '../game/expedition.ts';
import { affordableLevels, ascend, ascensionCost, ASCENSIONS, ASCENSION_PULLS, ascensionsOf, levelCap, levelCost, levelOf, MAX_LEVEL, MEMORIES, type GrowthResult } from '../game/levels.ts';
import { DEPTH_BAND, DEPTH_MAX, rewardMultiplier } from '../game/depth.ts';
import { BLOOM, PARTY_SIZE, partyProblem, plural, type Profile, renameTeam, TEAM_NAME_LENGTH, type Team } from '../game/profile.ts';
import { assignWeapon, holderOf, placeMember, quickMembers, removeMember, teamWeapons, type OwnedWeapon } from '../game/weapons.ts';
import { battleArt } from '../stage/art.ts';
import { CardFace, markNumber } from './CardView.tsx';
import { SideList } from './SideList.tsx';
import { sortWeapons, WeaponCard, WeaponGlyph, WeaponTile } from './Weapons.tsx';

// The roster, a character's page and party select (docs/notes/m5-collection.md, "The roster and the party").

const DOMAIN_LABEL: Record<string, string> = { flesh: 'Flesh', rapture: 'Rapture', spirit: 'Spirit', unbound: 'Unbound' };

const fullName = (id: string) => {
  const def = registry.characters[id];
  return def?.title ? `${def.name}, ${def.title}` : (def?.name ?? id);
};

/**
 * A character's battle art at a fixed height, the same for everyone as on the battlefield, so a wide
 * figure (Anthe) stands as tall as the rest. Art wider than its window is cut at the sides, never shrunk.
 */
export function Art({ id, className }: { id: string; className: string }) {
  const art = battleArt[id];
  return (
    <div className={`char-art ${className}`}>
      {art ? <img src={art} alt="" draggable={false} /> : <span className="monogram">{registry.characters[id]?.name.charAt(0)}</span>}
    </div>
  );
}

/** A character as a tile: her art, name and Domain, her level and Potential if given, and her place in the party if she has one. */
function Tile({ id, place, level, dupes, onClick }: { id: string; place?: number | undefined; level?: number | undefined; dupes?: number | undefined; onClick: () => void }) {
  const def = registry.characters[id];
  return (
    <button className={`roster-tile domain-${def?.domain ?? ''}${place !== undefined ? ' chosen' : ''}`} aria-label={def?.name ?? id} aria-pressed={place !== undefined} onClick={onClick}>
      <Art id={id} className="roster-art" />
      <strong>{def?.name ?? id}</strong>
      <span>{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
      {place !== undefined && <em className="roster-place">{place + 1}</em>}
      {level ? <em className="roster-lv">Lv {level}</em> : null}
      {dupes ? <em className="roster-level">P{dupes}</em> : null}
    </button>
  );
}

const placeLabel = (i: number) => (i === 0 ? 'Front' : String(i + 1));

interface PartySelectProps {
  owned: readonly string[];
  teams: readonly Team[];
  /** The preset to open on. */
  team: number;
  /** Ducats banked, and what one more preset costs in them. */
  money: number;
  presetCost: number;
  /** Buys one more preset. */
  onBuy: () => Promise<void>;
  /** Called with every change, to save the presets. */
  onChange: (teams: Team[], team: number) => void;
  /** The depth it opens on, and the deepest open; without them (a Trial) there is no depth to choose. */
  depth?: number;
  depthOpen?: number;
  /** Called with every depth chosen, to save it. */
  onDepth?: (depth: number) => void;
  /** Starts with the party, the depth and the preset's weapon under each place. */
  onStart: (party: string[], depth: number, weapons: (string | null)[]) => void;
  /** The weapons owned, for the weapon under each place; none if absent. */
  armory?: Readonly<Record<string, OwnedWeapon>> | undefined;
  /** Levels, ascensions and Potential, for each place's stats. */
  growth?: Growth;
  /** The start button's text: "Start expedition" unless given. */
  startLabel?: string;
  onBack: () => void;
}

/**
 * The run's depth (docs/notes/m6-depth.md, "Depth tiers"): its enemies' level and what it multiplies
 * Memories and Ducats by, both the game's, and how to open deeper ones.
 */
function DepthChooser({ depth, open, onChange }: { depth: number; open: number; onChange: (depth: number) => void }) {
  const next = open < DEPTH_MAX ? `Win Depth ${open} to open ${open + 1}–${Math.min(DEPTH_MAX, open + DEPTH_BAND)}.` : 'Every depth is open.';
  return (
    <div className="depth-chooser" role="group" aria-label="Depth">
      <span className="depth-label">Depth</span>
      <button className="depth-step" aria-label="Shallower" disabled={depth <= 1} onClick={() => onChange(depth - 1)}>
        −
      </button>
      <input
        className="depth-value"
        type="number"
        aria-label="Depth chosen"
        min={1}
        max={open}
        value={depth}
        onChange={(e) => onChange(Math.floor(Number(e.target.value)) || 1)}
      />
      <button className="depth-step" aria-label="Deeper" disabled={depth >= open} onClick={() => onChange(depth + 1)}>
        +
      </button>
      <span className="depth-info">
        Enemies <strong>Lv {depth}</strong> · Memories and Ducats <strong>×{Number(rewardMultiplier(depth).toFixed(2))}</strong>
      </span>
      <span className="depth-next">{open === 1 ? 'The first expedition is at Depth 1.' : next}</span>
    </div>
  );
}

/**
 * Which picker is open: one place's, quick select with the characters clicked so far, or one place's
 * weapon, with the weapon to move after a confirm if another place holds it.
 */
type Picking = { kind: 'place'; place: number } | { kind: 'quick'; picked: string[] } | { kind: 'weapon'; place: number; moving?: string } | null;

/**
 * Party select (owner, 26 Oct): team presets on the left; the chosen one's four places on the right.
 * A place opens the character list: a character goes in, or swaps with the place she was in. Quick
 * select fills all four in the order clicked. Under each place is its weapon (owner, 15 Nov): a
 * weapon once per preset, moving with its member, her owned signature filled in when she joins, and
 * each place's stats shown with it.
 */
export function PartySelect({
  owned,
  teams: initialTeams,
  team: initialTeam,
  money,
  presetCost,
  onBuy,
  onChange,
  depth: initialDepth = 1,
  depthOpen,
  onDepth,
  onStart,
  startLabel,
  armory = {},
  growth = {},
  onBack,
}: PartySelectProps) {
  const [depth, setDepth] = useState(Math.min(Math.max(1, initialDepth), depthOpen ?? 1));
  const changeDepth = (to: number) => {
    const next = Math.min(Math.max(1, to), depthOpen ?? 1);
    setDepth(next);
    onDepth?.(next);
  };
  const [teams, setTeams] = useState<Team[]>(() => initialTeams.map((t) => ({ ...t, members: [...t.members], ...(t.weapons && { weapons: [...t.weapons] }) })));
  const [team, setTeam] = useState(Math.min(initialTeam, initialTeams.length - 1));
  const [picking, setPicking] = useState<Picking>(null);
  const current = teams[team]!;
  const problem = partyProblem(current.members, owned);
  // The preset it opens on is in view, a bought one at the foot of the list included.
  const chosen = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    chosen.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const commit = (next: Team[], chosen = team) => {
    setTeams(next);
    setTeam(chosen);
    onChange(next, chosen);
  };
  const setCurrent = (next: Team) => commit(teams.map((t, i) => (i === team ? next : t)));
  const signatureOf = (id: string) => Object.values(registry.weapons).find((w) => w.signature === id && armory[w.id])?.id;
  // A weapon no longer owned (or no longer in the game) counts as none.
  const weapons = teamWeapons(current).map((w) => (w && armory[w] && registry.weapons[w] ? w : null));
  const wielded = Object.fromEntries(
    current.members.flatMap((m, i) => (m && weapons[i] ? [[m, { weapon: weapons[i], ...((armory[weapons[i]]?.step ?? 0) > 0 && { step: armory[weapons[i]]!.step }) }]] : [])),
  );
  const chooseWeapon = (place: number, weapon: string | null) => {
    const holder = weapon ? holderOf({ ...current, weapons }, weapon) : undefined;
    if (weapon && holder !== undefined && holder !== place) return setPicking({ kind: 'weapon', place, moving: weapon });
    setCurrent(assignWeapon({ ...current, weapons }, place, weapon));
    setPicking(null);
  };
  const setName = (name: string, done: boolean) => {
    const next = teams.map((t, i) => (i === team ? { ...t, name: done ? renameTeam(name, i) : name.slice(0, TEAM_NAME_LENGTH) } : t));
    if (done) commit(next);
    else setTeams(next);
  };

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  return (
    <div className="team-screen">
      <aside className="team-list-pane">
        <h2 className="panel-title">Choose your party</h2>
        <ul className="team-list" aria-label="Teams">
          {teams.map((t, i) => (
            <li key={i}>
              <button ref={i === team ? chosen : undefined} className={`team-preset${i === team ? ' selected' : ''}`} aria-pressed={i === team} onClick={() => commit(teams, i)}>
                <strong>{t.name}</strong>
                <span className="team-preset-faces">
                  {t.members.map((m, j) =>
                    m ? <Art key={j} id={m} className={`team-preset-face domain-${registry.characters[m]?.domain ?? ''}`} /> : <span key={j} className="team-preset-face" />,
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="ghost team-buy" disabled={money < presetCost} onClick={() => void onBuy()}>
          New preset: {itemCount('money', presetCost)}
        </button>
        <p className="team-money">You have {itemCount('money', money)}</p>
      </aside>
      <section className="team-pane">
        <input
          className="team-name"
          aria-label="Team name"
          value={current.name}
          maxLength={TEAM_NAME_LENGTH}
          onChange={(e) => setName(e.target.value, false)}
          onBlur={(e) => setName(e.target.value, true)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <ol className="team-slots" aria-label="Party">
          {current.members.map((id, i) => {
            const def = id ? registry.characters[id] : undefined;
            const weapon = weapons[i] ? registry.weapons[weapons[i]] : undefined;
            return (
              <li key={i} className="team-place">
                <button
                  className={`team-slot${id ? ` domain-${def?.domain ?? ''}` : ' empty'}`}
                  aria-label={`${placeLabel(i)}: ${def?.name ?? 'empty'}`}
                  onClick={() => setPicking({ kind: 'place', place: i })}
                >
                  <span className="team-slot-place">{placeLabel(i)}</span>
                  {id ? (
                    <>
                      <Art id={id} className="team-slot-art" />
                      <strong>{def?.name ?? id}</strong>
                      <span className="team-slot-domain">{DOMAIN_LABEL[def?.domain ?? ''] ?? def?.domain}</span>
                    </>
                  ) : (
                    <span className="team-slot-plus" aria-hidden>
                      +
                    </span>
                  )}
                </button>
                {id && (
                  <>
                    <StatList stats={fieldedCharacter(id, registry, { ...growth, weapons: wielded })?.stats} compact />
                    <button className="team-weapon" aria-label={`${def?.name ?? id}'s weapon: ${weapon ? `${weapon.name} +${armory[weapon.id]?.step ?? 0}` : 'none'}`} onClick={() => setPicking({ kind: 'weapon', place: i })}>
                      {weapon ? (
                        <>
                          <WeaponGlyph def={weapon} />
                          <span>
                            {weapon.name} <small>+{armory[weapon.id]?.step ?? 0}</small>
                          </span>
                        </>
                      ) : (
                        <span className="team-weapon-none">{Object.keys(armory).length > 0 ? 'Choose a weapon' : 'No weapons yet'}</span>
                      )}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <p className="roster-hint" role="status">
          {problem ?? 'Ready.'}
        </p>
        {depthOpen !== undefined && <DepthChooser depth={depth} open={depthOpen} onChange={changeDepth} />}
        <div className="panel-buttons">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <button className="ghost" onClick={() => setPicking({ kind: 'quick', picked: [] })}>
            Quick select
          </button>
          <button className="end-turn" disabled={problem !== undefined} onClick={() => onStart(current.members as string[], depth, weapons)}>
            {startLabel ?? 'Start expedition'}
          </button>
        </div>
      </section>
      {picking?.kind === 'weapon' && (
        <WeaponPicker
          member={current.members[picking.place] ?? ''}
          place={picking.place}
          members={current.members}
          weapons={weapons}
          armory={armory}
          growth={growth}
          moving={picking.moving}
          onChoose={(w) => chooseWeapon(picking.place, w)}
          onMove={(w) => {
            setCurrent(assignWeapon({ ...current, weapons }, picking.place, w));
            setPicking(null);
          }}
          onBack={() => setPicking({ kind: 'weapon', place: picking.place })}
          onCancel={() => setPicking(null)}
        />
      )}
      {picking && picking.kind !== 'weapon' && (
        <div className="team-picker" role="dialog" aria-label={picking.kind === 'quick' ? 'Quick select' : `Choose for ${placeLabel(picking.place)}`}>
          <h3>{picking.kind === 'quick' ? 'Quick select: click up to four, front first' : `Choose for ${placeLabel(picking.place)}`}</h3>
          <div className="team-picker-grid">
            {owned.map((id) => {
              const place = picking.kind === 'quick' ? picking.picked.indexOf(id) : current.members.indexOf(id);
              return (
                <Tile
                  key={id}
                  id={id}
                  place={place >= 0 ? place : undefined}
                  onClick={() => {
                    if (picking.kind === 'place') {
                      setCurrent(placeMember({ ...current, weapons }, picking.place, id, signatureOf(id)));
                      setPicking(null);
                    } else {
                      const picked = picking.picked.includes(id) ? picking.picked.filter((x) => x !== id) : picking.picked.length < PARTY_SIZE ? [...picking.picked, id] : picking.picked;
                      setPicking({ kind: 'quick', picked });
                    }
                  }}
                />
              );
            })}
          </div>
          <div className="panel-buttons">
            <button className="ghost" onClick={() => setPicking(null)}>
              Cancel
            </button>
            {picking.kind === 'place' && current.members[picking.place] && (
              <button
                className="ghost"
                onClick={() => {
                  setCurrent(removeMember({ ...current, weapons }, picking.place));
                  setPicking(null);
                }}
              >
                Remove
              </button>
            )}
            {picking.kind === 'quick' && (
              <button
                className="end-turn"
                onClick={() => {
                  setCurrent(quickMembers(current, picking.picked, signatureOf));
                  setPicking(null);
                }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One place's weapon: every weapon owned on the left, the member's signature first, each marked with
 * who holds it in this preset; the chosen one previewed on the right (owner, 15 Nov), with the
 * member's stats if she took it, and Equip. Equipping one another place holds asks first, naming who.
 */
function WeaponPicker({
  member,
  place,
  members,
  weapons,
  armory,
  growth,
  moving,
  onChoose,
  onMove,
  onBack,
  onCancel,
}: {
  member: string;
  place: number;
  members: readonly (string | null)[];
  weapons: readonly (string | null)[];
  armory: Readonly<Record<string, OwnedWeapon>>;
  growth: Growth;
  moving?: string | undefined;
  onChoose: (weapon: string | null) => void;
  onMove: (weapon: string) => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const name = registry.characters[member]?.name ?? member;
  const heldBy = (w: string) => {
    const i = weapons.indexOf(w);
    return i >= 0 ? (members[i] ?? undefined) : undefined;
  };
  const holder = moving ? registry.characters[heldBy(moving) ?? '']?.name : undefined;
  const sorted = sortWeapons(armory, member);
  const [shown, setShown] = useState<string | undefined>(weapons[place] ?? sorted[0]);
  const def = shown ? registry.weapons[shown] : undefined;
  const held = shown ? armory[shown] : undefined;
  const shownHolder = shown ? heldBy(shown) : undefined;
  const withIt = def && held ? fieldedCharacter(member, registry, { ...growth, weapons: { [member]: { weapon: def.id, ...((held.step ?? 0) > 0 && { step: held.step }) } } })?.stats : undefined;
  return (
    <div className="team-picker weapon-picker" role="dialog" aria-label={`A weapon for ${name}`}>
      <h3>A weapon for {name}</h3>
      {sorted.length === 0 ? (
        <p className="banner-dialog-note">No weapons yet: banner pulls give them.</p>
      ) : (
        <div className="weapon-picker-body">
          <ul className="weapon-grid">
            {sorted.map((w) => (
              <li key={w}>
                <WeaponTile id={w} owned={armory[w]!} holder={heldBy(w)} pressed={shown === w} onClick={() => setShown(w)} />
              </li>
            ))}
          </ul>
          {def && held && (
            <aside className="weapon-preview" aria-label="Preview">
              <WeaponCard def={def} step={held.step ?? 0} spares={held.spares ?? 0} />
              <p className="weapon-preview-holder">
                {shownHolder === member ? `${name} holds it.` : shownHolder ? `${registry.characters[shownHolder]?.name ?? shownHolder} holds it in this team.` : 'No one in this team holds it.'}
              </p>
              <h4>{name} with it</h4>
              <StatList stats={withIt} compact />
              <button className="end-turn" disabled={shownHolder === member} onClick={() => onChoose(def.id)}>
                {shownHolder === member ? 'Equipped' : 'Equip'}
              </button>
            </aside>
          )}
        </div>
      )}
      {moving && (
        <div className="weapon-confirm" role="alertdialog" aria-label="Move the weapon">
          <p>
            {holder} holds it in this team. Move it to {name}?
          </p>
          <div className="panel-buttons">
            <button className="end-turn" onClick={() => onMove(moving)}>
              Move it
            </button>
            <button className="ghost" onClick={onBack}>
              Keep it there
            </button>
          </div>
        </div>
      )}
      <div className="panel-buttons">
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        {weapons[place] && (
          <button className="ghost" onClick={() => onChoose(null)}>
            No weapon
          </button>
        )}
      </div>
    </div>
  );
}

interface RosterProps {
  owned: readonly string[];
  profile: Profile;
  /** Dupe levels and levels as shown and fielded: the profile's, or a dev build's. */
  growth: Growth;
  onLevelUp: (id: string, levels: number) => Promise<GrowthResult>;
  onAscend: (id: string) => Promise<GrowthResult>;
  onBack: () => void;
}

/** Every owned character, with her level and dupe level; one opens her page. */
export function Roster({ owned, profile, growth, onBack, ...actions }: RosterProps) {
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <CharacterPage id={open} ids={owned} profile={profile} growth={growth} {...actions} onStep={setOpen} onBack={() => setOpen(null)} />;
  return (
    <div className="roster-screen">
      <h2 className="panel-title">Roster</h2>
      <div className="roster-grid">
        {owned.map((id) => (
          <Tile key={id} id={id} level={growth.levels?.[id] ?? 1} dupes={growth.dupes?.[id]} onClick={() => setOpen(id)} />
        ))}
      </div>
      <div className="panel-buttons">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

const itemsText = (items: Readonly<Record<string, number>>) =>
  Object.entries(items)
    .map(([id, n]) => itemCount(id, n))
    .join(', ');

/** "Spent: 3 Clear Memories, 120 Ducats. Back: 2 Faint Memories." and "Gained: 1 Purified Bloom." */
function changeText(change: Readonly<Record<string, number>>, pulls = 0): string {
  const side = (sign: number) => Object.fromEntries(Object.entries(change).filter(([, n]) => n * sign > 0).map(([id, n]) => [id, n * sign]));
  const back = side(1);
  return `Spent: ${itemsText(side(-1))}.${Object.keys(back).length > 0 ? ` Back: ${itemsText(back)}.` : ''}${pulls > 0 ? ` Gained: ${plural(pulls, BLOOM)}.` : ''}`;
}

/**
 * Levelling on her page: her level and ascensions, the Memories and Ducats banked, and buttons to
 * level once, as far as can be paid for, or ascend at a level cap. The game prices each and refuses
 * what can't be paid; the page only shows it.
 */
function Growing({
  id,
  profile,
  onLevelUp,
  onAscend,
  onGained,
}: {
  id: string;
  profile: Profile;
  onLevelUp: RosterProps['onLevelUp'];
  onAscend: RosterProps['onAscend'];
  /** Called with the Purified Blooms an action gave, to show them in a pop-up. */
  onGained: (pulls: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const level = levelOf(profile, id);
  const ascensions = ascensionsOf(profile, id);
  const cap = levelCap(ascensions);
  const most = affordableLevels(profile, id);
  const items = profile.items ?? {};
  const act = (job: () => Promise<GrowthResult>, done: (level: number) => string) => {
    if (busy) return;
    setBusy(true);
    job()
      .then((result) => {
        setNote(result.ok ? `${done(result.level)} ${changeText(result.change, result.pulls)}` : result.reason);
        if (result.ok && result.pulls) onGained(result.pulls);
      })
      .catch((err: unknown) => setNote(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };
  const priced = (levels: number) => {
    const cost = levelCost(level, levels);
    return `${cost.exp.toLocaleString('en-GB')} EXP, ${itemCount('money', cost.money)}`;
  };
  const ascension = ascensionCost(profile, id, registry);
  // At a cap with an ascension left: whether it can be made now, or why not (a profile level, the cost).
  const ascending = ascension && level >= cap ? ascend(profile, id, registry) : undefined;
  return (
    <section className="character-growth" aria-label="Level">
      <h3>
        Level {level} <small>of {cap} · {plural(ascensions, 'ascension')} of {ASCENSIONS.length}</small>
      </h3>
      <p className="character-bank">
        {MEMORIES.map((m) => itemCount(m.item, items[m.item] ?? 0)).join(' · ')} · {itemCount('money', items.money ?? 0)}
      </p>
      <div className="panel-buttons">
        {level >= MAX_LEVEL ? (
          <p>The highest level.</p>
        ) : level < cap ? (
          <>
            <button className="end-turn" disabled={busy || most < 1} onClick={() => act(() => onLevelUp(id, 1), (n) => `Level ${n}.`)}>
              Level up <small>{priced(1)}</small>
            </button>
            {most > 1 && (
              <button className="end-turn" disabled={busy} onClick={() => act(() => onLevelUp(id, most), (n) => `Level ${n}.`)}>
                To level {level + most} <small>{priced(most)}</small>
              </button>
            )}
          </>
        ) : (
          <button className="end-turn" disabled={busy || !ascension || !ascending?.ok} onClick={() => act(() => onAscend(id), () => 'Ascended.')}>
            Ascend <small>{ascension ? `${itemsText(ascension)} · gives ${plural(ASCENSION_PULLS, BLOOM)}` : ''}</small>
          </button>
        )}
      </div>
      <p className="character-note" role="status">
        {note ?? (level < cap && most < 1 && level < MAX_LEVEL ? `The next level needs ${priced(1)}.` : ascending && !ascending.ok ? ascending.reason : '')}
      </p>
    </section>
  );
}

type Tab = 'attributes' | 'kit' | 'potential';
// Weapons are equipped in team presets, not here (owner, 15 Nov).
const TABS: [Tab, string][] = [
  ['attributes', 'Attributes'],
  ['kit', 'Kit'],
  ['potential', 'Potential'],
];
const ROLE_LABEL: Record<string, string> = { attacker: 'Attacker', sentinel: 'Sentinel', support: 'Support', hybrid: 'Hybrid' };

/**
 * A character's page (docs/notes/weapons.md, "The character page"): the tabs down the left, the art
 * large in the middle, and the chosen tab beside it under her name, which stays whichever tab is
 * open. Arrows step to the previous or next character.
 */
function CharacterPage({
  id,
  ids,
  profile,
  growth,
  onLevelUp,
  onAscend,
  onStep,
  onBack,
}: Omit<RosterProps, 'owned' | 'onBack'> & { id: string; ids: readonly string[]; onStep: (id: string) => void; onBack: () => void }) {
  const base = registry.characters[id];
  const def = fieldedCharacter(id, registry, growth);
  const [gained, setGained] = useState(0);
  const [tab, setTab] = useState<Tab>('attributes');
  if (!base || !def) return null;
  const potential = growth.dupes?.[id] ?? 0;
  const at = ids.indexOf(id);
  const step = (by: number) => onStep(ids[(at + by + ids.length) % ids.length]!);
  return (
    <div className={`character-page domain-${def.domain}`} aria-label={def.name}>
      <nav className="character-nav" aria-label="Character">
        <div className="character-step">
          <button className="ghost" aria-label="Previous character" disabled={ids.length < 2} onClick={() => step(-1)}>
            ‹
          </button>
          <strong>{def.name}</strong>
          <button className="ghost" aria-label="Next character" disabled={ids.length < 2} onClick={() => step(1)}>
            ›
          </button>
        </div>
        <SideList label="Character page" items={TABS} chosen={tab} onChoose={setTab} />
        <button className="ghost side-back" onClick={onBack}>
          Back
        </button>
      </nav>
      <Art id={id} className="character-art" />
      <div className="character-info">
        <header className="character-header">
          <h2>{fullName(id)}</h2>
          <p className="character-domain">
            {DOMAIN_LABEL[def.domain] ?? def.domain}
            {def.role ? ` · ${ROLE_LABEL[def.role]}` : ''}
            {` · Level ${growth.levels?.[id] ?? 1}`}
            {base.dupes?.length ? ` · P${potential}` : ''}
          </p>
        </header>
        <div className="character-panel" role="tabpanel" aria-label={TABS.find(([t]) => t === tab)?.[1]}>
          {tab === 'attributes' && (
            <>
              <Attributes id={id} growth={growth} />
              <Growing id={id} profile={profile} onLevelUp={onLevelUp} onAscend={onAscend} onGained={setGained} />
            </>
          )}
          {tab === 'kit' && <Kit id={id} growth={growth} />}
          {tab === 'potential' &&
            (base.dupes?.length ? (
              <section>
                <h3>
                  Potential <small>P{potential} of {base.dupes.length} · each copy pulled after the first, or bought in the Shop, opens one</small>
                </h3>
                <ol className="character-dupes" aria-label="Potential">
                  {base.dupes.map((d, i) => (
                    <li key={i} className={i < potential ? 'reached' : undefined}>
                      <em>P{i + 1}</em> {d.text}
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <p>No Potential levels yet.</p>
            ))}
        </div>
      </div>
      {gained > 0 && (
        <div className="result reward ascension-reward" role="dialog" aria-label="Ascension reward">
          <h2 className="panel-title">Ascended</h2>
          <p className="result-line">
            {def.name} can now reach level {levelCap(ascensionsOf(profile, id))}.
          </p>
          <div className="banking">
            <p className="banked-total">+{plural(gained, BLOOM)}</p>
            <p className="banked-profile">
              {BLOOM}s banked in all: {profile.pulls}
            </p>
          </div>
          <button className="end-turn" autoFocus onClick={() => setGained(0)}>
            Collect
          </button>
        </div>
      )}
    </div>
  );
}

/** Her own stats, at her level, ascensions and Potential; a weapon's main stat shows on the preset screen. */
function Attributes({ id, growth }: { id: string; growth: Growth }) {
  return <StatList stats={fieldedCharacter(id, registry, { ...growth, weapons: undefined })?.stats} />;
}

/** HP, Attack, Defense, Crit Rate and Crit Damage. */
function StatList({ stats, compact = false }: { stats: Stats | undefined; compact?: boolean }) {
  if (!stats) return null;
  const crit = critOf(stats);
  const rows: [string, string][] = [
    ['HP', String(stats.hp)],
    ['Attack', String(stats.attack)],
    ['Defense', String(stats.defense)],
    ['Crit Rate', `${crit.rate}%`],
    ['Crit Damage', `${crit.damage}%`],
  ];
  return (
    <dl className={compact ? 'slot-stats' : 'character-stats'}>
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Her passive, ultimate and cards, with the numbers her stats fix. */
function Kit({ id, growth }: { id: string; growth: Growth }) {
  const def = fieldedCharacter(id, registry, growth);
  if (!def) return null;
  const kit = describeCharacter(def);
  const cards = def.cards.map((c) => registry.cards[c]).filter((c): c is CardDef => c !== undefined);
  const rewards = Object.values(registry.cards).filter((c) => c.reward && c.owner === id);
  const face = (card: CardDef) => (
    <CardFace
      key={card.id}
      id={card.id}
      def={card}
      owner={def}
      text={runCardText({ card: card.id, owner: id }, registry, { charge: false, keywords: false, mark: markNumber }, growth)}
      cost={card.cost}
      registry={registry}
      playable
    />
  );
  return (
    <>
      {def.passive && (
        <section>
          <h3>
            {def.passive.name} <small>Passive · {def.passive.scope === 'run' ? 'run' : 'combat'}</small>
          </h3>
          <p>{kit.passive}</p>
        </section>
      )}
      {def.ultimate && (
        <section>
          <h3>
            {def.ultimate.name} <small>Ultimate</small>
          </h3>
          <p>{kit.ultimate}</p>
          {kit.transcended && (
            <p className="character-transcended">
              <em>Transcended:</em> {kit.transcended}
            </p>
          )}
        </section>
      )}
      <h3>Cards</h3>
      <div className="character-cards">{cards.map(face)}</div>
      {rewards.length > 0 && (
        <>
          <h3>Reward cards</h3>
          <div className="character-cards">{rewards.map(face)}</div>
        </>
      )}
    </>
  );
}
