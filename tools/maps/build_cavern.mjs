import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const TILE_SIZE = 32;

// Load prop atlas metadata to extract exact footprints
const dungeonPropsMeta = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'client/public/assets/env/dungeon_props/dungeon_props.json'), 'utf8')
).meta;
const dungeonBrazierMeta = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'client/public/assets/env/dungeon_brazier/dungeon_brazier.json'), 'utf8')
).meta;
const treasureChestMeta = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'client/public/assets/env/treasure_chest/treasure_chest.json'), 'utf8')
).meta;

function getAtlasPropMeta(propId) {
  if (dungeonPropsMeta.props?.[propId]) return dungeonPropsMeta.props[propId];
  if (dungeonBrazierMeta.props?.[propId]) return dungeonBrazierMeta.props[propId];
  if (treasureChestMeta.props?.[propId]) return treasureChestMeta.props[propId];
  return null;
}

function loadTileset(name, firstgid) {
  const tsjPath = path.join(REPO_ROOT, `client/public/assets/tiles/${name}.tsj`);
  const tsj = JSON.parse(fs.readFileSync(tsjPath, 'utf8'));
  return {
    ...tsj,
    firstgid,
    _baseGid: firstgid,
    image: `../assets/tiles/${tsj.image}`,
  };
}

function formatPropProperties(meta, instance = {}, isOverhead = false) {
  const props = [];
  const fp = meta?.footprint || { x: 0, y: 0, w: 0, h: 0, shape: 'none' };
  props.push({ name: 'footprint', type: 'string', value: JSON.stringify(fp) });
  props.push({ name: 'tall', type: 'bool', value: Boolean(meta?.tall) });
  if (isOverhead) {
    props.push({ name: 'layer', type: 'string', value: 'overhead' });
  }
  if (instance.flipX) {
    props.push({ name: 'flipX', type: 'bool', value: true });
  }
  if (instance.scale && instance.scale !== 1.0) {
    props.push({ name: 'scale', type: 'float', value: instance.scale });
  }
  if (instance.tint) {
    props.push({ name: 'tint', type: 'string', value: instance.tint });
  }
  if (typeof instance.rotation === 'number' && instance.rotation !== 0) {
    props.push({ name: 'rotation', type: 'float', value: instance.rotation });
  }
  return props;
}

