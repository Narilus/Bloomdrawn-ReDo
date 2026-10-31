import { expect, test } from '@playwright/test';
import { blooms, importSave, saveFile } from './menu.ts';

// The main menu and Options (M6.1; owner, 31 Oct): every item leads somewhere, Ducats and Purified
// Blooms show top right with their names on hover, and Reset waits for a ticked box and "RESET".

test('the main menu opens each screen, and Reset needs the box ticked and RESET typed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const data = { pulls: 7, runs: 2, owned: ['kibane'], items: { money: 1250 } };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 7, contentVersion: 1, data } } });
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await expect(blooms(page)).toHaveText('7');
  await expect(page.locator('.currency-ducat strong')).toHaveText('1,250');
  await page.locator('.currency-ducat').hover();
  await expect(page.locator('.currency-ducat')).toHaveAttribute('data-tip', 'Ducats');
  await expect(page.locator('.menu-art img')).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/main-menu.png' });

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile')).toHaveCount(5);
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Banners' }).click();
  await expect(page.getByRole('button', { name: /Weapon banner/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/main-menu-banners.png' });
  await page.getByRole('button', { name: 'Character banner' }).click();
  await expect(page.locator('.currency-bloom strong')).toHaveText('7');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Expedition' }).click();
  await expect(page.getByRole('button', { name: 'Start expedition' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('.options-summary')).toHaveText('This profile has ended 2 expeditions.');
  const confirm = page.getByRole('button', { name: 'Confirm reset' });
  const typed = page.getByRole('textbox', { name: 'Type RESET to confirm' });
  await expect(confirm).toBeDisabled();
  await typed.fill('RESET');
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox').check();
  await typed.fill('reset');
  await expect(confirm).toBeDisabled();
  await typed.fill('RESET');
  await page.screenshot({ path: 'test-results/screenshots/options-reset.png' });
  await confirm.click();
  // A new profile: 10 Blooms, no Ducats, the starters only.
  await expect(blooms(page)).toHaveText('10');
  await expect(page.locator('.currency-ducat strong')).toHaveText('0');
  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('the inventory lists every item in a tab per kind, and shows what a chosen one is for (M6.2)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const data = { pulls: 4, runs: 1, owned: [], items: { money: 2100, pollen: 12, 'memory.clear': 3, 'material.spirit': 2 } };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 7, contentVersion: 1, data } } });
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Inventory' }).click();
  const tiles = page.locator('.inventory-item');
  await expect(tiles).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Purified Blooms: 4' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/screenshots/inventory.png' });
  await page.getByRole('tab', { name: 'Currencies' }).click();
  await expect(page.locator('.inventory-name')).toHaveText(['Purified Blooms', 'Ducats', 'Pollen']);
  await page.getByRole('tab', { name: 'Memories' }).click();
  await expect(page.locator('.inventory-name')).toHaveText(['Faint Memory', 'Clear Memory', 'Vivid Memory']);
  await page.getByRole('tab', { name: 'Materials' }).click();
  await expect(tiles).toHaveCount(4);
  await page.getByRole('button', { name: 'Spirit Shard: 2' }).click();
  const detail = page.getByRole('complementary', { name: 'Item' });
  await expect(detail.locator('h3')).toHaveText('Spirit Shard');
  await expect(detail).toContainText('Held: 2');
  await expect(detail).toContainText('Ascends a Spirit character at level 10, 20 or 30.');
  await page.screenshot({ path: 'test-results/screenshots/inventory-materials.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
  expect(errors).toEqual([]);
});
