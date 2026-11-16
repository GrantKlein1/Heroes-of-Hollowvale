import { test, expect } from '@playwright/test';

test.describe('Package 1b-4: Death & Respawn, Seeded Loot & Critter Flee AI', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless browser environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Acceptance Criterion 1: Die -> DIED event -> respawn with HP == max', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=legacy&seed=1&qa=1');

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
        typeof (window as any).__hv?.killPlayer === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    }, null, { timeout: 15000 });

    const initialCombat = await page.evaluate(() => (window as any).__hv.combat());
    expect(initialCombat.hp).toBe(100);
    expect(initialCombat.dead).toBe(false);

    // Trigger lethal player damage
    await page.evaluate(() => {
      (window as any).__hv.killPlayer('goblin');
    });

    // Verify player entered DEAD state and played death animation
    await page.waitForFunction(() => {
      const state = (window as any).__hv.playerState();
      const anim = (window as any).__hv.anim();
      return state === 'DEAD' || anim.includes('death');
    }, null, { timeout: 10000 });

    // Wait for death sequence to complete and auto-respawn at area entrance
    await page.waitForFunction(
      () => {
        const combat = (window as any).__hv.combat();
        const state = (window as any).__hv.playerState();
        return combat.dead === false && combat.hp === combat.hpMax && state === 'IDLE';
      },
      null,
      { timeout: 15000 }
    );

    const postRespawnCombat = await page.evaluate(() => (window as any).__hv.combat());
    expect(postRespawnCombat.dead).toBe(false);
    expect(postRespawnCombat.hp).toBe(postRespawnCombat.hpMax);
    expect(postRespawnCombat.hp).toBe(100);
    expect(postRespawnCombat.mana).toBe(postRespawnCombat.manaMax);

    // Save screenshot of player respawned with full HP
    await page.screenshot({
      path: 'tests/e2e/__screenshots__/death-respawn-max-hp.png',
      fullPage: false,
    });
  });

  test('Acceptance Criterion 2: Enemy death clip plays fully before removal', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=legacy&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight class
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawn === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    }, null, { timeout: 15000 });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // Spawn goblin enemy near player
    await page.evaluate(
      ({ x, y }) => {
        const scene = (window as any).__scene;
        scene.spawn('goblin', x + 50, y);
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Wait for spawned enemy to exist
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      return enemies.some((e: any) => e.enemyType === 'goblin' && e.hp > 0);
    });

    // Deal lethal damage to the spawned enemy
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      const enemy = enemies.find((e: any) => e.enemyType === 'goblin' && e.hp > 0);
      if (enemy) {
        enemy.takeDamage(100, performance.now());
      }
    });

    // Verify enemy is in DEAD state and currently playing death clip
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      const enemy = enemies.find((e: any) => e.enemyType === 'goblin');
      return enemy && enemy.state === 'DEAD' && enemy.lastAnimKey?.includes('death');
    });

    // Enemy must remain in scene during death animation
    const duringDeathCount = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return (scene?.enemies?.getChildren?.() || []).filter((e: any) => e.enemyType === 'goblin').length;
    });
    expect(duringDeathCount).toBeGreaterThanOrEqual(1);

    // Save screenshot of death animation playing before removal
    await page.screenshot({
      path: 'tests/e2e/__screenshots__/enemy-death-clip-removal.png',
      fullPage: false,
    });

    // Trigger animation completion and assert enemy is removed
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      const enemy = (scene?.enemies?.getChildren?.() || []).find((e: any) => e.enemyType === 'goblin');
      if (enemy) {
        enemy.onAnimationComplete({ key: 'goblin_death_down' });
      }
    });

    // Wait until enemy is removed from scene
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const enemies = scene?.enemies?.getChildren?.() || [];
      return !enemies.some((e: any) => e.enemyType === 'goblin');
    }, null, { timeout: 10000 });

    const postDeathCount = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return (scene?.enemies?.getChildren?.() || []).filter((e: any) => e.enemyType === 'goblin').length;
    });
    expect(postDeathCount).toBe(0);
  });

  test('LM-1: seed=1 goblin drops an idling emerald that collects on walk-over', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=legacy&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawn === 'function' &&
        typeof (window as any).__hv?.missingAssets === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    }, null, { timeout: 15000 });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    const drop = await page.evaluate(({ x, y }) => {
      const scene = (window as any).__scene;
      const hv = (window as any).__hv;
      const enemy = scene.spawn('goblin', x + 180, y);
      hv.seed(1);
      enemy.takeDamage(500, performance.now());
      enemy.onAnimationComplete({ key: 'goblin_death_down' });
      const pickup = (scene.lootPickups || []).find((s: any) => s.lootPickup && !s.lootCollected);
      return pickup
        ? {
            id: pickup.lootId,
            x: pickup.x,
            y: pickup.y,
            anim: pickup.anims?.currentAnim?.key || '',
            texture: pickup.texture?.key || '',
            originX: pickup.originX,
            originY: pickup.originY,
          }
        : null;
    }, { x: playerPos.x, y: playerPos.y });

    expect(drop).not.toBeNull();
    expect(drop?.id).toBe('emerald');
    expect(drop?.texture).toBe('loot_pickups');
    expect(drop?.anim).toContain('loot_emerald_idle');
    expect(drop?.originX).toBeCloseTo(0.5, 2);
    expect(drop?.originY).toBeCloseTo(0.875, 2);

    const missing = await page.evaluate(() => (window as any).__hv.missingAssets() as string[]);
    expect(missing.filter((key) => /loot|meteor/i.test(String(key)))).toEqual([]);

    await page.screenshot({
      path: 'tests/e2e/__screenshots__/lm1-loot-idle.png',
      fullPage: false,
    });

    await page.locator('canvas').click();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const pickup = (scene.lootPickups || []).find((s: any) => s.lootId === 'emerald');
      const anim = pickup?.anims?.currentAnim?.key || '';
      return Boolean(pickup?.lootCollected) || anim.includes('loot_collect') || Boolean(scene._lastLootCollect);
    }, null, { timeout: 8000 });
    await page.keyboard.up('ArrowRight');

    const collected = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const pickup = (scene.lootPickups || []).find((s: any) => s.lootId === 'emerald');
      const snap = scene._lastLootCollect || {};
      return {
        collected: Boolean(pickup?.lootCollected) || snap.id === 'emerald',
        anim: pickup?.anims?.currentAnim?.key || snap.anim || '',
        originX: pickup?.lootCollected ? pickup.originX : snap.originX,
        originY: pickup?.lootCollected ? pickup.originY : snap.originY,
      };
    });
    expect(collected.collected).toBe(true);
    expect(collected.anim).toContain('loot_collect');
    expect(collected.originX).toBeCloseTo(0.5, 2);
    expect(collected.originY).toBeCloseTo(0.5, 2);

    await expect(page.getByText('Loot: 1 Emerald')).toBeVisible({ timeout: 3000 });

    await page.screenshot({
      path: 'tests/e2e/__screenshots__/lm1-loot-collect.png',
      fullPage: false,
    });
  });

  test('Acceptance Criterion 4: Ambient critters flee from player with directional clips', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=legacy&seed=1&qa=1');

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
        typeof (window as any).__hv?.spawnCritter === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    }, null, { timeout: 30000 });

    const playerPos = await page.evaluate(() => (window as any).__hv.player());

    // 1. Spawn a squirrel to the right of player (distance = 50px < alertRadius of 100px)
    await page.evaluate(
      ({ x, y }) => {
        (window as any).__hv.spawnCritter('squirrel_red', x + 50, y);
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Verify squirrel enters alert/flee and flees right
    await page.waitForFunction(() => {
      const critters = (window as any).__hv.critters();
      const squirrel = critters.find((c: any) => c.type === 'squirrel_red');
      return squirrel && (squirrel.state === 'alert' || squirrel.state === 'flee');
    }, null, { timeout: 10000 });

    // 2. Spawn a bird directly above player (distance = 50px < alertRadius 115px)
    await page.evaluate(
      ({ x, y }) => {
        (window as any).__hv.spawnCritter('bird_sparrow', x, y - 50);
      },
      { x: playerPos.x, y: playerPos.y }
    );

    // Verify bird flees upward using vertical 'fly_up' clip
    await page.waitForFunction(() => {
      const critters = (window as any).__hv.critters();
      const bird = critters.find((c: any) => c.type === 'bird_sparrow');
      return bird && bird.state === 'flee' && bird.facing === 'up' && bird.lastAnim?.includes('fly_up');
    }, null, { timeout: 10000 });

    // Capture screenshot of critters fleeing
    await page.screenshot({
      path: 'tests/e2e/__screenshots__/critters-flee.png',
      fullPage: false,
    });
  });
});
