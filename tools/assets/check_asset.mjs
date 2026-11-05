#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_MANIFEST_PATH = path.join(REPO_ROOT, 'client', 'public', 'assets', 'manifest.json');

const VALID_DIRECTIONS = new Set(['down', 'left', 'right', 'up']);
const DIRECTIONAL_FRAME_REGEX = /^([a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*)_(down|left|right|up)(?:_([0-9]+))?$/;
const NON_DIRECTIONAL_FRAME_REGEX = /^([a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*)_([0-9]+)$/;
const MAX_PAGE_DIMENSION = 4096;

/**
 * Determines whether a sheet is an FX sheet or effect projectile.
 */
export function isFxAtlas(sheetKey = '', jsonPath = '', kind = '') {
  if (kind === 'fx') return true;
  const lowerKey = sheetKey.toLowerCase();
  const lowerPath = jsonPath.toLowerCase().replace(/\\/g, '/');
  if (lowerKey.includes('_fx') || lowerKey === 'fx' || lowerKey === 'fireball' || lowerKey === 'spell_fx' || lowerKey.startsWith('dfx_')) {
    return true;
  }
  if (lowerPath.includes('/fx/') || lowerPath.includes('/fx_v2/')) {
    return true;
  }
  return false;
}

/**
 * Determines whether an asset is ambient critters.
 */
export function isAmbientCritter(sheetKey = '', jsonPath = '', kind = '', assetId = '') {
  if (kind === 'ambient') return true;
  if (assetId === 'critters' || sheetKey === 'critters') return true;
  const lowerPath = jsonPath.toLowerCase().replace(/\\/g, '/');
  return lowerPath.includes('/ambient/') || lowerPath.includes('critters');
}

/**
 * Extracts anchor from meta.origin, meta.anchor, frame pivot/anchor, or manifestAnchor.
 */
export function extractAnchor(atlasData, options = {}) {
  if (!atlasData) return null;
  const meta = atlasData.meta;
  if (meta) {
    if (meta.origin && typeof meta.origin.x === 'number' && typeof meta.origin.y === 'number') {
      return { x: meta.origin.x, y: meta.origin.y, source: 'meta.origin' };
    }
    if (meta.anchor && typeof meta.anchor.x === 'number' && typeof meta.anchor.y === 'number') {
      return { x: meta.anchor.x, y: meta.anchor.y, source: 'meta.anchor' };
    }
  }

  const frames = atlasData.frames;
  if (frames) {
    const frameList = Array.isArray(frames) ? frames : Object.values(frames);
    const first = frameList[0];
    if (first) {
      if (first.pivot && typeof first.pivot.x === 'number' && typeof first.pivot.y === 'number') {
        return { x: first.pivot.x, y: first.pivot.y, source: 'frame.pivot' };
      }
      if (first.anchor && typeof first.anchor.x === 'number' && typeof first.anchor.y === 'number') {
        return { x: first.anchor.x, y: first.anchor.y, source: 'frame.anchor' };
      }
    }
  }

  if (options.manifestAnchor && typeof options.manifestAnchor.x === 'number' && typeof options.manifestAnchor.y === 'number') {
    return { x: options.manifestAnchor.x, y: options.manifestAnchor.y, source: 'manifest.anchor' };
  }

  return null;
}

/**
 * Validates a single Phaser JSON-hash atlas.
 *
 * @param {object|string} atlasInput - Parsed atlas JSON object or file path
 * @param {object} [options={}] - Contextual options
 * @param {string} [options.assetId] - Asset identifier (e.g. 'knight')
 * @param {string} [options.sheetKey] - Sheet key (e.g. 'knight_attack')
 * @param {string} [options.jsonPath] - Relative or absolute path to the atlas json
 * @param {string} [options.kind] - Manifest kind ('characters', 'enemies', 'ambient', 'fx', 'boss')
 * @param {object} [options.manifestAnchor] - Anchor from manifest entry if defined
 * @param {boolean} [options.isMultiPage] - Whether this sheet is part of a multi-page asset
 * @returns {{ valid: boolean, errors: string[], warnings: string[], info: object }}
 */
export function validateAtlas(atlasInput, options = {}) {
  const errors = [];
  const warnings = [];

  let data = atlasInput;
  let jsonPath = options.jsonPath || '';

  if (typeof atlasInput === 'string') {
    jsonPath = jsonPath || atlasInput;
    if (!fs.existsSync(atlasInput)) {
      return {
        valid: false,
        errors: [`Atlas file does not exist: ${atlasInput}`],
        warnings: [],
        info: {}
      };
    }
    try {
      const raw = fs.readFileSync(atlasInput, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      return {
        valid: false,
        errors: [`Failed to parse atlas JSON at ${atlasInput}: ${err.message}`],
        warnings: [],
        info: {}
      };
    }
  }

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Atlas data must be a valid non-null object'],
      warnings: [],
      info: {}
    };
  }

  const sheetKey = options.sheetKey || data.meta?.image?.replace(/\.png$/i, '') || '';
  const assetId = options.assetId || '';
  const kind = options.kind || '';
  const isFx = isFxAtlas(sheetKey, jsonPath, kind);
  const isCritter = isAmbientCritter(sheetKey, jsonPath, kind, assetId);
  const isMultiPage = options.isMultiPage ?? (assetId === 'red_dragon' || sheetKey.startsWith('red_dragon_p'));

  // 1. Frames collection validation
  if (!data.frames || (typeof data.frames !== 'object' && !Array.isArray(data.frames))) {
    errors.push(`Atlas '${sheetKey}' is missing a valid 'frames' map or array`);
    return { valid: false, errors, warnings, info: {} };
  }

  const frameEntries = Array.isArray(data.frames)
    ? data.frames.map((f, i) => [f.filename || `frame_${i}`, f])
    : Object.entries(data.frames);

  if (frameEntries.length === 0) {
    errors.push(`Atlas '${sheetKey}' contains no frames`);
    return { valid: false, errors, warnings, info: {} };
  }

  // 2. Atlas page dimensions <= 4096 px
  const meta = data.meta || {};
  if (meta.size) {
    const { w, h } = meta.size;
    if (typeof w !== 'number' || typeof h !== 'number' || w <= 0 || h <= 0) {
      errors.push(`Atlas '${sheetKey}' has invalid meta.size dimensions: ${w}x${h}`);
    } else {
      if (w > MAX_PAGE_DIMENSION) {
        errors.push(`Atlas '${sheetKey}' width ${w}px exceeds maximum allowed size of ${MAX_PAGE_DIMENSION}px`);
      }
      if (h > MAX_PAGE_DIMENSION) {
        errors.push(`Atlas '${sheetKey}' height ${h}px exceeds maximum allowed size of ${MAX_PAGE_DIMENSION}px`);
      }
    }
  }

  // Also verify frame bounds do not exceed MAX_PAGE_DIMENSION
  for (const [frameName, frameObj] of frameEntries) {
    const rect = frameObj?.frame;
    if (rect) {
      if (rect.w > MAX_PAGE_DIMENSION || rect.h > MAX_PAGE_DIMENSION) {
        errors.push(`Frame '${frameName}' dimensions (${rect.w}x${rect.h}) exceed maximum page dimension ${MAX_PAGE_DIMENSION}px`);
      }
      if (rect.x + rect.w > MAX_PAGE_DIMENSION || rect.y + rect.h > MAX_PAGE_DIMENSION) {
        errors.push(`Frame '${frameName}' bounds exceed maximum page size ${MAX_PAGE_DIMENSION}px`);
      }
    }
  }

  // 3. Anchor present in meta (or pivot/origin)
  const anchor = extractAnchor(data, options);
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    errors.push(`Atlas '${sheetKey}' is missing required anchor in meta (origin/anchor) or frame pivot`);
  }

  // 4. Footprint and hurtbox present in meta for character and enemy atlases
  // (Excludes pure FX sheets, ambient critters)
  const requiresCombatBoxes = !isFx && !isCritter && (kind === 'characters' || kind === 'enemies' || kind === 'boss');
  if (requiresCombatBoxes) {
    const fp = meta.footprint;
    if (!fp || typeof fp.x !== 'number' || typeof fp.y !== 'number' || typeof fp.w !== 'number' || typeof fp.h !== 'number') {
      errors.push(`Atlas '${sheetKey}' is missing required 'footprint' { x, y, w, h } in meta`);
    }

    const hb = meta.hurtbox;
    if (!hb || typeof hb.x !== 'number' || typeof hb.y !== 'number' || typeof hb.w !== 'number' || typeof hb.h !== 'number') {
      errors.push(`Atlas '${sheetKey}' is missing required 'hurtbox' { x, y, w, h } in meta`);
    }
  }

  // 5. Frame-name regex validation (<asset>_<anim>_<dir>_<i>)
  // Gather directions per animation to validate 4 facings or L/R for critters
  const animDirections = new Map(); // animKey -> Set of directions
  const animFrameIndices = new Map(); // animKey -> Set of numeric frame indices

  for (const [frameName] of frameEntries) {
    const dirMatch = frameName.match(DIRECTIONAL_FRAME_REGEX);
    if (dirMatch) {
      const animKey = dirMatch[1];
      const dir = dirMatch[2];
      const indexStr = dirMatch[3];

      if (!VALID_DIRECTIONS.has(dir)) {
        errors.push(`Frame '${frameName}' has invalid direction '${dir}' (expected down, left, right, up)`);
      }

      if (!animDirections.has(animKey)) {
        animDirections.set(animKey, new Set());
      }
      animDirections.get(animKey).add(dir);

      if (indexStr !== undefined) {
        if (!animFrameIndices.has(animKey)) {
          animFrameIndices.set(animKey, new Set());
        }
        animFrameIndices.get(animKey).add(Number(indexStr));
      }
      continue;
    }

    // Check if frame looks directional but has an invalid direction (e.g. north, south, east, west, forward, etc.)
    const candidateDirMatch = frameName.match(/^([a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*)_([a-zA-Z]+)(?:_([0-9]+))?$/);
    if (candidateDirMatch && !isFx) {
      const candDir = candidateDirMatch[2];
      const COMMON_INVALID_DIRS = new Set(['north', 'south', 'east', 'west', 'forward', 'backward', 'back', 'diagonal']);
      if (COMMON_INVALID_DIRS.has(candDir.toLowerCase())) {
        errors.push(`Frame '${frameName}' has invalid direction '${candDir}' (expected down, left, right, up)`);
        continue;
      }
    }

    // Check non-directional frames
    const nonDirMatch = frameName.match(NON_DIRECTIONAL_FRAME_REGEX);
    if (nonDirMatch) {
      const animKey = nonDirMatch[1];
      const index = Number(nonDirMatch[2]);
      if (!animFrameIndices.has(animKey)) {
        animFrameIndices.set(animKey, new Set());
      }
      animFrameIndices.get(animKey).add(index);

      // In non-FX sheets, non-directional frames are permitted if declared in meta.anims (e.g. arrow_impact)
      let isDeclaredNonDir = isFx;
      if (!isDeclaredNonDir && meta.anims && typeof meta.anims === 'object') {
        for (const [aName, aDef] of Object.entries(meta.anims)) {
          if (aDef.frameNames) {
            const regexStr = '^' + aDef.frameNames.replace(/<i>/g, '\\d+').replace(/<dir>/g, '(?:down|left|right|up)') + '$';
            if (new RegExp(regexStr).test(frameName)) {
              if (!aDef.directions || aDef.directions.length === 0) {
                isDeclaredNonDir = true;
                break;
              }
            }
          }
        }
      }

      if (!isDeclaredNonDir) {
        errors.push(`Frame '${frameName}' in entity atlas '${sheetKey}' does not match required directional naming convention '<asset>_<anim>_<dir>_<i>'`);
      }
      continue;
    }

    // If frame matches neither pattern, it is invalid
    errors.push(`Frame '${frameName}' does not match required naming convention '<asset>_<anim>_<dir>_<i>'`);
  }

  // 6. Directions check: 4 directions (down, left, right, up) or declared L/R only for critters
  for (const [animKey, dirs] of animDirections.entries()) {
    if (isCritter) {
      const hasOnlyLR = dirs.size <= 2 && [...dirs].every(d => d === 'left' || d === 'right');
      if (hasOnlyLR) {
        warnings.push(`Critters animation '${animKey}' renders Left/Right only (Phase 1 specification)`);
      } else if (dirs.size < 4) {
        warnings.push(`Critters animation '${animKey}' has partial directions: ${[...dirs].join(', ')}`);
      }
    } else if (!isMultiPage && !isFx) {
      // Regular character/enemy sheets must have all 4 directions for directional animations
      const missing = ['down', 'left', 'right', 'up'].filter(d => !dirs.has(d));
      if (missing.length > 0) {
        errors.push(`Animation '${animKey}' in sheet '${sheetKey}' is missing directions: ${missing.join(', ')} (expected down, left, right, up)`);
      }
    }
  }

  // 7. hitFrames < frame count for attack clips
  function checkHitFrames(animName, animDef, fallbackFrameCount) {
    if (!animDef || typeof animDef !== 'object') return;

    let hitFramesList = [];
    if (Array.isArray(animDef.hitFrames)) {
      hitFramesList = animDef.hitFrames;
    } else if (typeof animDef.hitFrames === 'number') {
      hitFramesList = [animDef.hitFrames];
    } else if (typeof animDef.hitFrame === 'number') {
      hitFramesList = [animDef.hitFrame];
    }

    if (hitFramesList.length === 0) return;

    let totalFrames = animDef.frames;
    if (typeof totalFrames !== 'number' || totalFrames <= 0) {
      totalFrames = fallbackFrameCount;
    }

    if (typeof totalFrames === 'number' && totalFrames > 0) {
      for (const hf of hitFramesList) {
        if (typeof hf !== 'number' || !Number.isInteger(hf)) {
          errors.push(`Animation '${animName}' hitFrame '${hf}' must be an integer`);
        } else if (hf < 0) {
          errors.push(`Animation '${animName}' hitFrame ${hf} cannot be negative`);
        } else if (hf >= totalFrames) {
          errors.push(`Animation '${animName}' hitFrame ${hf} is out of bounds (total frames: ${totalFrames})`);
        }
      }
    }
  }

  if (meta.anims && typeof meta.anims === 'object') {
    for (const [animName, animDef] of Object.entries(meta.anims)) {
      let maxIndex = -1;
      for (const [key, indices] of animFrameIndices.entries()) {
        if (key === animName || key.endsWith(`_${animName}`)) {
          for (const idx of indices) {
            if (idx > maxIndex) maxIndex = idx;
          }
        }
      }
      const fallbackCount = maxIndex >= 0 ? maxIndex + 1 : undefined;
      checkHitFrames(animName, animDef, fallbackCount);
    }
  }

  // Also check attacks sidecar if merged into meta.attacks
  if (meta.attacks?.anims && typeof meta.attacks.anims === 'object') {
    for (const [animName, animDef] of Object.entries(meta.attacks.anims)) {
      let maxIndex = -1;
      for (const [key, indices] of animFrameIndices.entries()) {
        if (key === animName || key.endsWith(`_${animName}`)) {
          for (const idx of indices) {
            if (idx > maxIndex) maxIndex = idx;
          }
        }
      }
      const fallbackCount = maxIndex >= 0 ? maxIndex + 1 : undefined;
      checkHitFrames(animName, animDef, fallbackCount);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info: {
      sheetKey,
      assetId,
      kind,
      frameCount: frameEntries.length,
      anchor,
      pageSize: meta.size || null
    }
  };
}

/**
 * Validates all atlases referenced by a manifest file or object.
 *
 * @param {string|object} [manifestInput=DEFAULT_MANIFEST_PATH] - Manifest path or object
 * @param {object} [options={}] - Custom options (e.g. repoRoot)
 * @returns {{ valid: boolean, totalSheets: number, errors: string[], warnings: string[], results: object }}
 */
export function validateManifest(manifestInput = DEFAULT_MANIFEST_PATH, options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const clientPublicDir = path.join(repoRoot, 'client', 'public');

  let manifest = manifestInput;
  if (typeof manifestInput === 'string') {
    if (!fs.existsSync(manifestInput)) {
      return {
        valid: false,
        totalSheets: 0,
        errors: [`Manifest file does not exist at ${manifestInput}`],
        warnings: [],
        results: {}
      };
    }
    manifest = JSON.parse(fs.readFileSync(manifestInput, 'utf8'));
  }

  if (!manifest || !manifest.assets || typeof manifest.assets !== 'object') {
    return {
      valid: false,
      totalSheets: 0,
      errors: ['Manifest missing required "assets" object'],
      warnings: [],
      results: {}
    };
  }

  const allErrors = [];
  const allWarnings = [];
  const results = {};

  // Collect unique sheets
  const sheetsToValidate = new Map();

  for (const [assetId, asset] of Object.entries(manifest.assets)) {
    const kind = asset.kind || '';

    if (asset.sheets && typeof asset.sheets === 'object') {
      for (const [sKey, sheet] of Object.entries(asset.sheets)) {
        if (!sheet.json) continue;
        const fullJsonPath = path.resolve(clientPublicDir, sheet.json);
        sheetsToValidate.set(fullJsonPath, {
          assetId,
          sheetKey: sKey,
          jsonRel: sheet.json,
          fullPath: fullJsonPath,
          kind,
          imageRel: sheet.image,
          manifestAnchor: sheet.anchor || asset.anchor
        });
      }
    } else if (asset.json) {
      const fullJsonPath = path.resolve(clientPublicDir, asset.json);
      sheetsToValidate.set(fullJsonPath, {
        assetId,
        sheetKey: asset.id || assetId,
        jsonRel: asset.json,
        fullPath: fullJsonPath,
        kind,
        imageRel: asset.image,
        manifestAnchor: asset.anchor
      });
    }
  }

  for (const [fullPath, meta] of sheetsToValidate.entries()) {
    if (!fs.existsSync(fullPath)) {
      const err = `Referenced atlas JSON missing on disk: ${meta.jsonRel} (${fullPath})`;
      allErrors.push(err);
      results[meta.sheetKey] = {
        valid: false,
        errors: [err],
        warnings: [],
        info: meta
      };
      continue;
    }

    // Verify corresponding image file exists
    if (meta.imageRel) {
      const fullImagePath = path.resolve(clientPublicDir, meta.imageRel);
      if (!fs.existsSync(fullImagePath)) {
        const err = `Referenced atlas image missing on disk: ${meta.imageRel} (${fullImagePath})`;
        allErrors.push(err);
      }
    }

    const checkResult = validateAtlas(fullPath, {
      assetId: meta.assetId,
      sheetKey: meta.sheetKey,
      jsonPath: meta.jsonRel,
      kind: meta.kind,
      manifestAnchor: meta.manifestAnchor
    });

    results[meta.sheetKey] = checkResult;

    if (!checkResult.valid) {
      for (const err of checkResult.errors) {
        allErrors.push(`[${meta.sheetKey}] ${err}`);
      }
    }
    for (const warn of checkResult.warnings) {
      allWarnings.push(`[${meta.sheetKey}] ${warn}`);
    }
  }

  return {
    valid: allErrors.length === 0,
    totalSheets: sheetsToValidate.size,
    errors: allErrors,
    warnings: allWarnings,
    results
  };
}

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const target = process.argv[2];
  let res;

  if (target && target.endsWith('.json') && !target.endsWith('manifest.json')) {
    console.log(`Checking single atlas: ${target}`);
    res = validateAtlas(path.resolve(target));
    console.log(`Result: ${res.valid ? 'VALID' : 'INVALID'}`);
    if (res.warnings.length > 0) {
      console.warn(`Warnings (${res.warnings.length}):`);
      res.warnings.forEach(w => console.warn(`  - ${w}`));
    }
    if (res.errors.length > 0) {
      console.error(`Errors (${res.errors.length}):`);
      res.errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
    process.exit(0);
  }

  const manifestPath = target ? path.resolve(target) : DEFAULT_MANIFEST_PATH;
  console.log(`Checking manifest assets from: ${manifestPath}`);
  res = validateManifest(manifestPath);

  console.log(`\n======================================================`);
  console.log(`[Asset Checker] Validated ${res.totalSheets} atlas sheets`);
  console.log(`Status: ${res.valid ? 'ALL VALID' : 'FAILED'}`);
  console.log(`Errors: ${res.errors.length}`);
  console.log(`Warnings: ${res.warnings.length}`);
  console.log(`======================================================\n`);

  if (res.warnings.length > 0) {
    console.warn(`Warnings:`);
    res.warnings.forEach(w => console.warn(`  [WARN] ${w}`));
    console.log('');
  }

  if (res.errors.length > 0) {
    console.error(`Errors:`);
    res.errors.forEach(e => console.error(`  [ERROR] ${e}`));
    console.log('');
    process.exit(1);
  }

  process.exit(0);
}
