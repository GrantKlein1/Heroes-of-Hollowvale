# Unregistered Tiled maps

`client/src/game/maps/mapRegistry.js` (`DEFAULT_MAPS`) lists the Tiled maps the game can load. Three maps in `client/public/maps/` are **not** in it:

| File | What it is | Why it is not registered |
| --- | --- | --- |
| `wilderness.tmj` | 20x34 reference render of the Ember Road corridor from `tools/maps/generate_tmj.mjs`. | The live wilderness is procedural (`client/src/game/terrain/*`). `HollowvaleScene.enterScene` skips the registry for the id `wilderness`, and `mapRegistry.test.js` asserts `resolveMap('wilderness')` is undefined. |
| `hearthmile.tmj` | 20x12 league (0,4) road bend with the Hearthmile Stone (landmark, canon in `newLore_expanded.txt`). Exits: north to `wilderness.tmj`, west to `ruinwatch.tmj`. | Its only inbound link is `wilderness.tmj` `exit_south`, which the procedural wilderness never uses. Registering it alone would not make it reachable. |
| `ruinwatch.tmj` | 20x12 Ruinwatch camp (canon: a stone ring and campsite on the Ember Road). Exit: east to `hearthmile.tmj`. | Its only inbound link is `hearthmile.tmj`. |

Both maps pass `validateMap` with 0 errors (see `generate_tmj.test.js`), so they are valid, just not wired in.

## Making them reachable

1. Add `hearthmile` and `ruinwatch` entries to `DEFAULT_MAPS` (assetGroups `['village']`, like Brackenford) and update the "7 canonical maps" count in `mapRegistry.test.js`.
2. Give the procedural wilderness a south exit that calls `enterScene('hearthmile', ...)` in `HollowvaleScene.js`, and add the matching `SCENE_HINTS` entries in `sceneCatalog.js`.
3. Remove the files from `KNOWN_UNREGISTERED` in `client/src/game/maps/__tests__/unregisteredMaps.test.js`.

Step 2 needs `HollowvaleScene.js`, which was out of scope for MAPS-1.

## Guard test

`unregisteredMaps.test.js` fails if a new `.tmj` appears in `client/public/maps` that is neither registered nor listed in `KNOWN_UNREGISTERED`, so maps cannot be orphaned silently.
