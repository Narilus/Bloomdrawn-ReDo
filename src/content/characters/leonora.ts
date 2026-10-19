import { add, changeCost, damage, draw, gainMana, gainShield, manaDebt, manaSpent, stat, transcend } from '../../engine/index.ts';
import { card, character } from '../define.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'leonora.strike', name: 'Strike', owner: 'leonora', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(add(6, stat('attack')))],
});

export const defense = card({
  id: 'leonora.defense', name: 'Defense', owner: 'leonora', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(add(5, stat('defense')))],
});

export const promissoryNote = card({
  id: 'leonora.promissory-note', name: 'Promissory Note', owner: 'leonora', slot: 'flavourA', cost: 2, target: 'none',
  effects: [gainMana(4), manaDebt(2)],
});

export const requisition = card({
  id: 'leonora.requisition', name: 'Requisition', owner: 'leonora', slot: 'flavourB', cost: 2, target: 'none',
  effects: [draw(2), changeCost(-2, 'next')],
});

export const callInTheDebts = card({
  id: 'leonora.call-in-the-debts', name: 'Call in the Debts', owner: 'leonora', slot: 'transcend', cost: 3, target: 'none',
  keywords: ['exhaust'], charge: 35,
  effects: [draw(2), gainMana(2), transcend()],
  text: 'Draw {effects.0.count} cards. Gain {effects.1.amount} Mana. Transcend.',
});

export const leonora = character({
  id: 'leonora', name: 'Leonora', domain: 'unbound',
  stats: { hp: 45, attack: 5, defense: 3 },
  cards: [strike, defense, callInTheDebts, promissoryNote, requisition],
  passive: {
    name: 'Running Tab', scope: 'combat',
    text: 'When a turn starts with Mana debt, draw {triggers.0.do.0.count} card.',
    triggers: [{ on: 'manaDebtPaid', do: [draw(1)] }],
  },
  ultimate: {
    name: 'Balance the Books',
    text: 'Gain Mana equal to the Mana spent this turn.',
    effects: [gainMana(manaSpent())],
    transcended: {
      text: 'Gain Mana equal to the Mana spent this turn, and draw {effects.1.count} cards.',
      effects: [gainMana(manaSpent()), draw(2)],
    },
  },
});
