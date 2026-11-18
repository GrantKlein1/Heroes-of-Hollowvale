import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const NEW_ENEMIES = [
  { id: 'shadowfang_wolf', name: 'Shadowfang Wolf' },
  { id: 'ashen_cultist', name: 'Ashen Cultist' },
  { id: 'ashen_revenant', name: 'Ashen Revenant' },
] as const;

const NEW_ITEMS = [
  { id: 'nightfang_dagger', name: 'Nightfang Dagger' },
  { id: 'stonehollow_hammer', name: 'Stonehollow Hammer' },
  { id: 'healing_charm', name: 'Healing Charm' },
  { id: 'seranyas_tear', name: "Amulet of Seranya's Tear" },
  { id: 'ember_chalice', name: 'The Embered Flagon Chalice' },
] as const;

async function openFieldGuide(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  });
  await page.goto('/?seed=1&qa=1');
  await expect(page.locator('canvas')).toBeVisible();
  const openGuide = page.getByRole('button', { name: 'Field Guide' }).first();
  await expect(openGuide).toBeVisible();
  await openGuide.click();
  await expect(page.getByTestId('field-guide')).toBeVisible();
}

function maybeShotDir() {
  const dir = process.env.FIELDGUIDE_SHOTS;
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test.describe('Field Guide', () => {
  test('opens from the title screen and lists the new enemies and items', async ({ page }) => {
    await openFieldGuide(page);

    await page.getByTestId('field-guide-tab-enemies').click();
    await expect(page.getByTestId('field-guide-note')).toBeVisible();

    for (const foe of NEW_ENEMIES) {
      const button = page.getByTestId(`field-guide-entry-${foe.id}`);
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-label', foe.name);
    }

    await page.getByTestId('field-guide-entry-shadowfang_wolf').click();
    const enemyDetail = page.getByTestId('field-guide-detail');
    await expect(enemyDetail.getByRole('heading', { name: 'Shadowfang Wolf' })).toBeVisible();
    await expect(enemyDetail).toContainText('Moves like smoke');
    await expect(enemyDetail).toContainText('health');

    const shotDir = maybeShotDir();
    if (shotDir) {
      await page.locator('[data-testid="field-guide"] [role="dialog"]').screenshot({
        path: path.join(shotDir, 'field-guide-shadowfang-wolf.png'),
      });
    }

    await page.getByTestId('field-guide-tab-items').click();
    for (const item of NEW_ITEMS) {
      const button = page.getByTestId(`field-guide-entry-${item.id}`);
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-label', item.name);
    }

    await page.getByTestId('field-guide-entry-nightfang_dagger').click();
    const itemDetail = page.getByTestId('field-guide-detail');
    await expect(itemDetail.getByRole('heading', { name: 'Nightfang Dagger' })).toBeVisible();
    await expect(itemDetail).toContainText('dragon’s tooth');
    await expect(itemDetail).toContainText('Strike');

    if (shotDir) {
      await page.locator('[data-testid="field-guide"] [role="dialog"]').screenshot({
        path: path.join(shotDir, 'field-guide-nightfang-dagger.png'),
      });
    }
  });
});
