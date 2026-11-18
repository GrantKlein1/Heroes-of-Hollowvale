# AS-2 v4 manifest
AS-2 v5 visual swap (approved by Grant 2026-11-09): 6 PNGs replaced, all metadata unchanged.
TILES-SWAP-1 (Batch 11 natural outdoor tiles, package A, approved by Grant 2026-11-18): 12 outdoor ground PNGs replaced (ash_fill, ash_ground, bridge_plank, cliff, cliff_face, cobble_road, dirt_road, forest_floor, grass, water, water_ford, water_shore); tsj, ids, collides unchanged. forest_floor PNG later replaced with the calmer approved-and-frozen version (Grant 2026-11-18); tsj unchanged. Byte and SHA rows below are updated for rows that exist; ash_fill and ash_ground have no rows in this older table.

TILES-VARIANTS (Batch 11 package B, append-only, approved by Grant 2026-11-18): the six package B tilesets replace the package A files in client/public/assets/tiles and this mirror (PNG + tsj). Existing ids keep their meaning and art; only ids are added: cliff 16-23 (straight-run alternates, collide), cliff_face 4-7 (cap_left, cap_right, two variants, collide), dirt_road 16-23 (alternates), water 64-95 (alternates 64-71 with animation frames 72-95), water_shore 64-78 (sand to grass blend, grassMask = id - 63), forest_floor 8-22 (forest to grass blend, grassMask = id - 7, plus the forest_floor_blob16 corner wangset). Tilecounts: cliff 16->24, cliff_face 4->8, dirt_road 16->24, water 64->96, water_shore 64->79, forest_floor 8->23. Byte and SHA rows below are for the package B files (source /workspace/blender/hollowvale/tiles_b11/packageB/ground, sha256 of forest_floor.png 5a8f374c..., water_shore.png 40db07e8..., checked against the Blendsmith MANIFEST). The Atlas table above shows the new ID ranges and image sizes. The "Unique art" column is the package A count and was not recomputed.

LOCAL art scope complete; not game-integrated or approved.
15 tilesets,222 tile IDs,20 logical props. No character asset changes.

## Ground / static cell anchors: top-left grid cell
| Atlas | Image px | IDs | Unique art | Anim | PNG bytes | TSJ bytes |
|---|---|---|---:|---|---:|---:|
| ground/bridge_plank | 136x34 | 0..3 | 4 | none | 1072 | 2572 |
| ground/cliff | 136x204 | 0..23 | 16 | none | 11487 | 28059 |
| ground/cliff_face | 136x68 | 0..7 | 4 | none | 4466 | 4435 |
| ground/cobble_road | 136x136 | 0..15 | 16 | none | 6345 | 18173 |
| ground/dirt_road | 136x204 | 0..23 | 16 | none | 10927 | 28095 |
| ground/dungeon_floor | 102x68 | 0..5 | 6 | none | 1006 | 3288 |
| ground/dungeon_wall | 136x34 | 0..3 | 4 | none | 292 | 2568 |
| ground/forest_floor | 136x204 | 0..22 | 8 | none | 13598 | 15683 |
| ground/grass | 136x68 | 0..7 | 8 | none | 2982 | 3986 |
| ground/interior_market_floor | 136x34 | 0..3 | 4 | none | 584 | 2590 |
| ground/interior_market_wall | 136x34 | 0..3 | 4 | none | 443 | 2584 |
| ground/interior_tavern_floor | 136x34 | 0..3 | 4 | none | 526 | 2590 |
| ground/interior_tavern_wall | 136x34 | 0..3 | 4 | none | 405 | 2584 |
| ground/water | 136x816 | 0..95 | 61 | wet1..15:4x160ms | 52096 | 100547 |
| ground/water_ford | 136x34 | 0..3 | 4 | none | 1802 | 2568 |
| ground/water_shore | 136x680 | 0..78 | 61 | wet1..15:4x160ms | 38774 | 74625 |

## Prop atlases
| Atlas | Image px | Frames | Origin | Anims | PNG bytes | JSON bytes |
|---|---|---:|---|---|---:|---:|
| props/village_props | 902x418 | 19 | 0.5,1.0 | static | 14872 | 16819 |
| props/hearth | 576x96 | 6 | 0.5,1.0 | burn6@8fps loop | 2571 | 3090 |

