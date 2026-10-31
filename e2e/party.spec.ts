import { expect, test, type Page } from '@playwright/test';
import { blooms, importSave, saveFile } from './menu.ts';

// The roster and party select (M5.1; owner, 26 Oct): every character's art stands the same height,
// a character's page shows her kit, and party select keeps team presets: a place swaps, quick select
// fills four in click order, a preset can be renamed, and the run fields the chosen team, front first.

const artHeight = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())?.height ?? 0;

test('the roster shows a kit, and a run starts with the team chosen, in its order', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?encounters=encounter.training');

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile')).toHaveCount(4);
  // Anthe is wider than she is tall, but stands as tall as the rest.
  const tile = (name: string) => `.roster-tile[aria-label="${name}"] img`;
  await expect(page.locator(tile('Anthe'))).toBeVisible();
  expect(await artHeight(page, tile('Anthe'))).toBeCloseTo(await artHeight(page, tile('Maelia')), 0);
  await page.screenshot({ path: 'test-results/screenshots/roster.png' });
  await page.getByRole('button', { name: 'Anthe', exact: true }).click();
  await expect(page.locator('.character-info h2')).toHaveText("Anthe, the Sphinx's Vigil");
  const antheHeight = await artHeight(page, '.character-art img');
  await page.screenshot({ path: 'test-results/screenshots/character-page-wide.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Maelia', exact: true }).click();
  await expect(page.locator('.character-info h2')).toHaveText('Maelia, Midwife of the Bloom');
  await expect(page.locator('.character-info')).toContainText('The first time each turn a card gains Embryo, gain 1 more.');
  await expect(page.locator('.character-cards .card')).toHaveCount(7);
  expect(await artHeight(page, '.character-art img')).toBeCloseTo(antheHeight, 0);
  await page.screenshot({ path: 'test-results/screenshots/character-page.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Expedition' }).click();
  const slots = page.locator('.team-slot');
  const names = page.locator('.team-slot strong');
  await expect(page.getByRole('button', { name: 'Team 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(names).toHaveText(['Agathe', 'Maelia', 'Anthe', 'Leonora']);
  // Picking Leonora for the front swaps her with Agathe.
  await page.getByRole('button', { name: 'Front: Agathe' }).click();
  await page.getByRole('dialog', { name: 'Choose for Front' }).getByRole('button', { name: 'Leonora', exact: true }).click();
  await expect(names).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);

  // Team 2 starts empty; quick select fills it in click order, and it can be renamed.
  await page.getByRole('button', { name: 'Team 2' }).click();
  await expect(slots).toHaveText(['Front+', '2+', '3+', '4+']);
  await expect(page.getByRole('button', { name: 'Start expedition' })).toBeDisabled();
  await expect(page.locator('.roster-hint')).toHaveText('A party is 4 characters.');
  await page.getByRole('button', { name: 'Quick select' }).click();
  const quick = page.getByRole('dialog', { name: 'Quick select' });
  for (const name of ['Anthe', 'Agathe', 'Leonora', 'Agathe', 'Maelia', 'Agathe']) await quick.getByRole('button', { name, exact: true }).click();
  await page.screenshot({ path: 'test-results/screenshots/party-quick.png' });
  await quick.getByRole('button', { name: 'Done' }).click();
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.getByRole('textbox', { name: 'Team name' }).fill('Sphinx first');
  await page.getByRole('textbox', { name: 'Team name' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Sphinx first' })).toBeVisible();
  // A place can be emptied and filled again.
  await page.getByRole('button', { name: '3: Maelia' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: '3: empty' })).toBeVisible();
  await page.getByRole('button', { name: '3: empty' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '3: empty' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Maelia', exact: true }).click();
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.screenshot({ path: 'test-results/screenshots/party-select.png' });
  await page.getByRole('button', { name: 'Start expedition' }).click();

  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.mana strong')).toBeVisible();
  await expect(page.locator('.portrait-name')).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);

  // Back at the main menu, party select opens on the same team, and Team 1 kept its swap.
  await page.reload();
  await page.getByRole('button', { name: 'New expedition' }).click();
  await page.getByRole('button', { name: 'Abandon it' }).click();
  await expect(page.getByRole('button', { name: 'Sphinx first' })).toHaveAttribute('aria-pressed', 'true');
  await expect(names).toHaveText(['Anthe', 'Leonora', 'Maelia', 'Agathe']);
  await page.getByRole('button', { name: 'Team 1' }).click();
  await expect(names).toHaveText(['Leonora', 'Maelia', 'Anthe', 'Agathe']);
  expect(errors).toEqual([]);
});

test("a character's dupe level shows on the roster, and the page shows her at it, with every level listed (M5.4)", async ({ page }) => {
  const data = { pulls: 0, runs: 0, owned: ['kibane'], dupes: { kibane: 3 } };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 6, contentVersion: 1, data } } });
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile[aria-label="Kibane"] .roster-level')).toHaveText('C3');
  await expect(page.locator('.roster-tile[aria-label="Maelia"] .roster-level')).toHaveCount(0);
  await page.getByRole('button', { name: 'Kibane', exact: true }).click();
  // C2's +10% HP and +3 Attack; C3's Foxfire Rite at 80% of Attack 18 plus 240% of it per Essence.
  await expect(page.locator('.character-stats')).toContainText('HP55Attack18');
  await expect(page.locator('.character-cards').first()).toContainText('Deal 14 + 43 × Essence damage.');
  await expect(page.locator('.character-dupes li')).toHaveCount(5);
  await expect(page.locator('.character-dupes li.reached')).toHaveCount(3);
  await page.locator('.character-dupes').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/screenshots/character-page-dupes.png' });
});

