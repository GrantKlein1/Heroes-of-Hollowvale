import { test, expect } from '@playwright/test';

test.describe('ENEMY-NEW-1: Shadowfang Wolf (WolfAI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('spawns a wolf that aggros, lunges and bites once, dies, and drops loot', async ({ page }) => {
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
      const wolf = (window as any).__hv.spawn('shadowfang_wolf', player.x + 190, player.y);
      return {
        isEnemy: Boolean(wolf?.isEnemy),
        enemyType: wolf?.enemyType,
        ai: wolf?.ai?.constructor?.name || null,
        texture: wolf?.texture?.key || null,
        originX: wolf?.originX,
        originY: wolf?.originY,
        hp: wolf?.hp,
        hitFrames: wolf?.hitFrames,
        footprint: wolf?.footprint,
        clipsExist: ['idle', 'walk', 'hurt', 'attack', 'death'].every((a) =>
          ['down', 'left', 'right', 'up'].every((d) => scene.anims.exists(`shadowfang_wolf_${a}_${d}`))
        ),
      };
    });

    expect(spawned.isEnemy).toBe(true);
    expect(spawned.enemyType).toBe('shadowfang_wolf');
    expect(spawned.ai).toBe('WolfAI');
    expect(spawned.texture).toBe('shadowfang_wolf');
    expect(spawned.originX).toBeCloseTo(0.5);
    expect(spawned.originY).toBeCloseTo(0.9062);
    expect(spawned.hp).toBe(30);
    expect(spawned.hitFrames).toEqual([3]);
    expect(spawned.footprint).toMatchObject({ w: 52, h: 12 });
    expect(spawned.clipsExist).toBe(true);

    // Aggro: 190 px is outside a goblin's 160 px but inside the wolf's 230 px.
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const wolf = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'shadowfang_wolf');
      return wolf?.animHistory?.some((k: string) => k.includes('walk'));
    }, null, { timeout: 8000 });

    // The bite: attack clip plays, with no telegraph clip, and lands on the player.
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const wolf = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'shadowfang_wolf');
      return wolf?.animHistory?.some((k: string) => k.includes('_attack_'));
    }, null, { timeout: 8000 });

    await page.waitForFunction((before) => (window as any).__hv.combat().hp < before, hpBefore, { timeout: 8000 });

    const bite = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const wolf = scene.enemies.getChildren().find((e: any) => e.enemyType === 'shadowfang_wolf');
      return {
        hp: (window as any).__hv.combat().hp,
        telegraph: wolf.animHistory.some((k: string) => k.includes('telegraph')),
        modeSeen: wolf.ai.mode,
      };
    });
    expect(bite.hp).toBeLessThan(hpBefore);
    expect(bite.hp).toBeGreaterThanOrEqual(hpBefore - 7 * 2);
    expect(bite.telegraph).toBe(false);

    const killed = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const wolf = scene.enemies.getChildren().find((e: any) => e.enemyType === 'shadowfang_wolf');
      // Seed 557: the first rolls stay under 0.2, so every loot row drops a sprite.
      (window as any).__hv.seed(557);
      wolf.takeDamage(1000, performance.now());
      return { hp: wolf.hp, dead: wolf.state === 'DEAD' || wolf.hp <= 0 };
    });
    expect(killed.hp).toBe(0);
    expect(killed.dead).toBe(true);

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return Array.isArray(scene?.lootPickups) && scene.lootPickups.length > 0;
    }, null, { timeout: 5000 });

    const loot = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return (scene.lootPickups || []).map((sprite: any) => sprite.lootId);
    });
    expect(loot.length).toBeGreaterThan(0);
    for (const id of loot) expect(['ruby', 'sapphire', 'emerald', 'healing_potion', 'mana_potion', 'speed_potion']).toContain(id);
  });
});
