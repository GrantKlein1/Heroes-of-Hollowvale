import { test, expect } from '@playwright/test';

test.describe('Heroes of Hollowvale — Hit System & Combat Feedback (Package 1-4)', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Knight melee attack: damage occurs on hitFrame (~250-275 ms), not instantly', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    // 1. Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 2. Select Knight class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    // 3. Wait for scene and __hv API to be ready
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // Ensure player is in initial idle state
    await page.waitForFunction(
      () => (window as any).__hv.anim() === 'knight_idle_down',
      null,
      { timeout: 5000 }
    );

    // 4. Face right via movement step
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () => (window as any).__hv.anim() === 'knight_walk_right',
      null,
      { timeout: 5000 }
    );
    await page.keyboard.up('ArrowRight');
    await page.waitForFunction(
      () => (window as any).__hv.anim() === 'knight_idle_right',
      null,
      { timeout: 5000 }
    );

    // 5. Spawn goblin enemy in front of the knight
    const playerPos = await page.evaluate(() => (window as any).__hv.player());
    expect(playerPos).toBeDefined();

    // Position goblin in front of knight's sword swing (facing right)
    // Keep goblin stationary as a combat dummy (speed = 0) so it doesn't walk into the player
    const targetX = playerPos.x + 70;
    const targetY = playerPos.y - 90;

    await page.evaluate(
      ({ x, y }) => {
        const e = (window as any).__hv.spawn('goblin', x, y);
        if (e) {
          e.speed = 0;
          if (e.body?.setVelocity) e.body.setVelocity(0, 0);
        }
      },
      { x: targetX, y: targetY }
    );

    // Verify goblin spawned with initial HP 15
    const combatBefore = await page.evaluate(() => (window as any).__hv.combat());
    expect(combatBefore.enemies.length).toBeGreaterThanOrEqual(1);
    const goblinBefore = combatBefore.enemies[0];
    expect(goblinBefore.hp).toBe(15);

    // 6. Set timeScale to 0.25 to accurately inspect pre-hitFrame vs post-hitFrame timing
    await page.evaluate(() => {
      (window as any).__hv.timeScale(0.25);
    });

    // Press attack (Space)
    await page.keyboard.press('Space');

    // Immediately after press (within ~50-100 ms real time / ~15-25 ms game time):
    // Player enters attack animation, but goblin HP MUST NOT drop instantly!
    const animKey = await page.evaluate(() => (window as any).__hv.anim());
    expect(animKey).toBe('knight_attack_right');

    const goblinImmediate = await page.evaluate(() => {
      const c = (window as any).__hv.combat();
      return c.enemies[0]?.hp;
    });
    // Acceptance criterion 1: goblin HP does NOT drop instantly
    expect(goblinImmediate, 'Goblin HP should not drop instantly on attack start').toBe(15);

    // In game time, hitFrame 3 at 11 fps occurs at 272.7 ms.
    // At timeScale 0.25, 273 ms game time = ~1090 ms wall clock time.
    // At ~400 ms wall clock time (~100 ms game time): still frame 1, goblin still alive at 15 HP!
    await page.waitForTimeout(400);
    const goblinMidway = await page.evaluate(() => {
      const c = (window as any).__hv.combat();
      return c.enemies[0]?.hp;
    });
    expect(goblinMidway, 'Goblin HP should still be 15 before hitFrame 3').toBe(15);

    // Advance to post-hitFrame (wait until hitFrame 3 triggers damage)
    // Restore timeScale to 1 to complete the hit
    await page.evaluate(() => {
      (window as any).__hv.timeScale(1.0);
    });

    await page.waitForFunction(
      () => {
        const c = (window as any).__hv.combat();
        return c.enemies[0]?.hp <= 3;
      },
      null,
      { timeout: 5000 }
    );

    const goblinAfter = await page.evaluate(() => {
      const c = (window as any).__hv.combat();
      return c.enemies[0]?.hp;
    });
    expect(goblinAfter, 'Goblin HP should drop to 3 after knight attack hitFrame').toBe(3);

    // Acceptance criterion 3: hit_spark anim plays on hit (__hv shows the key)
    const lastFx = await page.evaluate(() => {
      return typeof (window as any).__hv.lastFx === 'function'
        ? (window as any).__hv.lastFx()
        : (window as any).__scene?._lastFx;
    });
    expect(lastFx).toBe('fx_common_hit_spark');

    // Capture visual screenshot of the combat result
    await page.screenshot({ path: 'tests/e2e/__screenshots__/hit-system-knight-hit.png' });

    expect(consoleErrors).toEqual([]);
  });

  test('Player I-Frames: No second player hit within 600 ms', async ({ page }) => {
    // 1. Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await startButton.click();

    // Choose Knight
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const initialHp = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(initialHp).toBe(100);

    // First hit: deals 10 damage
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterFirst = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(hpAfterFirst).toBe(90);

    // Second hit 200 ms later (< 600 ms window): must be blocked by I-frames!
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterSecond = await page.evaluate(() => (window as any).__hv.combat().hp);
    // Acceptance criterion 2: No second player hit within 600 ms
    expect(hpAfterSecond, 'Second hit within 600 ms must deal zero damage').toBe(90);

    // Wait until 600 ms I-frame expires (total > 650 ms)
    await page.waitForTimeout(500);

    // Third hit after I-frame expiration: deals damage
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterThird = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(hpAfterThird, 'Hit after 600 ms I-frame window must deal damage').toBe(80);
  });
});

