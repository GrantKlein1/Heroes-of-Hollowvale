import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateMap,
  isCanonPlaceName,
  parsePropFootprint,
  rectsIntersect,
  extractPlaceNames,
} from '../../../../../tools/maps/validate_map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../__fixtures__');
const fixtureMapPath = path.join(fixturesDir, 'fixture_map.tmj');
const repoRoot = path.resolve(__dirname, '../../../../..');
const lorePath = path.join(repoRoot, 'newLore_expanded.txt');

describe('Package 2-2: Tiled Map Validator & CI Test Suite', () => {
  const canonLoreText = fs.readFileSync(lorePath, 'utf8');

  // =========================================================================
  // Acceptance Criterion 1 & 2: Good fixture validation
  // =========================================================================
  describe('Good Fixture Validation (fixture_map.tmj)', () => {
    it('passes validation with 0 errors on fixture_map.tmj', () => {
      const result = validateMap(fixtureMapPath, { lorePath });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.stats).toBeDefined();
      expect(result.stats.mapWidth).toBe(10);
      expect(result.stats.mapHeight).toBe(8);
      expect(result.stats.tileWidth).toBe(32);
      expect(result.stats.tileHeight).toBe(32);
      expect(result.stats.layerCount).toBe(7);
      expect(result.stats.tilesetCount).toBe(1);
      expect(result.stats.spawnCount).toBe(1);
      expect(result.stats.exitCount).toBe(1);
    });

    it('can validate an in-memory parsed JSON map object directly', () => {
      const raw = fs.readFileSync(fixtureMapPath, 'utf8');
      const mapData = JSON.parse(raw);
      const result = validateMap(mapData, { loreText: canonLoreText });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // =========================================================================
  // Acceptance Criterion 1: Specific failure messages on known-bad fixtures
  // =========================================================================
  describe('Known-Bad Fixtures Detection', () => {
    it('fails bad_missing_gid.tmj with specific invalid GID error message', () => {
      const badPath = path.join(fixturesDir, 'bad_missing_gid.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      const gidError = result.errors.find(
        (e) => e.includes('invalid GID 999') && e.includes('not found in any tileset')
      );
      expect(gidError).toBeDefined();
      expect(gidError).toMatch(/Tile at \(1, 1\) in layer "ground" uses invalid GID 999/);
    });

    it('fails bad_road_hole.tmj with grass hole error message', () => {
      const badPath = path.join(fixturesDir, 'bad_road_hole.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      const holeError = result.errors.find((e) => e.includes('Grass hole detected in road'));
      expect(holeError).toBeDefined();
      expect(holeError).toContain('(2, 2)');
      expect(holeError).toContain('surrounded by road on all 4 cardinal sides');
    });

    it('fails bad_unmarked_dead_end.tmj with unmarked dead end error message', () => {
      const badPath = path.join(fixturesDir, 'bad_unmarked_dead_end.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      const deadEndError = result.errors.find((e) => e.includes('Road dead end at') && e.includes('is unmarked'));
      expect(deadEndError).toBeDefined();
    });

    it('fails bad_spawn_in_collider.tmj with spawn collider intersection error message', () => {
      const badPath = path.join(fixturesDir, 'bad_spawn_in_collider.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      const spawnError = result.errors.find((e) => e.includes('Spawn "spawn_default"') && e.includes('inside a collider'));
      expect(spawnError).toBeDefined();
      expect(spawnError).toContain('(0, 0)');
      expect(spawnError).toContain('walls');
    });

    it('fails bad_unresolved_exit.tmj with unresolved exit error messages', () => {
      const badPath = path.join(fixturesDir, 'bad_unresolved_exit.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      const mapError = result.errors.find((e) => e.includes('Exit "exit_south"') && e.includes('targetMap'));
      const spawnError = result.errors.find((e) => e.includes('Exit "exit_south"') && e.includes('targetSpawn'));
      expect(mapError).toBeDefined();
      expect(spawnError).toBeDefined();
    });
  });

  // =========================================================================
  // Acceptance Criterion 3: Canon Lore check & non-canon name rejection
  // =========================================================================
  describe('Canon Lore Validation (Acceptance Criterion 3)', () => {
    it('fails bad_lore_name.tmj when non-canon place name "Ashfang" is used', () => {
      const badPath = path.join(fixturesDir, 'bad_lore_name.tmj');
      const result = validateMap(badPath, { lorePath });

      expect(result.valid).toBe(false);
      const loreErrors = result.errors.filter(
        (e) => e.includes('Ashfang') && e.includes('not found in canon lore')
      );
      expect(loreErrors.length).toBeGreaterThanOrEqual(1);
      expect(loreErrors[0]).toContain('newLore_expanded.txt');
    });

    it('correctly verifies canon place names with word boundaries against newLore_expanded.txt', () => {
      // Canon places that appear in newLore_expanded.txt
      expect(isCanonPlaceName('Brackenford', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Emberwood', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('The Embered Flagon', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Cavern of Embers', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('wilderness', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Stonehollow', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Vaelorin', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Saltmercy', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Sky Pyre', canonLoreText)).toBe(true);

      // Non-canon or invented places not in newLore_expanded.txt
      expect(isCanonPlaceName('Ashfang', canonLoreText)).toBe(false);
      expect(isCanonPlaceName('Mordor', canonLoreText)).toBe(false);
      expect(isCanonPlaceName('Gondor', canonLoreText)).toBe(false);
      expect(isCanonPlaceName('Neverwinter', canonLoreText)).toBe(false);
    });

    it('distinguishes sub-tokens and rejects partial token matches (e.g. Ash vs Ashfang)', () => {
      // 'Ash' is in lore ("Ashen Wastes", "Ash Year"), but 'Ashfang' is not
      expect(isCanonPlaceName('Ash', canonLoreText)).toBe(true);
      expect(isCanonPlaceName('Ashfang', canonLoreText)).toBe(false);
      expect(isCanonPlaceName('Ashford', canonLoreText)).toBe(true); // Ashford is in lore
      expect(isCanonPlaceName('AshfordXYZ', canonLoreText)).toBe(false);
    });

    it('extracts place names from map custom properties, layers, and objects', () => {
      const testMap = {
        width: 10,
        height: 10,
        tilewidth: 32,
        tileheight: 32,
        properties: [{ name: 'region', type: 'string', value: 'Brackenford' }],
        layers: [
          {
            name: 'zones',
            type: 'objectgroup',
            objects: [
              {
                id: 1,
                name: 'The Embered Flagon',
                type: 'landmark',
                x: 10,
                y: 10,
                width: 32,
                height: 32,
              },
              {
                id: 2,
                name: 'exit_wild',
                type: 'exit',
                x: 20,
                y: 20,
                width: 32,
                height: 32,
                properties: [
                  { name: 'targetMap', type: 'string', value: 'wilderness.tmj' },
                  { name: 'targetSpawn', type: 'string', value: 'north' },
                ],
              },
            ],
          },
        ],
      };

      const extracted = extractPlaceNames(testMap);
      const names = extracted.map((e) => e.name);
      expect(names).toContain('Brackenford');
      expect(names).toContain('The Embered Flagon');
      expect(names).toContain('wilderness');
    });
  });

  // =========================================================================
  // Granular Rule Tests: Prop footprints & collisions
  // =========================================================================
  describe('Prop Footprint & Collider Calculations', () => {
    it('calculates world bounds for standard bottom-anchored prop footprints', () => {
      const propObj = {
        name: 'pine_tree',
        x: 64,
        y: 32,
        width: 32,
        height: 64,
        properties: [
          {
            name: 'footprint',
            type: 'string',
            value: '{"x":0,"y":48,"w":32,"h":16,"shape":"ellipse"}',
          },
        ],
      };

      const fp = parsePropFootprint(propObj);
      expect(fp.x).toBe(64);
      expect(fp.y).toBe(80); // 32 + 48
      expect(fp.width).toBe(32);
      expect(fp.height).toBe(16);
      expect(fp.shape).toBe('ellipse');
    });

    it('detects spawn overlapping prop collision footprint', () => {
      const raw = fs.readFileSync(fixtureMapPath, 'utf8');
      const map = JSON.parse(raw);

      // In fixture_map.tmj:
      // pine_tree is at x: 64, y: 32, footprint is x: 64, y: 80, w: 32, h: 16
      // Place spawn directly overlapping pine_tree footprint: x: 64, y: 80
      const zonesLayer = map.layers.find((l) => l.name === 'zones');
      const spawnObj = zonesLayer.objects.find((o) => o.name.startsWith('spawn'));
      spawnObj.x = 64;
      spawnObj.y = 80;

      const result = validateMap(map, { lorePath });
      expect(result.valid).toBe(false);
      const propCollisionErr = result.errors.find((e) => e.includes('inside a prop collider') && e.includes('"pine_tree"'));
      expect(propCollisionErr).toBeDefined();
    });

    it('correctly reports rectsIntersect helper', () => {
      const a = { x: 0, y: 0, width: 32, height: 32 };
      const b = { x: 16, y: 16, width: 32, height: 32 };
      const c = { x: 32, y: 0, width: 32, height: 32 }; // touching edge, not intersecting
      const d = { x: 100, y: 100, width: 32, height: 32 };

      expect(rectsIntersect(a, b)).toBe(true);
      expect(rectsIntersect(a, c)).toBe(false);
      expect(rectsIntersect(a, d)).toBe(false);
    });
  });

  // =========================================================================
  // Cross-Map Exit Resolution
  // =========================================================================
  describe('Exit Cross-Resolution', () => {
    it('flags exit when availableMaps is provided and targetMap is missing', () => {
      const raw = fs.readFileSync(fixtureMapPath, 'utf8');
      const map = JSON.parse(raw);

      // exit_south points to wilderness.tmj
      const availableMaps = new Set(['town.tmj', 'dungeon.tmj']);
      const result = validateMap(map, { lorePath, availableMaps });

      expect(result.valid).toBe(false);
      const missingMapErr = result.errors.find((e) =>
        e.includes('references targetMap "wilderness.tmj" which is not in available maps')
      );
      expect(missingMapErr).toBeDefined();
    });

    it('passes when targetMap is present in availableMaps', () => {
      const raw = fs.readFileSync(fixtureMapPath, 'utf8');
      const map = JSON.parse(raw);

      const availableMaps = new Set(['wilderness.tmj']);
      const result = validateMap(map, { lorePath, availableMaps });
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Package 3-1: Lane F Interior Maps Validation (tavern.tmj & market.tmj)
  // =========================================================================
  describe('Package 3-1: Interior Maps Validation', () => {
    const mapsDir = path.resolve(repoRoot, 'client/public/maps');
    const tavernPath = path.join(mapsDir, 'tavern.tmj');
    const marketPath = path.join(mapsDir, 'market.tmj');
    const brackenfordPath = path.join(mapsDir, 'brackenford.tmj');

    it('passes validateMap with 0 errors on tavern.tmj', () => {
      const result = validateMap(tavernPath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(20);
      expect(result.stats.mapHeight).toBe(12);
      expect(result.stats.tilesetCount).toBe(3);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(1);
    });

    it('passes validateMap with 0 errors on market.tmj', () => {
      const result = validateMap(marketPath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(20);
      expect(result.stats.mapHeight).toBe(12);
      expect(result.stats.tilesetCount).toBe(3);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(1);
    });

    it('verifies exits resolve back to brackenford.tmj', () => {
      const availableMaps = new Set(['brackenford.tmj', 'tavern.tmj', 'market.tmj']);
      const tavernResult = validateMap(tavernPath, { lorePath, availableMaps });
      const marketResult = validateMap(marketPath, { lorePath, availableMaps });

      expect(tavernResult.valid).toBe(true);
      expect(marketResult.valid).toBe(true);
    });
  });

  // =========================================================================
  // Package 3-2: Cavern Maps Validation (mouth, halls, treasure, lair)
  // =========================================================================
  describe('Package 3-2: Cavern Maps Validation', () => {
    const mapsDir = path.resolve(repoRoot, 'client/public/maps');
    const mouthPath = path.join(mapsDir, 'cavern_mouth.tmj');
    const hallsPath = path.join(mapsDir, 'cavern_halls.tmj');
    const treasurePath = path.join(mapsDir, 'cavern_treasure.tmj');
    const lairPath = path.join(mapsDir, 'cavern_lair.tmj');

    it('passes validateMap with 0 errors on cavern_mouth.tmj', () => {
      const result = validateMap(mouthPath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(24);
      expect(result.stats.mapHeight).toBe(16);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(1);
    });

    it('passes validateMap with 0 errors on cavern_halls.tmj', () => {
      const result = validateMap(hallsPath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(28);
      expect(result.stats.mapHeight).toBe(16);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(2);
    });

    it('passes validateMap with 0 errors on cavern_treasure.tmj', () => {
      const result = validateMap(treasurePath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(20);
      expect(result.stats.mapHeight).toBe(12);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(1);
    });

    it('passes validateMap with 0 errors on cavern_lair.tmj', () => {
      const result = validateMap(lairPath, { lorePath });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.stats.mapWidth).toBe(32);
      expect(result.stats.mapHeight).toBe(24);
      expect(result.stats.spawnCount).toBeGreaterThanOrEqual(1);
      expect(result.stats.exitCount).toBeGreaterThanOrEqual(1);
    });

    it('verifies cavern network exit connectivity', () => {
      const availableMaps = new Set([
        'wilderness.tmj',
        'cavern_mouth.tmj',
        'cavern_halls.tmj',
        'cavern_treasure.tmj',
        'cavern_lair.tmj',
      ]);
      expect(validateMap(mouthPath, { lorePath, availableMaps }).valid).toBe(true);
      expect(validateMap(hallsPath, { lorePath, availableMaps }).valid).toBe(true);
      expect(validateMap(treasurePath, { lorePath, availableMaps }).valid).toBe(true);
      expect(validateMap(lairPath, { lorePath, availableMaps }).valid).toBe(true);
    });
  });
});
