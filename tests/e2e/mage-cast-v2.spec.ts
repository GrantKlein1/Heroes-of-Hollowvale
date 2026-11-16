import { test, expect } from '@playwright/test';

test.describe('MS-1 — Mage Lightning and Leech release on the v2 cast frame', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  async function startMage(page: import('@playwright/test').Page) {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(1).click();
    await expect(chooseModal).toBeHidden();
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return scene?.anims?.exists?.('mage_cast_lightning_v2_down')
        && scene?.anims?.exists?.('mage_cast_leech_v2_right')
        && scene?.textures?.exists?.('spell_fx_v2');
    });
  }

  test('Lightning body clip is v2 and the bolt waits for the release frame', async ({ page }) => {
    await startMage(page);

    const result = await page.evaluate(async () => {
      const scene = (window as any).__scene;
      const player = scene.player;
      player.setPosition(240, 280);
      player.setFacing('down');
      const before = (scene.projectiles || []).length;
      const started = performance.now();
      const castOk = (window as any).__hv.cast('lightning');
      const anim = (window as any).__hv.anim();
      const immediate = (scene.projectiles || []).length;

      const spawned = await new Promise<any>((resolve) => {
        const step = () => {
          const list = scene.projectiles || [];
          if (list.length > before) {
            const proj = list[list.length - 1];
            resolve({
              elapsed: performance.now() - started,
              x: proj.x,
              y: proj.y,
              key: proj.texture?.key,
              fly: proj.flyAnim,
              hit: proj.hitAnim,
              playerX: player.x,
              playerY: player.y,
            });
            return;
          }
          if (performance.now() - started > 800) {
            resolve(null);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      return { castOk, anim, immediate, before, spawned, flipX: player.flipX };
    });

    expect(result.castOk).toBe(true);
    expect(result.anim).toBe('mage_cast_lightning_v2_down');
    expect(result.immediate).toBe(result.before);
    expect(result.flipX).not.toBe(true);
    expect(result.spawned).toBeTruthy();
    expect(result.spawned.elapsed).toBeGreaterThanOrEqual(312.5 - 62.5);
    expect(result.spawned.elapsed).toBeLessThanOrEqual(312.5 + 62.5);
    expect(result.spawned.key).toBe('spell_fx_v2');
    expect(result.spawned.fly).toBe('lightning_bolt_v2');
    expect(result.spawned.hit).toBe('lightning_impact_v2');
    expect(Math.abs(result.spawned.x - (result.spawned.playerX - 37))).toBeLessThanOrEqual(2);
    expect(Math.abs(result.spawned.y - (result.spawned.playerY - 36))).toBeLessThanOrEqual(2);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/mage-lightning-v2-release.png' });
  });

  test('Leech orb uses the v2 clip and release offset for a second facing', async ({ page }) => {
    await startMage(page);

    const result = await page.evaluate(async () => {
      const scene = (window as any).__scene;
      const player = scene.player;
      const session = (window as any).__session;
      if (session) session.lifeLeechCooldownUntil = 0;
      player.setPosition(300, 260);
      player.setFacing('right');
      const before = (scene.projectiles || []).length;
      const started = performance.now();
      (window as any).__hv.cast('leech');
      const anim = (window as any).__hv.anim();
      const immediate = (scene.projectiles || []).length;

      const spawned = await new Promise<any>((resolve) => {
        const step = () => {
          const list = scene.projectiles || [];
          if (list.length > before) {
            const proj = list[list.length - 1];
            resolve({
              elapsed: performance.now() - started,
              x: proj.x,
              y: proj.y,
              fly: proj.flyAnim,
              hit: proj.hitAnim,
              ret: proj.returnAnim,
              absorb: proj.absorbAnim,
              playerX: player.x,
              playerY: player.y,
            });
            return;
          }
          if (performance.now() - started > 800) {
            resolve(null);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      return { anim, immediate, before, spawned };
    });

    expect(result.anim).toBe('mage_cast_leech_v2_right');
    expect(result.immediate).toBe(result.before);
    expect(result.spawned).toBeTruthy();
    expect(result.spawned.elapsed).toBeGreaterThanOrEqual(312.5 - 62.5);
    expect(result.spawned.elapsed).toBeLessThanOrEqual(312.5 + 62.5);
    expect(result.spawned.fly).toBe('leech_orb_v2');
    expect(result.spawned.hit).toBe('leech_impact_v2');
    expect(result.spawned.ret).toBe('leech_return_v2');
    expect(result.spawned.absorb).toBe('leech_absorb_v2');
    expect(Math.abs(result.spawned.x - (result.spawned.playerX + 36))).toBeLessThanOrEqual(2);
    expect(Math.abs(result.spawned.y - (result.spawned.playerY - 71))).toBeLessThanOrEqual(2);
  });
});
