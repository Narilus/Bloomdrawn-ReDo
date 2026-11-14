import { expect, test } from '@playwright/test';
import { importSave, saveFile } from './menu.ts';

// Weapons (M6.8; docs/notes/weapons.md; owner, 15 Nov): weapons are equipped in team presets, a
// sub-slot under each member, once per preset (moving after a confirm), and each place's stats show
// its weapon. The inventory holds each weapon once with its spares; the character page shows base stats.

const profile = {
  pulls: 0,
  runs: 0,
  owned: ['virelle'],
  weapons: {
    'weapon.thorn-rapier': {},
    'weapon.surgeons-scalpel': { step: 2, spares: 2 },
    'weapon.seed-orb-staff': {},
  },
  teams: [{ name: 'Team 1', members: ['agathe', 'maelia', 'anthe', 'leonora'], weapons: [null, 'weapon.surgeons-scalpel', null, null] }],
  team: 0,
};
const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 12, contentVersion: 1, data: profile } } });

test('a preset equips weapons: a sub-slot under each member, her signature filled in, a weapon moved after a confirm, stats with it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training');
  await importSave(page, saveFile(backup));

  // The character page has no Weapon tab, and shows her own stats.
  await page.getByRole('button', { name: 'Roster' }).click();
  await page.getByRole('button', { name: 'Virelle', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Character page' }).getByRole('tab')).toHaveText(['Attributes', 'Kit', 'Potential']);
  await expect(page.locator('.character-stats')).toContainText('Attack18');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Expedition' }).click();
  await expect(page.getByRole('button', { name: "Maelia's weapon: Surgeon's Scalpel +2" })).toBeVisible();
  // Maelia's Attack 9 with the Scalpel's +18% is 11.
  await expect(page.locator('.team-place').nth(1).locator('.slot-stats')).toContainText('Attack11');
  await page.screenshot({ path: 'test-results/screenshots/party-weapons.png' });

  // Virelle joins in Agathe's place, bringing her owned signature.
  await page.getByRole('button', { name: 'Front: Agathe' }).click();
  await page.getByRole('dialog', { name: 'Choose for Front' }).getByRole('button', { name: 'Virelle', exact: true }).click();
  await expect(page.getByRole('button', { name: "Virelle's weapon: Virelle's Thorn Rapier +0" })).toBeVisible();

  // Anthe takes the Scalpel from Maelia, after a confirm naming her.
  await page.getByRole('button', { name: "Anthe's weapon: none" }).click();
  const picker = page.getByRole('dialog', { name: 'A weapon for Anthe' });
  await expect(picker.locator('.weapon-tile-name')).toHaveText(["Maelia's Seed-Orb Staff", "Virelle's Thorn Rapier", "Surgeon's Scalpel"]);
  await page.screenshot({ path: 'test-results/screenshots/party-weapon-picker.png' });
  await picker.getByRole('button', { name: "Surgeon's Scalpel +2, 2 spares, held by Maelia" }).click();
  await expect(page.getByRole('alertdialog', { name: 'Move the weapon' })).toContainText('Maelia holds it in this team. Move it to Anthe?');
  await page.getByRole('button', { name: 'Move it' }).click();
  await expect(page.getByRole('button', { name: "Anthe's weapon: Surgeon's Scalpel +2" })).toBeVisible();
  await expect(page.getByRole('button', { name: "Maelia's weapon: none" })).toBeVisible();

  // The run copies the preset's weapons: Virelle fights with her Rapier (Crit Damage +24%).
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.mana strong')).toBeVisible();
  await expect(page.locator('.portrait-name')).toHaveText(['Virelle', 'Maelia', 'Anthe', 'Leonora']);
  expect(errors).toEqual([]);
});

test('the inventory holds each weapon once: reinforce with a spare, salvage spares for Pollen after a confirm', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Inventory' }).click();
  const kinds = page.getByRole('tablist', { name: 'Item kinds' });
  await expect(kinds.getByRole('tab')).toHaveText(['All', 'Currencies', 'Memories', 'Materials', 'Weapons', 'Special']);
  await kinds.getByRole('tab', { name: 'Weapons' }).click();
  await expect(page.locator('.inventory-weapons .weapon-tile-name')).toHaveText(["Maelia's Seed-Orb Staff", "Virelle's Thorn Rapier", "Surgeon's Scalpel"]);
  const detail = page.getByRole('complementary', { name: 'Weapon' });
  await page.getByRole('button', { name: "Surgeon's Scalpel +2, 2 spares" }).click();
  await expect(detail).toContainText('Attack +18%');
  await expect(detail).toContainText('Bleed and Poison the wielder applies are 14.4% more.');
  await expect(detail).toContainText('In Team 1 (Maelia).');
  await page.screenshot({ path: 'test-results/screenshots/inventory-weapons.png' });

  await detail.getByRole('button', { name: 'Reinforce' }).click();
  await expect(page.getByRole('status')).toHaveText('Reinforced to +3.');
  await expect(detail).toContainText('1 spare');
  await detail.getByRole('button', { name: 'Salvage', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Salvage' })).toContainText("Salvage a spare of Surgeon's Scalpel for 2 Pollen?");
  await page.getByRole('alertdialog', { name: 'Salvage' }).getByRole('button', { name: 'Salvage' }).click();
  await expect(page.getByRole('status')).toHaveText('Salvaged. Pollen held: 2.');
  // The weapon itself stays.
  await expect(detail.getByRole('button', { name: 'Salvage', exact: true })).toBeDisabled();
  await expect(page.locator('.inventory-weapons .weapon-tile')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('the weapon banner: its own Focus among the signatures, the two tickboxes, and weapons in the results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 12, contentVersion: 1, data: { ...profile, pulls: 10 } } } })));
  await page.getByRole('button', { name: 'Banners' }).click();
  await page.getByRole('button', { name: 'Weapon banner' }).click();
  await expect(page.locator('.banner-header h2')).toHaveText('Weapon banner');
  await page.getByRole('button', { name: 'Switch' }).click();
  const pool = page.getByRole('dialog', { name: 'Choose a Focus' });
  await expect(pool.locator('.weapon-tile')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/screenshots/weapon-banner-pool.png' });
  await pool.getByRole('button', { name: "Kibane's Foxfire Gauntlet" }).click();
  await expect(page.locator('.banner-focus-info .weapon-card h3')).toContainText("Kibane's Foxfire Gauntlet");
  // The tickboxes save at once and show on both banners.
  const ticks = page.getByRole('group', { name: 'Weapon duplicates' });
  await ticks.getByRole('checkbox', { name: 'Auto-reinforce duplicates' }).check();
  await expect(ticks.getByRole('checkbox', { name: 'Auto-reinforce duplicates' })).toBeChecked();
  await page.screenshot({ path: 'test-results/screenshots/weapon-banner.png' });
  await page.getByRole('button', { name: /Pull 10/ }).click();
  const results = page.getByRole('dialog', { name: 'Results' });
  await expect(results.locator('.banner-result')).toHaveCount(10);
  // A ten-pull has an SR or better, and every SR is a weapon.
  await expect(results.locator('.banner-result.rarity-sr .banner-result-glyph, .banner-result.rarity-ssr .banner-result-glyph').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/screenshots/weapon-banner-results.png' });
  await results.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Banners' }).click();
  await page.getByRole('button', { name: 'Character banner' }).click();
  await expect(page.getByRole('group', { name: 'Weapon duplicates' }).getByRole('checkbox', { name: 'Auto-reinforce duplicates' })).toBeChecked();
  expect(errors).toEqual([]);
});
