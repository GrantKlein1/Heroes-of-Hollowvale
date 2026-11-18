import { test, expect } from '@playwright/test';

test.describe('Package IT-1: Hero Item Hold and Use Animations & Consumables', () => {
  test('wire Batch 9 hero item hold/use animations; make apple and ale consumable on /?qa=1', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(`[pageerror] ${err.message}`);
    });

    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
      }
    });

    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // 1. Boot on default path /?qa=1
    await page.goto('/?qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight (index 0)
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await expect(classModalHeading).toBeHidden();

    // Wait for __hv QA interface and scene player to be ready
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        typeof (window as any).__hv?.scene === 'function' &&
        (window as any).__hv.scene() === 'village' &&
        Boolean((window as any).__scene?.player)
      );
    });

    // Listen for ITEM_CONSUMED on the chat / global eventBus
    await page.evaluate(() => {
      (window as any).__consumedEvents = [];
      (window as any).__chatEventBus?.on('item:consumed', (evt: any) => {
        (window as any).__consumedEvents.push(evt);
      });
    });

    // =========================================================================
    // Knight with healing_potion:
    // (a) idle shows knight_hold_idle_down, moving shows knight_hold_run_*
    // (b) item sprite is within 1 px of feet + anchor
    // =========================================================================
    await page.evaluate(() => {
      (window as any).__session.equippedId = 'healing_potion';
      (window as any).__scene.player.playAnim('idle');
    });

    await page.waitForFunction(() => (window as any).__hv.anim() === 'knight_hold_idle_down');
    expect(await page.evaluate(() => (window as any).__hv.anim())).toBe('knight_hold_idle_down');

    // (b) Verify item sprite follows within 1 px of feet + anchor
    const spriteCheck = await page.evaluate(() => {
      const player = (window as any).__scene.player;
      const sprite = player.itemSprite;
      const anchor = player._lastAnchor;
      const scale = player.scaleX || 1;
      const expectedX = player.x + anchor.x * scale;
      const expectedY = player.y + anchor.y * scale;
      return {
        visible: sprite?.visible,
        diffX: Math.abs(sprite.x - expectedX),
        diffY: Math.abs(sprite.y - expectedY),
        depth: sprite.depth,
        playerDepth: player.depth,
      };
    });
    expect(spriteCheck.visible).toBe(true);
    expect(spriteCheck.diffX).toBeLessThanOrEqual(1);
    expect(spriteCheck.diffY).toBeLessThanOrEqual(1);
    expect(spriteCheck.depth).toBeGreaterThan(spriteCheck.playerDepth);

    // Save screenshot for item hold
    await page.screenshot({ path: 'tests/e2e/__screenshots__/it1-item-hold.png' });

    // Moving shows knight_hold_run_*
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => ((window as any).__hv.anim() || '').startsWith('knight_hold_run_'));
    expect(await page.evaluate(() => (window as any).__hv.anim())).toMatch(/^knight_hold_run_/);
    await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => ((window as any).__hv.anim() || '').startsWith('knight_hold_idle_'));
    expect(await page.evaluate(() => (window as any).__hv.anim())).toMatch(/^knight_hold_idle_/);

    // =========================================================================
    // (d) release at 400 ms: hp unchanged, back on hold clip
    // =========================================================================
    await page.evaluate(() => {
      (window as any).__scene.hp = 20;
      (window as any).__consumedEvents = [];
    });
    await page.keyboard.down('KeyK');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__scene._consuming)).toBe(true);
    expect(await page.evaluate(() => (window as any).__hv.anim())).toMatch(/^knight_use_drink_/);

    // Wait until 400 ms total elapsed, then release K
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyK');
    await page.waitForTimeout(100);

    const cancelState = await page.evaluate(() => ({
      hp: (window as any).__scene.hp,
      consuming: (window as any).__scene._consuming,
      anim: (window as any).__hv.anim(),
      consumedCount: (window as any).__consumedEvents.length,
    }));
    expect(cancelState.hp).toBe(20);
    expect(cancelState.consuming).toBe(false);
    expect(cancelState.anim).toMatch(/^knight_hold_idle_/);
    expect(cancelState.consumedCount).toBe(0);

    // =========================================================================
    // (c) set __scene.hp = 20, hold K:
    // clip is knight_use_drink_*, hp is still 20 at 500 ms,
    // becomes 90 by about 700 ms, ITEM_CONSUMED fired once, _consuming ends at 1000 ms
    // =========================================================================
    await page.evaluate(() => {
      (window as any).__scene.hp = 20;
      (window as any).__consumedEvents = [];
      (window as any).__session.equippedId = 'healing_potion';
    });
    await page.keyboard.down('KeyK');

    // Check at 500 ms: hp still 20, clip is use_drink, consuming true
    await page.waitForTimeout(500);
    const midDrinkState = await page.evaluate(() => ({
      hp: (window as any).__scene.hp,
      consuming: (window as any).__scene._consuming,
      anim: (window as any).__hv.anim(),
      consumedCount: (window as any).__consumedEvents.length,
    }));
    expect(midDrinkState.consuming).toBe(true);
    expect(midDrinkState.anim).toMatch(/^knight_use_drink_/);
    expect(midDrinkState.hp).toBe(20);
    expect(midDrinkState.consumedCount).toBe(0);

    // Save screenshot for item use
    await page.screenshot({ path: 'tests/e2e/__screenshots__/it1-item-use.png' });

    // By about 700 ms (wait up to 750-800 ms), hp becomes 90 and ITEM_CONSUMED fired once
    await page.waitForFunction(() => (window as any).__scene.hp === 90, { timeout: 3000 });
    const drinkCommitState = await page.evaluate(() => ({
      hp: (window as any).__scene.hp,
      consumedCount: (window as any).__consumedEvents.length,
    }));
    expect(drinkCommitState.hp).toBe(90);
    expect(drinkCommitState.consumedCount).toBe(1);

    // At 1000 ms, _consuming ends
    await page.waitForFunction(() => !(window as any).__scene._consuming, { timeout: 3000 });
    expect(await page.evaluate(() => (window as any).__scene._consuming)).toBe(false);
    await page.keyboard.up('KeyK');
    await page.waitForTimeout(100);

    // =========================================================================
    // Repeat for apple (use_eat, +25 hp)
    // =========================================================================
    await page.evaluate(() => {
      (window as any).__scene.hp = 20;
      (window as any).__session.equippedId = 'apple';
      (window as any).__consumedEvents = [];
      (window as any).__scene.player.playAnim('idle');
    });
    await page.waitForFunction(() => ((window as any).__hv.anim() || '').startsWith('knight_hold_idle_'));

    await page.keyboard.down('KeyK');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__hv.anim())).toMatch(/^knight_use_eat_/);

    // Still 20 at 500 ms
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).__scene.hp)).toBe(20);

    // By ~700 ms, becomes 45 hp (20 + 25)
    await page.waitForFunction(() => (window as any).__scene.hp === 45, { timeout: 3000 });
    expect(await page.evaluate(() => (window as any).__consumedEvents.length)).toBe(1);

    // Ends at 1000 ms
    await page.waitForFunction(() => !(window as any).__scene._consuming, { timeout: 3000 });
    await page.keyboard.up('KeyK');
    await page.waitForTimeout(100);

    // =========================================================================
    // Repeat for ale_flask (+10 hp, 1.25x damage for about 5 s, no speed boost)
    // =========================================================================
    await page.evaluate(() => {
      (window as any).__scene.hp = 20;
      (window as any).__session.equippedId = 'ale_flask';
      (window as any).__session.speedBoostUntil = 0;
      (window as any).__session.damageMult = 1;
      (window as any).__session.damageBoostUntil = 0;
      (window as any).__consumedEvents = [];
      (window as any).__scene.player.playAnim('idle');
    });
    await page.waitForFunction(() => ((window as any).__hv.anim() || '').startsWith('knight_hold_idle_'));

    await page.keyboard.down('KeyK');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).__hv.anim())).toMatch(/^knight_use_drink_/);

    // By ~700 ms, becomes 30 hp (20 + 10). Damage buff ~5s ahead. Speed unchanged.
    await page.waitForFunction(() => (window as any).__scene.hp === 30, { timeout: 3000 });
    const aleBoost = await page.evaluate(() => {
      const now = performance.now();
      const session = (window as any).__session;
      return {
        damageDiff: (session.damageBoostUntil || 0) - now,
        damageMult: session.damageMult,
        speedDiff: (session.speedBoostUntil || 0) - now,
      };
    });
    expect(aleBoost.damageMult).toBe(1.25);
    expect(aleBoost.damageDiff).toBeGreaterThan(3500);
    expect(aleBoost.damageDiff).toBeLessThan(5500);
    expect(aleBoost.speedDiff).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => (window as any).__consumedEvents.length)).toBe(1);

    // Ends at 1000 ms
    await page.waitForFunction(() => !(window as any).__scene._consuming, { timeout: 3000 });
    await page.keyboard.up('KeyK');
    await page.waitForTimeout(100);

    // =========================================================================
    // Smoke the other 3 heroes: hold_idle plays
    // =========================================================================
    for (const hero of ['mage', 'thief', 'dwarf']) {
      await page.evaluate((cls) => {
        (window as any).__session.classId = cls;
        (window as any).__session.equippedId = 'healing_potion';
        (window as any).__scene.player.setClass(cls);
        (window as any).__scene.player.setFacing('down');
        (window as any).__scene.player.playAnim('idle');
      }, hero);
      await page.waitForFunction(
        (expected) => (window as any).__hv.anim() === expected,
        `${hero}_hold_idle_down`
      );
      expect(await page.evaluate(() => (window as any).__hv.anim())).toBe(`${hero}_hold_idle_down`);
    }

    // Zero console errors, zero page errors, zero 404s
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundResponses).toEqual([]);
  });
});
