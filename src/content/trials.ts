// Trials (docs/notes/trials.md): each Domain's boss, in the order the Trials screen lists them. A
// win pays the Domain's ascension material (its `material`).
export const TRIALS: readonly { domain: string; encounter: string }[] = [
  { domain: 'flesh', encounter: 'encounter.grand-anatomist' },
  { domain: 'rapture', encounter: 'encounter.veiled-hierophant' },
  { domain: 'spirit', encounter: 'encounter.kirin-oracle' },
  { domain: 'unbound', encounter: 'encounter.ringmaster' },
];
