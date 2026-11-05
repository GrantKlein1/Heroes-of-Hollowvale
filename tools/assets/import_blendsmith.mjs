#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(REPO_ROOT, 'art-source', 'blendsmith');
const DEST_DIR = path.join(REPO_ROOT, 'client', 'public', 'assets');

const FORBIDDEN_PATTERNS = [
  /frames/i,
  /render_hi/i,
  /_bak/i,
  /previews/i,
  /\.blend$/i,
  /\.glb$/i,
  /^dragon_fx\.json$/i,
  /^MANIFEST\.md$/i
];

function isForbidden(filename) {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(filename));
}

function extractAnchor(jsonData) {
  if (jsonData.meta?.origin?.x !== undefined && jsonData.meta?.origin?.y !== undefined) {
    return { x: Number(jsonData.meta.origin.x), y: Number(jsonData.meta.origin.y) };
  }
  if (jsonData.meta?.anchor?.x !== undefined && jsonData.meta?.anchor?.y !== undefined) {
    return { x: Number(jsonData.meta.anchor.x), y: Number(jsonData.meta.anchor.y) };
  }
  if (jsonData.frames) {
    const firstFrame = Object.values(jsonData.frames)[0];
    if (firstFrame?.pivot?.x !== undefined && firstFrame?.pivot?.y !== undefined) {
      return { x: Number(firstFrame.pivot.x), y: Number(firstFrame.pivot.y) };
    }
    if (firstFrame?.anchor?.x !== undefined && firstFrame?.anchor?.y !== undefined) {
      return { x: Number(firstFrame.anchor.x), y: Number(firstFrame.anchor.y) };
    }
  }
  return { x: 0.5, y: 0.5 };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function importBlendsmith() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source directory does not exist: ${SOURCE_DIR}`);
  }

  ensureDir(DEST_DIR);

  console.log(`[Blendsmith Importer] Source: ${SOURCE_DIR}`);
  console.log(`[Blendsmith Importer] Destination: ${DEST_DIR}`);

  // Load attacks.json for red_dragon
  const dragonAttacksPath = path.join(SOURCE_DIR, 'red_dragon', 'attacks.json');
  let dragonAttacksData = null;
  if (fs.existsSync(dragonAttacksPath)) {
    dragonAttacksData = JSON.parse(fs.readFileSync(dragonAttacksPath, 'utf8'));
  }

  const manifest = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    groups: {
      boot: ['fx_common', 'critters', 'knight'],
      village: ['knight', 'thief', 'dwarf', 'mage', 'critters', 'fx_common'],
      wilderness: ['knight', 'thief', 'dwarf', 'mage', 'goblin', 'goblin_archer', 'goblin_brute', 'critters', 'fx_common'],
      boss: ['knight', 'thief', 'dwarf', 'mage', 'fx_common', 'dragon_fx_v2'],
      boss_p1: ['red_dragon_p1_a', 'red_dragon_p1_b'],
      boss_p2: ['red_dragon_p2_a', 'red_dragon_p2_b', 'red_dragon_p2_land'],
      boss_p3: ['red_dragon_p3_a', 'red_dragon_p3_b']
    },
    assets: {}
  };

  // Helper to copy files and record sheets
  function processAssetDirectory({
    srcSubdir,
    targetKind,
    targetAssetName,
    customSubdirMap = null,
    isMage = false,
    isDragon = false
  }) {
    const assetDestDir = path.join(DEST_DIR, targetKind, targetAssetName);
    ensureDir(assetDestDir);

    const assetEntry = {
      id: targetAssetName,
      kind: targetKind,
      anchor: null,
      sheets: {},
      sidecars: []
    };

    const srcPath = path.join(SOURCE_DIR, srcSubdir);

    function walkAndCopy(currentSrc, currentDestRel = '') {
      const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

      for (const entry of entries) {
        if (isForbidden(entry.name)) {
          console.log(`  [Excluded] ${entry.name}`);
          continue;
        }

        const fullSrc = path.join(currentSrc, entry.name);
        const relToAsset = path.join(currentDestRel, entry.name);
        const fullDest = path.join(assetDestDir, relToAsset);

        if (entry.isDirectory()) {
          ensureDir(fullDest);
          walkAndCopy(fullSrc, relToAsset);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext !== '.png' && ext !== '.json') {
            console.log(`  [Skipped non-png/json] ${entry.name}`);
            continue;
          }

          ensureDir(path.dirname(fullDest));

          if (isDragon && entry.name.startsWith('red_dragon_p') && ext === '.json') {
            // Merge attacks.json into dragon meta
            const raw = fs.readFileSync(fullSrc, 'utf8');
            const data = JSON.parse(raw);
            if (!data.meta) data.meta = {};
            if (dragonAttacksData) {
              data.meta.attacks = dragonAttacksData;
              if (!data.meta.anims && dragonAttacksData.anims) {
                data.meta.anims = dragonAttacksData.anims;
              }
              if (dragonAttacksData.state_machine) {
                data.meta.state_machine = dragonAttacksData.state_machine;
              }
              if (dragonAttacksData.mouthData) {
                data.meta.mouthData = dragonAttacksData.mouthData;
              }
            }
            fs.writeFileSync(fullDest, JSON.stringify(data, null, 2), 'utf8');
          } else {
            fs.copyFileSync(fullSrc, fullDest);
          }

          // If JSON atlas, register sheet and extract anchor
          if (ext === '.json') {
            try {
              const data = JSON.parse(fs.readFileSync(fullDest, 'utf8'));
              // Check if it is an atlas (has frames)
              if (data.frames) {
                const sheetKey = path.basename(entry.name, '.json');
                const sheetPngName = `${sheetKey}.png`;
                const sheetAnchor = extractAnchor(data);

                const webAssetPath = `assets/${targetKind}/${targetAssetName}/${relToAsset.replace(/\\/g, '/')}`;
                const webPngPath = webAssetPath.replace(/\.json$/, '.png');

                assetEntry.sheets[sheetKey] = {
                  key: sheetKey,
                  image: webPngPath,
                  json: webAssetPath,
                  anchor: sheetAnchor
                };

                // Base sheet sets asset-level primary anchor
                if (sheetKey === targetAssetName || !assetEntry.anchor) {
                  assetEntry.anchor = sheetAnchor;
                }
              } else {
                assetEntry.sidecars.push(relToAsset.replace(/\\/g, '/'));
              }
            } catch (err) {
              console.warn(`  [Warning] Failed parsing ${fullDest}: ${err.message}`);
            }
          }
        }
      }
    }

    walkAndCopy(srcPath);

    // Default anchor fallback if still null
    if (!assetEntry.anchor) {
      const firstSheet = Object.values(assetEntry.sheets)[0];
      assetEntry.anchor = firstSheet?.anchor || { x: 0.5, y: 0.5 };
    }

    return assetEntry;
  }

  // 1. Process regular characters
  const characters = ['knight', 'thief', 'dwarf'];
  for (const charName of characters) {
    const entry = processAssetDirectory({
      srcSubdir: charName,
      targetKind: 'characters',
      targetAssetName: charName
    });
    manifest.assets[charName] = entry;
  }

  // 2. Process Mage (merge walk/ and spells/ into unified 'mage' asset)
  const mageDestDir = path.join(DEST_DIR, 'characters', 'mage');
  ensureDir(mageDestDir);

  const mageEntry = {
    id: 'mage',
    kind: 'characters',
    anchor: null,
    sheets: {},
    sidecars: []
  };

  const mageSubdirs = ['walk', 'spells'];
  for (const subdir of mageSubdirs) {
    const subPath = path.join(SOURCE_DIR, 'mage', subdir);
    if (!fs.existsSync(subPath)) continue;

    const entries = fs.readdirSync(subPath, { withFileTypes: true });
    for (const entry of entries) {
      if (isForbidden(entry.name)) continue;

      const fullSrc = path.join(subPath, entry.name);
      const fullDest = path.join(mageDestDir, entry.name);

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== '.png' && ext !== '.json') continue;

        fs.copyFileSync(fullSrc, fullDest);

        if (ext === '.json') {
          try {
            const data = JSON.parse(fs.readFileSync(fullDest, 'utf8'));
            if (data.frames) {
              const sheetKey = path.basename(entry.name, '.json');
              const sheetAnchor = extractAnchor(data);
              mageEntry.sheets[sheetKey] = {
                key: sheetKey,
                image: `assets/characters/mage/${sheetKey}.png`,
                json: `assets/characters/mage/${sheetKey}.json`,
                anchor: sheetAnchor
              };
              if (sheetKey === 'mage_walk' || !mageEntry.anchor) {
                mageEntry.anchor = sheetAnchor;
              }
            } else {
              mageEntry.sidecars.push(entry.name);
            }
          } catch (err) {
            console.warn(`  [Warning] Failed parsing mage file ${entry.name}: ${err.message}`);
          }
        }
      }
    }
  }
  if (!mageEntry.anchor) {
    const firstSheet = Object.values(mageEntry.sheets)[0];
    mageEntry.anchor = firstSheet?.anchor || { x: 0.5, y: 0.9271 };
  }
  manifest.assets.mage = mageEntry;

  // 3. Process enemies
  const enemies = ['goblin', 'goblin_archer', 'goblin_brute'];
  for (const enemyName of enemies) {
    const entry = processAssetDirectory({
      srcSubdir: enemyName,
      targetKind: 'enemies',
      targetAssetName: enemyName
    });
    manifest.assets[enemyName] = entry;
  }

  // 4. Process ambient critters
  const crittersEntry = processAssetDirectory({
    srcSubdir: 'critters',
    targetKind: 'ambient',
    targetAssetName: 'critters'
  });
  manifest.assets.critters = crittersEntry;

  // 5. Process fx_common
  const fxEntry = processAssetDirectory({
    srcSubdir: 'fx_common',
    targetKind: 'fx',
    targetAssetName: 'fx_common'
  });
  manifest.assets.fx_common = fxEntry;

  // 6. Process Red Dragon
  const dragonEntry = processAssetDirectory({
    srcSubdir: 'red_dragon',
    targetKind: 'boss',
    targetAssetName: 'red_dragon',
    isDragon: true
  });

  dragonEntry.phases = {
    p1: ['red_dragon_p1_a', 'red_dragon_p1_b'],
    p2: ['red_dragon_p2_a', 'red_dragon_p2_b', 'red_dragon_p2_land'],
    p3: ['red_dragon_p3_a', 'red_dragon_p3_b']
  };
  dragonEntry.attacks = 'assets/boss/red_dragon/attacks.json';
  manifest.assets.red_dragon = dragonEntry;

  // Also register individual per-phase dragon assets and dragon_fx_v2 for direct manifest access
  const dragonPhases = [
    { key: 'red_dragon_p1_a', phase: 1 },
    { key: 'red_dragon_p1_b', phase: 1 },
    { key: 'red_dragon_p2_a', phase: 2 },
    { key: 'red_dragon_p2_b', phase: 2 },
    { key: 'red_dragon_p2_land', phase: 2 },
    { key: 'red_dragon_p3_a', phase: 3 },
    { key: 'red_dragon_p3_b', phase: 3 }
  ];

  for (const { key, phase } of dragonPhases) {
    const sheet = dragonEntry.sheets[key];
    manifest.assets[key] = {
      id: key,
      kind: 'boss',
      phase,
      anchor: sheet?.anchor || { x: 0.5, y: 0.7812 },
      image: sheet?.image || `assets/boss/red_dragon/${key}.png`,
      json: sheet?.json || `assets/boss/red_dragon/${key}.json`
    };
  }

  // Register dragon_fx_v2 entry
  const dragonFxSheet = dragonEntry.sheets['dragon_fx_v2'];
  manifest.assets['dragon_fx_v2'] = {
    id: 'dragon_fx_v2',
    kind: 'boss',
    anchor: dragonFxSheet?.anchor || { x: 0.5, y: 0.5 },
    image: dragonFxSheet?.image || 'assets/boss/red_dragon/fx_v2/dragon_fx_v2.png',
    json: dragonFxSheet?.json || 'assets/boss/red_dragon/fx_v2/dragon_fx_v2.json'
  };

  // Write manifest.json
  const manifestPath = path.join(DEST_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[Blendsmith Importer] Manifest written: ${manifestPath}`);

  // Summary statistics
  let totalBytes = 0;
  let fileCount = 0;

  function tallyDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        tallyDir(full);
      } else if (item.isFile()) {
        fileCount++;
        totalBytes += fs.statSync(full).size;
      }
    }
  }

  tallyDir(DEST_DIR);

  const mib = (totalBytes / (1024 * 1024)).toFixed(2);
  const kib = (totalBytes / 1024).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`[Blendsmith Importer] SUMMARY`);
  console.log(`Total files imported: ${fileCount}`);
  console.log(`Total size: ${totalBytes} bytes (${kib} KiB / ${mib} MiB)`);
  console.log(`Manifest groups: ${Object.keys(manifest.groups).join(', ')}`);
  console.log(`Manifest assets: ${Object.keys(manifest.assets).length} entries`);
  console.log(`======================================================\n`);

  return { manifest, fileCount, totalBytes, mib };
}

// Run if called directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    importBlendsmith();
  } catch (err) {
    console.error(`Import failed:`, err);
    process.exit(1);
  }
}
