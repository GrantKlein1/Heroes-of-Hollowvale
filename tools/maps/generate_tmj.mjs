#!/usr/bin/env node
/**
 * Tiled .tmj Map Generator for Heroes of Hollowvale.
 * Package MM-1 (Lane F Map Content).
 *
 * Emits 32 px Tiled .tmj maps using Blendsmith v4 tilesets and prop pairing metadata,
 * validated by tools/maps/validate_map.mjs and adhering to docs/maps/brackenford-route-notes.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

export const TILE_SIZE = 32;
export const LEAGUE_W = 20;
export const LEAGUE_H = 12;
export const STRIDE_X = 19;
export const STRIDE_Y = 11;

export const DEFAULT_SEED = 'hollowvale-1477';

// Direction vectors
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// ============================================================================
// 1. Deterministic Seeding & PRNG (docs/maps/brackenford-route-notes.md §5)
// ============================================================================

export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mix(seed, x, y, salt = 0) {
  let h = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0;
  h ^= Math.imul(x | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= Math.imul(y | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h ^= salt >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x165667b1);
  return h >>> 0;
}

export function unit(seed, x, y, salt = 0) {
  return mix(seed, x, y, salt) / 4294967296;
}

export function posMod(n, m) {
  return ((n % m) + m) % m;
}

export function isStrideEdge(wx, wy) {
  return posMod(wx, STRIDE_X) === 0 || posMod(wy, STRIDE_Y) === 0;
}

export function tileKey(wx, wy) {
  return `${wx},${wy}`;
}

export function tileCenter(wx, wy, tileSize = TILE_SIZE) {
  return {
    x: wx * tileSize + tileSize / 2,
    y: wy * tileSize + tileSize / 2,
  };
}

// ============================================================================
// 2. Ember Road, River Bracken & Route Geometry (§2)
// ============================================================================

// Hearthmile bend turn-set (PR #22 / route notes §2.A)
const BEND_CELLS = new Set([
  '11,48', '10,48', '9,48', '8,48', '7,48', '6,48', '5,48', '4,48', '3,48',
  '7,47', '6,47', '5,47', '4,47',
  '3,47', '2,47', '1,47', '0,47',
  '5,46', '4,46', '3,46', '2,46', '1,46', '0,46',
  '2,48', '1,48', '0,48',
  '-1,47', '-1,46', '-2,46', '-3,46', '-4,46',
  '-2,47', '-3,47', '-4,47',
]);

/**
 * Builds the 16-league Northern Eaves Road to Ruinwatch (PR #23 / §2.B).
 */
function buildEavesRoad() {
  const cells = new Set();
  const center = [];
  const add = (x, y) => {
    cells.add(`${x},${y}`);
    cells.add(`${x},${y + 1}`);
  };

  let x = -4;
  let y = 46;
  const steps = 16 * 18; // 288 steps
  for (let i = 0; i <= steps; i++) {
    add(x, y);
    center.push({ wx: x, wy: y, i });
    x -= 1;
    add(x, y);
    if (i % 5 === 4) {
      y -= 1;
      add(x, y);
    }
  }

  let guard = 0;
  while ((posMod(x, STRIDE_X) === 0 || posMod(y, STRIDE_Y) === 0) && guard < 8) {
    x -= 1;
    add(x, y);
    center.push({ wx: x, wy: y, i: steps + 1 + guard });
    guard += 1;
  }
  return { cells, center };
}

const EAVES = buildEavesRoad();
export const RUINWATCH_ROAD = EAVES.center[EAVES.center.length - 1];

function beside(p) {
  let x = p.wx;
  let y = p.wy;
  if (posMod(y, STRIDE_Y) === 0) y += 1;
  if (posMod(x, STRIDE_X) === 0) x += 1;
  return { wx: x, wy: y, i: p.i };
}

export const RUINWATCH_CAMP = beside(RUINWATCH_ROAD);

export function isRoad(wx, wy) {
  // River line crosses at wy = 7; crossings are fords or bridges
  if (wy === 7) return false;
  // Ember Road highway track (4 tiles wide wx 8..11, wy 11..47)
  if (wx >= 8 && wx <= 11 && wy >= 11 && wy <= 47) return true;
  // Hearthmile stone bend turn set
  if (BEND_CELLS.has(tileKey(wx, wy))) return true;
  // Northern Eaves Road
  if (EAVES.cells.has(tileKey(wx, wy))) return true;
  // Brackenford south track from square to gate
  if (wx >= 8 && wx <= 11 && wy >= 6 && wy <= 9) return true;
  return false;
}

export function riverKind(wx, wy) {
  if (wy !== 7) return null;
  // River line runs along wy = 7
  if (wx >= 8 && wx <= 11) return 'ford'; // Town ford
  if (wx === 5 || wx === 6) return 'bridge'; // Plank bridge
  return 'water'; // Deep water
}

