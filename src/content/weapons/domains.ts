import { gainShield, gte, handCount, mul, stat, when } from '../../engine/index.ts';
import { pct, weapon } from '../define.ts';
import { bleed } from '../statuses/bleed.ts';
import { poison } from '../statuses/poison.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// SR and R weapons, two of each per Domain to start (docs/notes/weapons.md; owner, 14 Nov). Generic
// effects that work in any team, best with their Domain's engine; each R is a weaker cousin of an
// SR. `p` is the reinforcement power, 1 at +0 to 1.5 at +5. Numbers are placeholders for the lab.

const SR = 18;
const R = 10;

// Flesh

const sharperDots = (id: string, name: string, rarity: 'sr' | 'r', bonus: number) =>
  weapon({
    id, name, rarity, domain: 'flesh',
    main: { stat: 'attack', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `Bleed and Poison the wielder applies are ${pct(bonus * p)}% more.`,
      modifiers: [bleed, poison].map((s) => ({ value: 'stacks' as const, step: 'outgoingMul' as const, status: s.id, amount: 1 + (bonus / 100) * p })),
    }),
  });

const embryoGuard = (id: string, name: string, rarity: 'sr' | 'r', share: number) =>
  weapon({
    id, name, rarity, domain: 'flesh',
    main: { stat: rarity === 'sr' ? 'hp' : 'defense', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `The first time each turn the party consumes Embryo, gain Shield equal to ${pct(share * p)}% of the wielder's Defense.`,
      triggers: [{ on: 'resourceConsumed', filter: { source: 'party', resource: 'embryo' }, once: 'turn', do: [gainShield(mul((share / 100) * p, stat('defense')))] }],
    }),
  });

export const surgeonsScalpel = sharperDots('weapon.surgeons-scalpel', "Surgeon's Scalpel", 'sr', 12);
export const wombGlassLantern = embryoGuard('weapon.womb-glass-lantern', 'Womb-Glass Lantern', 'sr', 30);
export const sutureHook = sharperDots('weapon.suture-hook', 'Suture Hook', 'r', 6);
export const podSling = embryoGuard('weapon.pod-sling', 'Pod Sling', 'r', 15);

// Rapture

const tentacleEdge = (id: string, name: string, rarity: 'sr' | 'r', bonus: number) =>
  weapon({
    id, name, rarity, domain: 'rapture',
    main: { stat: 'attack', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `Tentacles deal ${pct(bonus * p)}% more damage.`,
      modifiers: [{ value: 'damage', step: 'outgoingMul', on: 'party', volley: true, amount: 1 + (bonus / 100) * p }],
    }),
  });

const volleyGuard = (id: string, name: string, rarity: 'sr' | 'r', share: number) =>
  weapon({
    id, name, rarity, domain: 'rapture',
    main: { stat: rarity === 'sr' ? 'hp' : 'defense', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `The first time each turn a card triggers a volley, gain Shield equal to ${pct(share * p)}% of the wielder's Defense.`,
      triggers: [{ on: 'volleyFired', filter: { fromCard: true }, once: 'turn', do: [gainShield(mul((share / 100) * p, stat('defense')))] }],
    }),
  });

export const boneRosary = tentacleEdge('weapon.bone-rosary', 'Bone Rosary', 'sr', 10);
export const processionBell = volleyGuard('weapon.procession-bell', 'Procession Bell', 'sr', 30);
export const waxCandle = tentacleEdge('weapon.wax-candle', 'Wax Candle', 'r', 5);
export const prayerRope = volleyGuard('weapon.prayer-rope', 'Prayer Rope', 'r', 15);

// Spirit

const ritualEdge = (id: string, name: string, rarity: 'sr' | 'r', bonus: number) =>
  weapon({
    id, name, rarity, domain: 'spirit',
    main: { stat: 'attack', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `The wielder's Ritual cards deal ${pct(bonus * p)}% more damage.`,
      modifiers: [{ value: 'damage', step: 'outgoingMul', keyword: 'ritual', amount: 1 + (bonus / 100) * p }],
    }),
  });

const ritualGuard = (id: string, name: string, rarity: 'sr' | 'r', share: number) =>
  weapon({
    id, name, rarity, domain: 'spirit',
    main: { stat: rarity === 'sr' ? 'defense' : 'hp', amount: rarity === 'sr' ? SR : R },
    effect: (p) => ({
      text: `At end of turn, if you hold a Ritual, gain Shield equal to ${pct(share * p)}% of the wielder's Defense.`,
      triggers: [{ on: 'turnEnd', do: [when(gte(handCount('ritual'), 1), [gainShield(mul((share / 100) * p, stat('defense')))])] }],
    }),
  });

export const talismanFan = ritualEdge('weapon.talisman-fan', 'Talisman Fan', 'sr', 10);
export const goldLeafLamp = ritualGuard('weapon.gold-leaf-lamp', 'Gold-Leaf Lamp', 'sr', 25);
export const paperCharm = ritualEdge('weapon.paper-charm', 'Paper Charm', 'r', 5);
export const templeBell = ritualGuard('weapon.temple-bell', 'Temple Bell', 'r', 12);

// Unbound

export const ironSnare = weapon({
  id: 'weapon.iron-snare', name: 'Iron Snare', rarity: 'sr', domain: 'unbound',
  main: { stat: 'attack', amount: SR },
  effect: (p) => ({
    text: `The wielder deals ${pct(10 * p)}% more damage to enemies with Weak or Vulnerable.`,
    modifiers: [{ value: 'damage', step: 'outgoingMul', targetHas: [weak.id, vulnerable.id], amount: 1 + 0.1 * p }],
  }),
});

export const brassHourglass = weapon({
  id: 'weapon.brass-hourglass', name: 'Brass Hourglass', rarity: 'sr', domain: 'unbound',
  main: { stat: 'hp', amount: SR },
  effect: (p) => ({
    text: `When a turn starts with Mana debt, gain Shield equal to ${pct(30 * p)}% of the wielder's Defense.`,
    triggers: [{ on: 'manaDebtPaid', do: [gainShield(mul(0.3 * p, stat('defense')))] }],
  }),
});

export const whetstone = weapon({
  id: 'weapon.whetstone', name: 'Whetstone', rarity: 'r', domain: 'unbound',
  main: { stat: 'attack', amount: R },
  effect: (p) => ({
    text: `The wielder's Strike deals ${pct(8 * p)}% more damage.`,
    modifiers: [{ value: 'damage', step: 'outgoingMul', slot: 'strike', amount: 1 + 0.08 * p }],
  }),
});

export const tinCompass = weapon({
  id: 'weapon.tin-compass', name: 'Tin Compass', rarity: 'r', domain: 'unbound',
  main: { stat: 'defense', amount: R },
  effect: (p) => ({
    text: `The wielder's Defense card gives ${pct(6 * p)}% more Shield.`,
    modifiers: [{ value: 'shield', step: 'outgoingMul', slot: 'defense', amount: 1 + 0.06 * p }],
  }),
});
