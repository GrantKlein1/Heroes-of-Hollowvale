#!/usr/bin/env node
/**
 * Tiled .tmj Map Validator for Heroes of Hollowvale.
 *
 * Enforces:
 * 1. GIDs exist in defined tilesets (both tile layers and object tile GIDs).
 * 2. Road / Wang rules:
 *    - No grass holes in roads (non-road cells surrounded on all cardinal sides by road).
 *    - No unmarked dead ends (road tiles of degree <= 1 without exit/spawn/door/marker).
 * 3. Exits resolve (valid targetMap and targetSpawn attributes; optional cross-map resolution).
 * 4. Spawns not inside a collider (tile collision layers or prop collision footprints).
 * 5. Every place name in canon lore (verified against newLore_expanded.txt).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_LORE_PATH = path.join(REPO_ROOT, 'newLore_expanded.txt');

// Flip flags used by Tiled
const FLIP_HORIZONTAL = 0x80000000;
const FLIP_VERTICAL = 0x40000000;
const FLIP_DIAGONAL = 0x20000000;
const FLIP_HEX = 0x10000000;
const FLIP_MASK = 0x1fffffff;

/**
 * Normalizes Tiled properties into a plain key-value dictionary.
 *
 * @param {Array<{ name: string, value: any }> | Record<string, any>} [rawProps]
 * @returns {Record<string, any>}
 */
export function parseProperties(rawProps) {
  if (!rawProps) return {};
  if (Array.isArray(rawProps)) {
    const dict = {};
    for (const prop of rawProps) {
      if (prop && typeof prop.name === 'string') {
        dict[prop.name] = prop.value;
      }
    }
    return dict;
  }
  if (typeof rawProps === 'object') {
    return { ...rawProps };
  }
  return {};
}

/**
 * Parses embedded footprint JSON from prop object properties or attributes.
 * Matches MapLoader.js / docs/ASSET_SPEC.md §5.C contract.
 *
 * @param {object} propObj - Raw Tiled prop object
 * @returns {{ x: number, y: number, width: number, height: number, shape: string }}
 */
export function parsePropFootprint(propObj) {
  const px = Number(propObj.x) || 0;
  const py = Number(propObj.y) || 0;
  const pw = Number(propObj.width) || 32;
  const ph = Number(propObj.height) || 32;

  let fp = {
    x: 0,
    y: Math.round(ph * 0.75),
    w: pw,
    h: Math.max(8, Math.round(ph * 0.25)),
    shape: 'rect',
  };

  const props = propObj.properties;
  let rawFootprint = null;
  if (Array.isArray(props)) {
    const match = props.find((p) => p && p.name === 'footprint');
    if (match) rawFootprint = match.value;
  } else if (props && typeof props.footprint !== 'undefined') {
    rawFootprint = props.footprint;
  }

  if (typeof rawFootprint === 'string') {
    try {
      rawFootprint = JSON.parse(rawFootprint);
    } catch {
      rawFootprint = null;
    }
  }

  if (rawFootprint && typeof rawFootprint === 'object') {
    const shape = String(rawFootprint.shape || 'rect').toLowerCase();
    if (shape === 'none') {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        shape: 'none',
      };
    }

    const rawW = rawFootprint.w ?? rawFootprint.width;
    const rawH = rawFootprint.h ?? rawFootprint.height;
    const w = Number.isFinite(Number(rawW)) ? Number(rawW) : fp.w;
    const h = Number.isFinite(Number(rawH)) ? Number(rawH) : fp.h;
    const relX = Number(rawFootprint.x) || 0;
    const relY = Number(rawFootprint.y) || 0;

    const centerX = px + pw / 2;
    const feetY = py + ph;

    let worldX = px + relX;
    let worldY = py + relY;

    if (relX < 0) {
      worldX = centerX + relX;
    }
    if (relY <= 0) {
      worldY = feetY + relY;
    }

    return {
      x: worldX,
      y: worldY,
      width: w,
      height: h,
      shape,
    };
  }

  return {
    x: px + fp.x,
    y: py + fp.y,
    width: fp.w,
    height: fp.h,
    shape: 'rect',
  };
}

