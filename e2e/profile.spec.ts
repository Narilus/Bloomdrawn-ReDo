import { expect, test } from '@playwright/test';
import { blooms, importSave, saveFile } from './menu.ts';

// The profile page (M6.6; owner, 31 Oct): the badge top left of the main menu shows the profile
// level and a pip while rewards wait; the page claims them, a Purified Bloom a level and an SSR
// Selector at 25, and spends the Selector on a banner character.

// 9,900 profile EXP is level 26, with levels 24 to 26 still to claim.
const backup = JSON.stringify({
  format: 'bloomdrawn-backup',
  saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 9, contentVersion: 1, data: { pulls: 2, runs: 4, owned: [], exp: 9900, claimed: 23, stats: { won: 3, lost: 1, fights: 14, elites: 6, bosses: 3 } } } },
});

test("claims a level's Bloom and spends the SSR Selector it gave", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(backup));
  const badge = page.locator('.profile-badge');
  await expect(badge).toHaveAccessibleName('Profile level 26, 3 rewards to claim');
  await expect(badge.locator('.profile-pip')).toHaveText('3');
  await page.screenshot({ path: 'test-results/screenshots/menu-profile-badge.png' });

  await badge.click();
  await expect(page.locator('.profile-level h3')).toHaveText('Level 26');
  await expect(page.locator('.profile-rewards')).toContainText('Level 24–26: 3 Purified Blooms and 1 SSR Selector to claim.');
  await expect(page.locator('.profile-stats')).toContainText('Fights won14');
  await page.screenshot({ path: 'test-results/screenshots/profile.png' });

  await page.getByRole('button', { name: 'Claim' }).click();
  await expect(page.getByRole('status')).toHaveText('Claimed 3 Purified Blooms and 1 SSR Selector.');
  await expect(page.getByRole('button', { name: 'Claim' })).toBeDisabled();
  await expect(page.locator('.profile-held')).toHaveText('Held: 1');

  await page.getByRole('button', { name: 'Choose a character' }).click();
  const choose = page.getByRole('dialog', { name: 'Choose an SSR' });
  await choose.getByRole('button', { name: 'Kibane' }).click();
  await choose.getByRole('button', { name: 'Take Kibane' }).click();
  await expect(page.getByRole('status')).toHaveText('Kibane joins the roster.');
  await expect(page.locator('.profile-held')).toHaveText('Held: 0');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(blooms(page)).toHaveText('5');
  await expect(page.locator('.profile-pip')).toHaveCount(0);
  expect(errors).toEqual([]);
});