test('a character levels up and ascends on her page, and party select buys a preset with Ducats (M5.5)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const data = { pulls: 0, runs: 0, owned: [], items: { 'memory.vivid': 3, 'material.flesh': 1, money: 3000 } };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 7, contentVersion: 1, data } } });
  await page.goto('/');
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.locator('.roster-tile[aria-label="Maelia"] .roster-lv')).toHaveText('Lv 1');
  await page.getByRole('button', { name: 'Maelia', exact: true }).click();
  const growth = page.getByRole('region', { name: 'Level' });
  await expect(growth.locator('h3')).toContainText('Level 1 of 10');
  await expect(page.locator('.character-stats')).toContainText('HP55Attack9Defense15');
  // Three Vivid Memories pay for nine levels (4,500 EXP), 1,500 coming back as Clear ones.
  await growth.getByRole('button', { name: /To level 10/ }).click();
  await expect(growth.locator('h3')).toContainText('Level 10 of 10');
  await expect(growth.locator('.character-note')).toHaveText('Level 10. Spent: 3 Vivid Memories, 900 Ducats. Back: 3 Clear Memories.');
  // A Support at level 10 before ascending (m6-scaling.md, 4.4–4.5).
  await expect(page.locator('.character-stats')).toContainText('HP117Attack16Defense30');
  // Her Strike is 300% of Attack 16.
  await expect(page.locator('.character-cards').first()).toContainText('Deal 48 damage.');
  await expect(growth.getByRole('button', { name: /Ascend/ })).toContainText('gives 1 Purified Bloom');
  await growth.getByRole('button', { name: /Ascend/ }).click();
  const reward = page.getByRole('dialog', { name: 'Ascension reward' });
  await expect(reward).toContainText('Maelia can now reach level 20.');
  await expect(reward.locator('.banked-total')).toHaveText('+1 Purified Bloom');
  await expect(reward.locator('.banked-profile')).toHaveText('Purified Blooms banked in all: 1');
  await page.screenshot({ path: 'test-results/screenshots/character-page-ascended.png' });
  await reward.getByRole('button', { name: 'Collect' }).click();
  await expect(reward).toHaveCount(0);
  await expect(growth.locator('h3')).toContainText('Level 10 of 20');
  // The ascension is a step up in stats too.
  await expect(page.locator('.character-stats')).toContainText('HP156Attack21Defense39');
  await expect(growth.locator('.character-note')).toHaveText('Ascended. Spent: 1 Flesh Sac, 1,000 Ducats. Gained: 1 Purified Bloom.');
  await expect(growth.locator('.character-bank')).toContainText('3 Clear Memories');
  await expect(growth.locator('.character-bank')).toContainText('1,100 Ducats');
  await page.screenshot({ path: 'test-results/screenshots/character-page-level.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.roster-tile[aria-label="Maelia"] .roster-lv')).toHaveText('Lv 10');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(blooms(page)).toHaveText('1');

  await page.getByRole('button', { name: 'Expedition' }).click();
  await expect(page.locator('.team-preset')).toHaveCount(5);
  await page.getByRole('button', { name: 'New preset: 500 Ducats' }).click();
  await expect(page.locator('.team-preset')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Team 6' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'New preset: 750 Ducats' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/screenshots/party-buy-preset.png' });
  expect(errors).toEqual([]);
});

test('party select chooses a depth from those open, and the run fields enemies at its level (M6.4)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // A new profile: only Depth 1.
  await page.goto('/?encounters=encounter.training');
  await page.getByRole('button', { name: 'Expedition' }).click();
  const depth = page.getByRole('group', { name: 'Depth' });
  await expect(depth.getByRole('spinbutton', { name: 'Depth chosen' })).toHaveValue('1');
  await expect(depth.getByRole('button', { name: 'Deeper' })).toBeDisabled();
  await expect(depth).toContainText('The first expedition is at Depth 1.');

  // Depth 10 won: 1 to 20 open.
  const data = { pulls: 0, runs: 3, owned: [], deepest: 10 };
  const backup = JSON.stringify({ format: 'bloomdrawn-backup', saves: { profile: { format: 'bloomdrawn-save', kind: 'profile', schemaVersion: 8, contentVersion: 1, data } } });
  await page.getByRole('button', { name: 'Back' }).click();
  await importSave(page, saveFile(backup));
  await page.getByRole('button', { name: 'Expedition' }).click();
  await expect(depth).toContainText('Win Depth 20 to open 21–30.');
  await depth.getByRole('spinbutton', { name: 'Depth chosen' }).fill('25');
  await expect(depth.getByRole('spinbutton', { name: 'Depth chosen' })).toHaveValue('20');
  await depth.getByRole('button', { name: 'Shallower' }).click();
  await expect(depth).toContainText('Enemies Lv 19 · Memories and Ducats ×5.5');
  await page.screenshot({ path: 'test-results/screenshots/party-depth.png' });
  await page.getByRole('button', { name: 'Start expedition' }).click();
  await expect(page.locator('.map-depth')).toHaveText('Depth 19');
  await page.locator('[data-tile="2,0"]').click();
  await expect(page.locator('.enemy-level').first()).toHaveText('Lv 19');
  await expect(page.locator('.turn')).toContainText('Depth 19');

  // The depth chosen is kept for the next run.
  await page.reload();
  await page.getByRole('button', { name: 'New expedition' }).click();
  await page.getByRole('button', { name: 'Abandon it' }).click();
  await expect(depth.getByRole('spinbutton', { name: 'Depth chosen' })).toHaveValue('19');
  expect(errors).toEqual([]);
});
