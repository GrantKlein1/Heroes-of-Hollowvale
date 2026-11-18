# Art pipeline (Blendsmith → Phaser)

Shipped character, enemy, effect, and tile art comes from Blendsmith under `art-source/blendsmith/`. This repo does not draw those sheets. The importer is `tools/assets/import_blendsmith.mjs`. From the repo root it is:

```
npm run assets:import
```

The importer reads `art-source/blendsmith/` and writes Phaser 3 JSON-hash atlases under `client/public/assets/`. The client loads those sheets with `scene.load.atlas` in `client/src/game/assets/AssetRegistry.js`.

The contract is [`docs/ASSET_SPEC.md`](ASSET_SPEC.md): frame names `<asset>_<anim>_<dir>_<i>`, **32 px** tiles, four facings (`down`, `left`, `right`, `up`), and a per-sheet anchor. Anchors differ by sheet. Read each anchor from that atlas's `meta`. The importer also accepts a frame pivot when `meta` has no origin.

`art-source/blendsmith/` is read-only in this repo. Leave `frames/`, `render_hi/`, 4× masters, `*_bak*`, previews, `.blend`, and `.glb` out of `client/public/`.

## Tiles

World tiles are 32 px. Tiled maps (`.tmj`) live under `client/public/maps/`. Runtime tilesets live under `client/public/assets/tiles/`. Wang sets, prop anchors, and the 12° camera are in `docs/ASSET_SPEC.md` (Tiles).

## Legacy painted images

Painted scene images the game no longer draws are kept under `art-source/legacy-public/`, on the path they had under `client/public/` (for example `art-source/legacy-public/images/bossFightEmptyRoom.png`). The audit notes are `docs/public-audit-2026-11-17.md` (`node tools/assets/audit_public_refs.mjs`).

Package 3-4 (PR #89) removed the painted renderer and the maps opt-out. Any `renderer` or `maps` query value is ignored. The game uses Blendsmith atlases and Tiled maps, including when the URL contains `?renderer=legacy` or `?maps=legacy`.
