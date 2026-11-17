# Public image audit 2026-11-17

Scope: every file under `client/public/` except `assets/`, `audio/`, and `maps/`.
A file is KEEP when its public path, basename, `%20` form, parent directory prefix, or (for a root `images/<stem>.png`) a quoted `'<stem>'` / `"<stem>"` in `client/src` or `server/src` appears in searched text.
Search roots: `client/src`, `client/index.html`, `client/vite.config.*`, `server/src`, `tests/`, `tools/`, `docs/`, text under `art-source/`.
Excluded from search: `docs/public-audit-*.md`, `docs/plans/**`, `tools/assets/audit_public_refs.mjs`, `node_modules/`, `test-results/`, screenshot baselines, and non-text files.
Tool files (`.aseprite`, `.py`, stray README) are MOVE even if a doc mentions them.

| path | size | referenced-by | action |
|---|---:|---|---|
| `images/animatedFireBall/animatedFireBall.gif` | 245.8 KB | client/src/config/paths.js:20 | KEEP |
| `images/animatedFireSmall/animatedFireSmall.gif` | 38.2 KB | client/src/config/paths.js:19 | KEEP |
| `images/animatedHealing/animatedHealing.gif` | 43.2 KB | none | MOVE |
| `images/animatedHealing/animatedHealingPop.gif` | 50.8 KB | none | MOVE |
| `images/animatedMana/animatedMana.gif` | 66.2 KB | none | MOVE |
| `images/animatedSmoke/animatedSmoke.gif` | 21.0 KB | client/src/config/paths.js:46 | KEEP |
| `images/animatedSword/animatedSword1.png` | 185.6 KB | client/src/config/paths.js:138 | KEEP |
| `images/animatedSword/animatedSword10.png` | 197.3 KB | client/src/config/paths.js:147 | KEEP |
| `images/animatedSword/animatedSword11.png` | 198.2 KB | client/src/config/paths.js:148 | KEEP |
| `images/animatedSword/animatedSword12.png` | 198.3 KB | client/src/config/paths.js:149 | KEEP |
| `images/animatedSword/animatedSword13.png` | 197.7 KB | client/src/config/paths.js:150 | KEEP |
| `images/animatedSword/animatedSword14.png` | 197.2 KB | client/src/config/paths.js:151 | KEEP |
| `images/animatedSword/animatedSword15.png` | 197.8 KB | client/src/config/paths.js:152 | KEEP |
| `images/animatedSword/animatedSword16.png` | 193.1 KB | client/src/config/paths.js:153 | KEEP |
| `images/animatedSword/animatedSword17.png` | 189.0 KB | client/src/config/paths.js:154 | KEEP |
| `images/animatedSword/animatedSword18.png` | 187.1 KB | client/src/config/paths.js:155 | KEEP |
| `images/animatedSword/animatedSword19.png` | 185.8 KB | client/src/config/paths.js:156 | KEEP |
| `images/animatedSword/animatedSword2.png` | 185.8 KB | client/src/config/paths.js:139 | KEEP |
| `images/animatedSword/animatedSword20.png` | 185.6 KB | client/src/config/paths.js:157 | KEEP |
| `images/animatedSword/animatedSword21.png` | 185.6 KB | client/src/config/paths.js:158 | KEEP |
| `images/animatedSword/animatedSword22.png` | 185.6 KB | client/src/config/paths.js:159 | KEEP |
| `images/animatedSword/animatedSword3.png` | 187.1 KB | client/src/config/paths.js:140 | KEEP |
| `images/animatedSword/animatedSword4.png` | 189.0 KB | client/src/config/paths.js:141 | KEEP |
| `images/animatedSword/animatedSword5.png` | 193.1 KB | client/src/config/paths.js:142 | KEEP |
| `images/animatedSword/animatedSword6.png` | 197.8 KB | client/src/config/paths.js:143 | KEEP |
| `images/animatedSword/animatedSword7.png` | 197.2 KB | client/src/config/paths.js:144 | KEEP |
| `images/animatedSword/animatedSword8.png` | 197.7 KB | client/src/config/paths.js:145 | KEEP |
| `images/animatedSword/animatedSword9.png` | 198.3 KB | client/src/config/paths.js:146 | KEEP |
| `images/animatedThiefPotion/animatedThiefPotion.gif` | 1.18 MB | client/src/config/paths.js:21 | KEEP |
| `images/apple.png` | 994.7 KB | client/src/config/paths.js:84 | KEEP |
| `images/bossFightEmptyRoom.png` | 2.26 MB | none | MOVE |
| `images/cleric.png` | 850.9 KB | none | MOVE |
| `images/dungeon entrance.png` | 2.02 MB | client/src/config/paths.js:16 | KEEP |
| `images/dungeon.png` | 2.69 MB | client/src/config/paths.js:17 | KEEP |
| `images/dwarf.png` | 956.2 KB | client/src/config/paths.js:59 | KEEP |
| `images/dwarfAle.png` | 510.5 KB | client/src/config/paths.js:99 | KEEP |
| `images/dwarfArmor.png` | 474.8 KB | client/src/config/paths.js:97 | KEEP |
| `images/dwarfAttack.png` | 536.2 KB | client/src/config/paths.js:67 | KEEP |
| `images/dwarfAxe.png` | 321.0 KB | client/src/config/paths.js:96 | KEEP |
| `images/dwarfEmptyHands.png` | 760.2 KB | client/src/config/paths.js:131 | KEEP |
| `images/dwarfPickaxe.png` | 311.3 KB | client/src/config/paths.js:98 | KEEP |
| `images/dwarfWithAle.png` | 782.4 KB | client/src/config/paths.js:130 | KEEP |
| `images/dwarfWithPickaxe.png` | 820.5 KB | client/src/config/paths.js:129 | KEEP |
| `images/emerald.png` | 744.7 KB | client/src/Game.jsx:233 (quoted id 'emerald') | KEEP |
| `images/fireSmall.aseprite` | 3.9 KB | none | MOVE (tool) |
| `images/goblin archer.png` | 874.0 KB | client/src/config/paths.js:74 | KEEP |
| `images/goblin brute.png` | 1.05 MB | client/src/config/paths.js:73 | KEEP |
| `images/goblin.png` | 803.0 KB | client/src/config/paths.js:72 | KEEP |
| `images/goblinArrow.png` | 296.8 KB | client/src/config/paths.js:44 | KEEP |
| `images/healPotion.png` | 465.1 KB | client/src/config/paths.js:82 | KEEP |
| `images/hiddenTreasureRoom.png` | 2.13 MB | client/src/config/paths.js:18 | KEEP |
| `images/knight.png` | 757.4 KB | client/src/config/paths.js:56 | KEEP |
| `images/knightArmor.png` | 528.6 KB | client/src/config/paths.js:81 | KEEP |
| `images/knightAttack.png` | 640.3 KB | client/src/config/paths.js:64 | KEEP |
| `images/knightEmptyHands.png` | 679.7 KB | client/src/config/paths.js:113 | KEEP |
| `images/knightShield.png` | 617.2 KB | client/src/config/paths.js:80 | KEEP |
| `images/knightSword.png` | 337.6 KB | client/src/config/paths.js:79 | KEEP |
| `images/knightWithHealPotion.png` | 705.3 KB | client/src/config/paths.js:111 | KEEP |
| `images/knightWithShield.png` | 660.0 KB | client/src/config/paths.js:110 | KEEP |
| `images/knightWithShieldAndSword.png` | 722.9 KB | client/src/config/paths.js:112 | KEEP |
| `images/mage 2.png` | 721.4 KB | client/src/config/paths.js:57 | KEEP |
| `images/mageAttack.png` | 483.2 KB | client/src/config/paths.js:65 | KEEP |
| `images/mageEmptyHands.png` | 623.9 KB | client/src/config/paths.js:119 | KEEP |
| `images/mageRobes.png` | 394.4 KB | client/src/config/paths.js:88 | KEEP |
| `images/mageSpellBook.png` | 652.3 KB | client/src/config/paths.js:87 | KEEP |
| `images/mageSpellBookSpellIcons/blinkIcon.png` | 682.2 KB | client/src/config/paths.js:50 | KEEP |
| `images/mageSpellBookSpellIcons/lifeLeechIcon.png` | 837.3 KB | client/src/config/paths.js:51 | KEEP |
| `images/mageSpellBookSpellIcons/lightningBoltIcon.png` | 458.1 KB | client/src/config/paths.js:48 | KEEP |
| `images/mageSpellBookSpellIcons/manaShieldIcon.png` | 613.2 KB | client/src/config/paths.js:49 | KEEP |
| `images/mageSpellBookSpells/lifeLeechSpell.gif` | 350.9 KB | client/src/config/paths.js:24 | KEEP |
| `images/mageStaff.png` | 237.9 KB | client/src/config/paths.js:86 | KEEP |
| `images/mageWithBook.png` | 663.9 KB | client/src/config/paths.js:117 | KEEP |
| `images/mageWithManaPotion.png` | 648.4 KB | client/src/config/paths.js:118 | KEEP |
| `images/manaPotion.png` | 412.4 KB | client/src/config/paths.js:89 | KEEP |
| `images/market.png` | 1.57 MB | client/src/config/paths.js:14 | KEEP |
| `images/poisonPotion.gif` | 37.8 KB | client/src/config/paths.js:22 | KEEP |
| `images/red dragon boss fight room.png` | 1.69 MB | client/src/config/paths.js:25 | KEEP |
| `images/red dragon.png` | 816.5 KB | none | MOVE |
| `images/ruby.png` | 876.8 KB | client/src/Game.jsx:231 (quoted id 'ruby') | KEEP |
| `images/sapphire.png` | 549.8 KB | client/src/Game.jsx:232 (quoted id 'sapphire') | KEEP |
| `images/specialSwordWithFire.gif` | 749.7 KB | none | MOVE |
| `images/speedPotion.png` | 503.2 KB | client/src/config/paths.js:83 | KEEP |
| `images/start village screen.png` | 2.05 MB | client/src/config/paths.js:12 | KEEP |
| `images/tavern.png` | 1.47 MB | client/src/config/paths.js:13 | KEEP |
| `images/terrain/README.md` | 560 B | art-source/blendsmith/npcs/MANIFEST_npc_b6.md:20 | MOVE (tool) |
| `images/terrain/grass_version1_16x16.png` | 1.58 MB | client/src/config/terrainAssets.js:34 | KEEP |
| `images/terrain/grass_version2_16x16.png` | 1.64 MB | client/src/config/terrainAssets.js:48 | KEEP |
| `images/terrain/path_top_bottom_16x16.png` | 1.75 MB | client/src/config/terrainAssets.js:62 | KEEP |
| `images/terrain/path_top_right_16x16.png` | 1.76 MB | client/src/config/terrainAssets.js:76 | KEEP |
| `images/terrain/path_top_right_bottom_16x16.png` | 1.89 MB | client/src/config/terrainAssets.js:90 | KEEP |
| `images/terrain/path_top_right_bottom_left_16x16.png` | 1.89 MB | client/src/config/terrainAssets.js:104 | KEEP |
| `images/terrain/rock_pile_32x32.png` | 1.80 MB | client/src/config/terrainAssets.js:118 | KEEP |
| `images/thief.png` | 667.9 KB | client/src/config/paths.js:58 | KEEP |
| `images/thiefAttack.png` | 351.5 KB | client/src/config/paths.js:66 | KEEP |
| `images/thiefCloak.png` | 340.0 KB | client/src/config/paths.js:92 | KEEP |
| `images/thiefDaggers.png` | 492.7 KB | client/src/config/paths.js:91 | KEEP |
| `images/thiefDisappear.gif` | 815.2 KB | client/src/config/paths.js:45 | KEEP |
| `images/thiefEmptyHands.png` | 586.3 KB | client/src/config/paths.js:125 | KEEP |
| `images/thiefLockpick.png` | 266.5 KB | client/src/config/paths.js:93 | KEEP |
| `images/thiefPoison.png` | 434.2 KB | client/src/config/paths.js:94 | KEEP |
| `images/thiefReappear.gif` | 803.9 KB | none | MOVE |
| `images/thiefWithLockpicks.png` | 610.6 KB | client/src/config/paths.js:123 | KEEP |
| `images/thiefWithPoison.png` | 600.8 KB | client/src/config/paths.js:124 | KEEP |
| `images/title screen wider no background.png` | 947.3 KB | client/src/config/paths.js:26 | KEEP |
| `images/title screen.png` | 1.47 MB | none | MOVE |
| `images/walkingPath.png` | 2.55 MB | client/src/config/paths.js:15 | KEEP |

Files: 106. KEEP 95. MOVE 11 (7.04 MB).

`images/terrain/README.md` matches the basename `README.md` in `art-source/blendsmith/npcs/MANIFEST_npc_b6.md` (a different file). It is still MOVE because it is a non-runtime file that shipped under `client/public/`.

`du -sh client/public`: 96M before these moves, 89M after. `assets/`, `audio/`, and `maps/` were not touched. `ruby.png`, `sapphire.png`, and `emerald.png` stay because their ids are quoted strings passed to `DEFAULT_ITEM_ICON`.
