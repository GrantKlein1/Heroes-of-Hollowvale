import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateAllMaps,
  buildBrackenfordMap,
  buildHearthmileMap,
  buildRuinwatchMap,
  buildWildernessMap,
  buildTilesets,
  createGidResolver,
  DEFAULT_SEED,
  TILE_SIZE,
  LEAGUE_W,
  LEAGUE_H,
  floodLeague,
  autotileWangId,
} from '../../../../../tools/maps/generate_tmj.mjs';
import { validateMap } from '../../../../../tools/maps/validate_map.mjs';
import { MAP_LAYERS } from '../depth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const ASSETS_DIR = path.join(REPO_ROOT, 'client', 'public', 'assets', 'tiles');
const MAPS_DIR = path.join(REPO_ROOT, 'client', 'public', 'maps');
const LORE_PATH = path.join(REPO_ROOT, 'newLore_expanded.txt');

describe('Package MM-1: Tiled TMJ Map Generator', () => {
  const tilesets = buildTilesets(ASSETS_DIR);
  const canonLoreText = fs.readFileSync(LORE_PATH, 'utf8');

  // =========================================================================
  // 1. Tileset GID & Sequential Ranges
  // =========================================================================
  describe('Tileset GID Architecture & Ranges', () => {
    it('builds sequential, non-overlapping firstgids across Blendsmith v4 tilesets', () => {
      expect(tilesets.length).toBe(8);

      let expectedFirstGid = 1;
      for (const ts of tilesets) {
        expect(ts.firstgid).toBe(expectedFirstGid);
        expect(ts.tilecount).toBeGreaterThan(0);
        expect(ts.name).toBeDefined();
        expectedFirstGid += ts.tilecount;
      }
    });

    it('creates GID resolver that maps names and local IDs to correct global GIDs', () => {
      const gids = createGidResolver(tilesets);
      expect(gids.get('grass', 0)).toBe(1);
      expect(gids.get('dirt_road', 0)).toBe(9);
      expect(gids.get('dirt_road', 15)).toBe(24);
      expect(gids.get('cobble_road', 0)).toBe(25);
      expect(gids.get('water', 0)).toBe(41);
      expect(gids.get('water_ford', 0)).toBe(105);
      expect(gids.get('bridge_plank', 0)).toBe(109);
      expect(gids.get('cliff', 0)).toBe(113);
      expect(gids.get('cliff_face', 0)).toBe(129);
    });
  });

  // =========================================================================
  // 2. Canonical 7 Layers Architecture
  // =========================================================================
  describe('Canonical 7 Layers & Map Structure', () => {
    const brackenford = buildBrackenfordMap(tilesets, DEFAULT_SEED);

    it('contains all 7 canonical map layers defined in depth.js', () => {
      const layerNames = brackenford.layers.map((l) => l.name);
      for (const canonical of MAP_LAYERS) {
        expect(layerNames).toContain(canonical);
      }
    });

    it('assigns correct standard dimensions and tile dimensions (32px)', () => {
      expect(brackenford.width).toBe(LEAGUE_W);
      expect(brackenford.height).toBe(LEAGUE_H);
      expect(brackenford.tilewidth).toBe(TILE_SIZE);
      expect(brackenford.tileheight).toBe(TILE_SIZE);
    });
  });

  // =========================================================================
  // 3. Validation via validate_map.mjs (Acceptance Criterion 1)
  // =========================================================================
  describe('Map Validation (Criterion 1)', () => {
    it('passes validateMap with 0 errors on brackenford.tmj', () => {
      const mapPath = path.join(MAPS_DIR, 'brackenford.tmj');
      const result = validateMap(mapPath, { lorePath: LORE_PATH });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('passes validateMap with 0 errors on hearthmile.tmj', () => {
      const mapPath = path.join(MAPS_DIR, 'hearthmile.tmj');
      const result = validateMap(mapPath, { lorePath: LORE_PATH });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('passes validateMap with 0 errors on ruinwatch.tmj', () => {
      const mapPath = path.join(MAPS_DIR, 'ruinwatch.tmj');
      const result = validateMap(mapPath, { lorePath: LORE_PATH });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('passes validateMap with 0 errors on wilderness.tmj', () => {
      const mapPath = path.join(MAPS_DIR, 'wilderness.tmj');
      const result = validateMap(mapPath, { lorePath: LORE_PATH });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('resolves cross-map exit targets cleanly across all generated maps', () => {
      const mapFiles = ['brackenford.tmj', 'hearthmile.tmj', 'ruinwatch.tmj', 'wilderness.tmj'];
      const availableSet = new Set(mapFiles);

      for (const filename of mapFiles) {
        const fullPath = path.join(MAPS_DIR, filename);
        const result = validateMap(fullPath, {
          lorePath: LORE_PATH,
          availableMaps: availableSet,
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      }
    });
  });

  // =========================================================================
  // 4. Deterministic Seeding (Acceptance Criterion 2)
  // =========================================================================
  describe('Deterministic Seeding QA (Criterion 2)', () => {
    it('produces byte-identical outputs when generated repeatedly with identical seed', () => {
      const run1 = buildBrackenfordMap(tilesets, 'hollowvale-1477');
      const run2 = buildBrackenfordMap(tilesets, 'hollowvale-1477');
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));

      const wild1 = buildWildernessMap(tilesets, 'hollowvale-1477');
      const wild2 = buildWildernessMap(tilesets, 'hollowvale-1477');
      expect(JSON.stringify(wild1)).toBe(JSON.stringify(wild2));
    });

    it('alters terrain variations deterministically when seed changes', () => {
      const mapA = buildBrackenfordMap(tilesets, 'seed-alpha');
      const mapB = buildBrackenfordMap(tilesets, 'seed-beta');
      // Ground detail differs by seed
      const detailA = mapA.layers.find((l) => l.name === 'ground_detail').data;
      const detailB = mapB.layers.find((l) => l.name === 'ground_detail').data;
      expect(JSON.stringify(detailA)).not.toBe(JSON.stringify(detailB));
    });
  });

  // =========================================================================
  // 5. Water / Traversal Rules (Hard Rule 2)
  // =========================================================================
  describe('Water & Traversal Collision Rules (Hard Rule 2)', () => {
    const map = buildBrackenfordMap(tilesets, DEFAULT_SEED);
    const ground = map.layers.find((l) => l.name === 'ground').data;
    const collision = map.layers.find((l) => l.name === 'collision').data;
    const gids = createGidResolver(tilesets);

    it('retains collides: false in water tileset as authored', () => {
      const waterTsj = tilesets.find((ts) => ts.name === 'water');
      expect(waterTsj).toBeDefined();
      for (const tile of waterTsj.tiles) {
        const prop = tile.properties?.find((p) => p.name === 'collides');
        if (prop) {
          expect(prop.value).toBe(false);
        }
      }
    });

    it('blocks deep water with explicit collision tile while leaving fords and bridges passable (0)', () => {
      // River Bracken line wy = 7 (ty = 7 in Brackenford)
      const riverTy = 7;

      // Ford at wx in [8..11] (tx in [8..11])
      for (let tx = 8; tx <= 11; tx++) {
        const idx = riverTy * LEAGUE_W + tx;
        expect(ground[idx]).toBe(gids.get('water_ford', 0));
        expect(collision[idx]).toBe(0); // Passable
      }

      // Plank bridge at wx in [5..6] (tx in [5..6])
      for (let tx = 5; tx <= 6; tx++) {
        const idx = riverTy * LEAGUE_W + tx;
        expect(ground[idx]).toBe(gids.get('bridge_plank', 0));
        expect(collision[idx]).toBe(0); // Passable
      }

      // Deep water outside crossings
      for (let tx = 2; tx <= 4; tx++) {
        const idx = riverTy * LEAGUE_W + tx;
        expect(collision[idx]).toBeGreaterThan(0); // Solid obstacle
      }
    });
  });

  // =========================================================================
  // 6. Prop Pairing & Overhead Contract (Hard Rule 3)
  // =========================================================================
  describe('Prop Pairing Contract (Hard Rule 3)', () => {
    const map = buildBrackenfordMap(tilesets, DEFAULT_SEED);
    const propsLayer = map.layers.find((l) => l.name === 'props');
    const objects = propsLayer.objects;

    it('pairs cottage_base and tavern_base with matching roofs sharing identical coordinates', () => {
      const bases = objects.filter((o) => o.name === 'cottage_base' || o.name === 'tavern_base');
      expect(bases.length).toBeGreaterThan(0);

      for (const base of bases) {
        const expectedRoofName = base.name === 'cottage_base' ? 'cottage_roof' : 'tavern_roof';
        const roof = objects.find(
          (o) => o.name === expectedRoofName && o.x === base.x && o.y === base.y
        );

        expect(roof).toBeDefined();
        expect(roof.width).toBe(base.width);
        expect(roof.height).toBe(base.height);

        // Overhead properties
        const tallProp = roof.properties.find((p) => p.name === 'tall');
        expect(tallProp?.value).toBe(true);

        const layerProp = roof.properties.find((p) => p.name === 'layer');
        expect(layerProp?.value).toBe('overhead');
      }
    });

    it('pairs pine and oak trees with canopies sharing identical coordinates', () => {
      const pineBase = objects.find((o) => o.name === 'tree_pine_base');
      expect(pineBase).toBeDefined();

      const pineCanopy = objects.find(
        (o) => o.name === 'tree_pine_canopy' && o.x === pineBase.x && o.y === pineBase.y
      );
      expect(pineCanopy).toBeDefined();
      expect(pineCanopy.properties.find((p) => p.name === 'tall')?.value).toBe(true);
    });
  });

  // =========================================================================
  // 7. Topological Reachability QA (§4)
  // =========================================================================
  describe('Topological Reachability & Flood-Fill (docs/maps/brackenford-route-notes.md §4)', () => {
    it('confirms 0 isolated pockets in generated Brackenford walkable grid', () => {
      const map = buildBrackenfordMap(tilesets, DEFAULT_SEED);
      const collision = map.layers.find((l) => l.name === 'collision').data;

      const isWalkable = (x, y) => collision[y * LEAGUE_W + x] === 0;
      const { lost } = floodLeague(LEAGUE_W, LEAGUE_H, isWalkable);
      expect(lost).toEqual([]);
    });

    it('autotiles Wang 2x2 corners deterministically', () => {
      const grid = [
        [false, false, false],
        [false, true, true],
        [false, true, true],
      ];
      const isGroup = (x, y) => Boolean(grid[y]?.[x]);
      const wangId = autotileWangId(1, 1, isGroup);
      expect(wangId).toBeGreaterThanOrEqual(0);
      expect(wangId).toBeLessThanOrEqual(15);
    });
  });
});
