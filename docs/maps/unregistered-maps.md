# Unregistered Tiled maps

`client/src/game/maps/mapRegistry.js` (`DEFAULT_MAPS`) lists the Tiled maps the game can load. One map in `client/public/maps/` is **not** in it:

| File | What it is | Why it is not registered |
| --- | --- | --- |
| `wilderness.tmj` | 20x34 reference render of the Ember Road corridor from `tools/maps/generate_tmj.mjs`. | The live wilderness is procedural (`client/src/game/terrain/*`). `HollowvaleScene.enterScene` skips the registry for the id `wilderness`, and `mapRegistry.test.js` asserts `resolveMap('wilderness')` is undefined. |

`hearthmile.tmj` and `ruinwatch.tmj` are registered with `assetGroups: ['village']`, the same group as Brackenford.

## How the road is wired

The procedural wilderness does not load `wilderness.tmj`. Its south exit is the south path mouth of the entrance screen (`wild_0_0`, `HEARTHMILE_GATE` in `client/src/game/terrain/wildernessBridge.js`). Walking out of that corridor calls `enterScene('hearthmile', { targetSpawn: 'spawn_north' })`.

Hearthmile's north exit still targets `wilderness.tmj` / `spawn_south`. That name is not a registered map, so the exit returns to the procedural wilderness and places the hero on the same south path, inset from the edge so the crossing does not fire again. Hearthmile's west exit and Ruinwatch's east exit use the spawns already in the `.tmj` files (`spawn_east` and `spawn_west`).

## Guard test

`unregisteredMaps.test.js` fails if a new `.tmj` appears in `client/public/maps` that is neither registered nor listed in `KNOWN_UNREGISTERED`, so maps cannot be orphaned silently.
