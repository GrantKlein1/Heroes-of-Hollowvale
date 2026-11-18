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

// ITEM-NEW-1: the five Batch 11 items. Set ITEM_NEW_SHOTS=<dir> to also save review screenshots (outside the repo).
test.describe('Package ITEM-NEW-1: Batch 11 items (healing charm, nightfang dagger, stonehollow hammer, quest items)', () => {
  test('healing charm use with synced glow, dagger and hammer holds, quest items, market and inventory icons', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];
    const shotDir = process.env.ITEM_NEW_SHOTS || '';
    const shot = async (name: string, opts: Record<string, unknown> = {}) => {
      if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png`, ...opts });
    };
    // Crop around the hero (world to screen: camera view and zoom) so the in-hand item is readable.
    const shotAtPlayer = async (name: string) => {
      if (!shotDir) return;
      const clip = await page.evaluate(() => {
        const s = (window as any).__scene;
        const cam = s.cameras.main;
        const sx = (s.player.x - cam.worldView.x) * cam.zoom;
        const sy = (s.player.y - cam.worldView.y) * cam.zoom;
        return { x: Math.max(0, sx - 110), y: Math.max(0, sy - 190), width: 220, height: 230 };
      });
      await page.screenshot({ path: `${shotDir}/${name}.png`, clip });
    };

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));
    page.on('response', (res) => {
      if (res.status() === 404) notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
    });
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.goto('/?qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByText('Choose Your Class')).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(0).click();
    await page.waitForFunction(() => (
      typeof (window as any).__hv?.giveItem === 'function' &&
      (window as any).__hv.scene() === 'village' &&
      Boolean((window as any).__scene?.player)
    ));

    // Open ground, QA labels off, so the review screenshots are clean.
    await page.evaluate(() => (window as any).__hv.goto('village', 0.5, 0.5));
    await page.waitForTimeout(800);
    await page.evaluate(() => (window as any).__hv.debug(false));

    // QA hook: give items through the normal loot path. The knight's packs show them with the new icons.
    const gave = await page.evaluate(() => [
      (window as any).__hv.giveItem('healing_charm', 2),
      (window as any).__hv.giveItem('nightfang_dagger'),
      (window as any).__hv.giveItem('stonehollow_hammer'),
      (window as any).__hv.giveItem('seranyas_tear'),
      (window as any).__hv.giveItem('ember_chalice'),
      (window as any).__hv.giveItem('not_an_item'),
    ]);
    expect(gave.map((g: any) => g.ok)).toEqual([true, true, true, true, true, false]);
    await page.keyboard.press('v'); // hotbar is full after four, so the fifth item lands in storage
    for (const name of ['Healing Charm', 'Nightfang Dagger', 'Stonehollow Hammer', "Amulet of Seranya's Tear", 'The Embered Flagon Chalice']) {
      await expect(page.locator(`img[alt="${name}"]`).first()).toBeVisible();
    }
    await page.waitForTimeout(200);
    await shot('inventory-new-icons');
    await page.keyboard.press('v');

    // =====================================================================
    // Healing charm: full lift use clip with the glow overlay synced frame for frame.
    // =====================================================================
    await page.evaluate(() => {
      const w = window as any;
      w.__session.equippedId = 'healing_charm';
      w.__scene.hp = 20;
      w.__consumedEvents = [];
      w.__chatEventBus.on('item:consumed', (evt: any) => w.__consumedEvents.push(evt));
      w.__scene.player.playAnim('idle');
    });
    await page.waitForFunction(() => (window as any).__hv.anim() === 'knight_hold_idle_down');
    await page.keyboard.down('KeyK');
    await page.waitForFunction(() => ((window as any).__hv.anim() || '').startsWith('knight_use_charm_'));

    const glowSamples: Array<{ body: string; glow: string; visible: boolean; above: boolean }> = [];
    for (let i = 0; i < 40; i++) {
      const sample = await page.evaluate(() => {
        const p = (window as any).__scene.player;
        const g = p.glowSprite;
        return {
          body: p.anims?.currentFrame?.frame?.name || '',
          glow: g?.frame?.name || '',
          visible: Boolean(g?.visible),
          above: Boolean(g) && g.depth > p.depth && g.depth > (p.itemSprite?.depth ?? -1),
        };
      });
      glowSamples.push(sample);
      if (!(await page.evaluate(() => (window as any).__scene._consuming))) break;
      await page.waitForTimeout(25);
    }
    await page.keyboard.up('KeyK');
    const live = glowSamples.filter((s) => s.visible);
    expect(live.length).toBeGreaterThan(3);
    for (const s of live) {
      expect(s.glow).toBe(s.body); // frame-for-frame sync
      expect(s.above).toBe(true);
    }
    await page.waitForFunction(() => (window as any).__scene.hp === 65, { timeout: 3000 }); // 20 + 45
    expect(await page.evaluate(() => (window as any).__consumedEvents.length)).toBe(1);
    await page.waitForFunction(() => !(window as any).__scene._consuming);
    await page.waitForFunction(() => !(window as any).__scene.player.itemUseState?.active);
    expect(await page.evaluate(() => (window as any).__scene.player.glowSprite?.visible)).toBe(false);

    // Review shot: replay the clip, pause on the effect frame (10, the glow peak) and crop around the hero.
    if (shotDir) {
      await page.evaluate(() => new Promise<void>((resolve) => {
        const p = (window as any).__scene.player;
        p.beginItemUse('healing_charm', performance.now());
        const tick = () => {
          if ((p.anims?.currentFrame?.frame?.name || '').endsWith('_down_10')) {
            p.anims.pause();
            resolve();
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      await page.waitForTimeout(120);
      await shotAtPlayer('healing-charm-use-glow');
      await page.evaluate(() => { const p = (window as any).__scene.player; p.anims.resume(); p.endItemUse(); });
    }

    // The charm also plays for the other three heroes (their own sheets, same glow overlay).
    for (const hero of ['mage', 'thief', 'dwarf']) {
      await page.evaluate((cls) => {
        const w = window as any;
        w.__session.classId = cls;
        w.__session.equippedId = 'healing_charm';
        w.__scene.player.setClass(cls);
        w.__scene.player.setFacing('down');
        w.__scene.player.playAnim('idle');
        w.__scene.player.beginItemUse('healing_charm', performance.now());
      }, hero);
      await page.waitForFunction((h) => ((window as any).__hv.anim() || '').startsWith(`${h}_use_charm_`), hero);
      await page.waitForFunction(() => (window as any).__scene.player.glowSprite?.visible === true, null, { timeout: 3000 });
      expect(await page.evaluate(() => (window as any).__scene.player.glowSprite.texture.key)).toBe(`${hero}_use_charm_glow`);
      await page.evaluate(() => (window as any).__scene.player.endItemUse());
    }

    // =====================================================================
    // Nightfang dagger (thief) and stonehollow hammer (dwarf) hold in hand.
    // =====================================================================
    await page.evaluate(() => {
      const w = window as any;
      w.__session.classId = 'thief';
      w.__session.equippedId = 'nightfang_dagger';
      w.__scene.player.setClass('thief');
      w.__scene.player.setFacing('right');
      w.__scene.player.playAnim('idle');
    });
    await page.waitForFunction(() => (window as any).__hv.anim() === 'thief_hold_idle_right');
    const dagger = await page.evaluate(() => {
      const p = (window as any).__scene.player;
      return { atlas: p.itemSprite.texture.key, frame: p.itemSprite.frame.name, visible: p.itemSprite.visible };
    });
    expect(dagger).toEqual({ atlas: 'items_inhand_b11', frame: 'nightfang_dagger_right', visible: true });
    await shotAtPlayer('nightfang-dagger-in-hand');

    await page.evaluate(() => {
      const w = window as any;
      w.__session.classId = 'dwarf';
      w.__session.equippedId = 'stonehollow_hammer';
      w.__scene.player.setClass('dwarf');
      w.__scene.player.setFacing('down');
      w.__scene.player.playAnim('idle');
    });
    await page.waitForFunction(() => (window as any).__hv.anim() === 'dwarf_hold_idle_down');
    const hammer = await page.evaluate(() => {
      const p = (window as any).__scene.player;
      return { atlas: p.itemSprite.texture.key, frame: p.itemSprite.frame.name, visible: p.itemSprite.visible };
    });
    expect(hammer).toEqual({ atlas: 'items_inhand_b11', frame: 'stonehollow_hammer_down', visible: true });
    await shotAtPlayer('stonehollow-hammer-in-hand');

    // =====================================================================
    // Quest items: cannot be consumed; their ground pickups glow at 4 fps, other pickups play at 8 fps.
    // =====================================================================
    await page.evaluate(() => {
      const w = window as any;
      w.__session.classId = 'knight';
      w.__scene.player.setClass('knight');
      w.__session.equippedId = 'seranyas_tear';
      w.__consumedEvents = [];
    });
    await page.keyboard.down('KeyK');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).__scene._consuming)).toBe(false);
    await page.keyboard.up('KeyK');
    expect(await page.evaluate(() => (window as any).__consumedEvents.length)).toBe(0);

    await page.evaluate(() => {
      const w = window as any;
      w.__session.equippedId = null;
      w.__hv.dropItem('seranyas_tear', 70, 0);
      w.__hv.dropItem('ember_chalice', 70, 36);
      w.__hv.dropItem('healing_charm', -70, 0);
    });
    await page.waitForTimeout(300);
    const pickups = await page.evaluate(() => {
      const list = (window as any).__scene.lootPickups || [];
      return list.map((s: any) => ({
        id: s.lootId,
        anim: s.anims.currentAnim?.key,
        fps: s.anims.currentAnim?.frameRate,
        texture: s.texture.key,
        x: s.x,
        y: s.y,
      }));
    });
    const byId = Object.fromEntries(pickups.map((p: any) => [p.id, p]));
    expect(byId.seranyas_tear).toMatchObject({ anim: 'loot_pickups_b11_loot_seranyas_tear_idle_down', fps: 4, texture: 'loot_pickups_b11' });
    expect(byId.ember_chalice).toMatchObject({ anim: 'loot_pickups_b11_loot_ember_chalice_idle_down', fps: 4 });
    expect(byId.healing_charm).toMatchObject({ anim: 'loot_pickups_b11_loot_healing_charm_idle_down', fps: 8 });
    if (shotDir) {
      const clip = await page.evaluate(() => {
        const cam = (window as any).__scene.cameras.main;
        const p = (window as any).__scene.player;
        const sx = (p.x - cam.worldView.x) * cam.zoom;
        const sy = (p.y - cam.worldView.y) * cam.zoom;
        return { x: Math.max(0, sx - 240), y: Math.max(0, sy - 40), width: 480, height: 150 };
      });
      await page.screenshot({ path: `${shotDir}/quest-pickups-on-ground.png`, clip });
    }

    // Market lists the dagger, hammer and charm and never the quest items.
    await page.evaluate(() => (window as any).__hv.goto('market', 0.5, 0.8));
    await page.waitForFunction(() => (window as any).__hv.scene() === 'market');
    await page.evaluate(() => (window as any).__chatEventBus.emit('npc:vendor', {}));
    await page.getByRole('button', { name: 'Weaponry' }).click();
    await expect(page.getByText('Nightfang Dagger').first()).toBeVisible();
    await expect(page.getByText('Stonehollow Hammer').first()).toBeVisible();
    await page.waitForTimeout(150);
    await shot('market-weaponry-new-icons');
    await page.getByRole('button', { name: 'Magic' }).click();
    await expect(page.getByText('Healing Charm').first()).toBeVisible();
    for (const tab of ['Potions', 'Magic', 'Food', 'Weaponry', 'Armor', 'Tools']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByText("Amulet of Seranya's Tear")).toHaveCount(0);
      await expect(page.getByText('The Embered Flagon Chalice')).toHaveCount(0);
    }
    await page.keyboard.press('Escape');


    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundResponses).toEqual([]);
  });
});

