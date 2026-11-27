/** Prompt rules from CLAUDE.md ("Art and writing") and DESIGN.md ("Never in any prompt or image"). */
export const BANNED = [
  'shimmer', 'fractal', 'echo', 'refraction', 'mirror', 'liminal', 'cosmic', 'ethereal',
  'impossible geometry', 'pressure', 'wrongness', 'otherworldly',
  'starfield', 'galaxy', 'galaxies', 'nebula', 'underwater', 'fish', 'coral', 'sparkle', 'neon', 'glitch',
];
/** Domain names never appear in prompts. "flesh" is left out: it is also the house material. */
export const DOMAINS = ['Rapture', 'Spirit', 'Unbound'];

export type Background = 'transparent' | 'blue' | 'green';

const KEYS = { blue: '#0000FF', green: '#00FF00' } as const;

export function backgroundLine(background: Background): string {
  if (background === 'transparent') return 'Background: fully transparent.';
  return `Background: one flat, uniform pure ${background} (${KEYS[background]}) filling the whole canvas, with no gradient, glow, shadow or texture. Do not use that ${background} anywhere on the figure.`;
}

/** Reads a stem from DESIGN.md: the blockquote following its bold label line. */
export function stemFrom(design: string, label: string): string {
  const lines = design.split('\n');
  const at = lines.findIndex((line) => line.startsWith(`**${label}**`));
  const quote = lines.slice(at + 1).find((line) => line.startsWith('> '));
  if (at < 0 || !quote) throw new Error(`DESIGN.md has no "${label}" stem`);
  return quote.slice(2).trim();
}

/** Every rule a prompt breaks, as readable messages. Empty means the prompt may be sent. */
export function promptProblems(prompt: string, background?: Background): string[] {
  const problems: string[] = [];
  const lower = prompt.toLowerCase();
  for (const word of BANNED) if (new RegExp(`\\b${word}`).test(lower)) problems.push(`banned word "${word}"`);
  for (const domain of DOMAINS) if (new RegExp(`\\b${domain}\\b`, 'i').test(prompt)) problems.push(`Domain name "${domain}"`);
  if (background && background !== 'transparent') {
    // The key colour is cut out of the image, so the figure must not use it.
    const body = prompt.replace(backgroundLine(background), '');
    if (new RegExp(`\\b${background}\\b`, 'i').test(body)) problems.push(`the figure mentions "${background}", the key colour`);
  }
  return problems;
}

export interface PromptParts {
  stem: string;
  brief: string;
  /** Absent for a scene, which fills its own canvas. */
  background?: Background | undefined;
  /** What an attached image is for: a style to match, or the character herself to portray. */
  reference?: 'style' | 'likeness' | undefined;
}

export const STYLE_REFERENCE =
  'Image 1 is a style reference only: match its pixel density, outline weight, shading and proportions. Do not copy its character, costume, colours or pose.';

/** For a portrait: the battle sprite is the source of truth for who she is and what she wears. */
export const LIKENESS_REFERENCE =
  'Image 1 is this exact character, drawn as a small pixel-art battle sprite. Paint the same person: keep her face, age, hair colour and style, skin tone, eye colour, costume, every colour and every prop and ornament exactly as Image 1 shows them, and add nothing to her design. Only the medium and framing change: a painted portrait, not pixel art.';

export function composePrompt({ stem, brief, background, reference }: PromptParts): string {
  const lead = reference === 'style' ? [STYLE_REFERENCE] : reference === 'likeness' ? [LIKENESS_REFERENCE] : [];
  return [...lead, stem, brief.trim(), ...(background ? [backgroundLine(background)] : [])].join('\n\n') + '\n';
}