// Hand-authored landmark stamps
function stampKind(wx, wy) {
  // Brackenford Hub (lx: 0, ly: 0)
  if (wy >= 0 && wy <= 11 && wx >= 0 && wx <= 19) {
    if (wy === 7) return riverKind(wx, wy);
    if (wy === 10 && (wx === 9 || wx === 10)) return 'gate';
    if (isRoad(wx, wy)) return 'road';
    if (wy === 1 && wx >= 2 && wx <= 17) return 'wall';
    if (wy === 10 && wx >= 2 && wx <= 17) return 'wall';
    if (wx === 1 && wy >= 2 && wy <= 9) return 'wall';
    if (wx === 18 && wy >= 2 && wy <= 9) return 'wall';
    // Cobblestone town square
    if (wy >= 4 && wy <= 6 && wx >= 5 && wx <= 16) return 'cobble';
    if (wy >= 8 && wy <= 9 && wx >= 8 && wx <= 11) return 'cobble';
    return null;
  }

  // Hearthmile Stone bend (lx: 0, ly: 4)
  if (wy >= 44 && wy <= 55 && wx >= 0 && wx <= 19) {
    if (isRoad(wx, wy)) return 'road';
    // Cobblestone apron around monument
    if (wx >= 6 && wx <= 8 && wy >= 48 && wy <= 50) return 'cobble';
    return null;
  }

  // Ruinwatch Camp
  const rw = RUINWATCH_CAMP;
  if (Math.abs(wx - rw.wx) <= 2 && Math.abs(wy - rw.wy) <= 2) {
    if (isRoad(wx, wy)) return 'road';
    return 'cobble'; // Cobblestone apron around camp
  }

  return null;
}

export function computeKind(wx, wy, seed = DEFAULT_SEED) {
  const stamped = stampKind(wx, wy);
  if (stamped) return stamped;
  if (isRoad(wx, wy)) return 'road';
  const river = riverKind(wx, wy);
  if (river) return river;

  // Biome distribution
  const dx = 9.5 - wx;
  const h = unit(seed, wx, wy, 1);
  const south = Math.max(0, Math.min(1, (wy - 11) / 44));
  if (dx >= 6) return h < 0.82 ? 'forest' : 'grass';
  if (dx >= 3) {
    const t = (dx - 3) / 3 + south * 0.12;
    return h < t ? 'forest' : 'grass';
  }
  if (dx <= -5) return h < 0.78 ? 'plains' : 'grass';
  if (dx <= -2) {
    const t = (-dx - 2) / 3;
    return h < t ? 'plains' : 'grass';
  }
  return 'grass';
}

export function isPassableKind(kind) {
  return kind !== 'wall' && kind !== 'water' && kind !== 'cliff';
}

// ============================================================================
// 3. Wang 2x2 Corner Autotiler for 16-tile Sets
// ============================================================================

/**
 * Evaluates binary Wang ID (0..15) for corner Wang matching:
 * Bit 0: NW (1)
 * Bit 1: NE (2)
 * Bit 2: SW (4)
 * Bit 3: SE (8)
 */
export function autotileWangId(wx, wy, isGroup) {
  if (!isGroup(wx, wy)) return 0;

  const n = isGroup(wx, wy - 1);
  const s = isGroup(wx, wy + 1);
  const w = isGroup(wx - 1, wy);
  const e = isGroup(wx + 1, wy);

  const nwDiag = isGroup(wx - 1, wy - 1);
  const neDiag = isGroup(wx + 1, wy - 1);
  const swDiag = isGroup(wx - 1, wy + 1);
  const seDiag = isGroup(wx + 1, wy + 1);

  const nw = (!n || !w) ? false : (nwDiag ? true : false);
  const ne = (!n || !e) ? false : (neDiag ? true : false);
  const sw = (!s || !w) ? false : (swDiag ? true : false);
  const se = (!s || !e) ? false : (seDiag ? true : false);

  let id = 0;
  if (nw) id |= 1;
  if (ne) id |= 2;
  if (sw) id |= 4;
  if (se) id |= 8;

  // Fallback to center tile if isolated cell in group
  if (id === 0 && isGroup(wx, wy)) {
    id = 15;
  }

  return id;
}

// ============================================================================
// 4. Blendsmith v4 Tileset Definitions & FirstGIDs
// ============================================================================

export const TILESET_SPECS = [
  { name: 'grass', file: 'grass.tsj', count: 8 },
  { name: 'dirt_road', file: 'dirt_road.tsj', count: 16 },
  { name: 'cobble_road', file: 'cobble_road.tsj', count: 16 },
  { name: 'water', file: 'water.tsj', count: 64 },
  { name: 'water_ford', file: 'water_ford.tsj', count: 4 },
  { name: 'bridge_plank', file: 'bridge_plank.tsj', count: 4 },
  { name: 'cliff', file: 'cliff.tsj', count: 16 },
  { name: 'cliff_face', file: 'cliff_face.tsj', count: 4 },
];

