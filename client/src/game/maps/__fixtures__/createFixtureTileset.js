import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
}

const crcTable = makeCrcTable()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = data.length
  const header = Buffer.alloc(4)
  header.writeUInt32BE(len, 0)
  const typeAndData = Buffer.concat([typeBuf, data])
  const crcVal = crc32(typeAndData)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal, 0)
  return Buffer.concat([header, typeAndData, crcBuf])
}

/**
 * Encodes raw RGBA buffer into a valid PNG buffer.
 *
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgbaBuffer
 * @returns {Buffer}
 */
export function encodePng(width, height, rgbaBuffer) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // 8-bit depth
  ihdrData[9] = 6 // RGBA
  ihdrData[10] = 0 // Deflate compression
  ihdrData[11] = 0 // Adaptive filtering
  ihdrData[12] = 0 // No interlace
  const ihdr = createChunk('IHDR', ihdrData)

  const scanlineLen = 1 + width * 4
  const scanlines = Buffer.alloc(height * scanlineLen)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLen
    scanlines[rowOffset] = 0 // Filter type 0 (None)
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = createChunk('IDAT', zlib.deflateSync(scanlines))
  const iend = createChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

/**
 * 16 solid placeholder colors for 32x32 tileset (4 columns x 4 rows = 128x128 px).
 * All generated programmatically in code without external art assets.
 */
export const TILE_COLORS = [
  [91, 140, 50, 255],   // 0: Grass base (green)
  [71, 107, 38, 255],   // 1: Ground detail (dark green)
  [112, 112, 112, 255], // 2: Wall stone (grey)
  [163, 131, 86, 255],  // 3: Road/dirt (tan)
  [230, 57, 70, 255],   // 4: Collision block (red)
  [45, 106, 79, 255],   // 5: Prop base (forest green)
  [56, 176, 0, 255],    // 6: Overhead canopy (bright leaf green)
  [72, 202, 228, 255],  // 7: Water (cyan)
  [218, 165, 32, 255],  // 8: Gold/sand
  [139, 69, 19, 255],   // 9: Wood plank
  [100, 149, 237, 255], // 10: River deep
  [160, 82, 45, 255],   // 11: Roof tile
  [47, 79, 79, 255],    // 12: Dark slate
  [220, 20, 60, 255],   // 13: Crimson
  [70, 130, 180, 255],  // 14: Steel blue
  [255, 255, 255, 255], // 15: Highlight white
]

/**
 * Generates placeholder 128x128 PNG image buffer.
 *
 * @returns {Buffer}
 */
export function generatePlaceholderTilesetPng() {
  const tileSize = 32
  const cols = 4
  const rows = 4
  const width = cols * tileSize
  const height = rows * tileSize
  const buf = Buffer.alloc(width * height * 4)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileIndex = r * cols + c
      const color = TILE_COLORS[tileIndex] || [128, 128, 128, 255]
      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const x = c * tileSize + px
          const y = r * tileSize + py
          const idx = (y * width + x) * 4
          buf[idx] = color[0]
          buf[idx + 1] = color[1]
          buf[idx + 2] = color[2]
          buf[idx + 3] = color[3]
        }
      }
    }
  }

  return encodePng(width, height, buf)
}

/**
 * Constructs minimal valid fixture Tiled .tmj map data.
 * Contains all 7 canonical layers:
 * 'ground', 'ground_detail', 'walls', 'props', 'collision', 'zones', 'overhead'
 */
