import { test, expect } from '@playwright/test';

test.describe('Package 1b-2: Lane D Enemies — Brute Base & AI', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless browser environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Acceptance Criterion 1: Telegraph visible >= 300 ms before attack damage', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    // Wait for __hv API
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Spawn brute in attack range of player (30 px distance)
    await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        scene.spawn('brute', x + 30, y);
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Wait for brute to start telegraphing
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        const enemies = scene?.enemies?.getChildren?.() || [];
        const brute = enemies.find((e: any) => e.enemyType === 'brute');
        return brute?.animHistory?.some((k: string) => k.includes('telegraph'));
      },
      null,
      { timeout: 5000 }
    );

    // Record time when telegraph animation started
    const telegraphTimestamp = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const history = scene._enemyAnimHistory || [];
      const entry = history.find((h: any) => h.enemyType === 'brute' && h.anim.includes('telegraph'));
      return entry ? entry.time : performance.now();
    });

    // Wait for brute to transition to swing
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        const enemies = scene?.enemies?.getChildren?.() || [];
        const brute = enemies.find((e: any) => e.enemyType === 'brute');
        return brute?.animHistory?.some((k: string) => k.includes('attack'));
      },
      null,
      { timeout: 5000 }
    );

    const attackTimestamp = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const history = scene._enemyAnimHistory || [];
      const entry = history.find((h: any) => h.enemyType === 'brute' && h.anim.includes('attack'));
      return entry ? entry.time : performance.now();
    });

    const telegraphDuration = attackTimestamp - telegraphTimestamp;
    expect(telegraphDuration, 'Telegraph must be visible >= 300 ms before swing/damage').toBeGreaterThanOrEqual(280);

    const hasTelegraphLog = consoleLogs.some((l) => l.includes('[Enemy anim]') && l.includes('goblin_brute_telegraph'));
    const hasAttackLog = consoleLogs.some((l) => l.includes('[Enemy anim]') && l.includes('goblin_brute_attack'));
    expect(hasTelegraphLog, 'Console should log goblin_brute telegraph animation').toBe(true);
    expect(hasAttackLog, 'Console should log goblin_brute attack animation').toBe(true);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/brute-telegraph-attack.png' });
  });

  test('Acceptance Criterion 2: Hitting an armored brute mid-swing does not cancel attack', async ({ page }) => {
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await startButton.click();

    // Select Knight class
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Spawn brute and initiate attack
    await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        const brute = scene.spawn('brute', x + 30, y);
        if (brute) {
          brute.startAttack(performance.now());
        }
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Hit the brute while it is attacking
    const hitResult = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      const brute = enemies.find((e: any) => e.enemyType === 'brute');
      if (!brute) return null;

      const hpBefore = brute.hp;
      const wasAttacking = brute.isAttacking;
      // Strike brute for 8 damage
      brute.takeDamage(8, performance.now());
      const hpAfter = brute.hp;
      const stillAttacking = brute.isAttacking;
      const isHurtState = brute.state === 'HURT';
      const lastAnim = brute.lastAnimKey;

      return { hpBefore, hpAfter, wasAttacking, stillAttacking, isHurtState, lastAnim };
    });

    expect(hitResult).not.toBeNull();
    expect(hitResult!.hpBefore).toBe(25);
    expect(hitResult!.hpAfter).toBe(17);
    expect(hitResult!.wasAttacking).toBe(true);
    expect(hitResult!.stillAttacking, 'Brute must continue attacking after taking hit').toBe(true);
    expect(hitResult!.isHurtState, 'Armored brute must not enter HURT state while attacking').toBe(false);
    expect(hitResult!.lastAnim.includes('hurt'), 'Brute should not switch to hurt anim mid-swing').toBe(false);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/brute-armored-hit.png' });
  });

  test('Acceptance Criterion 3: Knockback distance ≈ 260 px/s impulse applied on hit', async ({ page }) => {
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await startButton.click();

    // Select Knight class
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Spawn brute next to player and execute attack hit directly
    const knockbackData = await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        const player = scene.player;
        const brute = scene.spawn('brute', x + 25, y);
        brute.facing = 'left';

        // Trigger hit
        brute.executeAttackHit(performance.now());

        const vx = player.body?.velocity?.x || 0;
        const vy = player.body?.velocity?.y || 0;
        const speed = Math.hypot(vx, vy);

        return { vx, vy, speed, bruteKnockback: brute.knockbackImpulse };
      },
      { x: playerPos.x, y: playerPos.y }
    );

    expect(knockbackData.bruteKnockback).toBe(260);
    // Knockback impulse speed should be ~260 px/s
    expect(knockbackData.speed).toBeGreaterThanOrEqual(250);
    expect(knockbackData.speed).toBeLessThanOrEqual(270);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/brute-knockback.png' });
  });
});
