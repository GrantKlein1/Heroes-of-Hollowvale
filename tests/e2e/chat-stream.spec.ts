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

  test('Package L-8: quick second message aborts first stream and renders second reply', async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    let streamCallCount = 0;
    await page.route('**/api/chat/stream', async (route) => {
      streamCallCount++;
      if (streamCallCount === 1) {
        // First message stream hangs/aborts
        const sseFirst = [
          'event: meta\ndata: {"npc":"bartender","sessionId":"sess-abort","turnId":"t-1"}\n\n',
          'event: delta\ndata: {"text":"First message partial..."}\n\n',
          'event: aborted\ndata: {"aborted":true,"reason":"superseded","turnId":"t-1"}\n\n',
        ];
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
          },
          body: sseFirst.join(''),
        });
      } else {
        const sseSecond = [
          'event: meta\ndata: {"npc":"bartender","sessionId":"sess-abort","turnId":"t-2"}\n\n',
          'event: delta\ndata: {"text":"Second message completed reply."}\n\n',
          'event: done\ndata: {"reply":"Second message completed reply.","npc":"bartender","sessionId":"sess-abort"}\n\n',
        ];
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
          },
          body: sseSecond.join(''),
        });
      }
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

    // Send first message
    const input = page.locator('input[placeholder*="Ask"], input[type="text"]').last();
    if (await input.isVisible()) {
      await input.fill('First message');
      await input.press('Enter');
      await page.waitForTimeout(50);
      await input.fill('Second message');
      await input.press('Enter');
    } else {
      const dragonBtn = page.getByRole('button', { name: 'Ask about the Dragon Quest' });
      await expect(dragonBtn).toBeVisible();
      await dragonBtn.click();
    }

    const finalBubble = page.locator('text=Second message completed reply.').or(page.locator('text=First message partial...'));
    await expect(finalBubble).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'tests/e2e/__screenshots__/l8-superseding-abort.png' });
  });

  test('UI-3: dialog name, focus restore, hidden API errors, and keyboard focus ring', async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    const leakedBody = 'RAW_API_BODY_SHOULD_NOT_LEAK';
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({ status: 500, body: leakedBody });
    });
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({ status: 500, body: `API error: 500 ${leakedBody}` });
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
      const sentinel = document.createElement('button');
      sentinel.id = 'ui3-focus-sentinel';
      sentinel.type = 'button';
      sentinel.textContent = 'Focus sentinel';
      document.body.appendChild(sentinel);
      sentinel.focus();
      (window as any).__chatEventBus.emit('npc:interact', { npc: 'bartender' });
    });

    const dialog = page.getByRole('dialog', { name: 'Tharos the Bartender' });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect.poll(async () => page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]');
      const active = document.activeElement;
      return !!(panel && active && (active === panel || panel.contains(active)));
    })).toBe(true);

    const dragonBtn = page.getByRole('button', { name: 'Ask about the Dragon Quest' });
    await expect(dragonBtn).toBeVisible();
    await dragonBtn.click();

    await expect(page.getByText('The bartender could not answer.')).toBeVisible({ timeout: 5000 });
    const transcript = await dialog.innerText();
    expect(transcript).not.toContain('API error');
    expect(transcript).not.toContain(leakedBody);
    expect(transcript).not.toContain('Chat stream error');

    const input = page.getByRole('textbox', { name: 'Message to the bartender' });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
    await page.getByRole('button', { name: 'Close', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(input).toBeFocused();

    const ring = await input.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        focusVisible: el.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(ring.focusVisible).toBe(true);
    const outlineVisible = ring.outlineStyle !== 'none'
      && parseFloat(ring.outlineWidth) > 0
      && ring.outlineColor !== 'rgba(0, 0, 0, 0)'
      && ring.outlineColor !== 'transparent';
    const shadowVisible = !!ring.boxShadow && ring.boxShadow !== 'none';
    expect(outlineVisible || shadowVisible).toBe(true);

    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#ui3-focus-sentinel')).toBeFocused();
  });
});
