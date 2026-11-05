---
trigger: always_on
---
# Hollowvale guardrails (copy to .agents/rules/hollowvale-guardrails.md)
- Never push to main, merge, force-push, or delete branches. One package per branch `hv/<id>-<slug>`.
- Only edit files the package prompt allows; otherwise stop and ask.
- Run `npm test` and `npm run build --workspace client` before finishing; paste results.
- No lore edits, no invented place names, no third-party art, no secrets in commits. Lore canon is newLore_expanded.txt.
- Stop and summarize at the end; don't start another package.
