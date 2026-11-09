import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const WIDTH = 20;
const HEIGHT = 12;
const TILE_SIZE = 32;

function createFloorTileset(name, imageRelativePath, firstgid = 1) {
  return {
    firstgid,
    columns: 4,
    image: imageRelativePath,
    imagewidth: 136,
    imageheight: 34,
    margin: 1,
    spacing: 2,
    name,
    tilecount: 4,
    tileheight: TILE_SIZE,
    tilewidth: TILE_SIZE,
    type: 'tileset',
    version: '1.10',
    _baseGid: firstgid,
    tiles: [0, 1, 2, 3].map((id) => ({
      id,
      properties: [
        { name: 'id', type: 'int', value: id },
        { name: 'collides', type: 'bool', value: false },
        { name: 'animationOnly', type: 'bool', value: false },
      ],
    })),
  };
}

function createWallTileset(name, imageRelativePath, firstgid = 5) {
  return {
    firstgid,
    columns: 4,
    image: imageRelativePath,
    imagewidth: 136,
    imageheight: 34,
    margin: 1,
    spacing: 2,
    name,
    tilecount: 4,
    tileheight: TILE_SIZE,
    tilewidth: TILE_SIZE,
    type: 'tileset',
    version: '1.10',
    _baseGid: firstgid,
    tiles: [0, 1, 2, 3].map((id) => ({
      id,
      properties: [
        { name: 'id', type: 'int', value: id },
        { name: 'collides', type: 'bool', value: true },
        { name: 'animationOnly', type: 'bool', value: false },
      ],
    })),
  };
}

function buildTavernMap() {
  const ground = new Array(WIDTH * HEIGHT).fill(0);
  const groundDetail = new Array(WIDTH * HEIGHT).fill(0);
  const walls = new Array(WIDTH * HEIGHT).fill(0);
  const collision = new Array(WIDTH * HEIGHT).fill(0);
  const overhead = new Array(WIDTH * HEIGHT).fill(0);

  // Fill interior floor (cols 2..17, rows 1..10)
  for (let r = 1; r <= 10; r++) {
    for (let c = 2; c <= 17; c++) {
      const idx = r * WIDTH + c;
      // Slight floor plank variation
      const variant = (r + c) % 4;
      ground[idx] = 1 + variant;
    }
  }

  // Outer collision border (rows 0, 11 and cols 0, 1, 18, 19)
  for (let r = 0; r < HEIGHT; r++) {
    for (let c = 0; c < WIDTH; c++) {
      if (r === 0 || r === 11 || c < 2 || c > 17) {
        collision[r * WIDTH + c] = 5;
      }
    }
  }

  // Perimeter walls
  // North wall: Row 1, cols 2..17
  for (let c = 2; c <= 17; c++) {
    walls[1 * WIDTH + c] = 5 + (c % 4);
    collision[1 * WIDTH + c] = 5;
  }
  // West & East walls: Rows 2..10
  for (let r = 2; r <= 10; r++) {
    walls[r * WIDTH + 2] = 5;
    collision[r * WIDTH + 2] = 5;

    walls[r * WIDTH + 17] = 5;
    collision[r * WIDTH + 17] = 5;
  }
  // South wall: Row 10, cols 2..8 and 11..17
  for (let c = 2; c <= 8; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  for (let c = 11; c <= 17; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  // Doorway at Row 10, Cols 9..10: open floor, NO walls, NO collision!
  walls[10 * WIDTH + 9] = 0;
  walls[10 * WIDTH + 10] = 0;
  collision[10 * WIDTH + 9] = 0;
  collision[10 * WIDTH + 10] = 0;

  // Bartender Bar Counter: Row 3, cols 8..11
  for (let c = 8; c <= 11; c++) {
    walls[3 * WIDTH + c] = 6;
    collision[3 * WIDTH + c] = 5;
  }

  const propsObjects = [
    {
      id: 1,
      name: 'barrel',
      type: 'prop',
      x: 3 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'ellipse' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 2,
      name: 'crate',
      type: 'prop',
      x: 4 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 3,
      name: 'barrel',
      type: 'prop',
      x: 16 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'ellipse' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 4,
      name: 'torch',
      type: 'prop',
      x: 6 * TILE_SIZE,
      y: 1 * TILE_SIZE - 32,
      width: 32,
      height: 64,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -4, y: -8, w: 8, h: 8, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 5,
      name: 'torch',
      type: 'prop',
      x: 13 * TILE_SIZE,
      y: 1 * TILE_SIZE - 32,
      width: 32,
      height: 64,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -4, y: -8, w: 8, h: 8, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 6,
      name: 'hearth',
      type: 'prop',
      x: 4 * TILE_SIZE,
      y: 0,
      width: 96,
      height: 96,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -34, y: -30, w: 68, h: 30, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
  ];

  const zonesObjects = [
    {
      id: 10,
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
      id: 11,
      name: 'spawn_tavern',
      type: 'spawn',
      x: 9 * TILE_SIZE + 16,
      y: 9 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: 12,
      name: 'exit_village',
      type: 'exit',
      x: 8 * TILE_SIZE,
      y: 7 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 4 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'string', value: 'door' },
        { name: 'targetMap', type: 'string', value: 'brackenford.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'door_tavern' },
        { name: 'prompt', type: 'string', value: 'Press E to exit to Brackenford' },
      ],
    },
    {
      id: 13,
      name: 'Tharos',
      type: 'npc',
      x: 8 * TILE_SIZE,
      y: 1 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 6 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'npc' },
        { name: 'action', type: 'string', value: 'bartender' },
        { name: 'canonName', type: 'string', value: 'The Flagon' },
        { name: 'npcId', type: 'string', value: 'bartender' },
        { name: 'label', type: 'string', value: 'Tharos (Tavernkeeper)' },
        { name: 'prompt', type: 'string', value: 'Press E to talk to Tharos' },
      ],
    },
    {
      id: 14,
      name: 'The Flagon',
      type: 'landmark',
      x: 5 * TILE_SIZE,
      y: 2 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      visible: true,
      properties: [
        { name: 'canonName', type: 'string', value: 'The Flagon' },
        { name: 'label', type: 'string', value: 'The Flagon notice board' },
      ],
    },
  ];

  return {
    compressionlevel: -1,
    width: WIDTH,
    height: HEIGHT,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    nextlayerid: 8,
    nextobjectid: 20,
    properties: [
      { name: 'placeName', type: 'string', value: 'The Flagon' },
      { name: 'canonName', type: 'string', value: 'The Flagon' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [
      createFloorTileset('interior_tavern_floor', '../assets/tiles/interior_tavern_floor.png', 1),
      createWallTileset('interior_tavern_wall', '../assets/tiles/interior_tavern_wall.png', 5),
    ],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: overhead },
    ],
  };
}