| Prop | Canvas | Footprint x,y,w,h,shape | Layer |
|---|---|---|---|
| barrel | 32x48 | -10.0,-12,20,12,ellipse | props |
| bush_a | 48x48 | -10.0,-10,20,10,ellipse | props |
| bush_b | 40x48 | -12.0,-12,24,12,ellipse | props |
| cottage_base | 160x176 | -58.0,-70,116,70,rect | props |
| cottage_roof | 160x176 | 0,0,0,0,none | overhead |
| crate | 32x48 | -10.0,-12,20,12,rect | props |
| fence_corner | 48x48 | -7.0,-14,14,14,rect | props |
| fence_h | 48x48 | -14.0,-8,28,8,rect | props |
| fence_v | 32x48 | -4.0,-24,8,24,rect | props |
| rock_a | 48x48 | -12.0,-12,24,12,ellipse | props |
| rock_b | 40x48 | -14.0,-14,28,14,ellipse | props |
| tavern_base | 192x208 | -74.0,-86,148,86,rect | props |
| tavern_roof | 192x208 | 0,0,0,0,none | overhead |
| torch | 32x64 | -4.0,-8,8,8,rect | props |
| tree_oak_base | 144x144 | -12.0,-12,24,12,ellipse | props |
| tree_oak_canopy | 144x144 | 0,0,0,0,none | overhead |
| tree_pine_base | 128x160 | -10.0,-12,20,12,ellipse | props |
| tree_pine_canopy | 128x160 | 0,0,0,0,none | overhead |
| well | 64x96 | -14.0,-20,28,20,ellipse | props |
| hearth | 96x96 per frame | -34,-30,68,30,rect | props |

