import { test, expect } from '@playwright/test';

const DOWN = { x: -17.69, y: -34.81 };
const RIGHT = { x: 9.84, y: -33.18 };

test.describe('Package B10-1: thief poison vial wind-up', () => {
  test('holds the throw for 250 ms, then releases on the sheet offset', async ({ page }) => {
    const notFound: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404 && /thief_use_throw|thief_use_lockpick|dwarf_use_pickaxe|items_inhand_b10/.test(res.url())) {
        notFound.push(res.url());
      }
    });

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.goto('/?qa=1');
    await page.getByRole('button', { name: 'Start Game' }).click();
    const classModal = page.getByText('Choose Your Class');
    await expect(classModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).nth(2).click();
    await expect(classModal).toBeHidden();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        (window as any).__hv.scene() === 'village' &&
        Boolean((window as any).__scene?.player)
      );
    });

    await page.evaluate(() => {
      const w = window as any;
      w.__consumedEvents = [];
      w.__chatEventBus?.on('item:consumed', (evt: any) => {
        w.__consumedEvents.push(evt);
      });
      w.__vialSpawns = [];
      const scene = w.__scene;
      const list = scene.projectiles;
      const orig = list.push.bind(list);
      list.push = function (...args: any[]) {
        const proj = args[0];
        const player = scene.player;
        if (proj?.flyAnim === 'thief_poison_vial') {
          w.__vialSpawns.push({
            x: proj.x,
            y: proj.y,
            px: player.x,
            py: player.y,
            facing: player.facing,
          });
        }
        return orig(...args);
      };
    });

    const early = await page.evaluate(() => {
      const w = window as any;
      const scene = w.__scene;
      const player = scene.player;
      w.__session.equippedId = 'poison_vial';
      w.__session.classId = 'thief';
      player.setFacing('down');
      const started = performance.now();
      scene._tryAttack(started);
      const vials = (scene.projectiles || []).filter((p: any) => p.flyAnim === 'thief_poison_vial');
      if (typeof scene.sys?.game?.pause === 'function') scene.sys.game.pause();
      return {
        anim: w.__hv.anim(),
        count: vials.length,
        visible: Boolean(player.itemSprite?.visible),
        texture: player.itemSprite?.texture?.key || null,
        elapsed: performance.now() - started,
      };
    });

    expect(early.anim).toMatch(/^thief_use_throw_/);
    expect(early.count).toBe(0);
    expect(early.visible).toBe(true);
    expect(early.texture).toBe('items_inhand_b10');
    expect(early.elapsed).toBeLessThan(250);
    await page.screenshot({ path: 'tests/e2e/__screenshots__/b101-vial-windup.png' });

    await page.evaluate(() => {
      const game = (window as any).__scene?.sys?.game;
      if (typeof game?.resume === 'function') game.resume();
    });

    await page.waitForFunction(() => (window as any).__vialSpawns.length >= 1);
    const downSpawn = await page.evaluate(() => (window as any).__vialSpawns[0]);
    expect(Math.abs(downSpawn.x - (downSpawn.px + DOWN.x))).toBeLessThanOrEqual(2);
    expect(Math.abs(downSpawn.y - (downSpawn.py + DOWN.y))).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => (window as any).__consumedEvents.length)).toBe(1);
    expect(await page.evaluate(() => (window as any).__consumedEvents[0])).toEqual({
      id: 'poison_vial',
      mode: 'search',
    });

    await page.waitForFunction(() => {
      const w = window as any;
      const player = w.__scene.player;
      const hidden = Boolean(player.itemSprite) && player.itemSprite.visible === false;
      const spawned = w.__vialSpawns.length >= 1;
      if (hidden && spawned && typeof w.__scene.sys?.game?.pause === 'function') {
        w.__scene.sys.game.pause();
      }
      return hidden && spawned;
    });
    await page.screenshot({ path: 'tests/e2e/__screenshots__/b101-vial-release.png' });
    await page.evaluate(() => {
      const game = (window as any).__scene?.sys?.game;
      if (typeof game?.resume === 'function') game.resume();
    });

    await page.waitForFunction(() => {
      const player = (window as any).__scene.player;
      const now = performance.now();
      return !player.itemUseState?.active && now >= (player._vialCooldownUntil || 0);
    });

    const right = await page.evaluate(() => {
      const w = window as any;
      const scene = w.__scene;
      const player = scene.player;
      w.__session.equippedId = 'poison_vial';
      player.setFacing('right');
      const before = w.__vialSpawns.length;
      const liveBefore = (scene.projectiles || []).filter((p: any) => p.flyAnim === 'thief_poison_vial').length;
      const started = performance.now();
      scene._tryAttack(started);
      const live = (scene.projectiles || []).filter((p: any) => p.flyAnim === 'thief_poison_vial').length;
      return {
        anim: w.__hv.anim(),
        before,
        liveBefore,
        live,
        elapsed: performance.now() - started,
      };
    });
    expect(right.anim).toMatch(/^thief_use_throw_right/);
    expect(right.live).toBe(right.liveBefore);
    expect(right.elapsed).toBeLessThan(250);

    await page.waitForFunction((before) => (window as any).__vialSpawns.length > before, right.before);
    const rightSpawn = await page.evaluate(() => {
      const spawns = (window as any).__vialSpawns;
      return spawns[spawns.length - 1];
    });
    expect(rightSpawn.facing).toBe('right');
    expect(Math.abs(rightSpawn.x - (rightSpawn.px + RIGHT.x))).toBeLessThanOrEqual(2);
    expect(Math.abs(rightSpawn.y - (rightSpawn.py + RIGHT.y))).toBeLessThanOrEqual(2);

    await page.waitForFunction(() => {
      const player = (window as any).__scene.player;
      const now = performance.now();
      return !player.itemUseState?.active && now >= (player._vialCooldownUntil || 0);
    });

    const cancelled = await page.evaluate(() => {
      const w = window as any;
      const scene = w.__scene;
      const player = scene.player;
      w.__session.equippedId = 'poison_vial';
      player.setFacing('down');
      const spawns = w.__vialSpawns.length;
      const consumed = w.__consumedEvents.length;
      const cooldownBefore = player._vialCooldownUntil || 0;
      scene._tryAttack(performance.now());
      const windupAnim = w.__hv.anim();
      const hurt = player.takeDamage(10, performance.now());
      return {
        hurt,
        spawns,
        consumed,
        cooldownBefore,
        windupAnim,
        anim: w.__hv.anim(),
      };
    });
    expect(cancelled.windupAnim).toMatch(/^thief_use_throw_/);
    expect(cancelled.hurt).toBe(true);
    expect(cancelled.anim).toMatch(/^thief_hurt_/);

    await page.waitForTimeout(450);
    const afterCancel = await page.evaluate(() => ({
      spawns: (window as any).__vialSpawns.length,
      consumed: (window as any).__consumedEvents.length,
      cooldown: (window as any).__scene.player._vialCooldownUntil || 0,
    }));
    expect(afterCancel.spawns).toBe(cancelled.spawns);
    expect(afterCancel.consumed).toBe(cancelled.consumed);
    expect(afterCancel.cooldown).toBe(cancelled.cooldownBefore);
    expect(notFound).toEqual([]);
  });
});