// -------------------------------------------------------------------------------------------
// Map 1: Cavern Mouth (Cavern of Embers Entrance)
// -------------------------------------------------------------------------------------------
function buildCavernMouthMap() {
  const width = 24;
  const height = 16;
  const ground = new Array(width * height).fill(0);
  const groundDetail = new Array(width * height).fill(0);
  const walls = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);
  const overhead = new Array(width * height).fill(0);

  // Tilesets:
  // 1. cliff (1..16)
  // 2. cliff_face (17..20)
  // 3. dungeon_wall_trim (21..36)
  // 4. dungeon_floor (37..42)
  const tsCliff = loadTileset('cliff', 1);
  const tsCliffFace = loadTileset('cliff_face', 17);
  const tsDungeonWallTrim = loadTileset('dungeon_wall_trim', 21);
  const tsDungeonFloor = loadTileset('dungeon_floor', 37);

  // Ground: rows 5..15 fill with dungeon_floor (gid 37..40)
  for (let r = 5; r < height; r++) {
    for (let c = 0; c < width; c++) {
      ground[r * width + c] = 37 + ((r + c) % 4);
    }
  }

  // North cliff background: rows 0..4
  for (let r = 0; r <= 3; r++) {
    for (let c = 0; c < width; c++) {
      ground[r * width + c] = 1 + ((r * 4 + c) % 16);
      collision[r * width + c] = 1;
    }
  }
  // Cliff face row 4
  for (let c = 0; c < width; c++) {
    walls[4 * width + c] = 17 + (c % 4);
    collision[4 * width + c] = 17;
  }

  // West & East boundary collisions (rows 5..15)
  for (let r = 5; r < height; r++) {
    collision[r * width + 0] = 1;
    collision[r * width + (width - 1)] = 1;
  }

  // South boundary collision with exit gap (cols 17..20 left open for wilderness exit)
  for (let c = 0; c < width; c++) {
    if (c < 17 || c > 20) {
      collision[(height - 1) * width + c] = 1;
    }
  }

  let nextObjId = 1;
  const propsObjects = [];

  // cavern_mouth_base + cavern_mouth_arch (256x224, feet at center-bottom)
  const mouthW = 256;
  const mouthH = 224;
  const mouthFeetX = 12 * TILE_SIZE; // col 12 (384 px)
  const mouthFeetY = 7 * TILE_SIZE; // row 7 (224 px)
  const mouthX = mouthFeetX - mouthW / 2; // 256 px
  const mouthY = mouthFeetY - mouthH; // 0 px

  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_mouth_base',
    type: 'prop',
    x: mouthX,
    y: mouthY,
    width: mouthW,
    height: mouthH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_mouth_base']),
  });

  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_mouth_arch',
    type: 'prop',
    x: mouthX,
    y: mouthY,
    width: mouthW,
    height: mouthH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_mouth_arch'], {}, true),
  });

  // Flanking rocks: cavern_rock_large_a & b
  const rockAW = 64;
  const rockAH = 48;
  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_rock_large_a',
    type: 'prop',
    x: 6 * TILE_SIZE - rockAW / 2,
    y: 7 * TILE_SIZE - rockAH,
    width: rockAW,
    height: rockAH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_rock_large_a']),
  });

  const rockBW = 64;
  const rockBH = 48;
  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_rock_large_b',
    type: 'prop',
    x: 18 * TILE_SIZE - rockBW / 2,
    y: 7 * TILE_SIZE - rockBH,
    width: rockBW,
    height: rockBH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_rock_large_b']),
  });

  // Wall torches along cliff face
  const torchW = 32;
  const torchH = 64;
  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_torch_wall',
    type: 'prop',
    x: 4 * TILE_SIZE,
    y: 4 * TILE_SIZE - 32,
    width: torchW,
    height: torchH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_torch_wall']),
  });
  propsObjects.push({
    id: nextObjId++,
    name: 'cavern_torch_wall',
    type: 'prop',
    x: 19 * TILE_SIZE,
    y: 4 * TILE_SIZE - 32,
    width: torchW,
    height: torchH,
    visible: true,
    properties: formatPropProperties(dungeonPropsMeta.props['cavern_torch_wall']),
  });

  // Zones
  const zonesObjects = [
    {
      id: nextObjId++,
      name: 'spawn_default',
      type: 'spawn',
      x: 18 * TILE_SIZE + 16,
      y: 13 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'spawn_wilderness',
      type: 'spawn',
      x: 18 * TILE_SIZE + 16,
      y: 13 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'spawn_halls',
      type: 'spawn',
      x: 12 * TILE_SIZE - 16,
      y: 8 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'door_halls',
      type: 'door',
      x: 11 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: 2 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_halls.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Molten Halls' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_default' },
        { name: 'prompt', type: 'string', value: 'Press E to enter Molten Halls' },
      ],
    },
    {
      id: nextObjId++,
      name: 'exit_wilderness',
      type: 'exit',
      x: 17 * TILE_SIZE,
      y: 14 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'exit' },
        { name: 'targetMap', type: 'string', value: 'wilderness.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Wilderness' },
        { name: 'targetSpawn', type: 'string', value: 'HUB_RETURN_SPAWN' },
        { name: 'prompt', type: 'string', value: 'Press E to follow the trail into the Wilderness' },
      ],
    },
  ];

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
    nextobjectid: nextObjId + 10,
    properties: [
      { name: 'canonName', type: 'string', value: 'Cavern of Embers' },
      { name: 'placeName', type: 'string', value: 'Cavern of Embers' },
      { name: 'backdrop', type: 'string', value: 'pending' },
      { name: 'propAtlases', type: 'string', value: 'dungeon_props,dungeon_brazier,treasure_chest' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [tsCliff, tsCliffFace, tsDungeonWallTrim, tsDungeonFloor],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width, height, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: overhead },
    ],
  };
}

