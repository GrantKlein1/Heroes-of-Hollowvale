import { test, expect } from '@playwright/test';
import { ANIM_TIMEOUT, previewClass, waitForScene } from './helpers/waits';
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = path.resolve(process.cwd(), 'docs/playtest/dwarf');

type SwingSample = {
  anim: string | null;
  facing: string | null;
  classId: string | null;
  attackType: string | null;
  state: string | null;
  texture: string | null;
  frame: string | null;
  x: number | null;
  y: number | null;
};

async function sample(page: import('@playwright/test').Page): Promise<SwingSample> {
  return page.evaluate(() => {
    const scene = (window as any).__scene;
    const player = scene?.player;
    const frame = player?.anims?.currentFrame;
    return {
      anim: (window as any).__hv?.anim?.() ?? null,
      facing: (window as any).__hv?.facing?.() ?? null,
      classId: player?.classId ?? null,
      attackType: player?.currentAttackType ?? null,
      state: player?.stateMachine?.state ?? null,
      texture: player?.texture?.key ?? null,
      frame: frame?.textureFrame ?? frame?.frame?.name ?? player?.frame?.name ?? null,
      x: typeof player?.x === 'number' ? player.x : null,
      y: typeof player?.y === 'number' ? player.y : null,
    };
  });
}

test('dwarf walks Brackenford and swings the axe', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const notFoundResponses: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') consoleErrors.push(text);
    if (msg.type() === 'warning') consoleWarnings.push(text);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() === 404) notFoundResponses.push(res.url());
  });

  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  });

  await page.goto('/?qa=1&seed=1');

  const startButton = page.getByRole('button', { name: 'Start Game' });
  await expect(startButton).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '01-title.png') });
  await startButton.click();

  const chooseHeading = page.getByText('Choose Your Class');
  await expect(chooseHeading).toBeVisible();
  const chooseButtons = page.getByRole('button', { name: 'Choose' });
  await expect(chooseButtons).toHaveCount(4);
  // Redesigned class screen: hovering a Choose button previews that class in the detail panel.
  await expect(chooseButtons.nth(3)).toHaveText('Choose Dwarf');
  await previewClass(page, chooseButtons.nth(3), 'Dwarf');
  await page.screenshot({ path: path.join(SHOT_DIR, '02-class-select.png') });

  // Fourth Choose is the dwarf (knight, mage, thief, dwarf).
  await chooseButtons.nth(3).click();
  await expect(chooseHeading).toBeHidden();

  await waitForScene(page, 'village');
  await page.waitForFunction(() => (window as any).__scene?.player?.classId === 'dwarf');

  const idle = await sample(page);
  expect(idle.classId).toBe('dwarf');
  expect(idle.anim).toBe('dwarf_idle_down');
  await page.screenshot({ path: path.join(SHOT_DIR, '03-brackenford-idle.png') });

  const canvas = page.locator('canvas');
  await canvas.click();

  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(150);

  const afterWalk = await sample(page);
  expect(afterWalk.classId).toBe('dwarf');
  expect(afterWalk.y).not.toBeNull();
  expect(idle.y).not.toBeNull();
  expect(afterWalk.y!).toBeLessThan(idle.y!);
  await page.screenshot({ path: path.join(SHOT_DIR, '04-brackenford-walk.png') });

  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const frame = (window as any).__scene?.player?.anims?.currentFrame?.textureFrame || '';
    return frame === 'dwarf_attack_up_3';
  }, null, { timeout: ANIM_TIMEOUT });
  const swing = await sample(page);
  await page.screenshot({ path: path.join(SHOT_DIR, '05-axe-swing.png') });

  await page.waitForFunction(() => {
    const anim = (window as any).__hv?.anim?.() || '';
    return anim.startsWith('dwarf_idle');
  }, null, { timeout: ANIM_TIMEOUT });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const frame = (window as any).__scene?.player?.anims?.currentFrame?.textureFrame || '';
    return frame === 'dwarf_attack_right_3';
  }, null, { timeout: ANIM_TIMEOUT });
  const secondSwing = await sample(page);
  await page.screenshot({ path: path.join(SHOT_DIR, '06-axe-swing-facing-right.png') });

  const observation = {
    route: '/?qa=1&seed=1',
    idle,
    afterWalk,
    swing,
    secondSwing,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    notFoundResponses,
  };
  console.log(`PT-D observation ${JSON.stringify(observation)}`);

  expect(swing.classId).toBe('dwarf');
  expect(secondSwing.classId).toBe('dwarf');
  expect(swing.anim).toContain('dwarf_attack');
  expect(secondSwing.anim).toContain('dwarf_attack');
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
