import { test, expect } from '@playwright/test';

test.describe('Package BF-1: Mage Lightning/Leech Freeze Regression (Empty v2 Clips)', () => {
  test('casting Lightning or Leech before and after v2 atlas loads does not freeze the game loop', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log('PAGE ERROR STACK:', err.stack);
      pageErrors.push(`[pageerror] ${err.message}`);
    });

    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
      }
    });

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // Default path /?qa=1 (no renderer or maps params)
    await page.goto('/?qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Mage (index 1)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(1).click();
    await expect(chooseModal).toBeHidden();

    // (a) Immediately after class modal closes, before atlases are loaded
    const earlyResult = await page.evaluate(() => {
      const scene = (window as any).__scene;
      let lightningThrew = false;
      let leechThrew = false;

      try {
        (window as any).__hv.cast('lightning');
      } catch (_e) {
        lightningThrew = true;
      }

      try {
        (window as any).__hv.cast('leech');
      } catch (_e) {
        leechThrew = true;
      }

      const initialFrame = scene?.game?.loop?.frame ?? 0;
      return { lightningThrew, leechThrew, initialFrame };
    });

    expect(earlyResult.lightningThrew).toBe(false);
    expect(earlyResult.leechThrew).toBe(false);

    // Wait 500 ms and assert game loop frame has advanced
    await page.waitForTimeout(500);

    const frameAfterEarly = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return scene?.game?.loop?.frame ?? 0;
    });

    expect(frameAfterEarly).toBeGreaterThan(earlyResult.initialFrame);

    // (b) Wait until __scene.anims.get('mage_cast_lightning_v2_down')?.frames.length > 0 and textures.exists('spell_fx_v2')
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const lightningClip = scene?.anims?.get?.('mage_cast_lightning_v2_down');
      const leechClip = scene?.anims?.get?.('mage_cast_leech_v2_right');
      const fxLoaded = scene?.textures?.exists?.('spell_fx_v2');
      const playerReady = scene?.player?.is?.('idle') || !scene?.player?.is?.('attack');
      return (
        Boolean(lightningClip?.frames?.length) &&
        Boolean(leechClip?.frames?.length) &&
        Boolean(fxLoaded) &&
        Boolean(playerReady)
      );
    }, null, { timeout: 15000 });

    // Cast Lightning facing down
    const lightningResult = await page.evaluate(async () => {
      const scene = (window as any).__scene;
      const player = scene.player;
      player.setFacing('down');
      const before = new Set<any>(scene.projectiles || []);
      const startLoop = scene.game.loop.frame;
      const startedAt = performance.now();

      const castOk = (window as any).__hv.cast('lightning');

      const spawned = await new Promise<boolean>((resolve) => {
        const step = () => {
          if ((scene.projectiles || []).some((p: any) => !before.has(p))) {
            resolve(true);
            return;
          }
          if (performance.now() - startedAt > 800) {
            resolve(false);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      return { spawned, startLoop, castOk };
    });

    expect(lightningResult.spawned).toBe(true);

    // Assert game.loop.frame keeps advancing for 1 s after cast
    await page.waitForTimeout(1000);
    const frameAfterLightning = await page.evaluate(() => (window as any).__scene?.game?.loop?.frame ?? 0);
    expect(frameAfterLightning).toBeGreaterThan(lightningResult.startLoop + 30);

    // Wait until player finishes attack
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return scene?.player?.is?.('idle') || !scene?.player?.is?.('attack');
    });

    // Reset lifeLeechCooldownUntil and cast Leech facing right
    const leechResult = await page.evaluate(async () => {
      const scene = (window as any).__scene;
      const session = (window as any).__session;
      if (session) session.lifeLeechCooldownUntil = 0;
      const player = scene.player;
      player.setFacing('right');
      const before = new Set<any>(scene.projectiles || []);
      const startLoop = scene.game.loop.frame;
      const startedAt = performance.now();

      const castOk = (window as any).__hv.cast('leech');

      const spawned = await new Promise<boolean>((resolve) => {
        const step = () => {
          if ((scene.projectiles || []).some((p: any) => !before.has(p))) {
            resolve(true);
            return;
          }
          if (performance.now() - startedAt > 800) {
            resolve(false);
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

      return { spawned, startLoop, castOk };
    });

    expect(leechResult.spawned).toBe(true);

    // Assert game.loop.frame keeps advancing for 1 s after cast
    await page.waitForTimeout(1000);
    const frameAfterLeech = await page.evaluate(() => (window as any).__scene?.game?.loop?.frame ?? 0);
    expect(frameAfterLeech).toBeGreaterThan(leechResult.startLoop + 30);

    // (c) Real input: equip spellbook as the game does, press Space 3 times about 400 ms apart
    await page.evaluate(() => {
      const session = (window as any).__session;
      if (session) {
        session.equippedId = 'spellbook';
        session.spellId = 'lightning';
      }
    });

    const loopBeforeSpace = await page.evaluate(() => (window as any).__scene?.game?.loop?.frame ?? 0);

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }

    const loopAfterSpace = await page.evaluate(() => (window as any).__scene?.game?.loop?.frame ?? 0);
    expect(loopAfterSpace).toBeGreaterThan(loopBeforeSpace + 40);

    // Zero page errors
    expect(pageErrors).toEqual([]);

    // Save screenshot
    await page.screenshot({ path: 'tests/e2e/__screenshots__/bf1-mage-cast.png' });
  });
});