// -------------------------------------------------------------------------------------------
// Map 2: Molten Halls (Faithful to molten_halls_sample.json)
// -------------------------------------------------------------------------------------------
const MOLTEN_HALLS_SAMPLE = {
  name: 'molten_halls_sample',
  tile: 32,
  size: [28, 16],
  dressing_rule: 'ONE design per type; variety via flipX/scale/tint/rot instance props only',
  walls: [{ rect: [0, 0, 28, 2], id: 'dungeon_wall' }],
  floors: [{ rect: [0, 2, 28, 14], id: 'dungeon_floor' }],
  lava: {
    cells: [
      [15, 7], [16, 7],
      [14, 8], [15, 8], [16, 8], [17, 8],
      [14, 9], [15, 9], [16, 9], [17, 9], [18, 9],
      [13, 10], [14, 10], [15, 10], [16, 10], [17, 10], [18, 10],
      [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11],
      [13, 12], [14, 12], [15, 12], [16, 12],
      [14, 13], [15, 13], [16, 13],
      [15, 14], [16, 14]
    ]
  },
  props: [
    { id: 'dungeon_pillar_base', x: 11, y: 7, footprint: { x: -14, y: -12, w: 28, h: 12 }, tall_pair: 'dungeon_pillar_top', canvas: [64, 160] },
    { id: 'dungeon_sealed_stair', x: 25, y: 4, instance: { flipX: false, scale: 1.0 }, footprint: { x: -22, y: -16, w: 44, h: 16 } },
    { id: 'chest_wood', x: 3, y: 5, instance: { flipX: false, scale: 1.0 } },
    { id: 'cavern_torch_wall', x: 4, y: 2.5, instance: { flipX: false, scale: 1.0 }, wall_bound: true, wall: 'north' },
    { id: 'gold_pile_small', x: 24, y: 13, instance: { flipX: false, scale: 1.05, tint: '#fff4c0' } },
    { id: 'dungeon_brazier', x: 2.4, y: 3.2, instance: { flipX: false, scale: 1.0 } },
    { id: 'dungeon_crate', x: 1.6, y: 4.6, instance: { flipX: true, scale: 0.95, tint: '#e8dcc8' } },
    { id: 'dungeon_barrel', x: 4.3, y: 4.9, instance: { flipX: false, scale: 1.05 } },
    { id: 'dungeon_bones', x: 2.2, y: 5.8, instance: { flipX: true, scale: 0.92 } },
    { id: 'dungeon_chain_wall', x: 6.2, y: 2.5, instance: { flipX: false, scale: 1.0 }, wall_bound: true, wall: 'north' },
    { id: 'dungeon_brazier', x: 7.0, y: 3.4, instance: { flipX: false, scale: 0.95 } },
    { id: 'dungeon_pillar_stump', x: 9.8, y: 8.4, instance: { flipX: false, scale: 1.0 } },
    { id: 'dungeon_rubble_a', x: 12.3, y: 8.1, instance: { flipX: true, scale: 1.08, tint: '#d8d0c4' } },
    { id: 'dungeon_bones', x: 10.4, y: 6.2, instance: { flipX: false, scale: 0.95 } },
    { id: 'dungeon_crack_decal', x: 11.6, y: 8.6, instance: { flipX: false, scale: 1.0, rotation: 35 } },
    { id: 'dungeon_debris', x: 12.6, y: 6.5, instance: { flipX: true, scale: 0.9, tint: '#ffe8a0' } },
    { id: 'dungeon_chain_wall', x: 20.5, y: 2.5, instance: { flipX: true, scale: 1.0 }, wall_bound: true, wall: 'north' },
    { id: 'dungeon_crate', x: 23.2, y: 3.6, instance: { flipX: false, scale: 1.0 } },
    { id: 'dungeon_barrel', x: 26.2, y: 5.2, instance: { flipX: true, scale: 0.95, tint: '#e0d0b8' } },
    { id: 'dungeon_rubble_a', x: 24.0, y: 5.6, instance: { flipX: false, scale: 1.05 } },
    { id: 'dungeon_crack_decal', x: 23.8, y: 4.4, instance: { flipX: true, scale: 0.95, rotation: -20 } },
    { id: 'dungeon_barrel', x: 25.5, y: 14.2, instance: { flipX: false, scale: 1.0 } },
    { id: 'dungeon_debris', x: 22.8, y: 13.6, instance: { flipX: false, scale: 1.05, tint: '#fff0b0' } },
    { id: 'dungeon_pillar_stump', x: 2.0, y: 14.0, instance: { flipX: true, scale: 1.05 } },
    { id: 'dungeon_crate', x: 1.5, y: 13.0, instance: { flipX: false, scale: 0.92, tint: '#ddd0c0' } }
  ]
};

