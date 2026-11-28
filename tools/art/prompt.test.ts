import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composePrompt, LIKENESS_REFERENCE, promptProblems, SET_REFERENCE, stemFrom, STYLE_REFERENCE } from './prompt.ts';

const design = readFileSync(new URL('../../docs/DESIGN.md', import.meta.url), 'utf8');

describe('prompts', () => {
  it('reads every stem from DESIGN.md, and none breaks a rule', () => {
    for (const label of ['Prompt stem', 'Battle sprite stem', 'Enemy sprite stem', 'Weapon icon stem', 'Ornament stem']) {
      const stem = stemFrom(design, label);
      expect(stem.length).toBeGreaterThan(100);
      expect(promptProblems(stem, 'blue')).toEqual([]);
    }
  });

  it('is the stem, then the brief, then the background, with the style note first if a reference is attached', () => {
    const prompt = composePrompt({ stem: 'STEM.', brief: ' BRIEF.\n', background: 'transparent', reference: 'style' });
    expect(prompt).toBe(`${STYLE_REFERENCE}\n\nSTEM.\n\nBRIEF.\n\nBackground: fully transparent.\n`);
  });

  it('a portrait leads with the likeness note: the sprite decides her colours and details', () => {
    const prompt = composePrompt({ stem: 'STEM.', brief: 'BRIEF.', reference: 'likeness' });
    expect(prompt).toBe(`${LIKENESS_REFERENCE}\n\nSTEM.\n\nBRIEF.\n`);
    expect(prompt).not.toContain(STYLE_REFERENCE);
  });

  it('a piece of ornament joining a picked frame leads with the set note: the kit decides its materials and colours', () => {
    const prompt = composePrompt({ stem: 'STEM.', brief: 'BRIEF.', background: 'transparent', reference: 'set' });
    expect(prompt).toBe(`${SET_REFERENCE}\n\nSTEM.\n\nBRIEF.\n\nBackground: fully transparent.\n`);
    expect(promptProblems(prompt)).toEqual([]);
  });

  it('a scene has no background line: it fills its own canvas', () => {
    expect(composePrompt({ stem: 'STEM.', brief: 'BRIEF.', reference: undefined })).toBe('STEM.\n\nBRIEF.\n');
  });

  it('refuses banned words, Domain names, and the key colour on the figure', () => {
    const prompt = composePrompt({ stem: 'A cosmic Rapture priestess.', brief: 'Blue sash.', background: 'blue', reference: undefined });
    expect(promptProblems(prompt, 'blue')).toEqual(['banned word "cosmic"', 'Domain name "Rapture"', 'the figure mentions "blue", the key colour']);
    expect(promptProblems(prompt.replace('Blue sash.', 'Violet sash.'), 'blue')).toHaveLength(2);
  });
});
