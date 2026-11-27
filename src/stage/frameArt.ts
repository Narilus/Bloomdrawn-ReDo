// Card-frame ornament (M6.11a; DESIGN.md "Cards"; owner, 28 Nov). Each frame (a Domain's, or the
// Bloom's for the party's own cards) is built from three pieces cut from one generated kit and
// stored as `<frame>-corner.png`, `<frame>-crest.png` and `<frame>-side.png` (`npm run art -- pick
// --frame`). A frame without them keeps the drawn stand-ins.

const FILES = import.meta.glob<string>('../assets/frames/*.png', { eager: true, query: '?url', import: 'default' });
const URLS = new Map(Object.entries(FILES).map(([path, url]) => [/([^/]+)\.png$/.exec(path)?.[1] ?? '', url]));

export interface FramePieces {
  /** Drawn for the top-left corner, mirrored into the others. */
  corner?: string | undefined;
  crest?: string | undefined;
  /** Runs top to bottom, mirrored for the left side. */
  side?: string | undefined;
}

export const frameArt = (frame: string): FramePieces => ({
  corner: URLS.get(`${frame}-corner`),
  crest: URLS.get(`${frame}-crest`),
  side: URLS.get(`${frame}-side`),
});
