# Shared-feet pairs

Use pairing.json in this folder. Every pair shares world camera, fixed PPU, canvas and bottom-center reference. Place base and roof/canopy at identical x/y, pivot(0.5,1.0). Never independently alpha-trim them or infer an overhead offset from alpha bounds. Small foot clearance protects outline pixels.

Overheads have no collision. Only base footprints collide; visual canopy rectangles must not become solid obstacles. Pixel alpha contact / single-connected-component evidence is recorded in top-level QA_REPORT.json.
