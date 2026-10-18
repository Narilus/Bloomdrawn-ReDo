import { expect, test } from '@playwright/test';

interface ActorSnapshot {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  recoilX: number;
}

test('after 20 rapid plays every actor settles back at its home point', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hand-card')).toHaveCount(5);
  const mana = page.locator('.mana strong');

  // Number key + Enter as fast as possible; End Turn whenever a play doesn't go through.
  let plays = 0;
  while (plays < 20) {
    const before = Number(await mana.textContent());
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    if (Number(await mana.textContent()) < before) plays++;
    else await page.keyboard.press('e');
  }

  await page.waitForTimeout(1500);
  const actors = await page.evaluate(
    () => (window as unknown as { __bloomdrawn: { actors: () => ActorSnapshot[] } }).__bloomdrawn.actors(),
  );
  expect(actors).toHaveLength(7);
  for (const a of actors) {
    expect.soft(Math.abs(a.x - a.homeX), `${a.id} x`).toBeLessThan(0.5);
    expect.soft(Math.abs(a.y - a.homeY), `${a.id} y`).toBeLessThan(0.5);
    expect.soft(Math.abs(a.recoilX), `${a.id} recoil`).toBeLessThan(0.5);
  }
});
