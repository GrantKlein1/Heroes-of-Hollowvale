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
    imageheight: 34,
    imagewidth: 136,
    margin: 1,
    name,
    spacing: 2,
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
    imageheight: 34,
    imagewidth: 136,
    margin: 1,
    name,
    spacing: 2,
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

const TRIM_TILE_DEFS = [
  { id: 0, name: 'face', collides: true },
  { id: 1, name: 'face_var', collides: true },
  { id: 2, name: 'cap_top', collides: true },
  { id: 3, name: 'cap_top_var', collides: true },
  { id: 4, name: 'corner_NW', collides: true },
  { id: 5, name: 'corner_NE', collides: true },
  { id: 6, name: 'corner_SW', collides: true },
  { id: 7, name: 'corner_SE', collides: true },
  { id: 8, name: 'corner_inner_NW', collides: true },
  { id: 9, name: 'corner_inner_NE', collides: true },
  { id: 10, name: 'doorway_L', collides: false },
  { id: 11, name: 'doorway_R', collides: false },
  { id: 12, name: 'doorway_cap_L', collides: true },
  { id: 13, name: 'doorway_cap_R', collides: true },
  { id: 14, name: 'threshold', collides: false },
  { id: 15, name: 'threshold_var', collides: false },
];

function createTrimTileset(name, imageRelativePath, firstgid = 9) {
  return {
    firstgid,
    columns: 4,
    image: imageRelativePath,
    imageheight: 136,
    imagewidth: 136,
    margin: 1,
    name,
    spacing: 2,
    tilecount: 16,
    tileheight: TILE_SIZE,
    tilewidth: TILE_SIZE,
    type: 'tileset',
    version: '1.10',
    _baseGid: firstgid,
    tiles: TRIM_TILE_DEFS.map((tile) => ({
      id: tile.id,
      properties: [
        { name: 'id', type: 'int', value: tile.id },
        { name: 'name', type: 'string', value: tile.name },
        { name: 'collides', type: 'bool', value: tile.collides },
        { name: 'animationOnly', type: 'bool', value: false },
      ],
    })),
  };
}

