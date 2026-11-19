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
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');

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
    // Feet-space reach (right): { x: -16, y: -24, w: 56, h: 48 } at player.x/y.
    // Goblin feet at player feet + (35, -15) sits inside that reach vs goblin hurtbox
    // (same offset as attack-combat-regression / full-flow combo tests).
    const goblinFeet = await page.evaluate(() => {
      const p = (window as any).__scene.player;
      return { x: p.x + 35, y: p.y - 15 };
    });
    expect(goblinFeet).toBeDefined();

    await page.evaluate(
      ({ x, y }) => {
        const e = (window as any).__hv.spawn('goblin', x, y);
        if (e) {
          e.speed = 0;
          if (e.body?.setVelocity) e.body.setVelocity(0, 0);
        }
      },
      goblinFeet
    );

    // Verify goblin spawned at the first-wave health from combat/balance.js
    const combatBefore = await page.evaluate(() => (window as any).__hv.combat());
    expect(combatBefore.enemies.length).toBeGreaterThanOrEqual(1);
    const goblinBefore = combatBefore.enemies[0];
    const startHp = goblinBefore.hp;
    expect(startHp).toBe(36);

    // 6. Slow the attack clip so the pre-hitFrame sample stays on frame 1.
    // __hv.timeScale only scales the scene clock. The swing advances on anim timeScale.
    await page.evaluate(() => {
      (window as any).__hv.timeScale(0.25);
      const player = (window as any).__scene?.player;
      if (player?.anims) player.anims.timeScale = 0.25;
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
    expect(goblinImmediate, 'Goblin HP should not drop instantly on attack start').toBe(startHp);

    // In game time, hitFrame 3 at 11 fps occurs at 272.7 ms.
    // At timeScale 0.25, 273 ms game time = ~1090 ms wall clock time.
    // At ~400 ms wall clock time (~100 ms game time): still frame 1, goblin still at full HP.
    await page.waitForTimeout(400);
    const goblinMidway = await page.evaluate(() => {
      const c = (window as any).__hv.combat();
      return c.enemies[0]?.hp;
    });
    expect(goblinMidway, 'Goblin HP should still be full before hitFrame 3').toBe(startHp);

    // Advance to post-hitFrame (wait until hitFrame 3 triggers damage)
    // Restore timeScale to 1 to complete the hit
    await page.evaluate(() => {
      (window as any).__hv.timeScale(1.0);
      const player = (window as any).__scene?.player;
      if (player?.anims) player.anims.timeScale = 1;
    });

    await page.waitForFunction(
      (hp) => {
        const c = (window as any).__hv.combat();
        return c.enemies[0]?.hp < hp;
      },
      startHp,
      { timeout: 5000 }
    );

    const goblinAfter = await page.evaluate(() => {
      const c = (window as any).__hv.combat();
      return c.enemies[0]?.hp;
    });
    expect(goblinAfter, 'Goblin HP should drop by one sword hit after hitFrame').toBe(startHp - 12);

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
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');

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
    expect(initialHp).toBe(120);

    // First hit: deals 10 damage
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterFirst = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(hpAfterFirst).toBe(110);

    // Second hit 200 ms later (< 600 ms window): must be blocked by I-frames!
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterSecond = await page.evaluate(() => (window as any).__hv.combat().hp);
    // Acceptance criterion 2: No second player hit within 600 ms
    expect(hpAfterSecond, 'Second hit within 600 ms must deal zero damage').toBe(110);

    // Wait until 600 ms I-frame expires (total > 650 ms)
    await page.waitForTimeout(500);

    // Third hit after I-frame expiration: deals damage
    await page.evaluate(() => {
      (window as any).__scene._hurtPlayer(10);
    });

    const hpAfterThird = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(hpAfterThird, 'Hit after 600 ms I-frame window must deal damage').toBe(100);
  });
});