/**
 * Axis-aligned bounding box collision test.
 *
 * @param {{ x: number, y: number, width: number, height: number }} a
 * @param {{ x: number, y: number, width: number, height: number }} b
 * @returns {boolean}
 */
export function rectsIntersect(a, b) {
  return !(
    a.x + a.width <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  );
}

/**
 * Escapes regex special characters.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether a place name exists in the canon lore text.
 *
 * @param {string} name
 * @param {string} loreText
 * @returns {boolean}
 */
export function isCanonPlaceName(name, loreText) {
  if (!name || typeof name !== 'string') return false;
  if (!loreText || typeof loreText !== 'string') return false;

  const trimmed = name.trim();
  if (!trimmed) return false;

  // Exact word boundary regex check (case-insensitive)
  // Ensures substring match like 'Ash' doesn't falsely validate 'Ashfang'
  const pattern = new RegExp(`(?:^|[^a-zA-Z0-9_])${escapeRegex(trimmed)}(?:[^a-zA-Z0-9_]|$)`, 'i');
  return pattern.test(loreText);
}

/**
 * Extracts declared place names from map properties, layers, and objects.
 *
 * @param {object} mapData
 * @returns {Array<{ name: string, source: string }>}
 */
export function extractPlaceNames(mapData) {
  const extracted = [];
  const placeKeys = [
    'placeName',
    'placename',
    'location',
    'region',
    'zone',
    'area',
    'canonName',
    'loreLocation',
    'loreName',
    'targetRegion',
    'targetLocation',
    'targetPlace',
  ];

  // 1. Map root and properties
  const mapProps = parseProperties(mapData.properties);
  for (const key of placeKeys) {
    if (typeof mapProps[key] === 'string' && mapProps[key].trim()) {
      extracted.push({ name: mapProps[key].trim(), source: `map property "${key}"` });
    }
  }

  // 2. Layers & Objects
  const layers = Array.isArray(mapData.layers) ? mapData.layers : [];
  for (const layer of layers) {
    const layerProps = parseProperties(layer.properties);
    for (const key of placeKeys) {
      if (typeof layerProps[key] === 'string' && layerProps[key].trim()) {
        extracted.push({
          name: layerProps[key].trim(),
          source: `layer "${layer.name}" property "${key}"`,
        });
      }
    }

    if (layer.type === 'objectgroup' && Array.isArray(layer.objects)) {
      for (const obj of layer.objects) {
        const objProps = parseProperties(obj.properties);
        const objType = String(obj.type || obj.class || '').toLowerCase();

        // Check if object is a landmark/poi/location
        if (['location', 'poi', 'landmark', 'region', 'area', 'place'].includes(objType)) {
          if (obj.name && typeof obj.name === 'string' && obj.name.trim()) {
            extracted.push({
              name: obj.name.trim(),
              source: `object "${obj.name}" (${objType})`,
            });
          }
        }

        // Check explicit place properties on objects
        for (const key of placeKeys) {
          if (typeof objProps[key] === 'string' && objProps[key].trim()) {
            extracted.push({
              name: objProps[key].trim(),
              source: `object "${obj.name || obj.id}" property "${key}"`,
            });
          }
        }

        // Check exit targetMap base name if applicable (e.g. wilderness.tmj -> wilderness)
        const isExit =
          objType === 'exit' ||
          String(objProps.kind || '').toLowerCase() === 'exit' ||
          Boolean(objProps.targetMap);

        if (isExit && typeof objProps.targetMap === 'string') {
          const explicitPlace = objProps.targetPlace || objProps.canonName || objProps.placeName;
          if (explicitPlace) {
            extracted.push({
              name: String(explicitPlace).trim(),
              source: `exit "${obj.name || obj.id}" targetPlace`,
            });
          } else {
            const base = path.basename(objProps.targetMap, path.extname(objProps.targetMap)).trim();
            if (base && !['map', 'test', 'fixture'].includes(base.toLowerCase())) {
              extracted.push({
                name: base,
                source: `exit "${obj.name || obj.id}" targetMap`,
              });
            }
          }
        }
      }
    }
  }

  return extracted;
}