export function generateFixtureMapData() {
  const width = 10
  const height = 8
  const tileCount = width * height

  // 1. ground layer (all grass, gid 1)
  const groundData = new Array(tileCount).fill(1)

  // 2. ground_detail layer (zeros except 2 spots)
  const groundDetailData = new Array(tileCount).fill(0)
  groundDetailData[1 * width + 1] = 2 // (1, 1) gid 2
  groundDetailData[5 * width + 6] = 2 // (6, 5) gid 2

  // 3. walls layer (row 0 filled with stone wall gid 3)
  const wallsData = new Array(tileCount).fill(0)
  for (let c = 0; c < width; c++) {
    wallsData[0 * width + c] = 3
  }

  // 4. collision layer (collision obstacle at col 4, rows 4..5)
  const collisionData = new Array(tileCount).fill(0)
  collisionData[4 * width + 4] = 5 // (col 4, row 4) [x: 128..160, y: 128..160]
  collisionData[5 * width + 4] = 5 // (col 4, row 5) [x: 128..160, y: 160..192]

  // 5. overhead layer (canopy roof tiles gid 7 at row 1, cols 2..3)
  const overheadData = new Array(tileCount).fill(0)
  overheadData[1 * width + 2] = 7
  overheadData[1 * width + 3] = 7

  return {
    compressionlevel: -1,
    width,
    height,
    tilewidth: 32,
    tileheight: 32,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    tilesets: [
      {
        firstgid: 1,
        name: 'placeholder_tiles',
        tilewidth: 32,
        tileheight: 32,
        tilecount: 16,
        columns: 4,
        image: 'placeholder_tiles.png',
        imagewidth: 128,
        imageheight: 128,
        tiles: [
          {
            id: 0,
            properties: [{ name: 'collides', type: 'bool', value: false }],
          },
          {
            id: 1,
            properties: [{ name: 'collides', type: 'bool', value: false }],
          },
          {
            id: 2,
            properties: [{ name: 'collides', type: 'bool', value: true }],
          },
          {
            id: 3,
            properties: [{ name: 'collides', type: 'bool', value: false }],
          },
          {
            id: 4,
            properties: [{ name: 'collides', type: 'bool', value: true }],
          },
          {
            id: 5,
            properties: [{ name: 'collides', type: 'bool', value: false }],
          },
          {
            id: 6,
            properties: [
              { name: 'collides', type: 'bool', value: false },
              { name: 'tall', type: 'bool', value: true },
            ],
          },
        ],
      },
    ],
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
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: [
          {
            id: 101,
            name: 'pine_tree',
            type: 'prop',
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
              { name: 'tall', type: 'bool', value: true },
            ],
          },
          {
            id: 102,
            name: 'cottage',
            type: 'prop',
            x: 224,
            y: 96,
            width: 64,
            height: 64,
            properties: [
              {
                name: 'footprint',
                type: 'string',
                value: '{"x":0,"y":32,"w":64,"h":32,"shape":"rect"}',
              },
              { name: 'tall', type: 'bool', value: true },
            ],
          },
        ],
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
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: [
          {
            id: 201,
            name: 'spawn_default',
            type: 'spawn',
            x: 32,
            y: 96,
            width: 32,
            height: 32,
            properties: [{ name: 'kind', type: 'string', value: 'spawn' }],
          },
          {
            id: 202,
            name: 'exit_south',
            type: 'exit',
            x: 128,
            y: 224,
            width: 64,
            height: 32,
            properties: [
              { name: 'targetMap', type: 'string', value: 'wilderness.tmj' },
              { name: 'targetSpawn', type: 'string', value: 'north' },
            ],
          },
          {
            id: 203,
            name: 'door_tavern',
            type: 'door',
            x: 224,
            y: 160,
            width: 32,
            height: 32,
            properties: [
              {
                name: 'prompt',
                type: 'string',
                value: 'Press E to enter The Flagon',
              },
            ],
          },
        ],
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
  }
}

/**
 * Writes the fixture PNG and TMJ to disk under __fixtures__/.
 */
export function writeFixtureFiles() {
  const pngPath = path.join(__dirname, 'placeholder_tiles.png')
  const tmjPath = path.join(__dirname, 'fixture_map.tmj')

  const pngBuf = generatePlaceholderTilesetPng()
  fs.writeFileSync(pngPath, pngBuf)

  const mapData = generateFixtureMapData()
  fs.writeFileSync(tmjPath, JSON.stringify(mapData, null, 2), 'utf-8')

  return { pngPath, tmjPath }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('createFixtureTileset.js')) {
  const { pngPath, tmjPath } = writeFixtureFiles()
  console.log('Generated fixture files:')
  console.log(' - PNG:', pngPath)
  console.log(' - TMJ:', tmjPath)
}
