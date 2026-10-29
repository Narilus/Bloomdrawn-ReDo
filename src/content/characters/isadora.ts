import { add, applyStatus, damage, draw, gainResource, gainShield, stat, transcend } from '../../engine/index.ts';
import { c2, card, character, variant } from '../define.ts';
import { tentacleVolley } from '../domains/rapture.ts';
import { danceOfBells } from '../statuses/dance.ts';

// Banner kit reviewed by the owner (docs/notes/banner-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'isadora.strike', name: 'Strike', owner: 'isadora', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'isadora.defense', name: 'Defense', owner: 'isadora', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const ankleBells = card({
  id: 'isadora.ankle-bells', name: 'Ankle Bells', owner: 'isadora', slot: 'flavourA', cost: 2, target: 'none',
  effects: [gainResource('tentacles', 2), gainResource('potency', 1)],
  text: 'Gain {effects.0.amount} Tentacles. Tentacles deal +{effects.1.amount} damage for the rest of combat.',
});

export const ecstaticSpin = card({
  id: 'isadora.ecstatic-spin', name: 'Ecstatic Spin', owner: 'isadora', slot: 'flavourB', cost: 4, target: 'allEnemies',
  effects: [tentacleVolley(), tentacleVolley()],
  text: 'Trigger a volley twice.',
});

export const theVeilTorn = card({
  id: 'isadora.the-veil-torn', name: 'The Veil Torn', owner: 'isadora', slot: 'transcend', cost: 4, target: 'allEnemies',
  keywords: ['exhaust'], charge: 35,
  effects: [gainResource('tentacles', 3), tentacleVolley(), transcend()],
  text: 'Gain {effects.0.amount} Tentacles. Trigger a volley. Transcend.',
});

// Card rewards (docs/notes/banner-kits.md). Numbers are placeholders.

export const petalRibbon = card({
  id: 'isadora.petal-ribbon', name: 'Petal Ribbon', owner: 'isadora', reward: true, cost: 1, target: 'none',
  effects: [gainResource('potency', 1), draw(1)],
  text: 'Tentacles deal +{effects.0.amount} damage for the rest of combat. Draw {effects.1.count} card.',
});

export const ribbonLash = card({
  id: 'isadora.ribbon-lash', name: 'Ribbon Lash', owner: 'isadora', reward: true, cost: 2, target: 'chosenEnemy',
  effects: [damage(add(3, stat('attack'))), tentacleVolley()],
  text: 'Deal {effects.0.amount} damage. Trigger a volley.',
});

// Rapt at C0 gives +1, at C1 +2; at C5 Tentacles also attack a second time at the end of each turn.
const rapt = (potency: number, capstone = false) => ({
  name: 'Rapt', scope: 'combat' as const,
  text:
    'The first time each turn a card triggers a volley, Tentacles deal +{triggers.0.do.0.amount} damage for the rest of combat.' +
    (capstone ? ' At the end of each turn, Tentacles attack twice.' : ''),
  triggers: [
    { on: 'volleyFired' as const, filter: { fromCard: true as const }, once: 'turn' as const, do: [gainResource('potency', potency)] },
    // A second end-of-turn attack beside the Domain's own, choosing its targets afresh.
    ...(capstone ? [{ on: 'turnEnd' as const, do: [tentacleVolley()] }] : []),
  ],
});

const DANCE = 'This turn, every volley hits twice, the end-of-turn attack included.';
// C4 adds 2 Tentacles, before the Transcended form's volley.
const danceOf = (tentacles: number) => {
  const gain = tentacles ? [gainResource('tentacles', tentacles)] : [];
  const more = tentacles ? ' Gain {effects.1.amount} Tentacles.' : '';
  return {
    name: 'Dance of Bells',
    text: DANCE + more,
    effects: [applyStatus(danceOfBells, 1, 'self'), ...gain],
    transcended: { text: `${DANCE}${more} Trigger a volley now.`, effects: [applyStatus(danceOfBells, 1, 'self'), ...gain, tentacleVolley()] },
  };
};

// C3: Ecstatic Spin costs 3 (docs/notes/banner-kits.md).
export const ecstaticSpinC3 = variant(ecstaticSpin, 3, { cost: 3 });

const STATS = { hp: 50, attack: 5, defense: 3 };

export const isadora = character({
  id: 'isadora', name: 'Isadora', title: 'the Ecstatic', domain: 'rapture',
  stats: STATS,
  cards: [strike, defense, theVeilTorn, ankleBells, ecstaticSpin],
  passive: rapt(1),
  ultimate: danceOf(0),
  dupes: [
    { text: 'Rapt gives +2.', passive: rapt(2) },
    c2(STATS),
    { text: 'Ecstatic Spin costs 3.', cards: { [ecstaticSpin.id]: ecstaticSpinC3.id } },
    { text: 'Dance of Bells also gains 2 Tentacles.', ultimate: danceOf(2) },
    { text: 'At the end of each turn, Tentacles attack twice.', passive: rapt(2, true) },
  ],
});
