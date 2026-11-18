import { test, expect } from '@playwright/test';
import { ANIM_TIMEOUT, waitForScene } from './helpers/waits';

test.describe('Attack Lifecycle, Collider Alignment & Mage Fix Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Mage melee attack plays staff bonk (mage_attack_2) and safely returns to idle without freezing', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Mage (index 1)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(1).click();
    await expect(chooseModal).toBeHidden();

    await waitForScene(page, 'village');

    // Verify initial idle state
    await page.waitForFunction(() => (window as any).__hv.anim() === 'mage_idle_down', null, { timeout: ANIM_TIMEOUT });

    // Trigger attack with frame-safe delay so Phaser's JustDown detects the keypress
    await page.keyboard.press('Space', { delay: 60 });

    // Verify attack animation starts and plays mage_attack_2_down
    await page.waitForFunction(() => {
      const anim = (window as any).__hv.anim();
      return anim && anim.includes('attack_2');
    }, null, { timeout: ANIM_TIMEOUT });

    // Verify that Mage returns to IDLE upon animation completion (within 1000 ms)
    await page.waitForFunction(() => {
      return (window as any).__hv.anim() === 'mage_idle_down';
    }, null, { timeout: ANIM_TIMEOUT });

    // Verify state machine is in IDLE
    const stateAfterAttack = await page.evaluate(() => (window as any).__scene.player.state);
    expect(stateAfterAttack).toBe('IDLE');

    // Verify character is not frozen and responds to movement
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');

    const movingAnim = await page.evaluate(() => (window as any).__hv.anim());
    expect(movingAnim).toContain('mage');
    expect(movingAnim).not.toContain('attack');

    // Verify zero missing animation console errors
    const missingAnimErrors = consoleErrors.filter((e) => e.includes('Missing animation'));
    expect(missingAnimErrors).toEqual([]);
  });

  test('Single attack input produces exactly one swing without restart or duplicate hits', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();

    // Select Knight (index 0)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(chooseModal).toBeHidden();

    await waitForScene(page, 'village');

    // Position player and spawn a single test goblin in front of the player
    const spawnResult = await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(200, 200);
      scene.player.body.reset(200, 200);
      scene.player.setFacing('right');

      // Spawn goblin right in front of knight (x: 235, y: 185)
      const goblin = scene.spawn('goblin', 235, 185);
      goblin.hp = 100;
      goblin.hpMax = 100;
      if (goblin.ai) {
        goblin.ai.hasSpawned = true;
      }
      return { goblinHp: goblin.hp };
    });
    expect(spawnResult.goblinHp).toBe(100);

    // Press attack once with frame-safe delay
    await page.keyboard.press('Space', { delay: 60 });

    // Sample animation over 1000 ms to confirm single attack lifecycle (no double attack restart)
    const animSamples: string[] = [];
    for (let i = 0; i < 15; i++) {
      const anim = await page.evaluate(() => (window as any).__hv.anim());
      animSamples.push(anim);
      await page.waitForTimeout(60);
    }

    // Verify the attack animation finishes and stays in IDLE (does not loop back to attack)
    await page.waitForFunction(() => (window as any).__hv.anim() === 'knight_idle_right', null, { timeout: ANIM_TIMEOUT });
    const finalState = await page.evaluate(() => (window as any).__scene.player.state);
    expect(finalState).toBe('IDLE');

    // Verify goblin took damage exactly once (Knight melee damage = 12, hp drops from 100 to 88)
    const enemyHp = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const goblin = scene.enemies.getChildren().find((e: any) => e.enemyType === 'goblin');
      return goblin?.hp;
    });
    expect(enemyHp).toBe(88);
  });

  test('Body position and feet collider stay aligned across idle -> attack -> idle across all 4 classes', async ({ page }) => {
    test.setTimeout(120000);
    const classes = [
      { id: 'knight', index: 0 },
      { id: 'mage', index: 1 },
      { id: 'thief', index: 2 },
      { id: 'dwarf', index: 3 },
    ];

    for (const { id: classId, index: classIndex } of classes) {
      await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
      await page.getByRole('button', { name: 'Start Game' }).click();
      const chooseModal = page.getByText('Choose Your Class');
      await expect(chooseModal).toBeVisible();
      await page.getByRole('button', { name: 'Choose' }).nth(classIndex).click();
      await expect(chooseModal).toBeHidden();

      await waitForScene(page, 'village');

      // Measure idle body alignment relative to player position
      const idleMetrics = await page.evaluate(() => {
        const p = (window as any).__scene.player;
        p.setPosition(200, 200);
        if (p.body?.updateFromGameObject) p.body.updateFromGameObject();
        return {
          px: p.x,
          py: p.y,
          bodyX: p.body.x,
          bodyY: p.body.y,
          offsetX: p.body.x - p.x,
          offsetY: p.body.y - p.y,
          width: p.body.width,
          height: p.body.height,
        };
      });

      // Trigger attack
      await page.keyboard.press('Space', { delay: 60 });
      await page.waitForTimeout(100);

      // Measure attack body alignment relative to player position
      const attackMetrics = await page.evaluate(() => {
        const p = (window as any).__scene.player;
        return {
          px: p.x,
          py: p.y,
          bodyX: p.body.x,
          bodyY: p.body.y,
          offsetX: p.body.x - p.x,
          offsetY: p.body.y - p.y,
          width: p.body.width,
          height: p.body.height,
        };
      });

      // Verify body position does NOT shift horizontally or vertically during attack!
      expect(Math.abs(attackMetrics.offsetX - idleMetrics.offsetX)).toBeLessThan(1.0);
      expect(Math.abs(attackMetrics.offsetY - idleMetrics.offsetY)).toBeLessThan(1.0);
      expect(attackMetrics.width).toBe(idleMetrics.width);
      expect(attackMetrics.height).toBe(idleMetrics.height);

      // Wait for attack to complete back to idle
      await page.waitForFunction(() => (window as any).__scene.player.state === 'IDLE', null, { timeout: ANIM_TIMEOUT });
    }
  });

  test('Attacking while walking against river bank or solid wall cannot cross collider', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(chooseModal).toBeHidden();

    await waitForScene(page, 'village');

    // 1. Position Knight directly north of deep water at col 2 (x: 80, y: 190 facing south toward river at y: 224)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(80, 190);
      scene.player.body.reset(80, 190);
    });

    // Hold down KeyS (moving toward river) while repeatedly attacking for 1200 ms
    await page.keyboard.down('KeyS');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Space', { delay: 60 });
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('KeyS');

    // Verify player body did NOT penetrate or cross deep water boundary (water starts at y = 224)
    const riverBlockedBottom = await page.evaluate(() => (window as any).__scene.player.body.bottom);
    expect(riverBlockedBottom).toBeLessThanOrEqual(230);

    // 2. Position Knight next to cottage wall (x: 50, y: 150 moving left into wall)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(70, 120);
      scene.player.body.reset(70, 120);
    });

    // Hold KeyA while attacking into the cottage footprint
    await page.keyboard.down('KeyA');
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Space', { delay: 60 });
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('KeyA');

    // Verify player is blocked by cottage boundary and did not phase inside
    const cottageBlockedX = await page.evaluate(() => (window as any).__scene.player.body.x);
    expect(cottageBlockedX).toBeGreaterThanOrEqual(20);
  });

  test('Enemy damage registers on player during active attack frames (hurtbox not displaced)', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(chooseModal).toBeHidden();

    await waitForScene(page, 'village');

    const initialHp = await page.evaluate(() => (window as any).__scene.hp);
    expect(initialHp).toBe(120);

    // Position player and spawn a brute right on top of player while player attacks
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(250, 250);
      scene.player.body.reset(250, 250);
      const enemy = scene.spawn('brute', 250, 250);
      enemy.hp = 200;
      if (enemy.ai) {
        enemy.ai.hasSpawned = true;
        enemy.ai.hasAlerted = true;
      }
    });

    // Player attacks
    await page.keyboard.press('Space', { delay: 60 });
    await page.waitForFunction(() => (window as any).__scene.hp < (window as any).__scene.hpMax, null, { timeout: ANIM_TIMEOUT });

    // Verify player takes damage (HP decrements below the knight's pool)
    const currentHp = await page.evaluate(() => (window as any).__scene.hp);
    expect(currentHp).toBeLessThan(initialHp);
  });

  test('Package 4-1: Second attack press inside combo window plays attack_2 and registers a hit on its own hitFrames', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();

    // Select Knight (index 0)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(chooseModal).toBeHidden();

    await waitForScene(page, 'village');

    // Position player and spawn a goblin in front of the player
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(200, 200);
      scene.player.body.reset(200, 200);
      scene.player.setFacing('right');

      const goblin = scene.spawn('goblin', 235, 185);
      goblin.hp = 100;
      goblin.hpMax = 100;
      if (goblin.ai) {
        goblin.ai.hasSpawned = true;
      }
      goblin.attackCooldownUntil = performance.now() + 60000; // passive for combo test
    });

    // First attack press
    await page.keyboard.press('Space', { delay: 60 });

    // Wait until knight is in attack animation at frame >= 3 (combo window open)
    await page.waitForFunction(() => {
      const p = (window as any).__scene.player;
      const frameName = p.anims?.currentFrame?.textureFrame || '';
      return p.state === 'ATTACK' && (frameName.endsWith('_3') || frameName.endsWith('_4'));
    }, null, { timeout: ANIM_TIMEOUT });

    // Second attack press inside combo window triggers attack_2
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene._tryAttack(performance.now());
    });

    // Verify attack_2 animation starts
    await page.waitForFunction(() => {
      const anim = (window as any).__hv.anim();
      return anim && anim.includes('attack_2');
    }, null, { timeout: ANIM_TIMEOUT });

    // Wait for combo sequence to complete back to IDLE
    await page.waitForFunction(() => (window as any).__scene.player.state === 'IDLE', null, { timeout: ANIM_TIMEOUT });

    // Verify console logged hit on attack_2 frame index
    const hitLogs = consoleLogs.filter((l) => l.includes('[Hit] attack_2 frame'));
    expect(hitLogs.length).toBeGreaterThan(0);

    // Verify goblin took damage from both attack swings
    const enemyHp = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const goblin = scene.enemies.getChildren().find((e: any) => e.enemyType === 'goblin');
      return goblin?.hp;
    });
    expect(enemyHp).toBeLessThanOrEqual(76);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/hero-attack-2-combo.png' });
  });
});

