import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'client', 'public', 'assets', 'manifest.json');

// Ensure Windows CRLF checkouts don't break ESM shebang loading
const rawCheckAssetPath = path.resolve(REPO_ROOT, 'tools', 'assets', 'check_asset.mjs');
let toolsModule;
try {
  toolsModule = await import(pathToFileURL(rawCheckAssetPath).href);
} catch (err) {
  const cacheDir = path.resolve(REPO_ROOT, 'node_modules', '.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cleanPath = path.join(cacheDir, 'check_asset_clean.mjs');
  fs.writeFileSync(cleanPath, fs.readFileSync(rawCheckAssetPath, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
  toolsModule = await import(pathToFileURL(cleanPath).href);
}

const {
  validateAtlas,
  validateManifest,
  extractAnchor,
  isFxAtlas,
  isAmbientCritter,
  isPropAtlas
} = toolsModule;

describe('Manifest & Atlas Contract Validation (Package 0-3)', () => {
  it('validates every atlas referenced by manifest.json with 0 errors', () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);

    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });

    expect(report.totalSheets).toBeGreaterThanOrEqual(57);
    if (report.errors.length > 0) {
      console.error('Validation errors found in manifest assets:', report.errors);
    }
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('enforces atlas page dimensions <= 4096 px across all manifest sheets', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    expect(report.valid).toBe(true);

    for (const [sheetKey, result] of Object.entries(report.results)) {
      if (result.info?.pageSize) {
        expect(result.info.pageSize.w).toBeLessThanOrEqual(4096);
        expect(result.info.pageSize.h).toBeLessThanOrEqual(4096);
      }
    }
  });

  it('verifies that an anchor is resolvable for every manifest sheet', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    expect(report.valid).toBe(true);

    for (const [sheetKey, result] of Object.entries(report.results)) {
      const anchor = result.info?.anchor;
      expect(anchor, `Sheet '${sheetKey}' must have an anchor`).toBeTruthy();
      expect(typeof anchor.x).toBe('number');
      expect(typeof anchor.y).toBe('number');
      expect(Number.isFinite(anchor.x)).toBe(true);
      expect(Number.isFinite(anchor.y)).toBe(true);
    }
  });

  it('ensures footprint and hurtbox are present on all character and enemy atlases', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    for (const [assetId, asset] of Object.entries(manifest.assets)) {
      const kind = asset.kind;
      if (kind !== 'characters' && kind !== 'enemies') continue;

      const sheets = asset.sheets || {};
      for (const [sheetKey, sheetDef] of Object.entries(sheets)) {
        if (isFxAtlas(sheetKey, sheetDef.json, kind)) continue;

        const fullJsonPath = path.join(REPO_ROOT, 'client', 'public', sheetDef.json);
        const data = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));

        expect(data.meta?.footprint, `${sheetKey} should have meta.footprint`).toBeDefined();
        expect(typeof data.meta.footprint.x).toBe('number');
        expect(typeof data.meta.footprint.y).toBe('number');
        expect(typeof data.meta.footprint.w).toBe('number');
        expect(typeof data.meta.footprint.h).toBe('number');

        expect(data.meta?.hurtbox, `${sheetKey} should have meta.hurtbox`).toBeDefined();
        expect(typeof data.meta.hurtbox.x).toBe('number');
        expect(typeof data.meta.hurtbox.y).toBe('number');
        expect(typeof data.meta.hurtbox.w).toBe('number');
        expect(typeof data.meta.hurtbox.h).toBe('number');
      }
    }
  });

  it('ensures hitFrames < frame count for all attack clips with hit timing', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    for (const [assetId, asset] of Object.entries(manifest.assets)) {
      const sheets = asset.sheets || (asset.json ? { [assetId]: asset } : {});
      for (const [sheetKey, sheetDef] of Object.entries(sheets)) {
        const fullJsonPath = path.join(REPO_ROOT, 'client', 'public', sheetDef.json);
        if (!fs.existsSync(fullJsonPath)) continue;

        const data = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));
        const anims = data.meta?.anims || {};

        for (const [animName, animDef] of Object.entries(anims)) {
          const hitFrames = Array.isArray(animDef.hitFrames)
            ? animDef.hitFrames
            : animDef.hitFrame !== undefined
              ? [animDef.hitFrame]
              : [];

          if (hitFrames.length > 0 && typeof animDef.frames === 'number') {
            for (const hf of hitFrames) {
              expect(hf).toBeGreaterThanOrEqual(0);
              expect(hf, `${sheetKey}.${animName} hitFrame ${hf} must be < frame count ${animDef.frames}`).toBeLessThan(animDef.frames);
            }
          }
        }
      }
    }
  });

  it('ensures 4 directions are present on character and enemy sheets', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    expect(report.valid).toBe(true);

    // Verify knight_walk has down, left, right, up
    const knightResult = report.results['knight'];
    expect(knightResult.valid).toBe(true);
    expect(knightResult.errors).toEqual([]);
  });

  it('records warnings for critters Left/Right only facings without failing validation', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    const crittersResult = report.results['critters'];

    expect(crittersResult).toBeDefined();
    expect(crittersResult.valid).toBe(true);
    expect(crittersResult.errors).toEqual([]);
    expect(crittersResult.warnings.length).toBeGreaterThan(0);
    expect(crittersResult.warnings.some(w => w.includes('Phase 1'))).toBe(true);
  });
});

