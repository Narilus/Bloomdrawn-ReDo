import { registry } from '../content/registry.ts';
import type { WeaponDef } from '../engine/index.ts';
import { MAX_STEP, type WeaponCopy } from '../game/weapons.ts';
import { Icon } from './icons.tsx';

// Weapon pieces shared by the character page, the inventory and the banner (docs/notes/weapons.md):
// a glyph framed in its rarity colour (until the weapons have art), its +step pips, and its card.

const RARITY: Record<WeaponDef['rarity'], string> = { ssr: 'SSR', sr: 'SR', r: 'R' };
const STAT: Record<WeaponDef['main']['stat'], string> = { hp: 'HP', attack: 'Attack', defense: 'Defense', critRate: 'Crit Rate', critDamage: 'Crit Damage' };

/** The glyph each weapon shows until the art pass. */
const GLYPH: Record<string, string> = {
  'weapon.seed-orb-staff': 'staff',
  'weapon.chalk-circle-censer': 'lamp',
  'weapon.vigil-lamp': 'lamp',
  'weapon.sealed-ledger': 'book',
  'weapon.thorn-rapier': 'blade',
  'weapon.torn-veil': 'charm',
  'weapon.foxfire-gauntlet': 'essence',
  'weapon.snare-line': 'cord',
  'weapon.surgeons-scalpel': 'blade',
  'weapon.suture-hook': 'blade',
  'weapon.womb-glass-lantern': 'lamp',
  'weapon.pod-sling': 'cord',
  'weapon.bone-rosary': 'cord',
  'weapon.procession-bell': 'bell',
  'weapon.wax-candle': 'essence',
  'weapon.prayer-rope': 'cord',
  'weapon.talisman-fan': 'charm',
  'weapon.gold-leaf-lamp': 'lamp',
  'weapon.paper-charm': 'charm',
  'weapon.temple-bell': 'bell',
  'weapon.iron-snare': 'cord',
  'weapon.brass-hourglass': 'delay',
  'weapon.whetstone': 'blade',
  'weapon.tin-compass': 'shield',
};

export const rarityLabel = (def: WeaponDef) => RARITY[def.rarity];

/** "Attack +30%", "Crit Rate +12%". */
export const mainStatText = (def: WeaponDef) => `${STAT[def.main.stat]} +${def.main.amount}%`;

/** The weapon's effect text at a step, +0 to +5. */
export const effectText = (def: WeaponDef, step = 0) => def.steps[Math.min(MAX_STEP, Math.max(0, step))]?.text ?? '';

export function WeaponGlyph({ def, className = '' }: { def: WeaponDef; className?: string }) {
  return (
    <span className={`weapon-glyph rarity-${def.rarity}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Icon name={GLYPH[def.id] ?? 'blade'} />
    </span>
  );
}

/** ◆◆◇◇◇ for +2. */
export function StepPips({ step }: { step: number }) {
  return (
    <span className="weapon-pips" aria-label={`Reinforced +${step} of ${MAX_STEP}`}>
      {Array.from({ length: MAX_STEP }, (_, i) => (i < step ? '◆' : '◇')).join('')}
    </span>
  );
}

/** A weapon's card: name, rarity, signature, main stat, effect now and at +5, and who wields it. */
export function WeaponCard({ def, step = 0, wielder, children }: { def: WeaponDef; step?: number; wielder?: string | undefined; children?: React.ReactNode }) {
  const owner = def.signature ? registry.characters[def.signature]?.name : undefined;
  return (
    <article className={`weapon-card rarity-${def.rarity}`} aria-label={def.name}>
      <WeaponGlyph def={def} className="large" />
      <h3>
        {def.name} <small>{rarityLabel(def)}</small>
      </h3>
      {owner && <p className="weapon-signature">Signature · {owner}</p>}
      <p className="weapon-main">{mainStatText(def)}</p>
      <p className="weapon-effect">{effectText(def, step)}</p>
      <p className="weapon-step">
        +{step} <StepPips step={step} />
      </p>
      {step < MAX_STEP && <p className="weapon-max">At +{MAX_STEP}: {effectText(def, MAX_STEP)}</p>}
      {wielder !== undefined && <p className="weapon-wielder">{wielder ? `Wielded by ${registry.characters[wielder]?.name ?? wielder}` : 'Not wielded'}</p>}
      {children}
    </article>
  );
}

/** A copy as a tile: its glyph framed in its rarity, its +step, a lock and its wielder. */
export function WeaponTile({ copy, wielder, pressed, onClick }: { copy: WeaponCopy; wielder?: string | undefined; pressed?: boolean; onClick: () => void }) {
  const def = registry.weapons[copy.weapon];
  if (!def) return null;
  const who = wielder ? registry.characters[wielder]?.name : undefined;
  const label = `${def.name} +${copy.step ?? 0}${copy.locked ? ', locked' : ''}${who ? `, wielded by ${who}` : ''}`;
  return (
    <button className={`weapon-tile rarity-${def.rarity}`} aria-pressed={pressed} aria-label={label} onClick={onClick}>
      <WeaponGlyph def={def} />
      <span className="weapon-tile-name">{def.name}</span>
      <strong className="weapon-tile-step">+{copy.step ?? 0}</strong>
      {copy.locked && <span className="weapon-tile-lock">Locked</span>}
      {who && <span className="weapon-tile-wielder">{who}</span>}
    </button>
  );
}

/** Owned copies in the order the lists show them: a character's signature first, then by rarity, then by step. */
export function sortCopies(copies: readonly WeaponCopy[], signatureFor?: string): WeaponCopy[] {
  const rank = { ssr: 0, sr: 1, r: 2 };
  const key = (c: WeaponCopy) => {
    const def = registry.weapons[c.weapon];
    return [def?.signature === signatureFor && signatureFor ? 0 : 1, rank[def?.rarity ?? 'r'], -(c.step ?? 0)];
  };
  return [...copies].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]! || (registry.weapons[a.weapon]?.name ?? '').localeCompare(registry.weapons[b.weapon]?.name ?? '');
  });
}
