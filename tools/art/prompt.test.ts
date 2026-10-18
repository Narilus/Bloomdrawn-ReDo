import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composePrompt, promptProblems, stemFrom, STYLE_REFERENCE } from './prompt.ts';

const design = readFileSync(new URL('../../docs/DESIGN.md', import.meta.url), 'utf8');

describe('prompts', () => {
  it('reads both stems from DESIGN.md, and neither breaks a rule', () => {
    for (const label of ['Prompt stem', 'Battle sprite stem']) {
      const stem = stemFrom(design, label);
      expect(stem.length).toBeGreaterThan(100);
      expect(promptProblems(stem, 'blue')).toEqual([]);
    }
  });

  it('is the stem, then the brief, then the background, with the style note first if a reference is attached', () => {
    const prompt = composePrompt({ stem: 'STEM.', brief: ' BRIEF.\n', background: 'transparent', styleReference: true });
    expect(prompt).toBe(`${STYLE_REFERENCE}\n\nSTEM.\n\nBRIEF.\n\nBackground: fully transparent.\n`);
  });

  it('refuses banned words, Domain names, and the key colour on the figure', () => {
    const prompt = composePrompt({ stem: 'A cosmic Rapture priestess.', brief: 'Blue sash.', background: 'blue', styleReference: false });
    expect(promptProblems(prompt, 'blue')).toEqual(['banned word "cosmic"', 'Domain name "Rapture"', 'the figure mentions "blue", the key colour']);
    expect(promptProblems(prompt.replace('Blue sash.', 'Violet sash.'), 'blue')).toHaveLength(2);
  });
});
