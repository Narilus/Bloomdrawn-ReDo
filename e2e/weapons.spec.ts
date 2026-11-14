import { expect, test } from '@playwright/test';
import { importSave, saveFile } from './menu.ts';

// Weapons (M6.8; docs/notes/weapons.md): a character's page has tabs down the left; the Weapon tab
// equips a copy (asking before taking one from someone else) and its main stat shows on Attributes.

const profile = {
  pulls: 0,
  runs: 0,
  owned: ['virelle'],
  weapons: [
    { uid: 'w1', weapon: 'weapon.thorn-rapier' },
    { uid: 'w2', weapon: 'weapon.surgeons-scalpel', step: 2 },
    { uid: 'w3', weapon: 'weapon.surgeons-scalpel' },
    { uid: 'w4', weapon: 'weapon.seed-orb-staff', locked: true },
  ],
  equipped: { maelia: 'w2' },
};
const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 11, contentVersion: 1, data: profile } } });

test("a character's page: tabs on the left, equipping a weapon, its stat on Attributes", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Roster' }).click();
  await page.getByRole('button', { name: 'Virelle', exact: true }).click();
  const tabs = page.getByRole('tablist', { name: 'Character page' });
  await expect(tabs.getByRole('tab')).toHaveText(['Attributes', 'Weapon', 'Kit', 'Potential']);
  await expect(page.locator('.character-header h2')).toHaveText('Virelle, the Open Wound');
  await page.screenshot({ path: 'test-results/screenshots/character-attributes.png' });

  // Virelle wields nothing; she takes the Thorn Rapier, her signature, listed first.
  await tabs.getByRole('tab', { name: 'Weapon' }).click();
  await expect(page.locator('.character-weapon')).toContainText('Virelle wields no weapon.');
  await page.getByRole('button', { name: 'Change' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a weapon' });
  await expect(picker.locator('.weapon-tile-name').first()).toHaveText("Virelle's Thorn Rapier");
  await page.screenshot({ path: 'test-results/screenshots/character-weapon-change.png' });
  await picker.getByRole('button', { name: "Virelle's Thorn Rapier +0" }).click();
  await expect(page.locator('.weapon-card h3')).toContainText("Virelle's Thorn Rapier");
  await expect(page.locator('.weapon-card')).toContainText('Crit Damage +24%');
  await expect(page.locator('.weapon-card')).toContainText('Signature · Virelle');
  await page.screenshot({ path: 'test-results/screenshots/character-weapon.png' });

  // Maelia's Scalpel is taken only after a confirm.
  await page.getByRole('button', { name: 'Change' }).click();
  await picker.getByRole('button', { name: "Surgeon's Scalpel +2, wielded by Maelia" }).click();
  await expect(page.getByRole('alertdialog', { name: 'Take the weapon' })).toContainText('Maelia wields it. Take it for Virelle?');
  await page.getByRole('button', { name: 'Take it' }).click();
  await expect(page.getByRole('status')).toHaveText('Virelle wields it; Maelia has none.');
  // Reinforce with the spare Scalpel: +2 and a +0 copy make +3.
  await page.getByRole('button', { name: 'Reinforce' }).click();
  await page.getByRole('dialog', { name: 'Choose a duplicate' }).getByRole('button', { name: "Surgeon's Scalpel +0" }).click();
  await expect(page.getByRole('status')).toHaveText('Reinforced to +3.');

  // Attributes shows what the weapon adds: Attack 18 +18% is 21.
  await tabs.getByRole('tab', { name: 'Attributes' }).click();
  await expect(page.locator('.character-stats')).toContainText('Attack21 (+3 weapon)');
  // The arrows step to the next character, on the same tab.
  await page.getByRole('button', { name: 'Next character' }).click();
  await expect(page.locator('.character-header h2')).not.toHaveText('Virelle, the Open Wound');
  await expect(tabs.getByRole('tab', { name: 'Attributes' })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('the inventory lists weapons: reinforce with a duplicate, lock, and salvage for Pollen after a confirm', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Inventory' }).click();
  const kinds = page.getByRole('tablist', { name: 'Item kinds' });
  await expect(kinds.getByRole('tab')).toHaveText(['All', 'Currencies', 'Memories', 'Materials', 'Weapons', 'Special']);
  await kinds.getByRole('tab', { name: 'Weapons' }).click();
  // The signatures first, then the SR copies, the highest step first.
  await expect(page.locator('.inventory-weapons .weapon-tile-name')).toHaveText(["Maelia's Seed-Orb Staff", "Virelle's Thorn Rapier", "Surgeon's Scalpel", "Surgeon's Scalpel"]);
  const detail = page.getByRole('complementary', { name: 'Weapon' });
  await page.getByRole('button', { name: "Surgeon's Scalpel +2, wielded by Maelia" }).click();
  await expect(detail).toContainText('Attack +18%');
  await expect(detail).toContainText('Bleed and Poison the wielder applies are 14.4% more.');
  await expect(detail).toContainText('Wielded by Maelia');
  await page.screenshot({ path: 'test-results/screenshots/inventory-weapons.png' });

  // The wielded copy can't be salvaged; the spare can, for 2 Pollen, once locked no more.
  await detail.getByRole('button', { name: 'Salvage' }).click();
  await page.getByRole('alertdialog', { name: 'Salvage' }).getByRole('button', { name: 'Salvage' }).click();
  await expect(page.getByRole('status')).toHaveText('That copy is wielded.');
  await page.getByRole('button', { name: "Surgeon's Scalpel +0" }).click();
  await detail.getByRole('button', { name: 'Lock' }).click();
  await expect(page.getByRole('status')).toHaveText('Locked: it is never salvaged.');
  await detail.getByRole('button', { name: 'Salvage' }).click();
  await page.getByRole('alertdialog', { name: 'Salvage' }).getByRole('button', { name: 'Salvage' }).click();
  await expect(page.getByRole('status')).toHaveText('That copy is locked.');
  await detail.getByRole('button', { name: 'Unlock' }).click();
  await detail.getByRole('button', { name: 'Salvage' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Salvage' })).toContainText("Salvage Surgeon's Scalpel +0 for 2 Pollen?");
  await page.getByRole('alertdialog', { name: 'Salvage' }).getByRole('button', { name: 'Salvage' }).click();
  await expect(page.getByRole('status')).toHaveText('Salvaged. Pollen held: 2.');
  await expect(page.locator('.inventory-weapons .weapon-tile')).toHaveCount(3);
  expect(errors).toEqual([]);
});
