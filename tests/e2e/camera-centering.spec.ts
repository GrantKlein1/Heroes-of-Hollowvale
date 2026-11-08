import { test, expect } from '@playwright/test';

test.describe('Camera Centering and Viewport Layout Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Centers world view with balanced margins and correct pointer coords at 1280x720, 1920x1080, and after resize', async ({ page }) => {
    // 1. Boot at 1280x720
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    const chooseButton = page.getByRole('button', { name: 'Choose' }).first();
    await expect(chooseButton).toBeVisible();
    await chooseButton.click();

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');
    await page.waitForTimeout(500);

    // Verify 1280x720 metrics
    const metrics720 = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const cam = scene.cameras.main;
      const p = scene.player;
      return {
        zoom: cam.zoom,
        camW: cam.width,
        camH: cam.height,
        worldView: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height },
        bounds: { x: cam._bounds.x, y: cam._bounds.y, w: cam._bounds.width, h: cam._bounds.height },
        playerScale: { x: p.scaleX, y: p.scaleY },
        playerSize: { w: p.displayWidth, h: p.displayHeight },
      };
    });

    expect(metrics720.zoom).toBe(2);
    expect(metrics720.playerScale.x).toBe(1);
    expect(metrics720.playerScale.y).toBe(1);
    expect(metrics720.playerSize.w).toBe(64);
    expect(metrics720.playerSize.h).toBe(96);
    // At 1280x720 (zoom 2): dw = 640 matches map width exactly
    expect(metrics720.worldView.w).toBe(640);
    expect(metrics720.worldView.x).toBe(0);

    // Verify HUD is full width
    const hudOptions = page.getByRole('button', { name: 'Options' });
    await expect(hudOptions).toBeVisible();
    const optionsBox = await hudOptions.boundingBox();
    expect(optionsBox?.x).toBeGreaterThan(1150); // upper right of 1280 screen

    // Screenshot 1280x720
    await expect(page).toHaveScreenshot('camera-centering-720p.png');

    // 2. Test 1920x1080 (3x zoom)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    const metrics1080 = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const cam = scene.cameras.main;
      return {
        zoom: cam.zoom,
        camW: cam.width,
        camH: cam.height,
        worldView: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height },
        bounds: { x: cam._bounds.x, y: cam._bounds.y, w: cam._bounds.width, h: cam._bounds.height },
      };
    });

    expect(metrics1080.zoom).toBe(3);
    expect(metrics1080.worldView.w).toBe(640);
    expect(metrics1080.worldView.x).toBe(0);

    const optionsBox1080 = await hudOptions.boundingBox();
    expect(optionsBox1080?.x).toBeGreaterThan(1800); // upper right of 1920 screen

    // Screenshot 1920x1080
    await expect(page).toHaveScreenshot('camera-centering-1080p.png');

    // 3. Test non-standard aspect ratio resize (1400x900) where view exceeds 640x384 map
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(300);

    const metricsResized = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const cam = scene.cameras.main;
      const view = cam.worldView;
      return {
        zoom: cam.zoom,
        camW: cam.width,
        camH: cam.height,
        worldView: { x: view.x, y: view.y, w: view.width, h: view.height },
        bounds: { x: cam._bounds.x, y: cam._bounds.y, w: cam._bounds.width, h: cam._bounds.height },
        // Screen position of map (0, 0)
        screenMapLeft: (0 - view.x) * cam.zoom,
        screenMapTop: (0 - view.y) * cam.zoom,
        // Screen position of map right/bottom edge (640, 384)
        screenMapRight: (640 - view.x) * cam.zoom,
        screenMapBottom: (384 - view.y) * cam.zoom,
      };
    });

    // In 1400x900 at zoom 2:
    // dw = 700 (map is 640 -> 60 extra world px = 120 screen px -> 60px margin on each side)
    // dh = 450 (map is 384 -> 66 extra world px = 132 screen px -> 66px margin on each side)
    expect(metricsResized.zoom).toBe(2);
    expect(metricsResized.bounds.w).toBe(700);
    expect(metricsResized.bounds.h).toBe(450);
    expect(metricsResized.bounds.x).toBe(-30);
    expect(metricsResized.bounds.y).toBe(-33);

    // Verify margins are symmetrical (not anchored to 0 top-left!)
    expect(metricsResized.screenMapLeft).toBe(60);
    expect(metricsResized.camW - metricsResized.screenMapRight).toBe(60);
    expect(metricsResized.screenMapTop).toBe(66);
    expect(metricsResized.camH - metricsResized.screenMapBottom).toBe(66);

    // 4. Verify pointer coordinate translation with centered margins
    // Hover mouse at screen (60, 66) -> should map exactly to world (0, 0)
    await page.mouse.move(60, 66);
    const pointerWorldOrigin = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const ptr = scene.input.activePointer;
      const wp = scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
      return { x: Math.round(wp.x), y: Math.round(wp.y) };
    });
    expect(pointerWorldOrigin.x).toBe(0);
    expect(pointerWorldOrigin.y).toBe(0);

    // Hover mouse at center of window (700, 450) -> should map to center of map (320, 192)
    await page.mouse.move(700, 450);
    const pointerWorldCenter = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const ptr = scene.input.activePointer;
      const wp = scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
      return { x: Math.round(wp.x), y: Math.round(wp.y) };
    });
    expect(pointerWorldCenter.x).toBe(320);
    expect(pointerWorldCenter.y).toBe(192);

    // Screenshot resized 1400x900
    await expect(page).toHaveScreenshot('camera-centering-resized-1400x900.png');
  });
});