function buildCavernHallsMap() {
  const sample = MOLTEN_HALLS_SAMPLE;
  const [width, height] = sample.size; // 28 x 16
  const ground = new Array(width * height).fill(0);
  const groundDetail = new Array(width * height).fill(0);
  const walls = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);
  const overhead = new Array(width * height).fill(0);

  // Tilesets:
  // 1. dungeon_floor (1..6)
  // 2. dungeon_wall (7..10)
  // 3. dungeon_wall_trim (11..26)
  // 4. molten_floor (27..90)
  // 5. scorched_floor (91..96)
  const tsDungeonFloor = loadTileset('dungeon_floor', 1);
  const tsDungeonWall = loadTileset('dungeon_wall', 7);
  const tsDungeonWallTrim = loadTileset('dungeon_wall_trim', 11);
  const tsMoltenFloor = loadTileset('molten_floor', 27);
  const tsScorchedFloor = loadTileset('scorched_floor', 91);

  // Floors: rect [0, 2, 28, 14]
  for (let r = 2; r < height; r++) {
    for (let c = 0; c < width; c++) {
      ground[r * width + c] = 1 + ((r + c) % 4);
    }
  }

  // North wall: rows 0..1, cols 0..27
  for (let r = 0; r <= 1; r++) {
    for (let c = 0; c < width; c++) {
      walls[r * width + c] = 7 + (c % 4);
      collision[r * width + c] = 7;
    }
  }

  // Perimeter collision: West (col 0), East (col 27), South (row 15 except doorway at col 8)
  for (let r = 2; r < height; r++) {
    collision[r * width + 0] = 7;
    collision[r * width + (width - 1)] = 7;
  }
  for (let c = 0; c < width; c++) {
    if (c < 7 || c > 9) {
      collision[(height - 1) * width + c] = 7;
    }
  }

  // Approved lava cells: map to molten_floor Wang tile 15 (gid 27 + 15 = 42) & collision
  const lavaSet = new Set(sample.lava.cells.map(([x, y]) => `${x},${y}`));
  for (const [lx, ly] of sample.lava.cells) {
    const idx = ly * width + lx;
    const nw = lavaSet.has(`${lx - 1},${ly - 1}`) && lavaSet.has(`${lx},${ly - 1}`) && lavaSet.has(`${lx - 1},${ly}`);
    const ne = lavaSet.has(`${lx + 1},${ly - 1}`) && lavaSet.has(`${lx},${ly - 1}`) && lavaSet.has(`${lx + 1},${ly}`);
    const sw = lavaSet.has(`${lx - 1},${ly + 1}`) && lavaSet.has(`${lx},${ly + 1}`) && lavaSet.has(`${lx - 1},${ly}`);
    const se = lavaSet.has(`${lx + 1},${ly + 1}`) && lavaSet.has(`${lx},${ly + 1}`) && lavaSet.has(`${lx + 1},${ly}`);
    const wangId = (nw ? 1 : 0) | (ne ? 2 : 0) | (sw ? 4 : 0) | (se ? 8 : 0);

    ground[idx] = 27 + wangId;
    collision[idx] = 7; // Collides using wall tile for solid collision
  }

  let nextObjId = 1;
  const propsObjects = [];

  // Map each prop from molten_halls_sample.json
  for (const p of sample.props) {
    let frameName = p.id;
    if (frameName === 'chest_wood') frameName = 'chest_wood_open_down_0';
    if (frameName === 'dungeon_brazier') frameName = 'dungeon_brazier_burn_down_0';

    const meta = getAtlasPropMeta(frameName);
    const canvasW = p.canvas?.[0] || meta?.size?.w || 32;
    const canvasH = p.canvas?.[1] || meta?.size?.h || 32;

    const feetX = p.x * TILE_SIZE;
    const feetY = p.y * TILE_SIZE;
    const objX = Math.round(feetX - canvasW / 2);
    const objY = Math.round(feetY - canvasH);

    const isOverhead = p.wall_bound === true || meta?.layer === 'overhead';

    propsObjects.push({
      id: nextObjId++,
      name: frameName,
      type: 'prop',
      x: objX,
      y: objY,
      width: canvasW,
      height: canvasH,
      visible: true,
      properties: formatPropProperties(meta, p.instance || {}, isOverhead),
    });

    if (p.tall_pair) {
      const topMeta = getAtlasPropMeta(p.tall_pair);
      propsObjects.push({
        id: nextObjId++,
        name: p.tall_pair,
        type: 'prop',
        x: objX,
        y: objY,
        width: canvasW,
        height: canvasH,
        visible: true,
        properties: formatPropProperties(topMeta, p.instance || {}, true),
      });
    }
  }

  // Zones
  const zonesObjects = [
    {
      id: nextObjId++,
      name: 'spawn_default',
      type: 'spawn',
      x: 8 * TILE_SIZE,
      y: 13 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'spawn_mouth',
      type: 'spawn',
      x: 8 * TILE_SIZE,
      y: 13 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'door_mouth',
      type: 'door',
      x: 7 * TILE_SIZE,
      y: 14 * TILE_SIZE,
      width: 3 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_mouth.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Cavern of Embers' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_halls' },
        { name: 'prompt', type: 'string', value: 'Press E to exit to Cavern of Embers' },
      ],
    },
    {
      id: nextObjId++,
      name: 'door_treasure',
      type: 'door',
      x: 24 * TILE_SIZE,
      y: 2 * TILE_SIZE,
      width: 2 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_treasure.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Cavern of Embers' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_default' },
        { name: 'prompt', type: 'string', value: 'Press E to enter the Treasure Room' },
      ],
    },
    {
      id: nextObjId++,
      name: 'door_lair',
      type: 'door',
      x: 25 * TILE_SIZE,
      y: 11 * TILE_SIZE,
      width: 2 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_lair.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Cavern of Embers' },
        { name: 'targetSpawn', type: 'string', value: 'spawn_default' },
        { name: 'prompt', type: 'string', value: "Press E to enter the Dragon's Lair" },
      ],
    },
    {
      id: nextObjId++,
      name: 'spawn_goblin_1',
      type: 'spawn',
      x: 13 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'spawn_goblin_2',
      type: 'spawn',
      x: 15 * TILE_SIZE,
      y: 5 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
  ];

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
    nextobjectid: nextObjId + 10,
    properties: [
      { name: 'canonName', type: 'string', value: 'Molten Halls' },
      { name: 'placeName', type: 'string', value: 'Molten Halls' },
      { name: 'propAtlases', type: 'string', value: 'dungeon_props,dungeon_brazier,treasure_chest' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [tsDungeonFloor, tsDungeonWall, tsDungeonWallTrim, tsMoltenFloor, tsScorchedFloor],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width, height, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: overhead },
    ],
  };
}

