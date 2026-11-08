import { test, expect } from '@playwright/test';

test.describe('Package 1-5 — Lane C Player: Atlas Projectiles & Spells', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio playback in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Fireball spawns at meta offset, uses atlas frames, and consumes 15 mana', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Mage (index 1)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(1).click();
    await expect(chooseModal).toBeHidden();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // Cast fireball via QA API
    const castResult = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const player = scene.player;
      player.setPosition(200, 200);
      player.setFacing('down');
      const manaBefore = scene.mana;

      // Cast fireball
      (window as any).__hv.cast('fireball');

      const projectiles = scene.projectiles || [];
      const proj = projectiles[projectiles.length - 1];

      return {
        manaBefore,
        manaAfter: scene.mana,
        projX: proj?.x,
        projY: proj?.y,
        projKey: proj?.texture?.key,
        playerX: player.x,
        playerY: player.y,
        playerFacing: player.facing,
      };
    });

    // Acceptance criterion 2: 15 mana cost
    expect(castResult.manaBefore).toBe(100);
    expect(castResult.manaAfter).toBe(85);

    // Acceptance criterion 1: Fireball spawns within +-2 px of meta offset
    // Meta offset for down: { x: -15, y: -56 }
    const expectedX = castResult.playerX - 15;
    const expectedY = castResult.playerY - 56;
    expect(Math.abs(castResult.projX - expectedX)).toBeLessThanOrEqual(2);
    expect(Math.abs(castResult.projY - expectedY)).toBeLessThanOrEqual(2);
    expect(castResult.projKey).toBe('fireball');

    // Verify no GIF files loaded in Phaser textures
    const textures = await page.evaluate(() => (window as any).__hv.textures());
    const gifTextures = textures.filter((k: string) => k.toLowerCase().endsWith('.gif') || k.toLowerCase().includes('.gif'));
    expect(gifTextures).toEqual([]);
  });

  test('Thief poison vial uses atlas frames (no .gif loaded)', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Thief (index 2)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(2).click();
    await expect(chooseModal).toBeHidden();

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');

    // Select hotbar slot 1 (poison vial) and trigger attack
    const throwResult = await page.evaluate(async () => {
      const scene = (window as any).__scene;
      const session = (window as any).__session || scene.session;

      // Set equipped to poison vial
      session.equippedId = 'poison_vial';
      scene._tryAttack(performance.now());

      const projectiles = scene.projectiles || [];
      const proj = projectiles[projectiles.length - 1];

      return {
        projKey: proj?.texture?.key,
        flyAnim: proj?.flyAnim,
        isArc: proj?.isArc,
        bakedSpin: proj?.bakedSpin,
      };
    });

    expect(throwResult.projKey).toBe('thief_fx');
    expect(throwResult.flyAnim).toBe('thief_poison_vial');
    expect(throwResult.isArc).toBe(true);
    expect(throwResult.bakedSpin).toBe(true);

    // Acceptance criterion 3: Poison vial uses atlas frames (no .gif loaded)
    const textures = await page.evaluate(() => (window as any).__hv.textures());
    const gifTextures = textures.filter((k: string) => k.toLowerCase().endsWith('.gif') || k.toLowerCase().includes('.gif'));
    expect(gifTextures).toEqual([]);
  });

  test('Mage attack_2 melee attack regression from BUG-3 is preserved', async ({ page }) => {
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();

    // Select Mage
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(1).click();
    await expect(chooseModal).toBeHidden();

    await page.waitForFunction(() => (window as any).__hv?.anim() === 'mage_idle_down');

    // Press Space for melee attack
    await page.keyboard.press('Space', { delay: 60 });

    // Verify attack animation starts and plays mage_attack_2_down
    await page.waitForFunction(() => {
      const anim = (window as any).__hv.anim();
      return anim && anim.includes('attack_2');
    }, null, { timeout: 2000 });

    // Safely returns to idle
    await page.waitForFunction(() => (window as any).__hv.anim() === 'mage_idle_down', null, { timeout: 3000 });
  });
});