/**
 * Validates a Tiled map against all engine and lore contracts.
 *
 * @param {object|string} mapInput - Raw map JSON object or path to .tmj file
 * @param {object} [options]
 * @param {string} [options.lorePath] - Path to newLore_expanded.txt
 * @param {string} [options.loreText] - Optional direct canon lore string
 * @param {Set<string>|string[]} [options.availableMaps] - Optional set of map names for exit cross-resolution
 * @param {boolean} [options.skipLore=false] - Skip lore check
 * @returns {{ valid: boolean, errors: string[], warnings: string[], stats: object }}
 */
export function validateMap(mapInput, options = {}) {
  const errors = [];
  const warnings = [];

  // 1. Resolve map data
  let mapData = mapInput;
  let mapFilePath = null;
  if (typeof mapInput === 'string') {
    mapFilePath = path.resolve(mapInput);
    if (!fs.existsSync(mapFilePath)) {
      return {
        valid: false,
        errors: [`Map file not found: ${mapFilePath}`],
        warnings: [],
        stats: {},
      };
    }
    try {
      const raw = fs.readFileSync(mapFilePath, 'utf8');
      mapData = JSON.parse(raw);
    } catch (err) {
      return {
        valid: false,
        errors: [`Failed to parse JSON in map file: ${err.message}`],
        warnings: [],
        stats: {},
      };
    }
  }

  if (!mapData || typeof mapData !== 'object') {
    return {
      valid: false,
      errors: ['Map data must be a valid JSON object'],
      warnings: [],
      stats: {},
    };
  }

  const mapWidth = Number(mapData.width) || 0;
  const mapHeight = Number(mapData.height) || 0;
  const tileWidth = Number(mapData.tilewidth) || 32;
  const tileHeight = Number(mapData.tileheight) || 32;

  if (mapWidth <= 0 || mapHeight <= 0) {
    errors.push(`Invalid map dimensions: width=${mapWidth}, height=${mapHeight}`);
  }

  // 2. Resolve tilesets and GID ranges
  const rawTilesets = Array.isArray(mapData.tilesets) ? mapData.tilesets : [];
  const tilesets = [];
  const gidCollidesMap = new Map();
  const gidRoadMap = new Map();

  for (const ts of rawTilesets) {
    const firstgid = Number(ts.firstgid) || 1;
    const tilecount = Number(ts.tilecount) || 0;
    const name = String(ts.name || '');
    const isRoadTileset = name.toLowerCase().includes('road') || name.toLowerCase().includes('path');

    tilesets.push({
      firstgid,
      tilecount,
      name,
      isRoadTileset,
      raw: ts,
    });

    if (Array.isArray(ts.tiles)) {
      for (const t of ts.tiles) {
        const gid = firstgid + Number(t.id);
        const props = parseProperties(t.properties);
        if (props.collides === true || props.collide === true) {
          gidCollidesMap.set(gid, true);
        }
        if (
          props.road === true ||
          props.isRoad === true ||
          props.path === true ||
          props.terrain === 'road' ||
          props.type === 'road' ||
          isRoadTileset
        ) {
          gidRoadMap.set(gid, true);
        }
      }
    }
  }

  /**
   * Helper to verify if a raw GID belongs to any tileset.
   * @param {number} rawGid
   * @returns {boolean}
   */
  function isGidDefined(rawGid) {
    if (rawGid === 0) return true;
    for (const ts of tilesets) {
      if (ts.tilecount > 0) {
        if (rawGid >= ts.firstgid && rawGid < ts.firstgid + ts.tilecount) {
          return true;
        }
      } else {
        // If tilecount not specified, assume firstgid match if >= firstgid
        if (rawGid >= ts.firstgid) {
          return true;
        }
      }
    }
    return false;
  }

  // 3. Inspect Layers (Tile GIDs, Colliders, Roads, Zones, Props)
  const layers = Array.isArray(mapData.layers) ? mapData.layers : [];
  const tileColliders = []; // Array of { x, y, width, height, source }
  const propColliders = []; // Array of { x, y, width, height, name }
  const spawns = []; // Array of { id, name, x, y, width, height, raw }
  const exits = []; // Array of { id, name, x, y, width, height, targetMap, targetSpawn, raw }
  const markers = []; // Array of { x, y, width, height, name, type }

  // 2D grid for road analysis [y][x]
  const roadGrid = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
  let roadTileCount = 0;

  for (const layer of layers) {
    const layerName = String(layer.name || '');
    const isCollisionLayer = layerName.toLowerCase() === 'collision';
    const isRoadLayer =
      layerName.toLowerCase().includes('road') ||
      layerName.toLowerCase().includes('path');

    if (layer.type === 'tilelayer') {
      const data = Array.isArray(layer.data) ? layer.data : [];
      const layerWidth = Number(layer.width) || mapWidth;
      const layerHeight = Number(layer.height) || mapHeight;

      for (let i = 0; i < data.length; i++) {
        const rawGidWithFlips = data[i];
        const gid = rawGidWithFlips & FLIP_MASK;
        const tx = i % layerWidth;
        const ty = Math.floor(i / layerWidth);

        if (gid > 0) {
          // Rule 1: Check GID exists in tilesets
          if (!isGidDefined(gid)) {
            errors.push(
              `Tile at (${tx}, ${ty}) in layer "${layerName}" uses invalid GID ${gid} (not found in any tileset)`
            );
          }

          // Check if tile collides
          const tileCollides = isCollisionLayer || gidCollidesMap.get(gid) === true;
          if (tileCollides) {
            tileColliders.push({
              x: tx * tileWidth,
              y: ty * tileHeight,
              width: tileWidth,
              height: tileHeight,
              tx,
              ty,
              source: `layer "${layerName}" GID ${gid}`,
            });
          }

          // Check if tile is road
          const isRoad = isRoadLayer || gidRoadMap.get(gid) === true;
          if (isRoad && ty < mapHeight && tx < mapWidth) {
            roadGrid[ty][tx] = true;
            roadTileCount++;
          }
        }
      }
    } else if (layer.type === 'objectgroup') {
      const objects = Array.isArray(layer.objects) ? layer.objects : [];
      for (const obj of objects) {
        // Tile object GID check
        if (typeof obj.gid === 'number') {
          const objGid = obj.gid & FLIP_MASK;
          if (objGid > 0 && !isGidDefined(objGid)) {
            errors.push(
              `Object "${obj.name || obj.id}" in layer "${layerName}" uses invalid GID ${objGid} (not found in any tileset)`
            );
          }
        }

        const objType = String(obj.type || obj.class || '').toLowerCase();
        const objProps = parseProperties(obj.properties);
        const kind = String(objProps.kind || '').toLowerCase();
        const objName = String(obj.name || '');

        const isExit =
          objType === 'exit' ||
          kind === 'exit' ||
          objName.toLowerCase().startsWith('exit') ||
          Boolean(objProps.targetMap || objProps.toMap);

        const isSpawn =
          objType === 'spawn' ||
          kind === 'spawn' ||
          objName.toLowerCase().startsWith('spawn') ||
          Boolean(objProps.spawnId);

        const isDoor =
          objType === 'door' ||
          kind === 'door' ||
          objName.toLowerCase().startsWith('door');

        const isPoi =
          ['poi', 'landmark', 'trigger', 'marker', 'building'].includes(objType) ||
          ['poi', 'landmark', 'trigger', 'marker'].includes(kind);

        const ox = Number(obj.x) || 0;
        const oy = Number(obj.y) || 0;
        const ow = Number(obj.width) || tileWidth;
        const oh = Number(obj.height) || tileHeight;

        if (isSpawn) {
          spawns.push({
            id: obj.id,
            name: objName || `spawn_${obj.id}`,
            x: ox,
            y: oy,
            width: ow,
            height: oh,
            raw: obj,
          });
        }

        if (isExit) {
          const targetMap = objProps.targetMap || objProps.toMap;
          const targetSpawn = objProps.targetSpawn || objProps.toSpawn || objProps.spawnId;
          exits.push({
            id: obj.id,
            name: objName || `exit_${obj.id}`,
            x: ox,
            y: oy,
            width: ow,
            height: oh,
            targetMap,
            targetSpawn,
            raw: obj,
          });
        }

        if (isDoor || isExit || isSpawn || isPoi) {
          markers.push({
            name: objName,
            type: objType || kind,
            x: ox,
            y: oy,
            width: ow,
            height: oh,
          });
        }

        // Prop colliders from footprint
        if (layerName.toLowerCase() === 'props' || objType === 'prop' || objProps.footprint) {
          const fp = parsePropFootprint(obj);
          propColliders.push({
            name: objName || `prop_${obj.id}`,
            x: fp.x,
            y: fp.y,
            width: fp.width,
            height: fp.height,
            shape: fp.shape,
          });
        }
      }
    }
  }

  // 4. Validate Road / Wang Rules
  if (roadTileCount > 0) {
    // 4A: No grass holes in roads
    for (let y = 1; y < mapHeight - 1; y++) {
      for (let x = 1; x < mapWidth - 1; x++) {
        if (!roadGrid[y][x]) {
          const north = roadGrid[y - 1][x];
          const south = roadGrid[y + 1][x];
          const west = roadGrid[y][x - 1];
          const east = roadGrid[y][x + 1];

          if (north && south && west && east) {
            errors.push(
              `Grass hole detected in road at (${x}, ${y}): non-road tile completely surrounded by road on all 4 cardinal sides`
            );
          }
        }
      }
    }

    // 4B: No unmarked dead ends
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (roadGrid[y][x]) {
          let degree = 0;
          const cardinalNeighbors = [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ];

          for (const [dx, dy] of cardinalNeighbors) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight && roadGrid[ny][nx]) {
              degree++;
            }
          }

          if (degree <= 1) {
            // Check if marked by an exit, door, spawn, or POI marker
            const tileBounds = {
              x: x * tileWidth,
              y: y * tileHeight,
              width: tileWidth,
              height: tileHeight,
            };

            const isMarked = markers.some((m) => {
              // Expand marker bounds slightly (1.5 tiles radius) to capture adjacent endpoints
              const expandedBounds = {
                x: m.x - tileWidth * 0.5,
                y: m.y - tileHeight * 0.5,
                width: m.width + tileWidth,
                height: m.height + tileHeight,
              };
              return rectsIntersect(tileBounds, expandedBounds);
            });

            if (!isMarked) {
              errors.push(
                `Road dead end at (${x}, ${y}) is unmarked (no exit, spawn, door, POI, or marker attached)`
              );
            }
          }
        }
      }
    }
  }

  // 5. Validate Exits Resolve
  for (const exit of exits) {
    if (!exit.targetMap || typeof exit.targetMap !== 'string' || !exit.targetMap.trim()) {
      errors.push(`Exit "${exit.name}" does not resolve: missing or empty targetMap property`);
    }

    if (!exit.targetSpawn || typeof exit.targetSpawn !== 'string' || !exit.targetSpawn.trim()) {
      errors.push(`Exit "${exit.name}" does not resolve: missing or empty targetSpawn property`);
    }

    // Optional cross-map validation
    if (options.availableMaps && exit.targetMap) {
      const mapSet = options.availableMaps instanceof Set
        ? options.availableMaps
        : new Set(options.availableMaps);

      if (!mapSet.has(exit.targetMap) && !mapSet.has(path.basename(exit.targetMap))) {
        errors.push(
          `Exit "${exit.name}" references targetMap "${exit.targetMap}" which is not in available maps`
        );
      }
    }
  }

  // 6. Validate Spawns Not Inside a Collider
  for (const spawn of spawns) {
    const spawnRect = {
      x: spawn.x,
      y: spawn.y,
      width: spawn.width,
      height: spawn.height,
    };

    // Check tile colliders
    for (const tc of tileColliders) {
      if (rectsIntersect(spawnRect, tc)) {
        errors.push(
          `Spawn "${spawn.name}" at (${spawn.x}, ${spawn.y}) is inside a collider (${tc.source} at tile [${tc.tx}, ${tc.ty}])`
        );
        break; // Only report once per spawn for tile colliders
      }
    }

    // Check prop colliders
    for (const pc of propColliders) {
      if (rectsIntersect(spawnRect, pc)) {
        errors.push(
          `Spawn "${spawn.name}" at (${spawn.x}, ${spawn.y}) is inside a prop collider (prop "${pc.name}" footprint at [${pc.x}, ${pc.y}])`
        );
        break;
      }
    }
  }

  // 7. Validate Canon Lore Place Names
  let loreNamesChecked = 0;
  if (!options.skipLore) {
    let loreContent = options.loreText;
    if (!loreContent) {
      const lorePath = options.lorePath || DEFAULT_LORE_PATH;
      if (fs.existsSync(lorePath)) {
        try {
          loreContent = fs.readFileSync(lorePath, 'utf8');
        } catch (err) {
          warnings.push(`Could not read canon lore file from ${lorePath}: ${err.message}`);
        }
      } else {
        warnings.push(`Canon lore file not found at ${lorePath}`);
      }
    }

    if (loreContent) {
      const placeNames = extractPlaceNames(mapData);
      loreNamesChecked = placeNames.length;

      for (const entry of placeNames) {
        if (!isCanonPlaceName(entry.name, loreContent)) {
          errors.push(
            `Place name "${entry.name}" from ${entry.source} is not found in canon lore (newLore_expanded.txt)`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      mapWidth,
      mapHeight,
      tileWidth,
      tileHeight,
      layerCount: layers.length,
      tilesetCount: tilesets.length,
      roadTileCount,
      spawnCount: spawns.length,
      exitCount: exits.length,
      loreNamesChecked,
    },
  };
}

// ============================================================================
// CLI Execution
// ============================================================================
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  let targets = [];

  if (args.length > 0) {
    targets = args;
  } else {
    // Default: find all .tmj files under client/src/game/maps, skipping bad_* fixtures
    const mapsDir = path.join(REPO_ROOT, 'client', 'src', 'game', 'maps');
    function collectTmj(dir) {
      let results = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(collectTmj(full));
        } else if (entry.isFile() && entry.name.endsWith('.tmj')) {
          if (!entry.name.startsWith('bad_')) {
            results.push(full);
          }
        }
      }
      return results;
    }
    targets = collectTmj(mapsDir);
  }

  console.log(`\n======================================================`);
  console.log(`[Tiled Map Validator] Validating ${targets.length} map(s)`);
  console.log(`======================================================\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let passedCount = 0;

  for (const target of targets) {
    const rel = path.relative(REPO_ROOT, target);
    const result = validateMap(target);

    if (result.valid) {
      console.log(`  ✓ [PASS] ${rel}`);
      passedCount++;
    } else {
      console.error(`  ✗ [FAIL] ${rel}`);
      for (const err of result.errors) {
        console.error(`      - Error: ${err}`);
      }
      totalErrors += result.errors.length;
    }

    if (result.warnings.length > 0) {
      for (const warn of result.warnings) {
        console.warn(`      - Warning: ${warn}`);
      }
      totalWarnings += result.warnings.length;
    }
  }

  console.log(`\n======================================================`);
  console.log(`Summary: ${passedCount}/${targets.length} passed`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Total Warnings: ${totalWarnings}`);
  console.log(`======================================================\n`);

  if (totalErrors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
