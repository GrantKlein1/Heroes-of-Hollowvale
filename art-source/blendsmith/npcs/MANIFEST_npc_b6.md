# MANIFEST: npc_b6 (Gate D sample)
## Runtime (draft sample, NOT the final sheet)
- runtime/npc_bartender/npc_bartender_gateD_sample.png (256x384, 4 rows x 4 idle frames)
- runtime/npc_bartender/npc_bartender_gateD_sample.json (Phaser JSON-hash, meta.anims.idle, footprint, origin)
- The plan's final destination `models/npc_bartender/npc_bartender.{png,json}` is NOT written, because models/ is read-only for this task. The final sheet also needs `talk` 6@8 after Gate D.
## Frames: frames/npc_bartender_idle_{down,left,right,up}_{0..3}.png (16)
## Source: source/npc_bartender.blend, source/npc_bartender.glb (action npc_bartender_idle), source/palette.json; render_hi/idle_*.png (4x Cycles) + render_provenance.json
## Previews
- previews/gateD_native1x.png: Gate A tavern layout, Tharos behind the bar counter, knight beside it (frame 0)
- previews/gateD_scene_idle_1x.gif, gateD_crop3x_idle.gif: same scene, idle animating
- previews/gateD_crop3x_bar_npc_knight.png: 3x crop of bar + Tharos + knight
- previews/gateD_footprints_native1x.png: footprint/pivot overlay
- previews/gateD_turnaround_tavern_native1x.png / _3x.png / _idle_1x.gif / _idle_3x.gif / _footprints_1x.png: knight | Tharos down/left/right/up | knight left on the v5 tavern floor
- previews/gateD_turnaround_vs_knight_1x.png / _3x.png: knight idle vs Tharos frame 0 per facing
- previews/npc_bartender_idle_{dir}.gif (4x, 6 fps), previews/npc_bartender_idle_strip_2x.png (all 16 frames)
## Scripts: scripts/{build_npc_bartender,pack_npc,gate_d,qa_npc,quickview,hash_baselines}.py; lib/ = copies of heroes_lib/hero_lib.py, pack_hero.py, combat_tools/pixel.py
## Reports: reports/{QA_REPORT.json,pack_stats.json,build.log,rebuild_smoke_result.json,baseline_*.json,baseline_immutability.json}

## Update 2026-11-09 (CT)
runtime/npc_bartender/npc_bartender.{png,json}, README.md · runtime/npc_vendor/npc_vendor_gate_sample.{png,json}, README.md · scripts: tharos_clips.py, pack_final.py, final_scene.py, qa_final.py, rebuild_compare.py, build_npc_vendor.py, vendor_clips.py, pack_vendor.py, vendor_scene.py, qa_vendor.py · frames/ (144), frames_vendor/ (16) · source_vendor/ (blend, glb, palette) · previews: npc_bartender_* clip GIFs/strips, npc_bartender_contact_sheet_2x.png, final_bar_*, vendor_*.

## Update 2026-11-09 (CT, after vendor gate)
runtime/npc_vendor/npc_vendor.{png,json}, README.md, README_gate_sample.md · render_hi_vendor_full/ (136 hi-res + provenance) · frames_vendor/ (136) · scripts: vendor_clips.py (full), pack_vendor_final.py, vendor_scene.py (new placement; the gate version is in archive_gateD/vendor_scene_gate.py), qa_vendor_final.py · previews: npc_vendor_<clip>_<dir>.gif, npc_vendor_<clip>_strip_2x.png, npc_vendor_contact_sheet_2x.png, vendor_stall_{native1x.png,crop3x.png,idle_native1x.gif,idle_crop3x.gif,cycle_native1x.gif,cycle_crop3x.gif,facings_2x.png,keyframes_3x.png}, vendor_turnaround_vs_knight_tharos_{1x,3x}.png
