import { test, expect } from '@playwright/test';

test.describe('Heroes of Hollowvale — Dodge & Block Mechanics (Package 1-6)', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('3. __hv.missingAssets() is empty for P0/P1 clips', async ({ page }) => {
    // Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    // Wait for __hv API
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.missingAssets === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const missing = await page.evaluate(() => (window as any).__hv.missingAssets());
    expect(missing).toEqual([]);
  });

  test('1. Dodging through a goblin swing takes 0 damage', async ({ page }) => {
    // 1. Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.dodge === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // Ensure player is at full HP
    const initialCombat = await page.evaluate(() => (window as any).__hv.combat());
    const initialHp = initialCombat.hp;
    expect(initialHp).toBe(100);

    // Set facing right
    await page.evaluate(() => {
      const p = (window as any).__scene.player;
      p.setFacing('right');
    });

    await page.waitForFunction(() => (window as any).__hv?.anim?.() === 'knight_idle_right');

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Trigger dodge roll
    const dodgeTriggered = await page.evaluate(() => (window as any).__hv.dodge());
    expect(dodgeTriggered).toBe(true);

    // Wait until animation enters dodge active frames (iFrames: [1, 4])
    await page.waitForFunction(() => {
      const anim = (window as any).__hv?.anim?.();
      const p = (window as any).__scene?.player;
      const frame = p?.anims?.currentFrame?.index;
      return anim && anim.includes('dodge') && frame >= 2 && frame <= 5;
    });

    // While dodging (frame inside i-frames), goblin swings at player
    const tookDamageDuringDodge = await page.evaluate(({ px, py }) => {
      const scene = (window as any).__scene;
      return scene.player.takeDamage(15, performance.now(), { fromX: px + 40, fromY: py });
    }, { px: playerPos.x, py: playerPos.y });

    // Dodge I-frame protection returns false (0 damage taken)
    expect(tookDamageDuringDodge).toBe(false);

    const afterCombat = await page.evaluate(() => (window as any).__hv.combat());
    expect(afterCombat.hp).toBe(initialHp); // Still 100 HP!
  });

  test('2. Knight block from the front reduces damage by 70%; from behind it does not', async ({ page }) => {
    // 1. Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.block === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // Set facing right
    await page.evaluate(() => {
      const p = (window as any).__scene.player;
      p.setFacing('right');
    });

    await page.waitForFunction(() => (window as any).__hv?.anim?.() === 'knight_idle_right');

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // 2. Raise shield (BLOCK state)
    const blockTriggered = await page.evaluate(() => (window as any).__hv.block());
    expect(blockTriggered).toBe(true);

    await page.waitForFunction(() => {
      const anim = (window as any).__hv?.anim?.();
      return anim && anim.includes('block');
    });

    // 3. Attack arrives from FRONT (to the right of the knight)
    const frontHitResult = await page.evaluate(({ px, py }) => {
      const scene = (window as any).__scene;
      scene._hurtPlayer(10, { fromX: px + 50, fromY: py });
      return {
        hp: scene.hp,
        lastDamage: scene.player.lastDamageTaken,
        anim: (window as any).__hv.anim(),
      };
    }, { px: playerPos.x, py: playerPos.y });

    // Frontal attack: 10 raw damage reduced by 70% -> only 3 damage taken!
    expect(frontHitResult.lastDamage).toBe(3);
    expect(frontHitResult.hp).toBe(97); // 100 - 3 = 97
    expect(frontHitResult.anim).toContain('block_hit');

    // 4. Attack arrives from BEHIND (to the left of the knight)
    // Clear hurt i-frame
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.invulnerableUntil = 0;
      scene._iframeUntil = 0;
    });

    const rearHitResult = await page.evaluate(({ px, py }) => {
      const scene = (window as any).__scene;
      scene._hurtPlayer(10, { fromX: px - 50, fromY: py });
      return {
        hp: scene.hp,
        lastDamage: scene.player.lastDamageTaken,
        anim: (window as any).__hv.anim(),
      };
    }, { px: playerPos.x, py: playerPos.y });

    // Rear attack: 0% reduction -> takes full 10 damage!
    expect(rearHitResult.lastDamage).toBe(10);
    expect(rearHitResult.hp).toBe(87); // 97 - 10 = 87
    expect(rearHitResult.anim).toContain('hurt');

    await page.evaluate(() => (window as any).__hv.unblock());
  });
});
