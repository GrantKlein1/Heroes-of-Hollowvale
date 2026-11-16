import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

  await t.test('AS-M: registers mage_spells_v2 and spell_fx_v2 without replacing v1 or changing load groups', () => {
    const hero = manifest.assets.mage_spells_v2;
    const fx = manifest.assets.spell_fx_v2;
    assert.ok(hero, 'mage_spells_v2 must exist');
    assert.ok(fx, 'spell_fx_v2 must exist');
    assert.equal(hero.kind, 'hero');
    assert.equal(fx.kind, 'fx');
    assert.equal(hero.image, 'assets/characters/mage/spells_v2/mage_spells_v2.png');
    assert.equal(hero.json, 'assets/characters/mage/spells_v2/mage_spells_v2.json');
    assert.equal(fx.image, 'assets/characters/mage/spells_v2/spell_fx_v2.png');
    assert.equal(fx.json, 'assets/characters/mage/spells_v2/spell_fx_v2.json');
    assert.deepEqual(hero.sidecars, ['anchors_v2.json']);
    assert.deepEqual(fx.sidecars, []);
    assert.deepEqual(manifest.groups.mage_spells, ['mage_spells_v2', 'spell_fx_v2']);

    assert.equal(manifest.assets.mage.sheets.mage_spells.image, 'assets/characters/mage/mage_spells.png');
    assert.equal(manifest.assets.mage.sheets.spell_fx.image, 'assets/characters/mage/spell_fx.png');
    assert.equal(manifest.assets.mage.sheets.mage_spells.json, 'assets/characters/mage/mage_spells.json');
    assert.equal(manifest.assets.mage.sheets.spell_fx.json, 'assets/characters/mage/spell_fx.json');

    for (const group of ['boot', 'village', 'wilderness', 'boss']) {
      assert.equal(manifest.groups[group].includes('mage_spells_v2'), false, `${group} must not load mage_spells_v2`);
      assert.equal(manifest.groups[group].includes('spell_fx_v2'), false, `${group} must not load spell_fx_v2`);
    }
  });

  await t.test('AS-M: copies art byte-identical and reads release, spawn, and anchors from sheet meta', () => {
    const locked = {
      'anchors_v2.json': '1397671a32b11968c92f7d59a09685bfe3794c5091efa2df1c24a24145c038f6',
      'mage_spells_v2.json': '949433a210b94b430af6ee45792cdb77f540771f9bdd530237395c173662e225',
      'mage_spells_v2.png': '3ed6d8a4782cb478948c6d295b1a440250a5ef966d1a2a090e56f0a10f665186',
      'spell_fx_v2.json': '39cf248482e6f558ccaf414fea3b5b6eb584f0059fd609b60f5b33d7abc4fabe',
      'spell_fx_v2.png': '580a4c9b9d604a410741407b4d89ef247543a3a21b94b9c8ba71ec92f6b68040'
    };
    const sourceDir = path.join(REPO_ROOT, 'art-source', 'blendsmith', 'mage', 'spells_v2');
    const publicDir = path.join(ASSETS_DIR, 'characters', 'mage', 'spells_v2');

    for (const [name, expected] of Object.entries(locked)) {
      const sourcePath = path.join(sourceDir, name);
      const publicPath = path.join(publicDir, name);
      const sourceHash = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
      const publicHash = createHash('sha256').update(fs.readFileSync(publicPath)).digest('hex');
      assert.equal(sourceHash, expected, `${name} art-source hash drifted from the locked pack`);
      assert.equal(publicHash, sourceHash, `${name} public copy is not byte-identical to art-source`);
    }

    const body = JSON.parse(fs.readFileSync(path.join(sourceDir, 'mage_spells_v2.json'), 'utf8'));
    const fx = JSON.parse(fs.readFileSync(path.join(sourceDir, 'spell_fx_v2.json'), 'utf8'));
    const hero = manifest.assets.mage_spells_v2;
    const fxEntry = manifest.assets.spell_fx_v2;

    assert.deepEqual(hero.anchor, body.meta.origin);
    assert.deepEqual(hero.release, body.meta.release);
    assert.deepEqual(hero.spawnOffset, body.meta.spawnOffset);
    assert.deepEqual(hero.returnOffset, body.meta.returnOffset);
    assert.deepEqual(hero.anims, body.meta.anims);
    assert.equal(body.meta.release.lightning, 5);
    assert.equal(body.meta.release.leech, 5);
    assert.equal(body.meta.anims.mage_cast_lightning_v2_down.frameRate, 16);
    assert.equal(body.meta.anims.mage_cast_lightning_v2_down.releaseFrame, 5);
    assert.equal(body.meta.anims.mage_cast_lightning_v2_down.releaseMs, 312.5);
    assert.equal(body.meta.anims.mage_cast_lightning_v2_down.frames.length, 10);
    assert.equal(body.meta.anims.mage_cast_leech_v2_up.frames.length, 10);

    const firstFxFrame = Object.values(fx.frames)[0];
    assert.deepEqual(fxEntry.anchor, { x: firstFxFrame.pivot.x, y: firstFxFrame.pivot.y });
    assert.deepEqual(fxEntry.anims, fx.meta.anims);
    assert.equal(fx.meta.anims.lightning_bolt_v2.frameRate, 16);
    assert.equal(fx.meta.anims.lightning_bolt_v2.repeat, -1);
  });
});
