# AS-2 v4 manifest

LOCAL art scope complete; not game-integrated or approved.
15 tilesets,222 tile IDs,20 logical props. No character asset changes.

## Ground / static cell anchors: top-left grid cell
| Atlas | Image px | IDs | Unique art | Anim | PNG bytes | TSJ bytes |
|---|---|---|---:|---|---:|---:|
| ground/bridge_plank | 136x34 | 0..3 | 4 | none | 384 | 2572 |
| ground/cliff | 136x136 | 0..15 | 16 | none | 2129 | 18139 |
| ground/cliff_face | 136x34 | 0..3 | 4 | none | 528 | 2564 |
| ground/cobble_road | 136x136 | 0..15 | 16 | none | 1922 | 18173 |
| ground/dirt_road | 136x136 | 0..15 | 16 | none | 1757 | 18167 |
| ground/dungeon_floor | 102x68 | 0..5 | 6 | none | 817 | 3288 |
| ground/dungeon_wall | 136x34 | 0..3 | 4 | none | 292 | 2568 |
| ground/grass | 136x68 | 0..7 | 8 | none | 1227 | 3986 |
| ground/interior_market_floor | 136x34 | 0..3 | 4 | none | 416 | 2590 |
| ground/interior_market_wall | 136x34 | 0..3 | 4 | none | 312 | 2584 |
| ground/interior_tavern_floor | 136x34 | 0..3 | 4 | none | 376 | 2590 |
| ground/interior_tavern_wall | 136x34 | 0..3 | 4 | none | 265 | 2584 |
| ground/water | 136x544 | 0..63 | 61 | wet1..15:4x160ms | 8280 | 62939 |
| ground/water_ford | 136x34 | 0..3 | 4 | none | 1170 | 2568 |
| ground/water_shore | 136x544 | 0..63 | 61 | wet1..15:4x160ms | 8206 | 62957 |

