import { test, expect } from '@playwright/test';

test.describe('ENEMY-NEW-1: Ashen Cultist (CultistAI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('spawns a cultist that aggros, throws an ember bolt that lands, dies, and drops loot', async ({ page }) => {
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

    // 215 px out is inside the cultist's 150-230 px firing band, so it casts from where it stands.
    const spawned = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const player = scene.player;
      const cultist = (window as any).__hv.spawn('ashen_cultist', player.x + 215, player.y);
      return {
        isEnemy: Boolean(cultist?.isEnemy),
        enemyType: cultist?.enemyType,
        ai: cultist?.ai?.constructor?.name || null,
        texture: cultist?.texture?.key || null,
        originX: cultist?.originX,
        originY: cultist?.originY,
        hp: cultist?.hp,
        hitFrames: cultist?.hitFrames,
        footprint: cultist?.footprint,
        clipsExist: ['idle', 'walk', 'hurt', 'attack', 'death'].every((a) =>
          ['down', 'left', 'right', 'up'].every((d) => scene.anims.exists(`ashen_cultist_${a}_${d}`))
        ),
      };
    });

    expect(spawned.isEnemy).toBe(true);
    expect(spawned.enemyType).toBe('ashen_cultist');
    expect(spawned.ai).toBe('CultistAI');
    expect(spawned.texture).toBe('ashen_cultist');
    expect(spawned.originX).toBeCloseTo(0.5);
    expect(spawned.originY).toBeCloseTo(0.9271);
    expect(spawned.hp).toBe(28);
    expect(spawned.hitFrames).toEqual([3]);
    expect(spawned.footprint).toMatchObject({ w: 28, h: 10 });
    expect(spawned.clipsExist).toBe(true);

    // Aggro: the cultist plays its cast clip and releases a bolt owned by an enemy.
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const cultist = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'ashen_cultist');
      return cultist?.animHistory?.some((k: string) => k.includes('_attack_'));
    }, null, { timeout: 8000 });

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const bolts = (scene?.projectiles || []).filter((pr: any) => pr?.owner === 'enemy' && pr?.flyAnim === 'fireball_fly');
      if (bolts.length > 0) {
        const b = bolts[0];
        (window as any).__emberBolt = { damage: b.damage, shooter: b.shooter?.enemyType, maxDist: b.maxDist };
      }
      return Boolean((window as any).__emberBolt);
    }, null, { timeout: 8000 });

    const bolt = await page.evaluate(() => (window as any).__emberBolt);
    expect(bolt.shooter).toBe('ashen_cultist');
    expect(bolt.damage).toBe(10);
    expect(bolt.maxDist).toBe(420);

    // The bolt lands: the (stationary) player loses HP.
    await page.waitForFunction((before) => (window as any).__hv.combat().hp < before, hpBefore, { timeout: 8000 });
    const hpAfter = await page.evaluate(() => (window as any).__hv.combat().hp);
    expect(hpAfter).toBeLessThan(hpBefore);
    expect(hpAfter).toBeGreaterThanOrEqual(hpBefore - 10);

    const killed = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const cultist = scene.enemies.getChildren().find((e: any) => e.enemyType === 'ashen_cultist');
      // Seed 557: the first rolls (.05 .03 .17) stay under every cultist loot chance.
      (window as any).__hv.seed(557);
      cultist.takeDamage(1000, performance.now());
      return { hp: cultist.hp, dead: cultist.state === 'DEAD' || cultist.hp <= 0 };
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
    expect(loot).toEqual(['mana_potion', 'ruby', 'sapphire']);
  });
});
