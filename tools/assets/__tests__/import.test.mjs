import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ASSETS_DIR = path.join(REPO_ROOT, 'client', 'public', 'assets');
const MANIFEST_PATH = path.join(ASSETS_DIR, 'manifest.json');

test('import_blendsmith acceptance criteria and contracts', async (t) => {
  await t.test('manifest.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(MANIFEST_PATH), `manifest.json should exist at ${MANIFEST_PATH}`);
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data.groups, 'manifest should have groups');
    assert.ok(data.assets, 'manifest should have assets');
  });

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  await t.test('groups contain boot, village, wilderness, boss, and per-phase boss groups', () => {
    const requiredGroups = [
      'boot',
      'village',
      'wilderness',
      'boss',
      'boss_p1',
      'boss_p2',
      'boss_p3'
    ];
    for (const group of requiredGroups) {
      assert.ok(Array.isArray(manifest.groups[group]), `Group ${group} should be an array`);
      assert.ok(manifest.groups[group].length > 0, `Group ${group} should not be empty`);
    }
  });

  await t.test('assets list contains all required core entities and per-phase dragon assets', () => {
    const requiredAssets = [
      'knight',
      'thief',
      'dwarf',
      'mage',
      'goblin',
      'goblin_archer',
      'goblin_brute',
      'critters',
      'fx_common',
      'red_dragon',
      'red_dragon_p1_a',
      'red_dragon_p1_b',
      'red_dragon_p2_a',
      'red_dragon_p2_b',
      'red_dragon_p2_land',
      'red_dragon_p3_a',
      'red_dragon_p3_b'
    ];
    for (const assetId of requiredAssets) {
      assert.ok(manifest.assets[assetId], `Asset "${assetId}" must exist in manifest.assets`);
    }
  });

  await t.test('each manifest entry carries its own anchor from meta', () => {
    for (const [key, asset] of Object.entries(manifest.assets)) {
      assert.ok(asset.anchor, `Asset ${key} must have anchor object`);
      assert.equal(typeof asset.anchor.x, 'number', `Asset ${key} anchor.x must be number`);
      assert.equal(typeof asset.anchor.y, 'number', `Asset ${key} anchor.y must be number`);
    }
  });

  await t.test('assert knight anchor !== goblin anchor (acceptance criterion 2)', () => {
    const knightAnchor = manifest.assets.knight.anchor;
    const goblinAnchor = manifest.assets.goblin.anchor;

    assert.ok(knightAnchor, 'knight anchor must exist');
    assert.ok(goblinAnchor, 'goblin anchor must exist');
    assert.notEqual(
      knightAnchor.y,
      goblinAnchor.y,
      `knight.anchor.y (${knightAnchor.y}) must differ from goblin.anchor.y (${goblinAnchor.y})`
    );
    assert.equal(knightAnchor.y, 0.9271);
    assert.equal(goblinAnchor.y, 0.9375);
  });

  await t.test('mage merges walk and spells into one logical asset', () => {
    const mage = manifest.assets.mage;
    assert.ok(mage, 'mage must exist in manifest');
    assert.ok(mage.sheets.mage_walk, 'mage must have mage_walk sheet from walk/');
    assert.ok(mage.sheets.mage_spells, 'mage must have mage_spells sheet from spells/');
    assert.ok(mage.sheets.mage_book, 'mage must have mage_book sheet from spells/');
    assert.ok(mage.sheets.fireball, 'mage must have fireball sheet from walk/');
  });

  await t.test('red_dragon has merged attacks.json metadata', () => {
    const dragonP1aPath = path.join(ASSETS_DIR, 'boss', 'red_dragon', 'red_dragon_p1_a.json');
    assert.ok(fs.existsSync(dragonP1aPath), 'red_dragon_p1_a.json must exist');
    const dragonP1a = JSON.parse(fs.readFileSync(dragonP1aPath, 'utf8'));

    assert.ok(dragonP1a.meta.attacks, 'red_dragon_p1_a meta must contain merged attacks');
    assert.ok(dragonP1a.meta.attacks.anims.claw, 'attacks must define claw animation');
    assert.ok(dragonP1a.meta.attacks.anims.tail, 'attacks must define tail animation');
    assert.ok(dragonP1a.meta.attacks.anims.breath, 'attacks must define breath animation');
  });

  await t.test('no forbidden files or directories exist under client/public/assets', () => {
    const forbiddenRegexes = [
      /frames/i,
      /render_hi/i,
      /_bak/i,
      /previews/i,
      /\.blend$/i,
      /\.glb$/i,
      /^dragon_fx\.json$/i,
      /^MANIFEST\.md$/i
    ];

    function checkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        for (const re of forbiddenRegexes) {
          assert.equal(
            re.test(entry.name),
            false,
            `Forbidden pattern ${re} matched "${entry.name}" at ${full}`
          );
        }
        if (entry.isDirectory()) {
          checkDir(full);
        }
      }
    }

    checkDir(ASSETS_DIR);
  });

  await t.test('manifest image and json files exist on disk under client/public', () => {
    for (const [key, asset] of Object.entries(manifest.assets)) {
      if (asset.image) {
        const fullImg = path.join(REPO_ROOT, 'client', 'public', asset.image);
        assert.ok(fs.existsSync(fullImg), `Image file for ${key} must exist: ${asset.image}`);
      }
      if (asset.json) {
        const fullJson = path.join(REPO_ROOT, 'client', 'public', asset.json);
        assert.ok(fs.existsSync(fullJson), `JSON file for ${key} must exist: ${asset.json}`);
      }
      if (asset.sheets) {
        for (const [sheetKey, sheet] of Object.entries(asset.sheets)) {
          if (sheet.image) {
            const fullSheetImg = path.join(REPO_ROOT, 'client', 'public', sheet.image);
            assert.ok(
              fs.existsSync(fullSheetImg),
              `Sheet image for ${key}.${sheetKey} must exist: ${sheet.image}`
            );
          }
          if (sheet.json) {
            const fullSheetJson = path.join(REPO_ROOT, 'client', 'public', sheet.json);
            assert.ok(
              fs.existsSync(fullSheetJson),
              `Sheet json for ${key}.${sheetKey} must exist: ${sheet.json}`
            );
          }
        }
      }
    }
  });

  await t.test('AS-3: registers 4 new groups and wilderness additions without touching boot or village', () => {
    assert.deepEqual(manifest.groups.boot, ['fx_common', 'critters', 'knight']);
    assert.deepEqual(manifest.groups.village, ['knight', 'thief', 'dwarf', 'mage', 'critters', 'fx_common', 'village_props', 'hearth']);
    assert.deepEqual(manifest.groups.interiors, ['interior_props', 'npc_bartender', 'npc_vendor']);
    assert.deepEqual(manifest.groups.cavern, ['dungeon_props', 'dungeon_brazier', 'treasure_chest']);
    assert.deepEqual(manifest.groups.loot, ['loot_pickups']);
    assert.deepEqual(manifest.groups.boss_fx_extra, ['dragon_fx_extra']);

    assert.ok(manifest.groups.wilderness.includes('wild_props'));
    assert.ok(manifest.groups.wilderness.includes('wild_props_4b'));
    assert.ok(manifest.groups.wilderness.includes('ember_vent'));
  });

  await t.test('AS-3: registers all 23 ground tilesets in manifest.tiles', () => {
    assert.equal(Object.keys(manifest.tiles).length, 23);
    const as3Tiles = [
      'interior_tavern_wall_trim',
      'interior_market_wall_trim',
      'dungeon_wall_trim',
      'molten_floor',
      'scorched_floor',
      'ash_ground',
      'ash_fill',
      'forest_floor'
    ];
    for (const tName of as3Tiles) {
      assert.ok(manifest.tiles[tName], `Tileset ${tName} must exist`);
      assert.equal(manifest.tiles[tName].tileWidth, 32);
      assert.equal(manifest.tiles[tName].tileHeight, 32);
      assert.equal(manifest.tiles[tName].margin, 1);
      assert.equal(manifest.tiles[tName].spacing, 2);
    }
  });

  await t.test('AS-3: registers all new atlases with dynamic anchors from meta', () => {
    const as3Atlases = [
      { id: 'interior_props', kind: 'props', y: 1.0 },
      { id: 'dungeon_props', kind: 'props', y: 1.0 },
      { id: 'dungeon_brazier', kind: 'props', y: 1.0 },
      { id: 'treasure_chest', kind: 'props', y: 1.0 },
      { id: 'wild_props', kind: 'props', y: 1.0 },
      { id: 'wild_props_4b', kind: 'props', y: 1.0 },
      { id: 'ember_vent', kind: 'props', y: 1.0 },
      { id: 'npc_bartender', kind: 'npc', y: 0.9271 },
      { id: 'npc_vendor', kind: 'npc', y: 0.9271 },
      { id: 'loot_pickups', kind: 'loot', y: 0.875 },
      { id: 'dragon_fx_extra', kind: 'fx', y: 0.5 }
    ];

    for (const { id, kind, y } of as3Atlases) {
      const entry = manifest.assets[id];
      assert.ok(entry, `Asset ${id} must exist in manifest.assets`);
      assert.equal(entry.kind, kind, `Asset ${id} kind must be ${kind}`);
      assert.ok(Math.abs(entry.anchor.y - y) < 0.001, `Asset ${id} anchor.y (${entry.anchor.y}) must match expected (${y})`);
    }
  });
});
