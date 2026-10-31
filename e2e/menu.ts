import type { Page } from '@playwright/test';

// Main menu steps the specs share (M6.1): saves load from a file in Options, and the banner is in
// the Banners sub-menu.

type SaveFile = string | { name: string; mimeType: string; buffer: Buffer };

/** Loads a save file through Options; one that loads returns to the main menu. */
export async function importSave(page: Page, file: SaveFile) {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.locator('.options-files input[type="file"]').setInputFiles(file);
}

/** A backup file's contents as a file to load. */
export const saveFile = (text: string): SaveFile => ({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });

export async function openBanner(page: Page) {
  await page.getByRole('button', { name: 'Banners' }).click();
  await page.getByRole('button', { name: 'Character banner' }).click();
}

/** The Purified Blooms on the main menu. */
export const blooms = (page: Page) => page.locator('.currency-bloom strong');
