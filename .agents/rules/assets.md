---
trigger: glob
globs: client/src/game/assets/**, tools/assets/**, client/public/assets/**, art-source/**
---
# Asset rules (copy to .agents/rules/assets.md)
- Read origin/anchor, fps, hitFrames, hitbox, footprint, hurtbox from each atlas's meta. Never hard-code.
- Dragon: load per phase; use fx_v2; attacks.json is a separate sidecar.
- Mage = mage/walk + mage/spells merged.
- art-source/blendsmith is read-only. Never ship frames/, render_hi/, *_bak*, masters, previews, .blend, .glb.