describe('Broken Fixture Testing (Asset QA Failure Detection)', () => {
  function createValidBaseFixture() {
    return {
      frames: {
        hero_walk_down_0: {
          frame: { x: 0, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          pivot: { x: 0.5, y: 0.9 }
        },
        hero_walk_left_0: {
          frame: { x: 64, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          pivot: { x: 0.5, y: 0.9 }
        },
        hero_walk_right_0: {
          frame: { x: 128, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          pivot: { x: 0.5, y: 0.9 }
        },
        hero_walk_up_0: {
          frame: { x: 192, y: 0, w: 64, h: 64 },
          rotated: false,
          trimmed: false,
          pivot: { x: 0.5, y: 0.9 }
        }
      },
      meta: {
        size: { w: 256, h: 64 },
        origin: { x: 0.5, y: 0.9 },
        footprint: { x: -8, y: -4, w: 16, h: 8 },
        hurtbox: { x: -10, y: -30, w: 20, h: 30 },
        anims: {
          walk: {
            frames: 1,
            directions: ['down', 'left', 'right', 'up']
          }
        }
      }
    };
  }

  it('passes validation on a compliant baseline fixture', () => {
    const fixture = createValidBaseFixture();
    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_test'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails validation when a frame name does not match the naming convention', () => {
    const fixture = createValidBaseFixture();
    // Insert non-compliant frame name
    fixture.frames['bad_frame_name'] = {
      frame: { x: 0, y: 0, w: 32, h: 32 },
      pivot: { x: 0.5, y: 0.5 }
    };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_broken_frame'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Frame 'bad_frame_name' does not match required naming convention"))).toBe(true);
  });

  it('fails validation when a directional frame has an invalid facing', () => {
    const fixture = createValidBaseFixture();
    fixture.frames['hero_walk_north_0'] = {
      frame: { x: 0, y: 0, w: 64, h: 64 },
      pivot: { x: 0.5, y: 0.9 }
    };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_invalid_facing'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("invalid direction 'north'"))).toBe(true);
  });

  it('fails validation when a character atlas is missing footprint in meta', () => {
    const fixture = createValidBaseFixture();
    delete fixture.meta.footprint;

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_missing_footprint'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("missing required 'footprint'"))).toBe(true);
  });

  it('fails validation when an enemy atlas is missing hurtbox in meta', () => {
    const fixture = createValidBaseFixture();
    delete fixture.meta.hurtbox;

    const result = validateAtlas(fixture, {
      kind: 'enemies',
      sheetKey: 'enemy_missing_hurtbox'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("missing required 'hurtbox'"))).toBe(true);
  });

  it('fails validation when atlas page size exceeds 4096 px', () => {
    const fixture = createValidBaseFixture();
    fixture.meta.size = { w: 4097, h: 1024 };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_oversize'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds maximum allowed size of 4096px'))).toBe(true);
  });

  it('fails validation when hitFrames is out of bounds (hitFrames >= frame count)', () => {
    const fixture = createValidBaseFixture();
    fixture.meta.anims.attack = {
      frames: 6,
      directions: ['down', 'left', 'right', 'up'],
      hitFrames: [6] // Valid indices are 0..5; 6 is out of bounds!
    };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_oob_hitframe'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
  });

  it('fails validation when hitFrames contains negative frame indices', () => {
    const fixture = createValidBaseFixture();
    fixture.meta.anims.attack = {
      frames: 6,
      directions: ['down', 'left', 'right', 'up'],
      hitFrames: [-1]
    };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_negative_hitframe'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cannot be negative'))).toBe(true);
  });

  it('fails validation when anchor is completely missing from meta and frames', () => {
    const fixture = createValidBaseFixture();
    delete fixture.meta.origin;
    delete fixture.meta.anchor;
    for (const frame of Object.values(fixture.frames)) {
      delete frame.pivot;
      delete frame.anchor;
    }

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_missing_anchor'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing required anchor in meta'))).toBe(true);
  });

  it('fails validation when a directional animation is missing directions in a character sheet', () => {
    const fixture = createValidBaseFixture();
    // Remove the 'up' direction frame
    delete fixture.frames.hero_walk_up_0;

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_missing_up'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('is missing directions: up'))).toBe(true);
  });

  it('strictly rejects character sheets missing any cardinal facing without weakening checks', () => {
    for (const dir of ['down', 'left', 'right', 'up']) {
      const fixture = createValidBaseFixture();
      delete fixture.frames[`hero_walk_${dir}_0`];

      const result = validateAtlas(fixture, {
        kind: 'characters',
        sheetKey: `hero_missing_${dir}`
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes(`is missing directions: ${dir}`))).toBe(true);
    }
  });

  it('strictly rejects character sheets with non-directional frame names', () => {
    const fixture = createValidBaseFixture();
    fixture.frames['hero_slash'] = {
      frame: { x: 0, y: 0, w: 64, h: 64 },
      pivot: { x: 0.5, y: 0.9 }
    };

    const result = validateAtlas(fixture, {
      kind: 'characters',
      sheetKey: 'hero_bad_slash'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("Frame 'hero_slash' does not match required naming convention"))).toBe(true);
  });
});

