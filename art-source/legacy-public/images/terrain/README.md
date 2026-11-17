# Terrain sprite assets

Place transparent PNGs here using:

`{tile_type}_{version?}_{connections?}_{W}x{H}.png`

Examples currently in use:

- `grass_version1_16x16.png` / `grass_version2_16x16.png` — grass variants
- `path_top_bottom_16x16.png` — straight N–S (rotate 90° for E–W)
- `path_top_right_16x16.png` — corner (rotate for other corners)
- `path_top_right_bottom_16x16.png` — T-junction (rotate for other T’s)
- `path_top_right_bottom_left_16x16.png` — four-way cross

See `client/src/config/terrainAssets.js` for the live manifest.
