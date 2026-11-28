import type { Visual } from '../game/profile.ts';

/** Applies the Visual tab's settings to the whole page; the card styles read the class. */
export function configureVisual(settings: Visual) {
  document.documentElement.classList.toggle('plain-frames', settings.plainFrames);
}