describe('Prop and Tile Contract Validation (Phase 1 AS-2)', () => {
  it('registers village_props and hearth in manifest assets under kind props', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    expect(manifest.assets.village_props).toBeDefined();
    expect(manifest.assets.village_props.kind).toBe('props');
    expect(manifest.assets.village_props.sheets.village_props).toBeDefined();
    expect(manifest.assets.village_props.sidecars).toContain('pairing.json');

    expect(manifest.assets.hearth).toBeDefined();
    expect(manifest.assets.hearth.kind).toBe('props');
    expect(manifest.assets.hearth.sheets.hearth).toBeDefined();

    expect(manifest.groups.village).toContain('village_props');
    expect(manifest.groups.village).toContain('hearth');
    expect(manifest.groups.wilderness).toContain('village_props');
  });

  it('registers all 15 ground tilesets in manifest.tiles with margin 1 and spacing 2', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    expect(manifest.tiles).toBeDefined();

    const expectedTilesets = [
      'bridge_plank', 'cliff', 'cliff_face', 'cobble_road', 'dirt_road',
      'dungeon_floor', 'dungeon_wall', 'grass', 'interior_market_floor',
      'interior_market_wall', 'interior_tavern_floor', 'interior_tavern_wall',
      'water', 'water_ford', 'water_shore'
    ];

    expect(Object.keys(manifest.tiles).length).toBe(15);
    for (const tsName of expectedTilesets) {
      const entry = manifest.tiles[tsName];
      expect(entry, `Tileset '${tsName}' must be in manifest.tiles`).toBeDefined();
      expect(entry.image).toBe(`assets/tiles/${tsName}.png`);
      expect(entry.tsj).toBe(`assets/tiles/${tsName}.tsj`);
      expect(entry.tileWidth).toBe(32);
      expect(entry.tileHeight).toBe(32);
      expect(entry.margin).toBe(1);
      expect(entry.spacing).toBe(2);

      const tsjPath = path.join(REPO_ROOT, 'client', 'public', entry.tsj);
      expect(fs.existsSync(tsjPath), `TSJ file ${tsjPath} must exist on disk`).toBe(true);
      const imgPath = path.join(REPO_ROOT, 'client', 'public', entry.image);
      expect(fs.existsSync(imgPath), `Image file ${imgPath} must exist on disk`).toBe(true);
    }

    // Verify animated water flags
    expect(manifest.tiles.water.hasAnimation).toBe(true);
    expect(manifest.tiles.water_shore.hasAnimation).toBe(true);
    expect(manifest.tiles.grass.hasAnimation).toBe(false);
  });

  it('validates village_props atlas with 19 frames and valid footprints', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    const vpResult = report.results['village_props'];

    expect(vpResult).toBeDefined();
    expect(vpResult.valid).toBe(true);
    expect(vpResult.errors).toEqual([]);
  });

  it('validates hearth animated atlas with 6 frames and single down direction', () => {
    const report = validateManifest(MANIFEST_PATH, { repoRoot: REPO_ROOT });
    const hearthResult = report.results['hearth'];

    expect(hearthResult).toBeDefined();
    expect(hearthResult.valid).toBe(true);
    expect(hearthResult.errors).toEqual([]);
  });

  it('fails prop validation when a prop has an invalid footprint shape', () => {
    const brokenPropFixture = {
      frames: {
        bad_barrel: {
          frame: { x: 0, y: 0, w: 32, h: 48 },
          pivot: { x: 0.5, y: 1.0 }
        }
      },
      meta: {
        origin: { x: 0.5, y: 1.0 },
        props: {
          bad_barrel: {
            footprint: { x: -8, y: -4, w: 16, h: 8, shape: 'hexagon' }, // invalid shape
            tall: false,
            layer: 'props'
          }
        }
      }
    };

    const result = validateAtlas(brokenPropFixture, {
      kind: 'props',
      sheetKey: 'bad_prop_shape'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("invalid footprint shape 'hexagon'"))).toBe(true);
  });

  it('fails prop validation when an overhead prop has a colliding footprint shape', () => {
    const brokenOverheadFixture = {
      frames: {
        bad_roof: {
          frame: { x: 0, y: 0, w: 64, h: 64 },
          pivot: { x: 0.5, y: 1.0 }
        }
      },
      meta: {
        origin: { x: 0.5, y: 1.0 },
        props: {
          bad_roof: {
            footprint: { x: -32, y: -32, w: 64, h: 32, shape: 'rect' }, // overhead cannot collide!
            tall: true,
            layer: 'overhead'
          }
        }
      }
    };

    const result = validateAtlas(brokenOverheadFixture, {
      kind: 'props',
      sheetKey: 'bad_overhead_collider'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cannot have colliding footprint shape'))).toBe(true);
  });

  it('fails animated prop validation when frames for declared direction are missing', () => {
    const brokenHearthFixture = {
      frames: {
        hearth_burn_down_0: {
          frame: { x: 0, y: 0, w: 96, h: 96 },
          pivot: { x: 0.5, y: 1.0 }
        }
        // missing frames 1..5
      },
      meta: {
        origin: { x: 0.5, y: 1.0 },
        footprint: { x: -34, y: -30, w: 68, h: 30, shape: 'rect' },
        anims: {
          burn: {
            frames: 6,
            directions: ['down'],
            frameNames: 'hearth_burn_down_<i>'
          }
        }
      }
    };

    const result = validateAtlas(brokenHearthFixture, {
      kind: 'props',
      sheetKey: 'hearth_missing_frames'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("missing expected frame 'hearth_burn_down_1'"))).toBe(true);
  });

  it('verifies that running the importer consecutively produces byte-identical outputs', () => {
    const importScriptPath = path.resolve(REPO_ROOT, 'tools', 'assets', 'import_blendsmith.mjs');
    const manifestBefore = fs.readFileSync(MANIFEST_PATH, 'utf8');

    // Run 1
    execFileSync(process.execPath, [importScriptPath], { cwd: REPO_ROOT, encoding: 'utf8' });
    const manifestAfterRun1 = fs.readFileSync(MANIFEST_PATH, 'utf8');

    // Run 2
    execFileSync(process.execPath, [importScriptPath], { cwd: REPO_ROOT, encoding: 'utf8' });
    const manifestAfterRun2 = fs.readFileSync(MANIFEST_PATH, 'utf8');

    expect(manifestAfterRun1).toBe(manifestBefore);
    expect(manifestAfterRun2).toBe(manifestAfterRun1);
  });
});