function buildMarketMap() {
  const ground = new Array(WIDTH * HEIGHT).fill(0);
  const groundDetail = new Array(WIDTH * HEIGHT).fill(0);
  const walls = new Array(WIDTH * HEIGHT).fill(0);
  const collision = new Array(WIDTH * HEIGHT).fill(0);
  const overhead = new Array(WIDTH * HEIGHT).fill(0);

  // Fill interior market floor (cols 2..17, rows 1..10)
  for (let r = 1; r <= 10; r++) {
    for (let c = 2; c <= 17; c++) {
      const idx = r * WIDTH + c;
      const variant = (r + c) % 4;
      ground[idx] = 1 + variant;
    }
  }

  // Outer collision border
  for (let r = 0; r < HEIGHT; r++) {
    for (let c = 0; c < WIDTH; c++) {
      if (r === 0 || r === 11 || c < 2 || c > 17) {
        collision[r * WIDTH + c] = 5;
      }
    }
  }

  // Perimeter walls
  for (let c = 2; c <= 17; c++) {
    walls[1 * WIDTH + c] = 5 + (c % 4);
    collision[1 * WIDTH + c] = 5;
  }
  for (let r = 2; r <= 10; r++) {
    walls[r * WIDTH + 2] = 5;
    collision[r * WIDTH + 2] = 5;

    walls[r * WIDTH + 17] = 5;
    collision[r * WIDTH + 17] = 5;
  }
  for (let c = 2; c <= 8; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  for (let c = 11; c <= 17; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  // Doorway at Row 10, cols 9..10: open
  walls[10 * WIDTH + 9] = 0;
  walls[10 * WIDTH + 10] = 0;
  collision[10 * WIDTH + 9] = 0;
  collision[10 * WIDTH + 10] = 0;

  // Market Stalls Counter: Row 4, cols 7..12
  for (let c = 7; c <= 12; c++) {
    walls[4 * WIDTH + c] = 6;
    collision[4 * WIDTH + c] = 5;
  }

  const propsObjects = [
    {
      id: 1,
      name: 'crate',
      type: 'prop',
      x: 3 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 2,
      name: 'crate',
      type: 'prop',
      x: 4 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 3,
      name: 'barrel',
      type: 'prop',
      x: 16 * TILE_SIZE,
      y: 2 * TILE_SIZE - 16,
      width: 32,
      height: 48,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -10, y: -12, w: 20, h: 12, shape: 'ellipse' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 4,
      name: 'torch',
      type: 'prop',
      x: 5 * TILE_SIZE,
      y: 1 * TILE_SIZE - 32,
      width: 32,
      height: 64,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -4, y: -8, w: 8, h: 8, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
    {
      id: 5,
      name: 'torch',
      type: 'prop',
      x: 14 * TILE_SIZE,
      y: 1 * TILE_SIZE - 32,
      width: 32,
      height: 64,
      visible: true,
      properties: [
        { name: 'footprint', type: 'string', value: JSON.stringify({ x: -4, y: -8, w: 8, h: 8, shape: 'rect' }) },
        { name: 'tall', type: 'bool', value: false },
      ],
    },
  ];

  const zonesObjects = [
    {
      id: 10,
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
      id: 11,
      name: 'spawn_market',
      type: 'spawn',
      x: 9 * TILE_SIZE + 16,
      y: 9 * TILE_SIZE,
      width: 32,
      height: 32,
      visible: true,
      properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
    },
    {
      id: 12,
      name: 'exit_village',
      type: 'exit',
      x: 8 * TILE_SIZE,
      y: 7 * TILE_SIZE,
      width: 4 * TILE_SIZE,
      height: 4 * TILE_SIZE,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'exit' },
        { name: 'type', type: 'string', value: 'door' },
        { name: 'targetMap', type: 'string', value: 'brackenford.tmj' },
        { name: 'targetSpawn', type: 'string', value: 'door_market' },
        { name: 'prompt', type: 'string', value: 'Press E to exit to Brackenford' },
      ],
    },
    {
      id: 13,
      name: 'Hest Mallow',
      type: 'npc',
      x: 7 * TILE_SIZE,
      y: 1 * TILE_SIZE + 16,
      width: 6 * TILE_SIZE,
      height: 5 * TILE_SIZE + 16,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'npc' },
        { name: 'action', type: 'string', value: 'vendor' },
        { name: 'canonName', type: 'string', value: 'Brackenford' },
        { name: 'npcId', type: 'string', value: 'vendor' },
        { name: 'label', type: 'string', value: 'Hest Mallow (Vendor)' },
        { name: 'prompt', type: 'string', value: 'Press E to trade with Hest Mallow' },
      ],
    },
    {
      id: 14,
      name: 'Brackenford',
      type: 'landmark',
      x: 4 * TILE_SIZE,
      y: 2 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      visible: true,
      properties: [
        { name: 'canonName', type: 'string', value: 'Brackenford' },
        { name: 'label', type: 'string', value: 'Market Stalls' },
      ],
    },
  ];

  return {
    compressionlevel: -1,
    width: WIDTH,
    height: HEIGHT,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    nextlayerid: 8,
    nextobjectid: 20,
    properties: [
      { name: 'placeName', type: 'string', value: 'Brackenford' },
      { name: 'canonName', type: 'string', value: 'Brackenford' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
    ],
    tilesets: [
      createFloorTileset('interior_market_floor', '../assets/tiles/interior_market_floor.png', 1),
      createWallTileset('interior_market_wall', '../assets/tiles/interior_market_wall.png', 5),
    ],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: ground },
      { id: 2, name: 'ground_detail', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: groundDetail },
      { id: 3, name: 'walls', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: walls },
      { id: 4, name: 'props', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: propsObjects },
      { id: 5, name: 'collision', type: 'tilelayer', visible: false, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: collision },
      { id: 6, name: 'zones', type: 'objectgroup', visible: true, opacity: 1, x: 0, y: 0, objects: zonesObjects },
      { id: 7, name: 'overhead', type: 'tilelayer', visible: true, opacity: 1, x: 0, y: 0, width: WIDTH, height: HEIGHT, data: overhead },
    ],
  };
}

const tavernTmj = buildTavernMap();
const marketTmj = buildMarketMap();

const mapsDir = path.join(REPO_ROOT, 'client/public/maps');
fs.writeFileSync(path.join(mapsDir, 'tavern.tmj'), JSON.stringify(tavernTmj, null, 2));
fs.writeFileSync(path.join(mapsDir, 'market.tmj'), JSON.stringify(marketTmj, null, 2));

console.log('Successfully wrote tavern.tmj and market.tmj');
