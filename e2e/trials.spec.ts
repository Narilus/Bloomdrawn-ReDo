import { expect, test } from '@playwright/test';
import { importSave, saveFile } from './menu.ts';

// Trials (M6.7; owner, 31 Oct): the main menu's Trials lists the four Domain bosses, each with its
// tiers, Tier 1 open and the next opened by a win. A Trial is one fight from party select; giving
// up is a defeat, which pays nothing.

// Flesh's Tier 1 already won.
const backup = JSON.stringify({
  format: 'bloomdrawn-backup',
  saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 10, contentVersion: 1, data: { pulls: 11, runs: 0, owned: [], trials: { flesh: 1 } } } },
});

test('lists the Trials and their tiers, fights one from party select, and gives up for nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Trials' }).click();

  const flesh = page.getByRole('region', { name: 'Flesh Trial' });
  await expect(page.locator('.trial-card', { hasText: 'Flesh' })).toContainText('Tier 1 won');
  await expect(flesh.getByRole('button', { name: /^Tier 1/ })).toContainText('Won');
  await expect(flesh.getByRole('button', { name: /^Tier 2/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(flesh.getByRole('button', { name: /^Tier 3/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/trials.png' });

  await page.locator('.trial-card', { hasText: 'Spirit' }).click();
  const spirit = page.getByRole('region', { name: 'Spirit Trial' });
  await expect(spirit.locator('h3')).toHaveText('The Kirin Oracle');
  await expect(spirit.getByRole('button', { name: /^Tier 1/ })).toContainText('Pays 1 Spirit Shard');
  await expect(spirit.getByRole('button', { name: /^Tier 2/ })).toBeDisabled();

  await spirit.getByRole('button', { name: 'Choose party' }).click();
  await page.getByRole('button', { name: 'Start Tier 1' }).click();
  await page.locator('.mana strong').waitFor();
  await expect(page.getByText(/Spirit Trial · Tier 1/)).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/trial-fight.png' });

  await page.getByRole('button', { name: 'Give up' }).click();
  await page.getByRole('dialog', { name: 'Give up' }).getByRole('button', { name: 'Give up' }).click();
  const defeat = page.getByRole('dialog', { name: 'Defeat' });
  await expect(defeat).toContainText('A defeat pays nothing.');
  await defeat.getByRole('button', { name: 'Trials' }).click();
  // Back on the Trial last chosen, with nothing won.
  await expect(page.locator('.trial-card', { hasText: 'Spirit' })).toContainText('Not yet won');
  await expect(page.getByRole('region', { name: 'Spirit Trial' })).toBeVisible();
  expect(errors).toEqual([]);
});