export function buildTilesets(assetsDir) {
  const tilesets = [];
  let currentFirstGid = 1;

  for (const spec of TILESET_SPECS) {
    const tsjPath = path.join(assetsDir, spec.file);
    if (!fs.existsSync(tsjPath)) {
      throw new Error(`Tileset file not found: ${tsjPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(tsjPath, 'utf8'));
    const embedded = {
      firstgid: currentFirstGid,
      columns: raw.columns || 4,
      image: `../assets/tiles/${raw.image || spec.name + '.png'}`,
      imagewidth: raw.imagewidth,
      imageheight: raw.imageheight,
      margin: raw.margin ?? 1,
      name: raw.name || spec.name,
      spacing: raw.spacing ?? 2,
      tilecount: raw.tilecount || spec.count,
      tileheight: raw.tileheight || TILE_SIZE,
      tilewidth: raw.tilewidth || TILE_SIZE,
      tiles: raw.tiles || [],
      type: 'tileset',
      version: raw.version || '1.10',
    };

    tilesets.push({
      ...embedded,
      _baseGid: currentFirstGid,
    });

    currentFirstGid += embedded.tilecount;
  }

  return tilesets;
}

// GID resolver helper
export function createGidResolver(tilesets) {
  const map = new Map();
  for (const ts of tilesets) {
    map.set(ts.name, ts._baseGid);
  }
  return {
    get(name, localId = 0) {
      const base = map.get(name);
      if (base === undefined) {
        throw new Error(`Unknown tileset name: ${name}`);
      }
      return base + localId;
    },
  };
}

// ============================================================================
// 5. Props & Pairing Contract (§3 / ASSET_SPEC §5.C)
// ============================================================================

export const PROP_DEFINITIONS = {
  barrel: {
    w: 32, h: 48,
    footprint: { x: -10.0, y: -12, w: 20, h: 12, shape: 'ellipse' },
    blocks: true,
  },
  crate: {
    w: 32, h: 48,
    footprint: { x: -10.0, y: -12, w: 20, h: 12, shape: 'rect' },
    blocks: true,
  },
  bush_a: {
    w: 48, h: 48,
    footprint: { x: -10.0, y: -10, w: 20, h: 10, shape: 'ellipse' },
    blocks: false,
  },
  bush_b: {
    w: 40, h: 48,
    footprint: { x: -12.0, y: -12, w: 24, h: 12, shape: 'ellipse' },
    blocks: false,
  },
  rock_a: {
    w: 48, h: 48,
    footprint: { x: -12.0, y: -12, w: 24, h: 12, shape: 'ellipse' },
    blocks: true,
  },
  rock_b: {
    w: 40, h: 48,
    footprint: { x: -14.0, y: -14, w: 28, h: 14, shape: 'ellipse' },
    blocks: true,
  },
  well: {
    w: 64, h: 96,
    footprint: { x: -14.0, y: -20, w: 28, h: 20, shape: 'ellipse' },
    blocks: true,
  },
  torch: {
    w: 32, h: 64,
    footprint: { x: -4.0, y: -8, w: 8, h: 8, shape: 'rect' },
    blocks: false,
  },
  hearth: {
    w: 96, h: 96,
    footprint: { x: -34, y: -30, w: 68, h: 30, shape: 'rect' },
    blocks: true,
  },
  fence_corner: {
    w: 48, h: 48,
    footprint: { x: -7.0, y: -14, w: 14, h: 14, shape: 'rect' },
    blocks: true,
  },
  fence_h: {
    w: 48, h: 48,
    footprint: { x: -14.0, y: -8, w: 28, h: 8, shape: 'rect' },
    blocks: true,
  },
  fence_v: {
    w: 32, h: 48,
    footprint: { x: -4.0, y: -24, w: 8, h: 24, shape: 'rect' },
    blocks: true,
  },
  // Paired Props (pairing.json)
  cottage_base: {
    w: 160, h: 176,
    footprint: { x: -58.0, y: -70, w: 116, h: 70, shape: 'rect' },
    blocks: true,
    pairedOverhead: 'cottage_roof',
  },
  cottage_roof: {
    w: 160, h: 176,
    footprint: { x: 0, y: 0, w: 0, h: 0, shape: 'none' },
    blocks: false,
    tall: true,
    layer: 'overhead',
  },
  tavern_base: {
    w: 192, h: 208,
    footprint: { x: -74.0, y: -86, w: 148, h: 86, shape: 'rect' },
    blocks: true,
    pairedOverhead: 'tavern_roof',
  },
  tavern_roof: {
    w: 192, h: 208,
    footprint: { x: 0, y: 0, w: 0, h: 0, shape: 'none' },
    blocks: false,
    tall: true,
    layer: 'overhead',
  },
  tree_pine_base: {
    w: 128, h: 160,
    footprint: { x: -10.0, y: -12, w: 20, h: 12, shape: 'ellipse' },
    blocks: true,
    pairedOverhead: 'tree_pine_canopy',
  },
  tree_pine_canopy: {
    w: 128, h: 160,
    footprint: { x: 0, y: 0, w: 0, h: 0, shape: 'none' },
    blocks: false,
    tall: true,
    layer: 'overhead',
  },
  tree_oak_base: {
    w: 144, h: 144,
    footprint: { x: -12.0, y: -12, w: 24, h: 12, shape: 'ellipse' },
    blocks: true,
    pairedOverhead: 'tree_oak_canopy',
  },
  tree_oak_canopy: {
    w: 144, h: 144,
    footprint: { x: 0, y: 0, w: 0, h: 0, shape: 'none' },
    blocks: false,
    tall: true,
    layer: 'overhead',
  },
};

/**
 * Converts anchor tile (wx, wy) and prop dimensions to Tiled object coordinates (px, py).
 * Uses bottom-center pivot (0.5, 1.0).
 */
export function propObjectCoords(wx, wy, w, h, tileSize = TILE_SIZE) {
  const feetX = wx * tileSize + tileSize / 2;
  const feetY = (wy + 1) * tileSize;
  return {
    x: Math.round(feetX - w / 2),
    y: Math.round(feetY - h),
  };
}

/**
 * Checks whether a prop's footprint collider covers the geometric center of tile (wx, wy).
 */
export function propCoversCenter(wx, wy, propDef) {
  if (!propDef.blocks || !propDef.footprint || propDef.footprint.shape === 'none') return false;
  const fp = propDef.footprint;
  const center = tileCenter(wx, wy);

  const feetX = wx * TILE_SIZE + TILE_SIZE / 2;
  const feetY = (wy + 1) * TILE_SIZE;

  const fpX = feetX + fp.x;
  const fpY = feetY + fp.y;

  return (
    center.x >= fpX &&
    center.x <= fpX + fp.w &&
    center.y >= fpY &&
    center.y <= fpY + fp.h
  );
}

// ============================================================================
// 6. Topological Reachability & Flood Fill QA (§4)
// ============================================================================

export function floodLeague(width, height, isWalkable) {
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (seen[y][x] || !isWalkable(x, y)) return;
    seen[y][x] = true;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    for (const [dx, dy] of DIRS) {
      push(x + dx, y + dy);
    }
  }

  const lost = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWalkable(x, y) && !seen[y][x]) {
        lost.push({ x, y });
      }
    }
  }

  return { reachable: seen, lost };
}

// ============================================================================
// 7. Map Builders for Individual Leagues and Corridor
// ============================================================================

/**
 * Creates canonical 7-layer Tiled map JSON structure.
 */
function createTiledMapStructure({
  width,
  height,
  tilesets,
  groundData,
  groundDetailData,
  wallsData,
  collisionData,
  propsObjects,
  zonesObjects,
  overheadData,
  properties = [],
}) {
  let nextObjectId = 1;
  const assignIds = (objs) => {
    for (const obj of objs) {
      if (!obj.id) obj.id = nextObjectId++;
      else if (obj.id >= nextObjectId) nextObjectId = obj.id + 1;
    }
  };

  assignIds(propsObjects);
  assignIds(zonesObjects);

  return {
    compressionlevel: -1,
    width,
    height,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    nextlayerid: 8,
    nextobjectid: nextObjectId,
    properties,
    tilesets,
    layers: [
      {
        id: 1,
        name: 'ground',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width,
        height,
        data: groundData,
      },
      {
        id: 2,
        name: 'ground_detail',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width,
        height,
        data: groundDetailData,
      },
      {
        id: 3,
        name: 'walls',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width,
        height,
        data: wallsData,
      },
      {
        id: 4,
        name: 'props',
        type: 'objectgroup',
        draworder: 'topdown',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: propsObjects,
      },
      {
        id: 5,
        name: 'collision',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width,
        height,
        data: collisionData,
      },
      {
        id: 6,
        name: 'zones',
        type: 'objectgroup',
        draworder: 'topdown',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: zonesObjects,
      },
      {
        id: 7,
        name: 'overhead',
        type: 'tilelayer',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        width,
        height,
        data: overheadData,
      },
    ],
  };
}

/**
 * Builds Brackenford Hub Map (League 0, 0).
 */
export function buildBrackenfordMap(tilesets, seed = DEFAULT_SEED) {
  const gids = createGidResolver(tilesets);
  const width = LEAGUE_W;
  const height = LEAGUE_H;
  const lx = 0;
  const ly = 0;
  const x0 = lx * STRIDE_X;
  const y0 = ly * STRIDE_Y;

  const groundData = new Array(width * height).fill(0);
  const groundDetailData = new Array(width * height).fill(0);
  const wallsData = new Array(width * height).fill(0);
  const collisionData = new Array(width * height).fill(0);
  const overheadData = new Array(width * height).fill(0);

  const kindAt = (wx, wy) => computeKind(wx, wy, seed);

  // Group helpers for Wang corner matching
  const isDirtRoad = (wx, wy) => kindAt(wx, wy) === 'road' || kindAt(wx, wy) === 'gate';
  const isCobbleRoad = (wx, wy) => kindAt(wx, wy) === 'cobble';
  const isWater = (wx, wy) => kindAt(wx, wy) === 'water' || kindAt(wx, wy) === 'ford' || kindAt(wx, wy) === 'bridge';

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const wx = x0 + tx;
      const wy = y0 + ty;
      const idx = ty * width + tx;
      const kind = kindAt(wx, wy);

      // Base grass everywhere
      groundData[idx] = gids.get('grass', 0);

      // Grass tufts / flowers detail
      if (kind === 'grass' && unit(seed, wx, wy, 7) < 0.12) {
        const detailVariant = (mix(seed, wx, wy, 8) % 7) + 1; // ids 1..7
        groundDetailData[idx] = gids.get('grass', detailVariant);
      }

      if (kind === 'road' || kind === 'gate') {
        const wangId = autotileWangId(wx, wy, isDirtRoad);
        groundData[idx] = gids.get('dirt_road', wangId);
      } else if (kind === 'cobble') {
        const wangId = autotileWangId(wx, wy, isCobbleRoad);
        groundData[idx] = gids.get('cobble_road', wangId);
      } else if (kind === 'ford') {
        groundData[idx] = gids.get('water_ford', 0);
      } else if (kind === 'bridge') {
        groundData[idx] = gids.get('bridge_plank', 0);
      } else if (kind === 'water') {
        const wangId = autotileWangId(wx, wy, isWater);
        groundData[idx] = gids.get('water', wangId);
        // Hard Rule 2: Deep river water is solid in collision layer
        collisionData[idx] = gids.get('cliff', 0);
      } else if (kind === 'wall') {
        wallsData[idx] = gids.get('cliff_face', 0);
        collisionData[idx] = gids.get('cliff_face', 0);
      }
    }
  }

  // Props & Pairing objects
  const propsObjects = [];
  const addProp = (propKey, wx, wy) => {
    const def = PROP_DEFINITIONS[propKey];
    if (!def) return;
    const { x, y } = propObjectCoords(wx, wy, def.w, def.h);
    const properties = [
      { name: 'footprint', type: 'string', value: JSON.stringify(def.footprint) },
      { name: 'tall', type: 'bool', value: Boolean(def.tall) },
    ];
    if (def.layer) {
      properties.push({ name: 'layer', type: 'string', value: def.layer });
    }

    propsObjects.push({
      name: propKey,
      type: 'prop',
      x,
      y,
      width: def.w,
      height: def.h,
      visible: true,
      properties,
    });

    // Hard Rule 3: Automatically pair overheads at identical coordinates
    if (def.pairedOverhead) {
      const overheadDef = PROP_DEFINITIONS[def.pairedOverhead];
      if (overheadDef) {
        propsObjects.push({
          name: def.pairedOverhead,
          type: 'prop',
          x,
          y,
          width: overheadDef.w,
          height: overheadDef.h,
          visible: true,
          properties: [
            { name: 'footprint', type: 'string', value: JSON.stringify(overheadDef.footprint) },
            { name: 'tall', type: 'bool', value: true },
            { name: 'layer', type: 'string', value: 'overhead' },
            { name: 'pairedBase', type: 'string', value: propKey },
          ],
        });
      }
    }
  };

  // Landmark Buildings (Section 3)
  // The Flagon Tavern
  addProp('tavern_base', 8, 3);
  // Market Stalls
  addProp('cottage_base', 2, 5);
  // Blacksmith
  addProp('cottage_base', 13, 4);

  // Environmental Props
  addProp('well', 16, 6);
  addProp('barrel', 4, 6);
  addProp('crate', 2, 7);
  addProp('torch', 8, 9);
  addProp('tree_pine_base', 3, 2);
  addProp('tree_oak_base', 16, 3);

  // Zones & Markers
  const zonesObjects = [
    {
      name: 'spawn_default',
      type: 'spawn',
      x: 10 * TILE_SIZE,
      y: 6 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'spawn_south',
      type: 'spawn',
      x: 9 * TILE_SIZE,
      y: 9 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'exit_south',
      type: 'exit',
      x: 9 * TILE_SIZE,
      y: 10 * TILE_SIZE,
      width: 2 * TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'wilderness.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_north' },
      ],
    },
    {
      name: 'door_tavern',
      type: 'door',
      x: 8 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      width: 2 * TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'door' },
        { name: 'prompt', type: 'string', value: 'Press E to enter The Flagon' },
      ],
    },
    {
      name: 'The Flagon',
      type: 'landmark',
      x: 7 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'canonName', type: 'string', value: 'The Flagon' },
        { name: 'label', type: 'string', value: 'The Flagon notice board' },
      ],
    },
    {
      name: 'Brackenford',
      type: 'landmark',
      x: 10 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'canonName', type: 'string', value: 'Brackenford' },
        { name: 'placeName', type: 'string', value: 'Brackenford' },
      ],
    },
  ];

  return createTiledMapStructure({
    width,
    height,
    tilesets,
    groundData,
    groundDetailData,
    wallsData,
    collisionData,
    propsObjects,
    zonesObjects,
    overheadData,
    properties: [
      { name: 'placeName', type: 'string', value: 'Brackenford' },
      { name: 'leagueX', type: 'int', value: lx },
      { name: 'leagueY', type: 'int', value: ly },
    ],
  });
}

/**
 * Builds Hearthmile Stone Bend Map (League 0, 4).
 */
export function buildHearthmileMap(tilesets, seed = DEFAULT_SEED) {
  const gids = createGidResolver(tilesets);
  const width = LEAGUE_W;
  const height = LEAGUE_H;
  const lx = 0;
  const ly = 4;
  const x0 = lx * STRIDE_X;
  const y0 = ly * STRIDE_Y;

  const groundData = new Array(width * height).fill(0);
  const groundDetailData = new Array(width * height).fill(0);
  const wallsData = new Array(width * height).fill(0);
  const collisionData = new Array(width * height).fill(0);
  const overheadData = new Array(width * height).fill(0);

  const kindAt = (wx, wy) => computeKind(wx, wy, seed);
  const isDirtRoad = (wx, wy) => kindAt(wx, wy) === 'road';
  const isCobbleRoad = (wx, wy) => kindAt(wx, wy) === 'cobble';

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const wx = x0 + tx;
      const wy = y0 + ty;
      const idx = ty * width + tx;
      const kind = kindAt(wx, wy);

      groundData[idx] = gids.get('grass', 0);

      if (kind === 'grass' && unit(seed, wx, wy, 7) < 0.1) {
        const detailVariant = (mix(seed, wx, wy, 8) % 7) + 1;
        groundDetailData[idx] = gids.get('grass', detailVariant);
      }

      if (kind === 'road') {
        const wangId = autotileWangId(wx, wy, isDirtRoad);
        groundData[idx] = gids.get('dirt_road', wangId);
      } else if (kind === 'cobble') {
        const wangId = autotileWangId(wx, wy, isCobbleRoad);
        groundData[idx] = gids.get('cobble_road', wangId);
      }
    }
  }

  const propsObjects = [];
  const addProp = (propKey, wx, wy) => {
    const def = PROP_DEFINITIONS[propKey];
    if (!def) return;
    const tx = wx - x0;
    const ty = wy - y0;
    const { x, y } = propObjectCoords(tx, ty, def.w, def.h);

    propsObjects.push({
      name: propKey,
      type: 'prop',
      x,
      y,
      width: def.w,
      height: def.h,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify(def.footprint) },
        { name: 'tall', type: 'bool', value: Boolean(def.tall) },
      ],
    });

    if (def.pairedOverhead) {
      const overheadDef = PROP_DEFINITIONS[def.pairedOverhead];
      if (overheadDef) {
        propsObjects.push({
          name: def.pairedOverhead,
          type: 'prop',
          x,
          y,
          width: overheadDef.w,
          height: overheadDef.h,
          visible: true,
          properties: [
            { name: 'footprint', type: 'string', value: JSON.stringify(overheadDef.footprint) },
            { name: 'tall', type: 'bool', value: true },
            { name: 'layer', type: 'string', value: 'overhead' },
            { name: 'pairedBase', type: 'string', value: propKey },
          ],
        });
      }
    }
  };

  // Hearthmile Stone monument props
  addProp('rock_a', 5, 49);
  addProp('rock_b', 9, 50);
  addProp('tree_pine_base', 3, 46);
  addProp('tree_pine_base', 15, 48);
  addProp('bush_a', 13, 50);

  // Relative coordinates in screen: wx 7, wy 48 -> tx = 7, ty = 4
  const zonesObjects = [
    {
      name: 'spawn_default',
      type: 'spawn',
      x: 7 * TILE_SIZE,
      y: 5 * TILE_SIZE, // tx: 7, ty: 5 (open cobble)
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'spawn_north',
      type: 'spawn',
      x: 9 * TILE_SIZE,
      y: 1 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'spawn_west',
      type: 'spawn',
      x: 1 * TILE_SIZE,
      y: 2 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'exit_north',
      type: 'exit',
      x: 8 * TILE_SIZE,
      y: 0,
      width: 4 * TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'wilderness.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_south' },
      ],
    },
    {
      name: 'exit_west',
      type: 'exit',
      x: 0,
      y: 2 * TILE_SIZE,
      width: TILE_SIZE,
      height: 2 * TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'ruinwatch.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_east' },
      ],
    },
    {
      name: 'Hearthmile Stone',
      type: 'landmark',
      x: 7 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'canonName', type: 'string', value: 'Hearthmile Stone' },
        { name: 'placeName', type: 'string', value: 'Hearthmile' },
        { name: 'label', type: 'string', value: 'Press E to read Hearthmile Stone' },
      ],
    },
  ];

  return createTiledMapStructure({
    width,
    height,
    tilesets,
    groundData,
    groundDetailData,
    wallsData,
    collisionData,
    propsObjects,
    zonesObjects,
    overheadData,
    properties: [
      { name: 'placeName', type: 'string', value: 'Hearthmile' },
      { name: 'leagueX', type: 'int', value: lx },
      { name: 'leagueY', type: 'int', value: ly },
    ],
  });
}

/**
 * Builds Ruinwatch Camp Terminus Map.
 */
export function buildRuinwatchMap(tilesets, seed = DEFAULT_SEED) {
  const gids = createGidResolver(tilesets);
  const width = LEAGUE_W;
  const height = LEAGUE_H;

  const groundData = new Array(width * height).fill(0);
  const groundDetailData = new Array(width * height).fill(0);
  const wallsData = new Array(width * height).fill(0);
  const collisionData = new Array(width * height).fill(0);
  const overheadData = new Array(width * height).fill(0);

  // Local camp road across middle from east edge
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const idx = ty * width + tx;
      groundData[idx] = gids.get('grass', 0);

      // Eaves road enters on right (tx 14..19, ty 5..6)
      if (tx >= 14 && (ty === 5 || ty === 6)) {
        groundData[idx] = gids.get('dirt_road', 15);
      }
      // Cobblestone camp ring in center (tx 8..13, ty 4..7)
      else if (tx >= 8 && tx <= 13 && ty >= 4 && ty <= 7) {
        groundData[idx] = gids.get('cobble_road', 15);
      }
    }
  }

  const propsObjects = [];
  const addProp = (propKey, tx, ty) => {
    const def = PROP_DEFINITIONS[propKey];
    if (!def) return;
    const { x, y } = propObjectCoords(tx, ty, def.w, def.h);
    propsObjects.push({
      name: propKey,
      type: 'prop',
      x,
      y,
      width: def.w,
      height: def.h,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify(def.footprint) },
        { name: 'tall', type: 'bool', value: Boolean(def.tall) },
      ],
    });
  };

  addProp('hearth', 10, 5); // Central camp campfire
  addProp('crate', 8, 4);
  addProp('barrel', 12, 4);
  addProp('rock_a', 7, 7);
  addProp('tree_pine_base', 4, 3);
  addProp('tree_pine_base', 15, 2);

  const zonesObjects = [
    {
      name: 'spawn_default',
      type: 'spawn',
      x: 10 * TILE_SIZE,
      y: 6 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'spawn_east',
      type: 'spawn',
      x: 17 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'exit_east',
      type: 'exit',
      x: 19 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: TILE_SIZE,
      height: 2 * TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'hearthmile.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_west' },
      ],
    },
    {
      name: 'Ruinwatch',
      type: 'landmark',
      x: 9 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'canonName', type: 'string', value: 'Ruinwatch' },
        { name: 'placeName', type: 'string', value: 'Ruinwatch' },
        { name: 'label', type: 'string', value: 'Press E to inspect Ruinwatch Camp' },
      ],
    },
  ];

  return createTiledMapStructure({
    width,
    height,
    tilesets,
    groundData,
    groundDetailData,
    wallsData,
    collisionData,
    propsObjects,
    zonesObjects,
    overheadData,
    properties: [{ name: 'placeName', type: 'string', value: 'Ruinwatch' }],
  });
}

/**
 * Builds Ember Road Wilderness Corridor Map.
 */
export function buildWildernessMap(tilesets, seed = DEFAULT_SEED) {
  const gids = createGidResolver(tilesets);
  const width = LEAGUE_W;
  // 3 leagues of road from wy 11 to wy 44: height 34 tiles
  const height = 34;
  const startWy = 11;

  const groundData = new Array(width * height).fill(0);
  const groundDetailData = new Array(width * height).fill(0);
  const wallsData = new Array(width * height).fill(0);
  const collisionData = new Array(width * height).fill(0);
  const overheadData = new Array(width * height).fill(0);

  const kindAt = (wx, wy) => computeKind(wx, wy, seed);
  const isDirtRoad = (wx, wy) => kindAt(wx, wy) === 'road';

  for (let ty = 0; ty < height; ty++) {
    const wy = startWy + ty;
    for (let tx = 0; tx < width; tx++) {
      const wx = tx;
      const idx = ty * width + tx;
      const kind = kindAt(wx, wy);

      groundData[idx] = gids.get('grass', 0);

      if (kind === 'grass' && unit(seed, wx, wy, 7) < 0.1) {
        const detailVariant = (mix(seed, wx, wy, 8) % 7) + 1;
        groundDetailData[idx] = gids.get('grass', detailVariant);
      }

      if (kind === 'road') {
        const wangId = autotileWangId(wx, wy, isDirtRoad);
        groundData[idx] = gids.get('dirt_road', wangId);
      }
    }
  }

  const propsObjects = [];
  const addProp = (propKey, tx, ty) => {
    const def = PROP_DEFINITIONS[propKey];
    if (!def) return;
    const { x, y } = propObjectCoords(tx, ty, def.w, def.h);
    propsObjects.push({
      name: propKey,
      type: 'prop',
      x,
      y,
      width: def.w,
      height: def.h,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify(def.footprint) },
        { name: 'tall', type: 'bool', value: Boolean(def.tall) },
      ],
    });

    if (def.pairedOverhead) {
      const overheadDef = PROP_DEFINITIONS[def.pairedOverhead];
      if (overheadDef) {
        propsObjects.push({
          name: def.pairedOverhead,
          type: 'prop',
          x,
          y,
          width: overheadDef.w,
          height: overheadDef.h,
          visible: true,
          properties: [
            { name: 'footprint', type: 'string', value: JSON.stringify(overheadDef.footprint) },
            { name: 'tall', type: 'bool', value: true },
            { name: 'layer', type: 'string', value: 'overhead' },
            { name: 'pairedBase', type: 'string', value: propKey },
          ],
        });
      }
    }
  };

  // Roadside farm barn south of Brackenford gate (Section 3)
  addProp('cottage_base', 2, 8); // Farm barn at wy 19 -> ty: 8
  addProp('tree_pine_base', 4, 12);
  addProp('tree_oak_base', 15, 14);
  addProp('rock_a', 14, 20);
  addProp('barrel', 13, 24);

  const zonesObjects = [
    {
      name: 'spawn_north',
      type: 'spawn',
      x: 9 * TILE_SIZE,
      y: 1 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'spawn_south',
      type: 'spawn',
      x: 9 * TILE_SIZE,
      y: (height - 2) * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      name: 'exit_north',
      type: 'exit',
      x: 8 * TILE_SIZE,
      y: 0,
      width: 4 * TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'brackenford.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_south' },
      ],
    },
    {
      name: 'exit_south',
      type: 'exit',
      x: 8 * TILE_SIZE,
      y: (height - 1) * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'targetMap', type: 'string', value: 'hearthmile.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_north' },
      ],
    },
    {
      name: 'Ember Road',
      type: 'landmark',
      x: 9 * TILE_SIZE,
      y: 16 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      properties: [
        { name: 'canonName', type: 'string', value: 'Ember Road' },
        { name: 'placeName', type: 'string', value: 'wilderness' },
      ],
    },
  ];

  return createTiledMapStructure({
    width,
    height,
    tilesets,
    groundData,
    groundDetailData,
    wallsData,
    collisionData,
    propsObjects,
    zonesObjects,
    overheadData,
    properties: [
      { name: 'placeName', type: 'string', value: 'wilderness' },
      { name: 'route', type: 'string', value: 'Ember Road' },
    ],
  });
}

// ============================================================================
// 8. Generate & Write Maps
// ============================================================================

export function generateAllMaps(options = {}) {
  const seed = options.seed || DEFAULT_SEED;
  const outDir = options.outDir || path.join(REPO_ROOT, 'client', 'public', 'maps');
  const assetsDir = options.assetsDir || path.join(REPO_ROOT, 'client', 'public', 'assets', 'tiles');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const tilesets = buildTilesets(assetsDir);

  const maps = {
    'brackenford.tmj': buildBrackenfordMap(tilesets, seed),
    'hearthmile.tmj': buildHearthmileMap(tilesets, seed),
    'ruinwatch.tmj': buildRuinwatchMap(tilesets, seed),
    'wilderness.tmj': buildWildernessMap(tilesets, seed),
  };

  const written = [];
  for (const [filename, mapData] of Object.entries(maps)) {
    const targetPath = path.join(outDir, filename);
    const content = JSON.stringify(mapData, null, 2);
    fs.writeFileSync(targetPath, content + '\n', 'utf8');
    written.push({ filename, path: targetPath, size: Buffer.byteLength(content) });
  }

  return { seed, outDir, maps: written };
}

// ============================================================================
// 9. CLI Execution
// ============================================================================

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  let seed = DEFAULT_SEED;
  let outDir = path.join(REPO_ROOT, 'client', 'public', 'maps');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      seed = args[i + 1];
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      outDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  console.log(`[TMJ Generator] Generating Tiled maps using seed "${seed}"...`);
  const result = generateAllMaps({ seed, outDir });
  console.log(`[TMJ Generator] Generated ${result.maps.length} maps in ${result.outDir}:`);
  for (const m of result.maps) {
    console.log(`  - ${m.filename} (${m.size} bytes)`);
  }
}

