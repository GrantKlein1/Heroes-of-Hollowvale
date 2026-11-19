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
import { parsePropFootprint, validateMap } from '../../../../../tools/maps/validate_map.mjs';
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
      expect(tilesets.length).toBe(9);

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
      // Batch 11 package B: dirt_road has 24 ids, water 96, cliff 24, cliff_face 8.
      expect(gids.get('dirt_road', 23)).toBe(32);
      expect(gids.get('cobble_road', 0)).toBe(33);
      expect(gids.get('water', 0)).toBe(49);
      expect(gids.get('water_ford', 0)).toBe(145);
      expect(gids.get('bridge_plank', 0)).toBe(149);
      expect(gids.get('cliff', 0)).toBe(153);
      expect(gids.get('cliff_face', 0)).toBe(177);
      expect(gids.get('water_shore', 0)).toBe(185);
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

    it('has no rock wall ring around Brackenford: no cliff_face in walls or collision, ring cells are plain grass', () => {
      const map = buildBrackenfordMap(tilesets, DEFAULT_SEED);
      const layer = (name) => map.layers.find((l) => l.name === name).data;
      const cliffFace = createGidResolver(tilesets).get('cliff_face', 0);
      expect(layer('walls').filter((g) => g === cliffFace)).toEqual([]);
      expect(layer('collision').filter((g) => g === cliffFace)).toEqual([]);
      expect(layer('walls').every((g) => g === 0)).toBe(true);
      const ground = layer('ground');
      const resolver = createGidResolver(tilesets);
      const grass = resolver.get('grass', 0);
      const shoreFirst = resolver.get('water_shore', 0);
      const shoreLast = resolver.get('water_shore', 78);
      // The river banks (rows 5-6 and 8-9) use water_shore sand and the sand to grass blend.
      const grassOrShore = (g) => g === grass || (g >= shoreFirst && g <= shoreLast);
      for (let c = 2; c <= 17; c++) {
        expect(ground[1 * LEAGUE_W + c]).toBe(grass);
        if (c !== 9 && c !== 10) expect(ground[10 * LEAGUE_W + c]).toBe(grass); // 9..10 is the south gate road
      }
      for (let r = 2; r <= 9; r++) {
        if (r === 7) continue;
        expect(grassOrShore(ground[r * LEAGUE_W + 1])).toBe(true);
        expect(grassOrShore(ground[r * LEAGUE_W + 18])).toBe(true);
        if (r < 5 || r > 9) {
          expect(ground[r * LEAGUE_W + 1]).toBe(grass);
          expect(ground[r * LEAGUE_W + 18]).toBe(grass);
        }
      }
    });

    it('keeps Brackenford spawns outside exit prompts, except the preserved points', () => {
      // HollowvaleScene._drawBeacons uses rectangle intersection and no radius.
      const promptRadius = 0
      const clearance = promptRadius + 48
      const kept = new Set(['spawn_default', 'spawn_from_market'])
      const map = buildBrackenfordMap(tilesets, DEFAULT_SEED)
      const zones = map.layers.find((layer) => layer.name === 'zones').objects
      const spawns = zones.filter((zone) => zone.type === 'spawn')
      const exits = zones.filter((zone) => zone.type === 'exit')
      const exitSouth = zones.find((zone) => zone.name === 'exit_south')

      expect(exitSouth).toMatchObject({ x: 288, y: 320, width: 64, height: 32 })
      expect(zones.find((zone) => zone.name === 'spawn_default')).toMatchObject({ x: 320, y: 192 })
      expect(zones.find((zone) => zone.name === 'spawn_from_market')).toMatchObject({ x: 128, y: 192 })

      const checked = []
      for (const spawn of spawns) {
        if (kept.has(spawn.name)) continue
        const px = spawn.x + spawn.width / 2
        const py = spawn.y + spawn.height / 2
        for (const exit of exits) {
          const nearestX = Math.max(exit.x, Math.min(px, exit.x + exit.width))
          const nearestY = Math.max(exit.y, Math.min(py, exit.y + exit.height))
          const distance = Math.hypot(px - nearestX, py - nearestY)
          expect(distance, `${spawn.name} to ${exit.name}`).toBeGreaterThanOrEqual(clearance)
        }
        checked.push(spawn.name)
      }
      expect(checked).toEqual(['spawn_south'])
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

describe('MAPS-POLISH-1 hearthmile and ruinwatch', () => {
  const tilesets = buildTilesets(ASSETS_DIR);

  function layer(map, name) {
    return map.layers.find((l) => l.name === name);
  }

  function zones(map) {
    return layer(map, 'zones').objects;
  }

  function props(map) {
    return layer(map, 'props').objects;
  }

  function coversCenter(obj, tx, ty) {
    const fp = parsePropFootprint(obj);
    if (!fp || fp.shape === 'none' || !(fp.width > 0) || !(fp.height > 0)) return false;
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE / 2;
    return cx >= fp.x && cx < fp.x + fp.width && cy >= fp.y && cy < fp.y + fp.height;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function entranceCells(map) {
    const cells = [];
    for (const zone of zones(map)) {
      if (zone.type !== 'exit' && zone.type !== 'spawn') continue;
      const x0 = Math.floor(zone.x / TILE_SIZE);
      const y0 = Math.floor(zone.y / TILE_SIZE);
      const x1 = Math.floor((zone.x + zone.width - 1) / TILE_SIZE);
      const y1 = Math.floor((zone.y + zone.height - 1) / TILE_SIZE);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) cells.push({ x, y, name: zone.name });
      }
    }
    return cells;
  }

  function unreachableFromEntrances(map) {
    const width = map.width;
    const height = map.height;
    const seen = Array.from({ length: height }, () => Array(width).fill(false));
    const queue = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height || seen[y][x]) return;
      if (props(map).some((obj) => coversCenter(obj, x, y))) return;
      seen[y][x] = true;
      queue.push([x, y]);
    };
    for (const cell of entranceCells(map)) push(cell.x, cell.y);
    for (let head = 0; head < queue.length; head++) {
      const [x, y] = queue[head];
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    const lost = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!seen[y][x] && !props(map).some((obj) => coversCenter(obj, x, y))) lost.push({ x, y });
      }
    }
    return lost;
  }

  function expectPolish(map, exits) {
    expect(map.width).toBe(20);
    expect(map.height).toBe(12);
    const zoneList = zones(map);
    for (const expected of exits) {
      const zone = zoneList.find((z) => z.name === expected.name);
      expect(zone, expected.name).toMatchObject({
        x: expected.x,
        y: expected.y,
        width: expected.width,
        height: expected.height,
      });
      if (expected.targetMap) {
        const target = zone.properties.find((p) => p.name === 'targetMap');
        const spawn = zone.properties.find((p) => p.name === 'targetSpawn');
        expect(target.value).toBe(expected.targetMap);
        expect(spawn.value).toBe(expected.targetSpawn);
      }
    }

    const forest = map.tilesets.find((ts) => ts.name === 'forest_floor');
    const grass = map.tilesets.find((ts) => ts.name === 'grass');
    expect(forest).toBeDefined();
    const ground = layer(map, 'ground').data;
    const blendCount = ground.filter((gid) => gid >= forest.firstgid + 8 && gid <= forest.firstgid + 21).length;
    expect(blendCount).toBeGreaterThan(0);
    const grassFrames = new Set(
      ground
        .filter((gid) => gid >= grass.firstgid && gid < grass.firstgid + grass.tilecount)
        .map((gid) => gid - grass.firstgid),
    );
    expect(grassFrames.size).toBeGreaterThan(1);

    const bases = props(map).filter((p) => p.name === 'tree_pine_base' || p.name === 'tree_oak_base');
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) {
      const canopyName = base.name === 'tree_pine_base' ? 'tree_pine_canopy' : 'tree_oak_canopy';
      const canopy = props(map).find((p) => p.name === canopyName && p.x === base.x && p.y === base.y);
      expect(canopy, base.name).toBeDefined();
      expect(canopy.width).toBe(base.width);
      expect(canopy.height).toBe(base.height);
      expect(canopy.properties.find((p) => p.name === 'layer')?.value).toBe('overhead');
      expect(canopy.properties.find((p) => p.name === 'tall')?.value).toBe(true);
      const canopyFp = JSON.parse(canopy.properties.find((p) => p.name === 'footprint').value);
      expect(canopyFp.shape).toBe('none');
      const trunkFp = JSON.parse(base.properties.find((p) => p.name === 'footprint').value);
      expect(trunkFp.w).toBeLessThan(base.width);
      expect(trunkFp.h).toBeLessThan(base.height);
    }

    const road = map.tilesets.find((ts) => ts.name === 'dirt_road');
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const gid = ground[ty * map.width + tx];
        const onRoad = gid >= road.firstgid && gid < road.firstgid + road.tilecount;
        if (!onRoad) continue;
        expect(props(map).some((obj) => coversCenter(obj, tx, ty)), `road ${tx},${ty}`).toBe(false);
      }
    }

    for (const zone of zoneList) {
      if (zone.type !== 'exit' && zone.type !== 'spawn') continue;
      const rect = { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
      for (const obj of props(map)) {
        const fp = parsePropFootprint(obj);
        if (!fp || fp.shape === 'none' || !(fp.width > 0)) continue;
        expect(rectsOverlap(rect, fp), `${zone.name} vs ${obj.name}`).toBe(false);
      }
    }

    expect(unreachableFromEntrances(map)).toEqual([]);
  }

  const hearthExits = [
    { name: 'spawn_default', x: 7 * TILE_SIZE, y: 5 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
    { name: 'spawn_north', x: 9 * TILE_SIZE, y: 1 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
    { name: 'spawn_west', x: 1 * TILE_SIZE, y: 2 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
    {
      name: 'exit_north', x: 8 * TILE_SIZE, y: 0, width: 4 * TILE_SIZE, height: TILE_SIZE,
      targetMap: 'wilderness.tmj', targetSpawn: 'spawn_south',
    },
    {
      name: 'exit_west', x: 0, y: 2 * TILE_SIZE, width: TILE_SIZE, height: 2 * TILE_SIZE,
      targetMap: 'ruinwatch.tmj', targetSpawn: 'spawn_east',
    },
  ];

  const ruinExits = [
    { name: 'spawn_default', x: 10 * TILE_SIZE, y: 6 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
    { name: 'spawn_east', x: 17 * TILE_SIZE, y: 5 * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
    {
      name: 'exit_east', x: 19 * TILE_SIZE, y: 5 * TILE_SIZE, width: TILE_SIZE, height: 2 * TILE_SIZE,
      targetMap: 'hearthmile.tmj', targetSpawn: 'spawn_west',
    },
  ];

  it('softens hearthmile, keeps the exits, and stays reachable', () => {
    const map = buildHearthmileMap(tilesets, DEFAULT_SEED);
    expectPolish(map, hearthExits);
    expect(JSON.stringify(map)).toBe(JSON.stringify(buildHearthmileMap(tilesets, DEFAULT_SEED)));
    const other = buildHearthmileMap(tilesets, 'other-seed');
    expect(JSON.stringify(layer(map, 'ground').data)).not.toBe(JSON.stringify(layer(other, 'ground').data));
  });

  it('gives ruinwatch canopies, a forest edge, and a reachable camp', () => {
    const map = buildRuinwatchMap(tilesets, DEFAULT_SEED);
    expectPolish(map, ruinExits);
    const names = props(map).map((p) => p.name);
    expect(names).toContain('tree_pine_canopy');
    expect(names).toContain('tree_oak_canopy');
    expect(names).toContain('hearth_burn_down_0');
    expect(JSON.stringify(map)).toBe(JSON.stringify(buildRuinwatchMap(tilesets, DEFAULT_SEED)));
  });
});
