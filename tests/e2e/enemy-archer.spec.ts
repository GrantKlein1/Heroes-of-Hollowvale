import { test, expect } from '@playwright/test';

test.describe('ARCHER-1: Goblin archer Enemy and ArcherAI', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('spawns an archer that aggros, fires one arrow, dies, and drops loot', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1&debug=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawn === 'function' &&
        typeof (window as any).__scene?.spawn === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const spawned = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const player = scene.player;
      const x = player.x + 170;
      const y = player.y;
      const archer = (window as any).__hv.spawn('archer', x, y);
      return {
        isEnemy: Boolean(archer?.isEnemy),
        enemyType: archer?.enemyType,
        ai: archer?.ai?.constructor?.name || null,
        texture: archer?.texture?.key || null,
        originX: archer?.originX,
        originY: archer?.originY,
        x: archer?.x,
        y: archer?.y,
      };
    });

    expect(spawned.isEnemy).toBe(true);
    expect(spawned.enemyType).toBe('archer');
    expect(spawned.ai).toBe('ArcherAI');
    expect(spawned.texture).toBe('goblin_archer');
    expect(spawned.originX).toBeCloseTo(0.5);
    expect(spawned.originY).toBeCloseTo(0.9375);

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const archer = scene?.enemies?.getChildren?.().find((e: any) => e.enemyType === 'archer');
      if (!archer) return false;
      const alerted = archer.ai?.hasAlerted === true
        || archer.animHistory?.some((key: string) => String(key).includes('alert'));
      return alerted;
    }, null, { timeout: 8000 });

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const shots = (scene?.projectiles || []).filter((pr: any) => {
        return pr?.owner === 'enemy' || String(pr?.hitAnim || '').includes('arrow') || String(pr?.frame?.name || '').includes('arrow');
      });
      if (shots.length > 0) {
        (window as any).__archerArrowSeen = true;
      }
      return (window as any).__archerArrowSeen === true;
    }, null, { timeout: 8000 });

    const killed = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const archer = scene.enemies.getChildren().find((e: any) => e.enemyType === 'archer');
      // First rolls of seed 557 stay under 0.25, so LOOT_TABLES.archer drops a sprite.
      (window as any).__hv.seed(557);
      archer.takeDamage(1000, performance.now());
      return { hp: archer.hp, dead: archer.state === 'DEAD' || archer.hp <= 0 };
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
  });
});