// -------------------------------------------------------------------------------------------
// Map 3: Cavern Treasure (Hidden Treasure Room)
// -------------------------------------------------------------------------------------------
function buildCavernTreasureMap() {
  const width = 20;
  const height = 12;
  const ground = new Array(width * height).fill(0);
  const groundDetail = new Array(width * height).fill(0);
  const walls = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);
  const overhead = new Array(width * height).fill(0);

  const tsDungeonFloor = loadTileset('dungeon_floor', 1);
  const tsDungeonWall = loadTileset('dungeon_wall', 7);
  const tsDungeonWallTrim = loadTileset('dungeon_wall_trim', 11);

  // Floor: rows 2..10, cols 2..17
  for (let r = 2; r <= 10; r++) {
    for (let c = 2; c <= 17; c++) {
      ground[r * width + c] = 1 + ((r + c) % 4);
    }
  }

  // Outer border collision (rows 0, 11; cols 0..1, 18..19)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === 11 || c < 2 || c > 17) {
        collision[r * width + c] = 7;
      }
    }
  }

  // North wall: row 1, cols 2..17
  for (let c = 2; c <= 17; c++) {
    walls[1 * width + c] = 7 + (c % 4);
    collision[1 * width + c] = 7;
  }
  // West & East walls: rows 2..10
  for (let r = 2; r <= 10; r++) {
    walls[r * width + 2] = 7;
    collision[r * width + 2] = 7;
    walls[r * width + 17] = 7;
    collision[r * width + 17] = 7;
  }
  // South wall: row 10, cols 2..8 and 11..17
  for (let c = 2; c <= 8; c++) {
    walls[10 * width + c] = 7;
    collision[10 * width + c] = 7;
  }
  for (let c = 11; c <= 17; c++) {
    walls[10 * width + c] = 7;
    collision[10 * width + c] = 7;
  }
  // Doorway at row 10 cols 9..10 open!
  walls[10 * width + 9] = 0;
  walls[10 * width + 10] = 0;
  collision[10 * width + 9] = 0;
  collision[10 * width + 10] = 0;

  let nextObjId = 1;
  const propsObjects = [];

  // Animated treasure chests (wood and iron)
  const chestWoodMeta = getAtlasPropMeta('chest_wood_open_down_0');
  propsObjects.push({
    id: nextObjId++,
    name: 'chest_wood_open_down_0',
    type: 'prop',
    x: 5 * TILE_SIZE - 24,
    y: 4 * TILE_SIZE - 48,
    width: 48,
    height: 48,
    visible: true,
    properties: formatPropProperties(chestWoodMeta),
  });

  const chestIronMeta = getAtlasPropMeta('chest_iron_open_down_0');
  propsObjects.push({
    id: nextObjId++,
    name: 'chest_iron_open_down_0',
    type: 'prop',
    x: 15 * TILE_SIZE - 24,
    y: 4 * TILE_SIZE - 48,
    width: 48,
    height: 48,
    visible: true,
    properties: formatPropProperties(chestIronMeta),
  });

  // Gold piles
  const goldMeta = getAtlasPropMeta('gold_pile_small');
  propsObjects.push({
    id: nextObjId++,
    name: 'gold_pile_small',
    type: 'prop',
    x: 7 * TILE_SIZE - 24,
    y: 4 * TILE_SIZE - 40,
    width: 48,
    height: 40,
    visible: true,
    properties: formatPropProperties(goldMeta, { scale: 1.05, tint: '#fff4c0' }),
  });
  propsObjects.push({
    id: nextObjId++,
    name: 'gold_pile_small',
    type: 'prop',
    x: 13 * TILE_SIZE - 24,
    y: 4 * TILE_SIZE - 40,
    width: 48,
    height: 40,
    visible: true,
    properties: formatPropProperties(goldMeta, { scale: 1.0, tint: '#ffe8a0' }),
  });

  // Debris & braziers
  const debrisMeta = getAtlasPropMeta('dungeon_debris');
  propsObjects.push({
    id: nextObjId++,
    name: 'dungeon_debris',
    type: 'prop',
    x: 4 * TILE_SIZE - 20,
    y: 6 * TILE_SIZE - 32,
    width: 40,
    height: 32,
    visible: true,
    properties: formatPropProperties(debrisMeta),
  });

  const brazierMeta = getAtlasPropMeta('dungeon_brazier_burn_down_0');
  propsObjects.push({
    id: nextObjId++,
    name: 'dungeon_brazier_burn_down_0',
    type: 'prop',
    x: 3 * TILE_SIZE,
    y: 2 * TILE_SIZE - 48,
    width: 64,
    height: 96,
    visible: true,
    properties: formatPropProperties(brazierMeta),
  });
  propsObjects.push({
    id: nextObjId++,
    name: 'dungeon_brazier_burn_down_0',
    type: 'prop',
    x: 15 * TILE_SIZE,
    y: 2 * TILE_SIZE - 48,
    width: 64,
    height: 96,
    visible: true,
    properties: formatPropProperties(brazierMeta),
  });

  // Zones
  const zonesObjects = [
    {
      id: nextObjId++,
      name: 'spawn_default',
      type: 'spawn',
      x: 9 * TILE_SIZE + 16,
      y: 9 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'door_halls',
      type: 'door',
      x: 8 * TILE_SIZE,
      y: 9 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_halls.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Molten Halls' },
        { name: 'targetSpawn', type: 'string', value: 'door_treasure' },
        { name: 'prompt', type: 'string', value: 'Press E to return to Molten Halls' },
      ],
    },
  ];

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
    nextobjectid: nextObjId + 10,
    properties: [
      { name: 'canonName', type: 'string', value: 'Cavern of Embers' },
      { name: 'placeName', type: 'string', value: 'Cavern of Embers' },
      { name: 'propAtlases', type: 'string', value: 'dungeon_props,dungeon_brazier,treasure_chest' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [tsDungeonFloor, tsDungeonWall, tsDungeonWallTrim],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width, height, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: overhead },
    ],
  };
}

