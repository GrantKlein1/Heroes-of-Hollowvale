import { test, expect } from '@playwright/test';

test.describe('Package 1b-1: Lane D Enemies — Goblin Base & AI', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless browser environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Acceptance Criterion 2: Standing inside a goblin deals no touch damage', async ({ page }) => {
    // 1. Boot game with blend renderer and QA enabled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

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

    const initialCombat = await page.evaluate(() => (window as any).__hv.combat());
    const initialHp = initialCombat.hp;
    expect(initialHp).toBe(100);

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Spawn goblin directly inside / on top of the player's position
    // Keep goblin on long attack cooldown so it doesn't swing; we are verifying touch/contact damage!
    await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        const e = scene.spawn('goblin', x, y);
        if (e) {
          e.attackCooldownUntil = performance.now() + 60000;
          if (e.body?.setVelocity) e.body.setVelocity(0, 0);
        }
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Wait 500 ms while standing directly inside the goblin's body
    await page.waitForTimeout(500);

    const hpAfterStandingInside = await page.evaluate(() => (window as any).__hv.combat().hp);
    // Contact damage must be completely removed: 0 damage dealt!
    expect(hpAfterStandingInside, 'Standing inside a goblin must deal 0 damage').toBe(100);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/goblin-no-touch-damage.png' });
  });

  test('Acceptance Criterion 3: Goblin plays telegraph then attack (anim keys logged)', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

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

    const debugInfo = await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        const e = scene.spawn('goblin', x + 28, y);
        return {
          sceneExists: Boolean(scene),
          enemySpawned: Boolean(e),
          enemyType: e?.enemyType,
          isEnemyInstance: e?.isEnemy,
          enemyX: e?.x,
          enemyY: e?.y,
          playerX: scene?.player?.x,
          playerY: scene?.player?.y,
          animsExists: typeof scene?.anims?.exists === 'function',
          goblinTelegraphExists: scene?.anims?.exists?.('goblin_telegraph_down'),
          goblinAttackExists: scene?.anims?.exists?.('goblin_attack_down'),
        };
      },
      { x: playerPos.x, y: playerPos.y }
    );
    console.log('[DEBUG INFO]', debugInfo);

    // Wait for goblin to trigger telegraph animation
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        const enemies = scene?.enemies?.getChildren?.() || [];
        const goblin = enemies.find((e: any) => e.enemyType === 'goblin');
        return goblin?.animHistory?.some((k: string) => k.includes('telegraph'));
      },
      null,
      { timeout: 5000 }
    );

    // Wait for goblin to transition from telegraph to attack animation
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        const enemies = scene?.enemies?.getChildren?.() || [];
        const goblin = enemies.find((e: any) => e.enemyType === 'goblin');
        return goblin?.animHistory?.some((k: string) => k.includes('attack'));
      },
      null,
      { timeout: 5000 }
    );

    const history = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      const goblin = enemies.find((e: any) => e.enemyType === 'goblin');
      return goblin?.animHistory || [];
    });

    const telegraphIndex = history.findIndex((k: string) => k.includes('telegraph'));
    const attackIndex = history.findIndex((k: string) => k.includes('attack'));

    expect(telegraphIndex, 'Telegraph anim must be present in history').toBeGreaterThanOrEqual(0);
    expect(attackIndex, 'Attack anim must be present in history').toBeGreaterThanOrEqual(0);
    expect(telegraphIndex, 'Telegraph anim must precede attack anim').toBeLessThan(attackIndex);

    // Verify anim keys were logged to console
    const hasTelegraphLog = consoleLogs.some((l) => l.includes('[Enemy anim]') && l.includes('telegraph'));
    const hasAttackLog = consoleLogs.some((l) => l.includes('[Enemy anim]') && l.includes('attack'));
    expect(hasTelegraphLog, 'Console should log goblin telegraph animation').toBe(true);
    expect(hasAttackLog, 'Console should log goblin attack animation').toBe(true);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/goblin-telegraph-attack.png' });
  });

  test('Acceptance Criterion 1: 3 goblins, never more than 2 attacking at once (attack tokens)', async ({ page }) => {
    await page.goto('/?renderer=blend&seed=42&qa=1');

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

    // Spawn 3 goblins clustered around the player (all within 30 px attack proximity)
    await page.evaluate(
      ({ px, py }) => {
        const scene = (window as any).__scene;
        scene.spawn('goblin', px + 25, py);
        scene.spawn('goblin', px - 25, py);
        scene.spawn('goblin', px, py + 25);
      },
      { px: playerPos.x, py: playerPos.y }
    );

    // Sample attack token count and concurrent attacking goblins over 1500 ms
    let maxSimultaneousAttacking = 0;
    let maxTokensHeld = 0;

    for (let i = 0; i < 20; i++) {
      const stats = await page.evaluate(() => {
        const scene = (window as any).__scene;
        const enemies = scene?.enemies?.getChildren?.() || [];
        const goblins = enemies.filter((e: any) => e.enemyType === 'goblin');
        const attackingCount = goblins.filter((g: any) => g.isAttacking).length;
        const tokenCount = scene.attackTokenManager?.count || 0;
        return { attackingCount, tokenCount };
      });

      if (stats.attackingCount > maxSimultaneousAttacking) {
        maxSimultaneousAttacking = stats.attackingCount;
      }
      if (stats.tokenCount > maxTokensHeld) {
        maxTokensHeld = stats.tokenCount;
      }

      await page.waitForTimeout(75);
    }

    // Acceptance criterion 1: never more than 2 attacking at once
    expect(maxSimultaneousAttacking, 'Never more than 2 goblins attacking at once').toBeLessThanOrEqual(2);
    expect(maxTokensHeld, 'Token manager never exceeds max capacity of 2').toBeLessThanOrEqual(2);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/3-goblins-max-2-tokens.png' });
  });
});
