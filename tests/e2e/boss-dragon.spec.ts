import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Package 3b-2: Red Dragon Boss AI across Phases 1–3', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Phase state transitions (66% and 33%), invulnerability window, lazy texture eviction, and encounter reset', async ({ page }) => {
    // 1. Boot with QA mode
    await page.goto('/?renderer=blend&maps=tiled&qa=1&seed=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(600);
    await startButton.click();

    // Select Knight class (index 0)
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for __hv QA interface in village scene
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawnDragon === 'function' &&
        typeof (window as any).__hv?.dragonState === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // 1. Spawn dragon at world coordinates (x: 400, y: 350, phase: 1)
    await page.evaluate(() => {
      (window as any).__hv.spawnDragon({ x: 400, y: 350, phase: 1 });
    });

    // Wait for Phase 1 texture to load
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return Boolean(scene?.textures?.exists('red_dragon_p1_a'));
    }, null, { timeout: 10000 });

    // Assert Phase 1 initial state
    let state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state).not.toBeNull();
    expect(state.phase).toBe(1);
    expect(state.hp).toBe(1200);
    expect(state.invulnerable).toBe(false);
    expect(state.airborne).toBe(false);
    expect(state.landed).toBe(true);

    // Verify Phase 1 textures are loaded and P2/P3 are not loaded
    let p1Loaded = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return {
        p1_a: scene.textures.exists('red_dragon_p1_a'),
        p2_a: scene.textures.exists('red_dragon_p2_a'),
        p3_a: scene.textures.exists('red_dragon_p3_a'),
      };
    });
    expect(p1Loaded.p1_a).toBe(true);
    expect(p1Loaded.p2_a).toBe(false);
    expect(p1Loaded.p3_a).toBe(false);

    // Capture Phase 1 screenshot
    const screenshotsDir = path.resolve('tests/e2e/__screenshots__');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(screenshotsDir, 'boss-dragon-p1.png') });

    // 2. Drive HP down to 66% threshold (792 HP) to trigger P1 -> P2 transition
    await page.evaluate(() => {
      (window as any).__hv.setDragonHp(0.66);
    });

    // Verify dragon immediately enters invulnerable TRANSITION state
    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.invulnerable).toBe(true);
    expect(state.state).toBe('TRANSITION');

    // Attempt to deal damage during transition: damage MUST be ignored
    const hpDuringTransition = state.hp;
    await page.evaluate(() => {
      // Try to set HP down to 50% during transition
      (window as any).__hv.setDragonHp(0.50);
    });
    const stateStillInTransition = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(stateStillInTransition.hp).toBe(hpDuringTransition);

    // Wait for transition to complete into Phase 2
    await page.waitForFunction(() => {
      const s = (window as any).__hv.dragonState();
      const scene = (window as any).__scene;
      return s && s.phase === 2 && !s.invulnerable && s.airborne && scene?.textures?.exists('red_dragon_p2_a');
    }, null, { timeout: 10000 });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.phase).toBe(2);
    expect(state.invulnerable).toBe(false);
    expect(state.airborne).toBe(true);
    expect(state.landed).toBe(false);

    // Verify texture eviction: P1 pages evicted, P2 pages loaded
    let p2Loaded = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return {
        p1_a: scene.textures.exists('red_dragon_p1_a'),
        p2_a: scene.textures.exists('red_dragon_p2_a'),
        p2_land: scene.textures.exists('red_dragon_p2_land'),
        p3_a: scene.textures.exists('red_dragon_p3_a'),
      };
    });
    expect(p2Loaded.p1_a).toBe(false);
    expect(p2Loaded.p2_a).toBe(true);
    expect(p2Loaded.p2_land).toBe(true);
    expect(p2Loaded.p3_a).toBe(false);

    await page.screenshot({ path: path.join(screenshotsDir, 'boss-dragon-p2.png') });

    // 3. Drive HP down to 33% threshold (396 HP) to trigger P2 -> P3 transition
    await page.evaluate(() => {
      (window as any).__hv.setDragonHp(0.33);
    });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.invulnerable).toBe(true);
    expect(state.state).toBe('TRANSITION');

    // Wait for transition to complete into Phase 3
    await page.waitForFunction(() => {
      const s = (window as any).__hv.dragonState();
      const scene = (window as any).__scene;
      return s && s.phase === 3 && !s.invulnerable && !s.airborne && scene?.textures?.exists('red_dragon_p3_a');
    }, null, { timeout: 10000 });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.phase).toBe(3);
    expect(state.invulnerable).toBe(false);
    expect(state.airborne).toBe(false);
    expect(state.landed).toBe(true);

    // Verify texture eviction: P2 pages evicted, P3 pages loaded
    let p3Loaded = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return {
        p1_a: scene.textures.exists('red_dragon_p1_a'),
        p2_a: scene.textures.exists('red_dragon_p2_a'),
        p3_a: scene.textures.exists('red_dragon_p3_a'),
        p3_b: scene.textures.exists('red_dragon_p3_b'),
      };
    });
    expect(p3Loaded.p1_a).toBe(false);
    expect(p3Loaded.p2_a).toBe(false);
    expect(p3Loaded.p3_a).toBe(true);
    expect(p3Loaded.p3_b).toBe(true);

    await page.screenshot({ path: path.join(screenshotsDir, 'boss-dragon-p3.png') });

    // 4. Drive HP down to 0: triggers death sequence
    await page.evaluate(() => {
      (window as any).__hv.setDragonHp(0);
    });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.hp).toBe(0);
    expect(state.state).toBe('DEAD');
    expect(state.invulnerable).toBe(true);

    await page.screenshot({ path: path.join(screenshotsDir, 'boss-dragon-death.png') });

    // 5. Test encounter reset
    await page.evaluate(() => {
      (window as any).__hv.resetDragon();
    });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.phase).toBe(1);
    expect(state.hp).toBe(1200);
    expect(state.invulnerable).toBe(false);
    expect(state.airborne).toBe(false);
    expect(state.landed).toBe(true);
  });

  test('Phase 2 landing window: airborne resists melee, lands after volley, and takes melee hit while landed', async ({ page }) => {
    // 1. Boot with QA mode
    await page.goto('/?renderer=blend&maps=tiled&qa=1&seed=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(600);
    await startButton.click();

    // Select Knight class (index 0)
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for __hv in village scene
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.spawnDragon === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // Get player position and preload Phase 2 textures
    const playerPos = await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.assetRegistry.loadDragonPhase(2);
      return (window as any).__hv.player();
    });

    // Wait for Phase 2 texture to load
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      return Boolean(scene?.textures?.exists('red_dragon_p2_a'));
    }, null, { timeout: 10000 });

    // Spawn dragon in Phase 2 right in front of the player (facing right)
    await page.evaluate(({ px, py }) => {
      const dragonX = px + 45;
      const dragonY = py;
      (window as any).__hv.spawnDragon({ x: dragonX, y: dragonY, phase: 2 });
    }, { px: playerPos.x, py: playerPos.y });

    // Verify spawned in Phase 2 hovering
    let state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.phase).toBe(2);
    expect(state.airborne).toBe(true);

    // Initial HP
    const initialHp = state.hp;

    // Ensure player is facing right toward dragon
    await page.evaluate(() => {
      const s = (window as any).__scene;
      s.facingX = 1;
      s.facingY = 0;
    });

    // Swing sword (Space) while dragon is airborne
    await page.keyboard.press('Space', { delay: 60 });
    await page.waitForTimeout(300);

    // HP must be unchanged because dragon is airborne
    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.hp).toBe(initialHp);

    // Trigger volley and subsequent landing
    await page.evaluate(() => {
      const dragon = (window as any).__scene._dragon;
      dragon.ai.triggerAttack('volley');
      dragon.ai.completeAttack();
    });

    // Verify dragon is landed
    await page.waitForFunction(() => {
      const s = (window as any).__hv.dragonState();
      return s && s.landed && !s.airborne;
    }, null, { timeout: 5000 });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.landed).toBe(true);
    expect(state.airborne).toBe(false);

    // Ensure player is facing right toward dragon
    await page.evaluate(() => {
      const s = (window as any).__scene;
      s.facingX = 1;
      s.facingY = 0;
    });

    // Wait for player melee attack cooldown (ATTACK_MS.knight = 500ms)
    await page.waitForTimeout(600);

    // Swing sword while dragon is landed
    await page.keyboard.press('Space', { delay: 60 });

    // Wait for melee damage to land
    await page.waitForFunction(() => {
      const s = (window as any).__hv.dragonState();
      return s && s.hp < 1200;
    }, null, { timeout: 5000 });

    state = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(state.hp, 'Melee hit lands after P2 landing').toBeLessThan(initialHp);

    const screenshotsDir = path.resolve('tests/e2e/__screenshots__');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(screenshotsDir, 'boss-dragon-landed-hit.png') });
  });
});
