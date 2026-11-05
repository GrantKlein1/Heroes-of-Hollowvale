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
});