## Prop atlases
| Atlas | Image px | Frames | Origin | Anims | PNG bytes | JSON bytes |
|---|---|---:|---|---|---:|---:|
| props/village_props | 902x418 | 19 | 0.5,1.0 | static | 10141 | 16819 |
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
| ground/bridge_plank.png | 384 | e63cb928c00a6f9f577d14406e5b7dd365d7d5222a83a703a5ec80a00aa454d4 |
| ground/bridge_plank.tsj | 2572 | 59c05a95882be003a7cebffe52875a6a99a992fd29495ace8d169640a0299cae |
| ground/cliff.png | 2129 | 936db39d7c5065de206ee0c3cee157031388b731df9a26adc7fcb2570115f49c |
| ground/cliff.tsj | 18139 | 8952e11c8d6846af6a9fbdc65c801d92381ff9481ab6bdf8bb27118fa53a46f3 |
| ground/cliff_face.png | 528 | 8ace6225d68ea69928dec9d37f80a1eba85806dea626a118d98b95a40ab8c1ef |
| ground/cliff_face.tsj | 2564 | 7832be09a0122b560067f72eb335b4cd74b199cea53f9550a15548cff51a2f7d |
| ground/cobble_road.png | 1922 | c1244fc8e3bcc0e8142f1157ef6fc1aba2354c28275b226755e1d3f056d46ea7 |
| ground/cobble_road.tsj | 18173 | e14764c031496a906bd78aa968b5cd841d55af05ddcbb74f425d0ac8389ec21b |
| ground/dirt_road.png | 1757 | 5ae57b29928562f2277fa2dcd6368248f8e3e920dc97b3208606e5b49ea2553e |
| ground/dirt_road.tsj | 18167 | ef037d5b6ad5b3001dfc242882df4d055ede67084aa6e82dd61eff0236e91abf |
| ground/dungeon_floor.png | 817 | 5a7a1785667e91c7318c474615da74447edffd0f52b184bdffba5e924369f44e |
| ground/dungeon_floor.tsj | 3288 | aa685e7ebbb469bab852b00107efd0877ba41e4fe46d41d3f25e7aae44212a35 |
| ground/dungeon_wall.png | 292 | b0e3a4a4705fe945dbdc21c08ba8829d8ff1242cabb73679ee8d3550906bd1ca |
| ground/dungeon_wall.tsj | 2568 | 4358a559afc8271dddc85412e08bf479b77780f2031976b9ec5cb36102259132 |
| ground/grass.png | 1227 | a9de1f1861dedf3b4e50d441826213b15492f8496a250df0b24380828084fed6 |
| ground/grass.tsj | 3986 | 6629ad7f81cec7c4534d15c70c0e226b6fbad71d74c923ad71ae03f773faddbb |
| ground/interior_market_floor.png | 416 | 4db23c10df02cde5d818c0ab1939b670a01159a7f4c952286cb182f4ea73f64c |
| ground/interior_market_floor.tsj | 2590 | 2ec7162023ed2f4f024b4cd63887e0e713a1feb3eeefb7d7ff913bbfb4bea16d |
| ground/interior_market_wall.png | 312 | 497b2355bc999619c463cbdbfd3c8b843fe66589baa742ae100c3b04cfedd796 |
| ground/interior_market_wall.tsj | 2584 | 5185184d320f3e30ca0071f764408d6a421f18e7555d71512ce30b4656c71f3c |
| ground/interior_tavern_floor.png | 376 | f14f73faaf39ee6df5ace2345eb7d74762300aacf85baf348b35c67a9cd0c1a0 |
| ground/interior_tavern_floor.tsj | 2590 | f444ba46e5949594527ef0662187de8883d2351a84f7aeb461be5790c03ecb28 |
| ground/interior_tavern_wall.png | 265 | 255150f43aa7f2828abeb7466787630f4ea12cf59832edccb2d64ddac482cffe |
| ground/interior_tavern_wall.tsj | 2584 | c14124dcde7e0a22875563a4e0179f2385d21c1f5fab904c650e72440109d23f |
| ground/water.png | 8280 | d9f286d1b44220e87129d61ec5ed677460539ce5aeaad5a6fbb463dc94e8dfe4 |
| ground/water.tsj | 62939 | 5924788df478fa33b2a623575f7e945bbf28d509eaceaf9a4d2bdcc1c45b91a7 |
| ground/water_ford.png | 1170 | 2ffb60f96ab1e146236d15fd7a7ad35ac7a607e201b1829f776c335cefb4409e |
| ground/water_ford.tsj | 2568 | 1b79c80d8670b09660a661f9c2dc4bb672dc30d4316f85ba6ed7c39544cc66ea |
| ground/water_shore.png | 8206 | c840cd52d6a8b08449dbfc1723ddb31357609b87a3bb89c41b1bec6fa5de8482 |
| ground/water_shore.tsj | 62957 | 6d587d9304355c260edaf86cc8e0714a6bafae886c8fc0cb6df85b1862f2c5cd |
| palette.json | 1220 | de92a9af68b25252456eb70916de00e28c7f43e99ec244f12c9e308d54721280 |
| props/PAIRING.md | 540 | ed715ccf43aea0a616f335902773e209696756cb4a86c8e3a17f3e070863cf30 |
| props/hearth.json | 3090 | 36b1cedfe0e82b5a63bedb659ffbe5e93a3cd474c3b4f09b091e194c8b4b5544 |
| props/hearth.png | 2571 | 2d6f08c34adc4b80a2259f7c70b88ce9b8530a198052be566dc07b5dac09c0de |
| props/pairing.json | 1003 | 2d0a818517f2e1e06052a63a0968846db10ccedc87e3da67e540424b0c3416d6 |
| props/village_props.json | 16819 | 0df69b8cf9e2f14308b281c50678efce2b8208f41465370fd8f7de831fd9ddf9 |
| props/village_props.png | 10141 | 2a551ae389f98d94ba5b0001c0b29b8fc2f1de802b1c4cb3412e2ddbcc673ac3 |