## Runtime file sizes and SHA256
MANIFEST.md itself excluded to avoid self-reference.
| File | bytes | SHA256 |
|---|---:|---|
| DRAFT.txt | 150 | 77fe004c71efe6562da5e67b0989d1f2d9f7d8758658ba71ff01750616bd9e6a |
| QA_REPORT.json | 1494181 | 600619d70aff675b28090c6ef221eeea4b795425fb6ac450fdaaf8ef5b43e6f4 |
| QA_REPORT.md | 4830 | d52d4f0d0c2a780f4f4f5ff5b65ca13cc9bd351070f69cb0da627fd3d7f41b10 |
| README.md | 5106 | 35bffe0a8f20549b54b69580ce75b9d6c24094986893cea648b3e268c83ebcc0 |
| SHOT_LIST.md | 1960 | 70ffa6d651a4c542fa34de6402ef5af73f10c906f4f0384f62b638b32eb6e620 |
| SOURCE_PROVENANCE.json | 160051 | ab24ca7c7ea6273d87d3bbfaea9b6df13e80ff1f68f166893cb9021e7becfa4f |
| ground/bridge_plank.png | 1072 | a2f7b5bbdadb2527fd09bebc4a121c28b261dd5a49b79d99b0a116c7b1ade709 |
| ground/bridge_plank.tsj | 2572 | 59c05a95882be003a7cebffe52875a6a99a992fd29495ace8d169640a0299cae |
| ground/cliff.png | 11487 | 91c10148c81a71ee15dcc4f4626386e0cff53ecc1112f6437e13c749f8b2433e |
| ground/cliff.tsj | 28059 | c7bd72be7ed47aed6101d2188a919118d0cb459f957bd04165b7be9be2ca7d0a |
| ground/cliff_face.png | 4466 | 706e0b0f4f21c2f52643c37f64065ce38f59a346dfa97a5644cef4aa95587d5c |
| ground/cliff_face.tsj | 4435 | a18f2543769c94b93968062433243627102a52c45ec24a9b677184e0c5f972a9 |
| ground/cobble_road.png | 6345 | 589facf18909378c2888a3dc5c9dc40e12674c3e57f6d328fb51188c23ed1b50 |
| ground/cobble_road.tsj | 18173 | e14764c031496a906bd78aa968b5cd841d55af05ddcbb74f425d0ac8389ec21b |
| ground/dirt_road.png | 10927 | 9cc822fc8babe169f0c1ee3fdb38cc2f02b635e21a0cf829576d03d050996ebe |
| ground/dirt_road.tsj | 28095 | dace721f99f6e220c5c09b794fe8a0a715bbb7b32547f4a70417b19e92960810 |
| ground/dungeon_floor.png | 1006 | b792ec95e4b99e1cde20642cea16eb6d2df6b1537de47f7b2f74dafd5c99eded |
| ground/dungeon_floor.tsj | 3288 | aa685e7ebbb469bab852b00107efd0877ba41e4fe46d41d3f25e7aae44212a35 |
| ground/dungeon_wall.png | 292 | b0e3a4a4705fe945dbdc21c08ba8829d8ff1242cabb73679ee8d3550906bd1ca |
| ground/dungeon_wall.tsj | 2568 | 4358a559afc8271dddc85412e08bf479b77780f2031976b9ec5cb36102259132 |
| ground/forest_floor.png | 13598 | 5a8f374c2ac2221a7f19d3848db50eb8230a0697d0643369f67c341f400eb9c7 |
| ground/forest_floor.tsj | 15683 | c83b1ea2700752363a9789fb8c377d669bc79cee9f4c3c5c0eabe3db0f056aed |
| ground/grass.png | 2982 | 73a8f6ba400593271c6e3e5ef765a52406f283d44ea62247ee060ce699f23c64 |
| ground/grass.tsj | 3986 | 6629ad7f81cec7c4534d15c70c0e226b6fbad71d74c923ad71ae03f773faddbb |
| ground/interior_market_floor.png | 584 | 014905f5d28d87af37750c98b61d91f6934a0cf4ccf61340be51da887e07292d |
| ground/interior_market_floor.tsj | 2590 | 2ec7162023ed2f4f024b4cd63887e0e713a1feb3eeefb7d7ff913bbfb4bea16d |
| ground/interior_market_wall.png | 443 | f00675360e7b0bcc3151b6c554344321e9159ff347ddaa3b92b35bcad56341ec |
| ground/interior_market_wall.tsj | 2584 | 5185184d320f3e30ca0071f764408d6a421f18e7555d71512ce30b4656c71f3c |
| ground/interior_tavern_floor.png | 526 | 6e0cab777d77df6996ce5edfe6e06732cd2bbee9c6cb36ce601e5478c49946dc |
| ground/interior_tavern_floor.tsj | 2590 | f444ba46e5949594527ef0662187de8883d2351a84f7aeb461be5790c03ecb28 |
| ground/interior_tavern_wall.png | 405 | f2a4c163edabc3b9190cd7be525eaee9d563533d8ff0fed5f81de16227120fa3 |
| ground/interior_tavern_wall.tsj | 2584 | c14124dcde7e0a22875563a4e0179f2385d21c1f5fab904c650e72440109d23f |
| ground/water.png | 52096 | f586084c52dccc68adbd22006dd0546d3940fa7560fd444f80e3f97b367c6bb9 |
| ground/water.tsj | 100547 | 789bef251bcc032055061980c301f57a8da7f18ecab7d6bbb29d739ba0d89a28 |
| ground/water_ford.png | 1802 | 9207904b4015c81e3826b6dc244b3d004db9cf89ae214de9cfc7b846e935f84a |
| ground/water_ford.tsj | 2568 | 1b79c80d8670b09660a661f9c2dc4bb672dc30d4316f85ba6ed7c39544cc66ea |
| ground/water_shore.png | 38774 | 40db07e8c4d8b3154d0186590c7fc3385fa5986a44a11718a12a12ec24c58930 |
| ground/water_shore.tsj | 74625 | be92b0d3da1386dbb0ec3de5703d5880f509e1d321f886159f93153b205c8c4b |
| palette.json | 1220 | de92a9af68b25252456eb70916de00e28c7f43e99ec244f12c9e308d54721280 |
| props/PAIRING.md | 540 | ed715ccf43aea0a616f335902773e209696756cb4a86c8e3a17f3e070863cf30 |
| props/hearth.json | 3090 | 36b1cedfe0e82b5a63bedb659ffbe5e93a3cd474c3b4f09b091e194c8b4b5544 |
| props/hearth.png | 2571 | 2d6f08c34adc4b80a2259f7c70b88ce9b8530a198052be566dc07b5dac09c0de |
| props/pairing.json | 1003 | 2d0a818517f2e1e06052a63a0968846db10ccedc87e3da67e540424b0c3416d6 |
| props/village_props.json | 16819 | 0df69b8cf9e2f14308b281c50678efce2b8208f41465370fd8f7de831fd9ddf9 |
| props/village_props.png | 14872 | ef39c4743149f5d142912f7ff4255238521a32af3b6f7a0dc72a4eab02d34f95 |
