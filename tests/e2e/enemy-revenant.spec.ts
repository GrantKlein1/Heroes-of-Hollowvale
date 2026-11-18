import { test, expect } from '@playwright/test';

test.describe('ENEMY-NEW-1: Ashen Revenant (BruteAI, armored)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('spawns a revenant that drifts in, lands a heavy hit, is armored, dies, and drops loot', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1&debug=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawn === 'function' &&
        typeof (window as any).__hv?.combat === 'function' &&
        typeof (window as any).__scene?.spawn === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const hpBefore = await page.evaluate(() => (window as any).__hv.combat().hp);

    const spawned = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const player = scene.player;
      const rev = (window as any).__hv.spawn('ashen_revenant', player.x + 110, player.y);
      return {
        isEnemy: Boolean(rev?.isEnemy),
        enemyType: rev?.enemyType,
        ai: rev?.ai?.constructor?.name || null,
        texture: rev?.texture?.key || null,
        originX: rev?.originX,
        originY: rev?.originY,
        hp: rev?.hp,
        armored: rev?.isArmored,
        hitFrames: rev?.hitFrames,
        footprint: rev?.footprint,
        startX: rev?.x,
        clipsExist: ['idle', 'walk', 'hurt', 'attack', 'death'].every((a) =>
          ['down', 'left', 'right', 'up'].every((d) => scene.anims.exists(`ashen_revenant_${a}_${d}`))
        ),
      };
    });

    expect(spawned.isEnemy).toBe(true);
    expect(spawned.enemyType).toBe('ashen_revenant');
    expect(spawned.ai).toBe('BruteAI');
    expect(spawned.texture).toBe('ashen_revenant');
    expect(spawned.originX).toBeCloseTo(0.5);
    expect(spawned.originY).toBeCloseTo(0.9271);
    expect(spawned.hp).toBe(90);
    expect(spawned.armored).toBe(true);
    expect(spawned.hitFrames).toEqual([3]);
    expect(spawned.footprint).toMatchObject({ w: 28, h: 10 });
    expect(spawned.clipsExist).toBe(true);

    // It walks (hover-drift clip) toward the player, slowly.
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const rev = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'ashen_revenant');
      return rev?.animHistory?.some((k: string) => k.includes('_walk_'));
    }, null, { timeout: 8000 });

    // One swing: attack clip with no telegraph clip, then the player takes the hit.
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const rev = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'ashen_revenant');
      return rev?.animHistory?.some((k: string) => k.includes('_attack_'));
    }, null, { timeout: 15000 });

    await page.waitForFunction((before) => (window as any).__hv.combat().hp < before, hpBefore, { timeout: 8000 });

    const hit = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const rev = scene.enemies.getChildren().find((e: any) => e.enemyType === 'ashen_revenant');
      return {
        hp: (window as any).__hv.combat().hp,
        telegraph: rev.animHistory.some((k: string) => k.includes('telegraph')),
        movedFrom: rev.x,
      };
    });
    expect(hit.hp).toBeLessThan(hpBefore);
    expect(hit.hp).toBeGreaterThanOrEqual(hpBefore - 20);
    expect(hit.telegraph).toBe(false);
    expect(hit.movedFrom).toBeLessThan(spawned.startX!);

    // Armored: a hit mid-swing does not cancel it.
    const armor = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const rev = scene.enemies.getChildren().find((e: any) => e.enemyType === 'ashen_revenant');
      rev.finishAttack(performance.now());
      rev.attackCooldownUntil = 0;
      rev.startAttack(performance.now());
      const wasAttacking = rev.isAttacking;
      rev.takeDamage(5, performance.now());
      return { wasAttacking, still: rev.isAttacking, hurt: rev.state === 'HURT', hp: rev.hp };
    });
    expect(armor.wasAttacking).toBe(true);
    expect(armor.still).toBe(true);
    expect(armor.hurt).toBe(false);
    expect(armor.hp).toBe(85);

    const killed = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const rev = scene.enemies.getChildren().find((e: any) => e.enemyType === 'ashen_revenant');
      // Seed 557: the first rolls (.05 .03 .17) stay under every revenant loot chance.
      (window as any).__hv.seed(557);
      rev.takeDamage(1000, performance.now());
      return { hp: rev.hp, dead: rev.state === 'DEAD' || rev.hp <= 0 };
    });
    expect(killed.hp).toBe(0);
    expect(killed.dead).toBe(true);

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return Array.isArray(scene?.lootPickups) && scene.lootPickups.length > 0;
    }, null, { timeout: 5000 });

    const loot = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return (scene.lootPickups || []).map((sprite: any) => sprite.lootId).sort();
    });
    expect(loot).toEqual(['healing_potion', 'ruby', 'sapphire']);
  });
});
