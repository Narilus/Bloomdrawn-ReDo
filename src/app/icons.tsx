// The HUD's icon set: simple SVG glyphs that stay crisp at any size. Content names an icon by
// key (a Domain counter's or a status's `icon`); an unknown key renders nothing, and the words
// stay in the tooltip and the screen-reader label either way.

const PATHS: Record<string, React.ReactNode> = {
  // A tentacle rising from the lower left and curling at the tip, suckers cut out along it.
  tentacle: (
    <>
      <path
        d="M3.5 22C4 16 8 14.5 11 13c3.5-1.8 6.5-4 6-7.4-.4-2.6-3.4-3.2-4.6-1.4-1 1.6.2 3.4 2 2.8-.8 1.6-2.6 1.9-3.8 1-2-1.6-1.2-5.8 2.4-6.4 4.8-.7 8 3 7.2 7.2-.9 4.6-5.4 6.8-8.4 8.4-2.6 1.4-4.2 2.6-4.6 4.8z"
        stroke="none"
      />
      <g fill="var(--icon-cut, #2e1e2a)" stroke="none">
        <circle cx="9.4" cy="17.8" r="0.9" />
        <circle cx="13" cy="15.4" r="0.85" />
        <circle cx="16.2" cy="12.6" r="0.8" />
        <circle cx="18.3" cy="9" r="0.7" />
      </g>
    </>
  ),
  // A curled bud inside a round pod, on a stem.
  embryo: (
    <>
      <circle cx="12" cy="12.5" r="9" fill="none" strokeWidth="2" />
      <circle cx="13.6" cy="9.4" r="3" stroke="none" />
      <path d="M11 10.6c-2.8 1.8-2.6 6 .6 6.6 2 .4 3.4-1.2 2.6-2.8" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 3.5c.5-1.5 2-2.1 3.4-1.9" fill="none" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // A votive flame.
  essence: (
    <>
      <path d="M12 2.5c3.5 4 6 7 6 11a6 6 0 0 1-12 0c0-3 2-5 3.5-7.5.5 2 1.5 3 2.5 3.5.5-2.5 0-4.5 0-7z" fill="none" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 20a2.4 2.4 0 0 1-2.4-2.4c0-1.6 1.4-2.6 2.4-4.1 1 1.5 2.4 2.5 2.4 4.1A2.4 2.4 0 0 1 12 20z" stroke="none" />
    </>
  ),
  shield: <path d="M12 2.8l7.5 3v5.6c0 4.8-3.1 8.2-7.5 10-4.4-1.8-7.5-5.2-7.5-10V5.8z" fill="none" strokeWidth="2.2" strokeLinejoin="round" />,
  // A cluster of pollen grains.
  poison: (
    <>
      <circle cx="9" cy="9.5" r="4" fill="none" strokeWidth="2" />
      <circle cx="16" cy="13" r="3.2" fill="none" strokeWidth="2" />
      <circle cx="9.5" cy="17.2" r="2.4" fill="none" strokeWidth="2" />
      <circle cx="17.5" cy="5.5" r="1.3" stroke="none" />
      <circle cx="4" cy="15" r="1.1" stroke="none" />
    </>
  ),
  // An attack: a short blade.
  attack: (
    <>
      <path d="M19.5 2.5l2 2-11 11-2-2z" stroke="none" />
      <path d="M6 11.5l6.5 6.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.3 15.7l-4.8 4.8" fill="none" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // A drop of blood.
  bleed: (
    <>
      <path d="M12 2.5C9 7.5 6 10.8 6 14.5a6 6 0 0 0 12 0C18 10.8 15 7.5 12 2.5z" stroke="none" />
      <path d="M9.6 14.2c0 1.6 1 2.8 2.4 3.1" fill="none" stroke="var(--icon-cut, #2e1e2a)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // A cracked shield.
  vulnerable: (
    <>
      <path d="M12 2.8l7.5 3v5.6c0 4.8-3.1 8.2-7.5 10-4.4-1.8-7.5-5.2-7.5-10V5.8z" fill="none" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12.6 4.5l-2.4 5 3 1.6-2.6 5.4" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
  // A snapped blade with a falling arrow.
  weak: (
    <>
      <path d="M19.5 2.5l2 2-6.2 6.2-2-2z" stroke="none" />
      <path d="M11.6 10.4L10 12l1.2 1.2" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 11.5l6.5 6.5" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.3 15.7l-4.8 4.8" fill="none" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15.5 14.5v6m-2.6-2.6l2.6 2.6 2.6-2.6" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // A dizzy spiral with sparks.
  stun: (
    <>
      <path d="M12 12.2c0-1.2 1.6-1.6 2.4-.6 1.2 1.4-.2 3.6-2.2 3.6-2.8 0-4.2-3.2-2.6-5.4 2-2.8 6.4-2.2 7.6 1 1.4 3.8-1.6 7.4-5.4 7.2" fill="none" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 4.5l.8 1.8 1.8.8-1.8.8L5 9.7l-.8-1.8-1.8-.8 1.8-.8zM19 2.5l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6z" stroke="none" />
    </>
  ),
  // An hourglass.
  delay: (
    <>
      <path d="M6.5 2.8h11M6.5 21.2h11" fill="none" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7.8 3c0 5 3.6 6.6 3.6 9S7.8 16 7.8 21M16.2 3c0 5-3.6 6.6-3.6 9s3.6 4 3.6 9" fill="none" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.6 19.6c.6-1.8 1.6-2.6 2.4-2.6s1.8.8 2.4 2.6z" stroke="none" />
    </>
  ),
  // A stumbling, sagging arrow.
  falter: (
    <>
      <path d="M4 6.5c3 0 4.5 2.5 6.5 6s3.5 6 7 6" fill="none" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14.5 21l3.4-2.5L15.6 15" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="6" r="1.3" stroke="none" />
      <circle cx="14.5" cy="4.5" r="1" stroke="none" />
    </>
  ),
};

export const hasIcon = (name: string | undefined): name is string => name !== undefined && name in PATHS;

/** A 1em icon in the current text colour. Decorative: the label belongs on its parent. */
export function Icon({ name, className }: { name: string; className?: string }) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg className={`icon icon-${name}${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" aria-hidden="true">
      {glyph}
    </svg>
  );
}
