import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const mapsDir = path.join(repoRoot, 'client/public/maps');
const CAVERN_MAPS = ['cavern_mouth.tmj', 'cavern_halls.tmj', 'cavern_treasure.tmj', 'cavern_lair.tmj'];

function snapshotMaps() {
  return Object.fromEntries(CAVERN_MAPS.map((name) => {
    const filePath = path.join(mapsDir, name);
    const stat = fs.statSync(filePath);
    return [name, { mtimeMs: stat.mtimeMs, bytes: fs.readFileSync(filePath) }];
  }));
}

describe('CV-1 cavern generator', () => {
  it('checks committed cavern maps in memory and does not write them', () => {
    const before = snapshotMaps();
    const result = spawnSync(process.execPath, ['tools/maps/build_cavern.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const after = snapshotMaps();
    for (const name of CAVERN_MAPS) {
      expect(after[name].mtimeMs).toBe(before[name].mtimeMs);
      expect(Buffer.compare(after[name].bytes, before[name].bytes)).toBe(0);
    }
  });
});