// -------------------------------------------------------------------------------------------
// Map 4: Cavern Lair (Red Dragon Boss Lair)
// -------------------------------------------------------------------------------------------
function buildCavernLairMap() {
  const width = 32;
  const height = 24;
  const ground = new Array(width * height).fill(0);
  const groundDetail = new Array(width * height).fill(0);
  const walls = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);
  const overhead = new Array(width * height).fill(0);

  const tsDungeonFloor = loadTileset('dungeon_floor', 1);
  const tsDungeonWall = loadTileset('dungeon_wall', 7);
  const tsDungeonWallTrim = loadTileset('dungeon_wall_trim', 11);
  const tsScorchedFloor = loadTileset('scorched_floor', 27);

  // Floor: rows 2..22, cols 2..29
  for (let r = 2; r <= 22; r++) {
    for (let c = 2; c <= 29; c++) {
      ground[r * width + c] = 1 + ((r + c) % 4);
    }
  }

  // Scorched floor patches in central arena
  for (let r = 9; r <= 15; r++) {
    for (let c = 12; c <= 20; c++) {
      if ((r + c) % 3 === 0) {
        ground[r * width + c] = 27 + ((r + c) % 6);
      }
    }
  }

  // Outer boundary collision
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === height - 1 || c < 2 || c > width - 3) {
        collision[r * width + c] = 7;
      }
    }
  }

  // North wall: rows 1..2, cols 2..29
  for (let r = 1; r <= 2; r++) {
    for (let c = 2; c <= 29; c++) {
      walls[r * width + c] = 7 + (c % 4);
      collision[r * width + c] = 7;
    }
  }

  // West & East walls: rows 3..21
  for (let r = 3; r <= 21; r++) {
    walls[r * width + 2] = 7;
    collision[r * width + 2] = 7;
    walls[r * width + 29] = 7;
    collision[r * width + 29] = 7;
  }

  // South wall: row 22, cols 2..13 and 18..29
  for (let c = 2; c <= 13; c++) {
    walls[22 * width + c] = 7;
    collision[22 * width + c] = 7;
  }
  for (let c = 18; c <= 29; c++) {
    walls[22 * width + c] = 7;
    collision[22 * width + c] = 7;
  }
  // South doorway at cols 14..17 left open!
  for (let c = 14; c <= 17; c++) {
    walls[22 * width + c] = 0;
    collision[22 * width + c] = 0;
  }

  let nextObjId = 1;
  const propsObjects = [];

  // Giant gold pile hoard at rear center: col 16, row 6 (canvas 192x96)
  const hoardMeta = getAtlasPropMeta('gold_pile_hoard');
  propsObjects.push({
    id: nextObjId++,
    name: 'gold_pile_hoard',
    type: 'prop',
    x: 16 * TILE_SIZE - 96,
    y: 6 * TILE_SIZE - 96,
    width: 192,
    height: 96,
    visible: true,
    properties: formatPropProperties(hoardMeta),
  });

  // Pillars flanking the arena (col 7, row 7 and col 24, row 7)
  const pillarBaseMeta = getAtlasPropMeta('dungeon_pillar_base');
  const pillarTopMeta = getAtlasPropMeta('dungeon_pillar_top');
  for (const col of [7, 24]) {
    const px = col * TILE_SIZE - 32;
    const py = 7 * TILE_SIZE - 160;
    propsObjects.push({
      id: nextObjId++,
      name: 'dungeon_pillar_base',
      type: 'prop',
      x: px,
      y: py,
      width: 64,
      height: 160,
      visible: true,
      properties: formatPropProperties(pillarBaseMeta),
    });
    propsObjects.push({
      id: nextObjId++,
      name: 'dungeon_pillar_top',
      type: 'prop',
      x: px,
      y: py,
      width: 64,
      height: 160,
      visible: true,
      properties: formatPropProperties(pillarTopMeta, {}, true),
    });
  }

  // Animated wall braziers lining the arena walls
  const brazierMeta = getAtlasPropMeta('dungeon_brazier_burn_down_0');
  const brazierCols = [4, 11, 20, 27];
  for (const c of brazierCols) {
    propsObjects.push({
      id: nextObjId++,
      name: 'dungeon_brazier_burn_down_0',
      type: 'prop',
      x: c * TILE_SIZE - 32,
      y: 3 * TILE_SIZE - 96,
      width: 64,
      height: 96,
      visible: true,
      properties: formatPropProperties(brazierMeta),
    });
    if (c < 13 || c > 18) {
      propsObjects.push({
        id: nextObjId++,
        name: 'dungeon_brazier_burn_down_0',
        type: 'prop',
        x: c * TILE_SIZE - 32,
        y: 21 * TILE_SIZE - 96,
        width: 64,
        height: 96,
        visible: true,
        properties: formatPropProperties(brazierMeta),
      });
    }
  }

  // Zones
  const zonesObjects = [
    {
      id: nextObjId++,
      name: 'spawn_default',
      type: 'spawn',
      x: 16 * TILE_SIZE - 16,
      y: 20 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'dragon_spawn',
      type: 'spawn',
      x: 16 * TILE_SIZE - 16,
      y: 12 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: nextObjId++,
      name: 'door_halls',
      type: 'door',
      x: 14 * TILE_SIZE,
      y: 21 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'door' },
        { name: 'targetMap', type: 'string', value: 'cavern_halls.tmj' },
        { name: 'targetPlace', type: 'string', value: 'Molten Halls' },
        { name: 'targetSpawn', type: 'string', value: 'door_lair' },
        { name: 'prompt', type: 'string', value: 'Press E to return to Molten Halls' },
      ],
    },
  ];

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
    nextobjectid: nextObjId + 10,
    properties: [
      { name: 'canonName', type: 'string', value: 'Cavern of Embers' },
      { name: 'placeName', type: 'string', value: 'Cavern of Embers' },
      { name: 'propAtlases', type: 'string', value: 'dungeon_props,dungeon_brazier,treasure_chest' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [tsDungeonFloor, tsDungeonWall, tsDungeonWallTrim, tsScorchedFloor],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width, height, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width, height, data: overhead },
    ],
  };
}

export function buildAllCavernMaps() {
  const mouthTmj = buildCavernMouthMap();
  const hallsTmj = buildCavernHallsMap();
  const treasureTmj = buildCavernTreasureMap();
  const lairTmj = buildCavernLairMap();

  const mapsDir = path.join(REPO_ROOT, 'client/public/maps');
  fs.writeFileSync(path.join(mapsDir, 'cavern_mouth.tmj'), JSON.stringify(mouthTmj, null, 2) + '\n');
  fs.writeFileSync(path.join(mapsDir, 'cavern_halls.tmj'), JSON.stringify(hallsTmj, null, 2) + '\n');
  fs.writeFileSync(path.join(mapsDir, 'cavern_treasure.tmj'), JSON.stringify(treasureTmj, null, 2) + '\n');
  fs.writeFileSync(path.join(mapsDir, 'cavern_lair.tmj'), JSON.stringify(lairTmj, null, 2) + '\n');

  console.log('Successfully built: cavern_mouth.tmj, cavern_halls.tmj, cavern_treasure.tmj, cavern_lair.tmj');
}

buildAllCavernMaps();

