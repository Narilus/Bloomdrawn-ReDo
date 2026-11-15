import { registry } from '../content/registry.ts';
import type { WeaponDef } from '../engine/index.ts';
import { MAX_STEP, type OwnedWeapon } from '../game/weapons.ts';
import { Icon } from './icons.tsx';

// Weapon pieces shared by the character page, the inventory and the banner (docs/notes/weapons.md):
// a glyph framed in its rarity colour (until the weapons have art), its +step pips, its card and its tile.

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

/** The owner's picked icons (`npm run art -- pick --icon`), by weapon ID: src/assets/weapons/<name>.png is weapon.<name>. */
const ART: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/weapons/*.png', { eager: true, import: 'default' })).map(([path, url]) => [`weapon.${path.replace(/^.*\/|\.png$/g, '')}`, url]),
);

/** A weapon's icon in a frame of its rarity colour: its art, or its glyph until it has art. */
export function WeaponGlyph({ def, className = '' }: { def: WeaponDef; className?: string }) {
  const art = ART[def.id];
  return (
    <span className={`weapon-glyph rarity-${def.rarity}${className ? ` ${className}` : ''}`} aria-hidden="true">
      {art ? <img src={art} alt="" draggable={false} /> : <Icon name={GLYPH[def.id] ?? 'blade'} />}
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

/** A weapon's card: name, rarity, signature, main stat, effect now and at +5, and its spares if given. */
export function WeaponCard({ def, step = 0, spares, children }: { def: WeaponDef; step?: number; spares?: number | undefined; children?: React.ReactNode }) {
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
        {spares !== undefined && <span className="weapon-spares"> · {spares === 1 ? '1 spare' : `${spares} spares`}</span>}
      </p>
      {step < MAX_STEP && <p className="weapon-max">At +{MAX_STEP}: {effectText(def, MAX_STEP)}</p>}
      {children}
    </article>
  );
}

/** A weapon as a tile: its glyph framed in its rarity, its step, its spares, and who holds it here if anyone. */
export function WeaponTile({ id, owned, holder, pressed, onClick }: { id: string; owned: OwnedWeapon; holder?: string | undefined; pressed?: boolean; onClick: () => void }) {
  const def = registry.weapons[id];
  if (!def) return null;
  const who = holder ? registry.characters[holder]?.name : undefined;
  const spares = owned.spares ?? 0;
  const label = `${def.name} +${owned.step ?? 0}${spares ? `, ${spares === 1 ? '1 spare' : `${spares} spares`}` : ''}${who ? `, held by ${who}` : ''}`;
  return (
    <button className={`weapon-tile rarity-${def.rarity}`} aria-pressed={pressed} aria-label={label} onClick={onClick}>
      <WeaponGlyph def={def} />
      <span className="weapon-tile-name">{def.name}</span>
      <strong className="weapon-tile-step">+{owned.step ?? 0}</strong>
      {spares > 0 && <span className="weapon-tile-lock">×{spares}</span>}
      {who && <span className="weapon-tile-wielder">{who}</span>}
    </button>
  );
}

/** Owned weapons in the order lists show them: a character's signature first, then by rarity, then by step, then by name. */
export function sortWeapons(owned: Readonly<Record<string, OwnedWeapon>>, signatureFor?: string): string[] {
  const rank = { ssr: 0, sr: 1, r: 2 };
  const key = (id: string) => {
    const def = registry.weapons[id];
    return [signatureFor && def?.signature === signatureFor ? 0 : 1, rank[def?.rarity ?? 'r'], -(owned[id]?.step ?? 0)];
  };
  return Object.keys(owned)
    .filter((id) => registry.weapons[id])
    .sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]! || registry.weapons[a]!.name.localeCompare(registry.weapons[b]!.name);
    });
}
