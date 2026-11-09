import { test, expect } from '@playwright/test';

test.describe('Package L-5: Chat SSE Streaming & Subtitle Increments', () => {
  test('subtitles appear incrementally as deltas arrive in bartender dialogue', async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // Mock SSE stream to simulate real-time deltas
    await page.route('**/api/chat/stream', async (route) => {
      const sseChunks = [
        'event: meta\ndata: {"npc":"bartender","sessionId":"sess-e2e","caps":{"maxSentences":8}}\n\n',
        'event: delta\ndata: {"text":"The "}\n\n',
        'event: delta\ndata: {"text":"Cavern "}\n\n',
        'event: delta\ndata: {"text":"of "}\n\n',
        'event: delta\ndata: {"text":"Embers "}\n\n',
        'event: delta\ndata: {"text":"lies to the south."}\n\n',
        'event: done\ndata: {"reply":"The Cavern of Embers lies to the south.","npc":"bartender","sessionId":"sess-e2e"}\n\n',
      ];

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
        body: sseChunks.join(''),
      });
    });

    await page.goto('/?seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(600);
    await startButton.click();

    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    const chooseButtons = page.getByRole('button', { name: 'Choose' });
    await chooseButtons.first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for client API and event bus
    await page.waitForFunction(() => typeof (window as any).__chatEventBus?.emit === 'function');

    // Trigger bartender dialogue
    await page.evaluate(() => {
      (window as any).__chatEventBus.emit('npc:interact', { npc: 'bartender' });
    });

    const chatModal = page.locator('text=Tharos the Bartender');
    await expect(chatModal).toBeVisible({ timeout: 5000 });

    const dragonBtn = page.getByRole('button', { name: 'Ask about the Dragon Quest' });
    await expect(dragonBtn).toBeVisible();
    await dragonBtn.click();

    // Verify the incrementally streamed response renders in the assistant chat bubble
    const assistantBubble = page.locator('text=The Cavern of Embers lies to the south.');
    await expect(assistantBubble).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'tests/e2e/__screenshots__/l5-chat-stream-subtitles.png' });
  });

  test('falls back to /api/chat when /api/chat/stream fails', async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // Simulate 500 error on stream
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 500,
        body: 'Internal Server Error',
      });
    });

    let fallbackCalled = false;
    await page.route('**/api/chat', async (route) => {
      fallbackCalled = true;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: 'Fallback reply from Tharos: Beware the dragon.',
          npc: 'bartender',
          meta: { sessionId: 'sess-fb' },
        }),
      });
    });

    await page.goto('/?seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(600);
    await startButton.click();

    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    const chooseButtons = page.getByRole('button', { name: 'Choose' });
    await chooseButtons.first().click();
    await expect(classModalHeading).toBeHidden();

    await page.waitForFunction(() => typeof (window as any).__chatEventBus?.emit === 'function');

    await page.evaluate(() => {
      (window as any).__chatEventBus.emit('npc:interact', { npc: 'bartender' });
    });

    const chatModal = page.locator('text=Tharos the Bartender');
    await expect(chatModal).toBeVisible({ timeout: 5000 });

    const dragonBtn = page.getByRole('button', { name: 'Ask about the Dragon Quest' });
    await expect(dragonBtn).toBeVisible();
    await dragonBtn.click();

    const fallbackBubble = page.locator('text=Fallback reply from Tharos: Beware the dragon.');
    await expect(fallbackBubble).toBeVisible({ timeout: 5000 });
    expect(fallbackCalled).toBe(true);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/l5-chat-fallback.png' });
  });
});
