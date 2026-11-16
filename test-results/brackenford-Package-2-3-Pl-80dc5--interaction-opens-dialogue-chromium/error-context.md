# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: brackenford.spec.ts >> Package 2-3: Playable Brackenford Tiled Map Integration (?maps=tiled) >> Tavern door exit leads to tavern and NPC interaction opens dialogue
- Location: tests\e2e\brackenford.spec.ts:196:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Tharos').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('text=Tharos').first() with timeout 5000ms
  - waiting for locator('text=Tharos').first()

```

```yaml
- text: "WASD: Move E: Interact V: Inventory F2: Collision Explore the tavern. Press E near the bottom to exit"
- button "Options"
- text: Iron Sword
- img "Wooden Shield"
- img "Iron Sword"
- text: "1"
- img "Healing Potion"
- text: 2 3 4 5 6
- img "Emerald"
- text: 7 2
- img "Sapphire"
- text: 8 2
- img "Ruby"
- text: 9 2
```

# Test source

```ts
  145 | 
  146 |     await page.keyboard.down('KeyS');
  147 |     await page.waitForFunction(() => (window as any).__scene.player.y > 256, { timeout: 10000 });
  148 |     await page.keyboard.up('KeyS');
  149 | 
  150 |     const fordCrossedY = await page.evaluate(() => (window as any).__scene.player.y);
  151 |     expect(fordCrossedY).toBeGreaterThan(256);
  152 |   });
  153 | 
  154 |   test('Overhead roofs and tree canopies have no collision and occlude player properly', async ({ page }) => {
  155 |     await page.addInitScript(() => {
  156 |       window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  157 |     });
  158 | 
  159 |     await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
  160 |     const startButton = page.getByRole('button', { name: 'Start Game' });
  161 |     await startButton.click();
  162 |     await page.getByRole('button', { name: 'Choose' }).first().click();
  163 | 
  164 |     await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');
  165 | 
  166 |     // Verify player can stand under tree pine canopy / tavern roof eaves without collision
  167 |     const occlusionCheck = await page.evaluate(() => {
  168 |       const scene = (window as any).__scene;
  169 |       const player = scene.player;
  170 |       const loader = scene.tiledMapLoader;
  171 | 
  172 |       // Position under pine canopy (x: 102, y: 70)
  173 |       player.setPosition(102, 70);
  174 |       player.body.reset(102, 70);
  175 | 
  176 |       // Verify no collision under canopy
  177 |       const blocked = loader.isBlockedPoint(102, 70);
  178 | 
  179 |       // Verify depth sorting: overhead canopy depth is 30000, player depth is feetY (~70)
  180 |       const canopyProp = loader.propObjects.find((p: any) => p.name === 'tree_pine_canopy');
  181 |       const playerDepth = player.depth;
  182 | 
  183 |       return {
  184 |         blockedUnderCanopy: blocked,
  185 |         canopyDepth: canopyProp?.depth,
  186 |         playerDepth,
  187 |         occluded: playerDepth < (canopyProp?.depth || 0),
  188 |       };
  189 |     });
  190 | 
  191 |     expect(occlusionCheck.blockedUnderCanopy).toBe(false);
  192 |     expect(occlusionCheck.canopyDepth).toBe(30000);
  193 |     expect(occlusionCheck.occluded).toBe(true);
  194 |   });
  195 | 
  196 |   test('Tavern door exit leads to tavern and NPC interaction opens dialogue', async ({ page }) => {
  197 |     await page.addInitScript(() => {
  198 |       window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  199 |     });
  200 | 
  201 |     await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
  202 |     const startButton = page.getByRole('button', { name: 'Start Game' });
  203 |     await startButton.click();
  204 |     await page.getByRole('button', { name: 'Choose' }).first().click();
  205 | 
  206 |     await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');
  207 | 
  208 |     // 1. Move player to tavern door zone (x: 288, y: 155) and press E to travel
  209 |     await page.evaluate(() => {
  210 |       const scene = (window as any).__scene;
  211 |       scene.player.setPosition(288, 155);
  212 |       scene.player.body.reset(288, 155);
  213 |     });
  214 | 
  215 |     // Press E to enter tavern
  216 |     await page.keyboard.press('e');
  217 |     await page.waitForTimeout(300);
  218 | 
  219 |     // If still in village, trigger interact directly
  220 |     await page.evaluate(() => {
  221 |       if ((window as any).__hv?.scene() === 'village') {
  222 |         (window as any).__scene._tryInteract();
  223 |       }
  224 |     });
  225 | 
  226 |     // Wait for tavern scene to load
  227 |     await page.waitForFunction(() => (window as any).__hv?.scene() === 'tavern', { timeout: 10000 });
  228 |     expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('tavern');
  229 | 
  230 |     // 2. In tavern, walk up to bartender and press E to trigger NPC dialogue
  231 |     await page.evaluate(() => {
  232 |       const scene = (window as any).__scene;
  233 |       scene.player.setPosition(scene.worldW * 0.5, scene.worldH * 0.5);
  234 |       scene.player.body.reset(scene.worldW * 0.5, scene.worldH * 0.5);
  235 |     });
  236 | 
  237 |     await page.keyboard.press('e');
  238 |     await page.waitForTimeout(300);
  239 |     await page.evaluate(() => {
  240 |       (window as any).__scene._tryInteract();
  241 |     });
  242 | 
  243 |     // Verify dialogue chat window opens
  244 |     const dialogueBox = page.locator('text=Tharos');
> 245 |     await expect(dialogueBox.first()).toBeVisible({ timeout: 5000 });
      |                                       ^ Error: expect(locator).toBeVisible() failed
  246 |   });
  247 | 
  248 |   test('Calibrated viewports at 1280x720 (2x) and 1920x1080 (3x) across all 4 classes', async ({ page }) => {
  249 |     await page.addInitScript(() => {
  250 |       window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  251 |     });
  252 | 
  253 |     for (const { id: classId, name: className, index: classIndex } of CLASSES) {
  254 |       await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');
  255 |       await page.getByRole('button', { name: 'Start Game' }).click();
  256 |       await page.getByRole('button', { name: 'Choose' }).nth(classIndex).click();
  257 | 
  258 |       await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');
  259 | 
  260 |       // Test 1280x720: integer 2x zoom
  261 |       await page.setViewportSize({ width: 1280, height: 720 });
  262 |       await page.waitForTimeout(200);
  263 | 
  264 |       const zoom720 = await page.evaluate(() => (window as any).__hv.zoom());
  265 |       expect(zoom720).toBe(2);
  266 | 
  267 |       // Test 1920x1080: integer 3x zoom
  268 |       await page.setViewportSize({ width: 1920, height: 1080 });
  269 |       await page.waitForTimeout(200);
  270 | 
  271 |       const zoom1080 = await page.evaluate(() => (window as any).__hv.zoom());
  272 |       expect(zoom1080).toBe(3);
  273 | 
  274 |       // Verify camera clamping inside [0, 0, 640, 384]
  275 |       const cameraBounds = await page.evaluate(() => {
  276 |         const scene = (window as any).__scene;
  277 |         const cam = scene.cameras.main;
  278 |         const view = cam.worldView;
  279 |         return {
  280 |           zoom: cam.zoom,
  281 |           scrollX: cam.scrollX,
  282 |           scrollY: cam.scrollY,
  283 |           viewX: view.x,
  284 |           viewY: view.y,
  285 |           viewRight: view.right,
  286 |           viewBottom: view.bottom,
  287 |         };
  288 |       });
  289 | 
  290 |       expect(cameraBounds.viewX).toBeGreaterThanOrEqual(-1);
  291 |       expect(cameraBounds.viewRight).toBeLessThanOrEqual(641);
  292 |       expect(cameraBounds.viewY).toBeGreaterThanOrEqual(-1);
  293 |       expect(cameraBounds.viewBottom).toBeLessThanOrEqual(385);
  294 | 
  295 |       // Test combat attack trigger
  296 |       await page.keyboard.press('Space');
  297 |       await page.waitForTimeout(100);
  298 | 
  299 |       const animKey = await page.evaluate(() => (window as any).__hv.anim());
  300 |       expect(animKey).toContain(classId);
  301 | 
  302 |       // Capture screenshot for each class in Brackenford
  303 |       await page.waitForTimeout(300);
  304 |       await expect(page).toHaveScreenshot(`brackenford-${classId}-1080p.png`);
  305 |     }
  306 |   });
  307 | });
  308 | 
```