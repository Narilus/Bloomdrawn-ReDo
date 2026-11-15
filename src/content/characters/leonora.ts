import { applyStatus, changeCost, damage, draw, gainMana, gainShield, manaDebt, manaSpent, mul, stat, transcend } from '../../engine/index.ts';
import { card, character, p2, variant } from '../define.ts';
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

// Potential (owner, 15 Nov: her draft stands; docs/notes/starter-kits.md, "Potential"). Numbers are placeholders.

// Running Tab at P0 draws 1; at P1 2; at P5 the next card played also costs 1 less.
const runningTab = (draws: number, cheaper = false) => ({
  name: 'Running Tab', scope: 'combat' as const,
  text:
    `When a turn starts with Mana debt, draw {triggers.0.do.0.count} card${draws === 1 ? '' : 's'}` +
    (cheaper ? ', and the next card you play costs {triggers.0.do.1.amount} less.' : '.'),
  triggers: [{ on: 'manaDebtPaid' as const, do: [draw(draws), ...(cheaper ? [changeCost(-1, 'next')] : [])] }],
});

// Balance the Books; P4 also draws 2 (Transcended, 4).
const balanceTheBooks = (draws: number) => ({
  name: 'Balance the Books',
  text: draws ? 'Gain Mana equal to the Mana spent this turn, and draw {effects.1.count} cards.' : 'Gain Mana equal to the Mana spent this turn.',
  effects: draws ? [gainMana(manaSpent()), draw(draws)] : [gainMana(manaSpent())],
  transcended: {
    text: 'Gain Mana equal to the Mana spent this turn, and draw {effects.1.count} cards.',
    effects: [gainMana(manaSpent()), draw(draws + 2)],
  },
});

// P3: Promissory Note gains 5 Mana; the debt is unchanged.
export const promissoryNoteP3 = variant(promissoryNote, 3, { effects: [gainMana(5), manaDebt(2)] });

const STATS = { hp: 45, attack: 15, defense: 9 };

export const leonora = character({
  id: 'leonora', name: 'Leonora', title: 'the Quartermaster', domain: 'unbound',
  role: 'support',
  stats: STATS,
  cards: [strike, defense, callInTheDebts, promissoryNote, requisition],
  passive: runningTab(1),
  ultimate: balanceTheBooks(0),
  dupes: [
    { text: 'Running Tab draws 2.', passive: runningTab(2) },
    p2(STATS),
    { text: 'Promissory Note gains 5 Mana.', cards: { [promissoryNote.id]: promissoryNoteP3.id } },
    { text: 'Balance the Books also draws 2 cards.', ultimate: balanceTheBooks(2) },
    { text: 'Running Tab also makes the next card you play cost 1 less.', passive: runningTab(2, true) },
  ],
});