function makeProp(id, name, x, y, width, height, footprint, tall = false, layer = 'props') {
  return {
    id,
    name,
    type: 'prop',
    x,
    y,
    width,
    height,
    visible: true,
    properties: [
      { name: 'footprint', type: 'string', value: JSON.stringify(footprint) },
      { name: 'tall', type: 'bool', value: tall },
      { name: 'layer', type: 'string', value: layer },
    ],
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

  // Row 0: Wall cap row (trim tileset firstgid = 9)
  // corner_NW = 9 + 4 = 13, cap_top = 9 + 2 = 11, cap_top_var = 9 + 3 = 12, corner_NE = 9 + 5 = 14
  walls[0 * WIDTH + 2] = 13;
  for (let c = 3; c <= 16; c++) {
    walls[0 * WIDTH + c] = c % 3 === 0 ? 12 : 11;
  }
  walls[0 * WIDTH + 17] = 14;

  // Row 1: Wall face row (trim tileset: face = 9 + 0 = 9, face_var = 9 + 1 = 10)
  walls[1 * WIDTH + 2] = 5;
  collision[1 * WIDTH + 2] = 5;
  for (let c = 3; c <= 16; c++) {
    walls[1 * WIDTH + c] = c % 2 === 0 ? 10 : 9;
    collision[1 * WIDTH + c] = 5;
  }
  walls[1 * WIDTH + 17] = 5;
  collision[1 * WIDTH + 17] = 5;

  // West & East walls: Rows 2..9
  for (let r = 2; r <= 9; r++) {
    walls[r * WIDTH + 2] = 5;
    collision[r * WIDTH + 2] = 5;

    walls[r * WIDTH + 17] = 5;
    collision[r * WIDTH + 17] = 5;
  }

  // South wall: Row 10
  // corner_SW = 9 + 6 = 15, corner_SE = 9 + 7 = 16
  // doorway_cap_L = 9 + 12 = 21, doorway_cap_R = 9 + 13 = 22
  // doorway_L = 9 + 10 = 19, doorway_R = 9 + 11 = 20
  walls[10 * WIDTH + 2] = 15;
  collision[10 * WIDTH + 2] = 5;
  for (let c = 3; c <= 7; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  walls[10 * WIDTH + 8] = 21;
  collision[10 * WIDTH + 8] = 5;

  // Doorway at Row 10, Cols 9..10: open floor, NO collision!
  walls[10 * WIDTH + 9] = 19;
  walls[10 * WIDTH + 10] = 20;
  collision[10 * WIDTH + 9] = 0;
  collision[10 * WIDTH + 10] = 0;

  walls[10 * WIDTH + 11] = 22;
  collision[10 * WIDTH + 11] = 5;
  for (let c = 12; c <= 16; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  walls[10 * WIDTH + 17] = 16;
  collision[10 * WIDTH + 17] = 5;

  // 30 Placed Objects from Blendsmith art-locked reference set
  const propsObjects = [
    // 1. Animated hearth on north wall
    makeProp(1, 'tavern_hearth_wall_burn_down_0', 128, 0, 96, 128, { x: -36, y: -18, w: 72, h: 18, shape: 'rect' }),
    // 2. Woodpile beside hearth
    makeProp(2, 'tavern_woodpile', 68, 48, 64, 48, { x: -26, y: -14, w: 52, h: 14, shape: 'rect' }),
    // 3. Hearth chair facing fire (+X)
    makeProp(3, 'tavern_hearth_chair', 228, 56, 40, 64, { x: -14, y: -12, w: 28, h: 12, shape: 'rect' }),
    // 4. Bottle shelf on wall behind bar
    makeProp(4, 'tavern_shelf_bottles', 288, 16, 64, 80, { x: -28, y: -8, w: 56, h: 8, shape: 'rect' }),
    // 5. Crockery shelf on wall behind bar
    makeProp(5, 'tavern_shelf_crockery', 352, 16, 64, 80, { x: -28, y: -8, w: 56, h: 8, shape: 'rect' }),
    // 6. Keg stack behind bar
    makeProp(6, 'tavern_keg_stack', 424, 40, 64, 64, { x: -22, y: -16, w: 44, h: 16, shape: 'rect' }),
    // 7. Corner barrel cluster (top right)
    makeProp(7, 'tavern_barrel_cluster', 484, 40, 64, 64, { x: -26, y: -18, w: 52, h: 18, shape: 'rect' }),
    // 8. Bar counter
    makeProp(8, 'tavern_bar_counter', 288, 96, 128, 80, { x: -56, y: -22, w: 112, h: 22, shape: 'rect' }),
    // 9-11. Three stools along bar counter
    makeProp(9, 'tavern_stool', 296, 148, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    makeProp(10, 'tavern_stool', 336, 148, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    makeProp(11, 'tavern_stool', 376, 148, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    // 12. Long trestle dining table
    makeProp(12, 'tavern_table_long', 104, 168, 96, 64, { x: -44, y: -16, w: 88, h: 16, shape: 'rect' }),
    // 13-14. Benches north and south of long table
    makeProp(13, 'tavern_bench', 120, 144, 64, 40, { x: -28, y: -12, w: 56, h: 12, shape: 'rect' }),
    makeProp(14, 'tavern_bench', 120, 220, 64, 40, { x: -28, y: -12, w: 56, h: 12, shape: 'rect' }),
    // 15-18. Round table 1 with candle and 2 stools
    makeProp(15, 'tavern_table_round', 248, 216, 64, 64, { x: -22, y: -14, w: 44, h: 14, shape: 'ellipse' }),
    makeProp(16, 'interior_candle_table', 260, 208, 40, 48, { x: -14, y: -10, w: 28, h: 10, shape: 'rect' }),
    makeProp(17, 'tavern_stool', 224, 224, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    makeProp(18, 'tavern_stool', 304, 224, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    // 19-22. Round table 2 with candle and 2 stools
    makeProp(19, 'tavern_table_round', 440, 184, 64, 64, { x: -22, y: -14, w: 44, h: 14, shape: 'ellipse' }),
    makeProp(20, 'interior_candle_table', 452, 176, 40, 48, { x: -14, y: -10, w: 28, h: 10, shape: 'rect' }),
    makeProp(21, 'tavern_stool', 416, 192, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    makeProp(22, 'tavern_stool', 496, 192, 32, 48, { x: -10, y: -8, w: 20, h: 8, shape: 'rect' }),
    // 23. Bottom left barrel cluster
    makeProp(23, 'tavern_barrel_cluster', 68, 256, 64, 64, { x: -26, y: -18, w: 52, h: 18, shape: 'rect' }),
    // 24. Right wall crate cluster
    makeProp(24, 'tavern_crate_cluster', 484, 260, 64, 56, { x: -26, y: -16, w: 52, h: 16, shape: 'rect' }),
    // 25. Coat rack beside entrance door
    makeProp(25, 'tavern_coat_rack', 236, 240, 48, 80, { x: -16, y: -8, w: 32, h: 8, shape: 'rect' }),
    // 26. Notice board on west wall
    makeProp(26, 'tavern_notice_board', 64, 104, 48, 64, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }),
    // 27-28. Windows on north wall
    makeProp(27, 'interior_window_wall', 80, 8, 48, 64, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }),
    makeProp(28, 'interior_window_wall', 232, 8, 48, 64, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }),
    // 29. Antlers mounted above mantel
    makeProp(29, 'tavern_antlers', 152, 4, 48, 48, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }),
    // 30. Shield mounted on east wall
    makeProp(30, 'tavern_shield_wall', 440, 8, 40, 56, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }),
  ];

  // Tharos NPC zone behind bar counter:
  // Counter is at x: 288, y: 96, w: 128 (center X = 352).
  // Tharos feet at (352, 136). Zone width 64, height 64 -> x: 320, y: 72.
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
      x: 320,
      y: 40,
      width: 64,
      height: 96,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'npc' },
        { name: 'action', type: 'string', value: 'bartender' },
        { name: 'canonName', type: 'string', value: 'The Flagon' },
        { name: 'npcId', type: 'string', value: 'bartender' },
        { name: 'label', type: 'string', value: 'Tharos (Tavernkeeper)' },
        { name: 'prompt', type: 'string', value: 'Press E to talk to Tharos' },
        { name: 'sprite', type: 'string', value: 'npc_bartender' },
        { name: 'facing', type: 'string', value: 'down' },
      ],
    },
    {
      id: 14,
      name: 'The Flagon',
      type: 'landmark',
      x: 64,
      y: 104,
      width: 48,
      height: 64,
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
    nextobjectid: 50,
    properties: [
      { name: 'placeName', type: 'string', value: 'The Flagon' },
      { name: 'canonName', type: 'string', value: 'The Flagon' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
      { name: 'propAtlases', type: 'string', value: 'interior_props' },
      { name: 'assetGroups', type: 'string', value: 'interiors' },
    ],
    tilesets: [
      createFloorTileset('interior_tavern_floor', '../assets/tiles/interior_tavern_floor.png', 1),
      createWallTileset('interior_tavern_wall', '../assets/tiles/interior_tavern_wall.png', 5),
      createTrimTileset('interior_tavern_wall_trim', '../assets/tiles/interior_tavern_wall_trim.png', 9),
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

  // Row 0: Wall cap row (trim tileset firstgid = 9)
  walls[0 * WIDTH + 2] = 13;
  for (let c = 3; c <= 16; c++) {
    walls[0 * WIDTH + c] = c % 3 === 0 ? 12 : 11;
  }
  walls[0 * WIDTH + 17] = 14;

  // Row 1: Wall face row
  walls[1 * WIDTH + 2] = 5;
  collision[1 * WIDTH + 2] = 5;
  for (let c = 3; c <= 16; c++) {
    walls[1 * WIDTH + c] = c % 2 === 0 ? 10 : 9;
    collision[1 * WIDTH + c] = 5;
  }
  walls[1 * WIDTH + 17] = 5;
  collision[1 * WIDTH + 17] = 5;

  // Perimeter walls
  for (let r = 2; r <= 9; r++) {
    walls[r * WIDTH + 2] = 5;
    collision[r * WIDTH + 2] = 5;

    walls[r * WIDTH + 17] = 5;
    collision[r * WIDTH + 17] = 5;
  }

  // Row 10: South wall & doorway
  walls[10 * WIDTH + 2] = 15;
  collision[10 * WIDTH + 2] = 5;
  for (let c = 3; c <= 7; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  walls[10 * WIDTH + 8] = 21;
  collision[10 * WIDTH + 8] = 5;

  // Doorway at Row 10, cols 9..10: open
  walls[10 * WIDTH + 9] = 19;
  walls[10 * WIDTH + 10] = 20;
  collision[10 * WIDTH + 9] = 0;
  collision[10 * WIDTH + 10] = 0;

  walls[10 * WIDTH + 11] = 22;
  collision[10 * WIDTH + 11] = 5;
  for (let c = 12; c <= 16; c++) {
    walls[10 * WIDTH + c] = 5;
    collision[10 * WIDTH + c] = 5;
  }
  walls[10 * WIDTH + 17] = 16;
  collision[10 * WIDTH + 17] = 5;

  // Market props with paired pieces
  const stallX = 224;
  const stallY = 64;
  const propsObjects = [
    // 1-2. Paired market stall: base (props) + awning (overhead) at identical (x, y)
    makeProp(1, 'market_stall_base', stallX, stallY, 128, 128, { x: -52, y: -20, w: 104, h: 20, shape: 'rect' }),
    makeProp(2, 'market_stall_awning', stallX, stallY, 128, 128, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }, true, 'overhead'),

    // 3-4. Paired market counter + hanging goods at identical (x, y)
    makeProp(3, 'market_counter', 400, 96, 112, 96, { x: -48, y: -18, w: 96, h: 18, shape: 'rect' }),
    makeProp(4, 'market_hanging_goods', 400, 96, 112, 96, { x: 0, y: 0, w: 0, h: 0, shape: 'none' }, true, 'overhead'),

    // 5-6. Market crates produce
    makeProp(5, 'market_crate_produce', 96, 64, 48, 48, { x: -18, y: -14, w: 36, h: 14, shape: 'rect' }),
    makeProp(6, 'market_crate_produce', 96, 112, 48, 48, { x: -18, y: -14, w: 36, h: 14, shape: 'rect' }),

    // 7-8. Market sacks
    makeProp(7, 'market_sack_pile', 96, 160, 48, 48, { x: -18, y: -14, w: 36, h: 14, shape: 'rect' }),
    makeProp(8, 'market_sack_pile', 480, 220, 48, 48, { x: -18, y: -14, w: 36, h: 14, shape: 'rect' }),

    // 9-10. Open barrels
    makeProp(9, 'market_barrel_open', 360, 192, 48, 56, { x: -16, y: -14, w: 32, h: 14, shape: 'rect' }),
    makeProp(10, 'market_barrel_open', 480, 156, 48, 56, { x: -16, y: -14, w: 32, h: 14, shape: 'rect' }),
  ];

  // Vendor NPC placement:
  // Stall origin is (stallX + 64, stallY + 128) = (288, 192).
  // Rule: feet at stall origin + (-72, -3) = (216, 189).
  // Zone width 48, height 48:
  // zone.x = 216 - 24 = 192
  // zone.y = 189 - 48 = 141
  const vendorFeetX = stallX + 64 - 72; // 216
  const vendorFeetY = stallY + 128 - 3; // 189
  const vendorZoneW = 64;
  const vendorZoneH = 96;

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
      x: vendorFeetX - vendorZoneW / 2,
      y: vendorFeetY - vendorZoneH,
      width: vendorZoneW,
      height: vendorZoneH,
      visible: true,
      properties: [
        { name: 'kind', type: 'string', value: 'npc' },
        { name: 'action', type: 'string', value: 'vendor' },
        { name: 'canonName', type: 'string', value: 'Brackenford' },
        { name: 'npcId', type: 'string', value: 'vendor' },
        { name: 'label', type: 'string', value: 'Hest Mallow (Vendor)' },
        { name: 'prompt', type: 'string', value: 'Press E to trade with Hest Mallow' },
        { name: 'sprite', type: 'string', value: 'npc_vendor' },
        { name: 'facing', type: 'string', value: 'down' },
      ],
    },
    {
      id: 14,
      name: 'Brackenford',
      type: 'landmark',
      x: 128,
      y: 64,
      width: 32,
      height: 32,
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
    nextobjectid: 50,
    properties: [
      { name: 'placeName', type: 'string', value: 'Brackenford' },
      { name: 'canonName', type: 'string', value: 'Brackenford' },
      { name: 'leagueX', type: 'int', value: 0 },
      { name: 'leagueY', type: 'int', value: 0 },
      { name: 'propAtlases', type: 'string', value: 'interior_props' },
      { name: 'assetGroups', type: 'string', value: 'interiors' },
    ],
    tilesets: [
      createFloorTileset('interior_market_floor', '../assets/tiles/interior_market_floor.png', 1),
      createWallTileset('interior_market_wall', '../assets/tiles/interior_market_wall.png', 5),
      createTrimTileset('interior_market_wall_trim', '../assets/tiles/interior_market_wall_trim.png', 9),
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
