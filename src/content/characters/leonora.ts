import { applyStatus, changeCost, damage, draw, gainMana, gainShield, manaDebt, manaSpent, mul, stat, transcend } from '../../engine/index.ts';
import { card, character } from '../define.ts';
import { vulnerable } from '../statuses/vulnerable.ts';
import { weak } from '../statuses/weak.ts';

// Approved starter kit (docs/notes/starter-kits.md). Numbers are placeholders for tuning.

export const strike = card({
  id: 'leonora.strike', name: 'Strike', owner: 'leonora', slot: 'strike', cost: 1, target: 'chosenEnemy', charge: 10,
  effects: [damage(mul(2.2, stat('attack')))],
});

export const defense = card({
  id: 'leonora.defense', name: 'Defense', owner: 'leonora', slot: 'defense', cost: 1, target: 'self', charge: 10,
  effects: [gainShield(mul(2.67, stat('defense')))],
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

// Card rewards (docs/notes/m4-run.md), offered after normal fights. Numbers are placeholders.

export const ledgerBalance = card({
  id: 'leonora.ledger-balance', name: 'Ledger Balance', owner: 'leonora', reward: true, cost: 1, target: 'none',
  effects: [draw(1), changeCost(-1, 'next')],
});

export const writOfSeizure = card({
  id: 'leonora.writ-of-seizure', name: 'Writ of Seizure', owner: 'leonora', reward: true, cost: 2, target: 'chosenEnemy',
  effects: [applyStatus(weak, 2), applyStatus(vulnerable, 2)],
  text: 'Apply {effects.0.stacks} Weak and {effects.1.stacks} Vulnerable.',
});

export const leonora = character({
  id: 'leonora', name: 'Leonora', title: 'the Quartermaster', domain: 'unbound',
  role: 'support',
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
