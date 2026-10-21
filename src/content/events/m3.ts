import { event } from '../define.ts';

// The M3 Events (docs/notes/m3-labyrinth.md, owner, 19 Oct). Choosing is mandatory once the party
// stands on one, and every choice ticks the Bloom clock. HP costs are a share of current HP. The
// scene text is a draft; numbers are placeholders.

export const surveyPack = event({
  id: 'event.survey-pack', name: 'The Abandoned Survey Pack',
  text: 'A canvas pack lies against the root wall, its straps chewed through. A purse of Obols sits on top. Under it is a sealed tin, warm to the touch, with brown resin seeping from the lid.',
  choices: [
    { label: 'Take the Obols', outcomes: [{ do: 'obols', amount: 30 }] },
    { label: 'Take the sealed tin', outcomes: [{ do: 'relic', tier: 'common' }, { do: 'loseHp', percent: 10 }] },
  ],
});

export const censer = event({
  id: 'event.censer', name: 'The Censer Left Burning',
  text: 'A brass censer hangs from a hook in the ceiling, still smoking. The smoke is yellow and smells of pollen and warm milk.',
  choices: [
    { label: 'Breathe it in', outcomes: [{ do: 'charge', amount: 20 }, { do: 'symptom' }] },
    { label: 'Snuff it', outcomes: [] },
  ],
});

export const kneelingGardener = event({
  id: 'event.kneeling-gardener', name: 'The Kneeling Gardener',
  text: 'A woman in a mud-stiff apron kneels among the roots, her knees grown into the soil. A pair of iron shears hangs from her belt.',
  choices: [
    { label: 'Help her up', outcomes: [{ do: 'heal', percent: 15 }] },
    { label: 'Take her shears', outcomes: [{ do: 'relic', tier: 'uncommon' }, { do: 'tick', count: 1 }] },
  ],
});

export const seedVault = event({
  id: 'event.seed-vault', name: 'The Seed Vault',
  text: 'An iron door is set into the root wall, with a coin slot at its centre. Through the grille, something rests on a green velvet cushion.',
  choices: [
    { label: 'Pay for what is inside', outcomes: [{ do: 'pay', amount: 40 }, { do: 'relic', tier: 'rare' }] },
    { label: 'Leave', outcomes: [] },
  ],
});
