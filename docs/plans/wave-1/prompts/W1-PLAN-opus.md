**Model:** Opus 5.5 (the non-Grok model pool), planning only. **Wave 1 planning agent.** Do NOT write or change any product code, tests, maps, assets or configs. Keep it short: you are saving the Grok implementers from wasted runs, not producing a design doc.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`.

**Branch:** `git fetch origin && git switch -c hv/PLAN-W1 origin/main`. Docs only: you may create ONLY `docs/plans/wave-1/<id>.md` files, one per package below. Push the branch. A docs-only PR is fine but optional. Never push to `main`, never merge, never enable auto-merge, never force-push.

**Start condition:** none (IT-1 may still be running; wave 1 packages are disjoint from its files).

**Packages in this wave:** MX-1, CV-1, RR-1, SS-1, PUB-1. The Grok implementer prompts live in `/workspace/hollowvale/cursor-launch-2026-11-17/<id>.md` on Grok Bot's box; Grok Bot will paste each prompt below this one as "CURRENT PROMPT" when it launches you. Read each CURRENT PROMPT, then verify it against the real code on fresh `origin/main`.

**For each package write `docs/plans/wave-1/<id>.md` containing:**
1. **Verified facts:** every claim the prompt makes about the repo (file, function, line numbers, current values) marked CONFIRMED or WRONG with the corrected value. Quote the actual lines.
2. **Exact MAY-change list:** the prompt's list tightened to concrete file paths, and any file the prompt forgot that the work truly needs (flag these clearly as ADDITIONS).
3. **Overlap check:** against every other package in this wave and against any open PR (`gh pr list --state open`): any shared file = a blocker to report at the top of your final message.
4. **Test plan:** the exact unit cases and Playwright assertions (names, values, tolerances) that prove each acceptance criterion, and the commands. Say which tests are expected to fail today before the change.
5. **Risks and traps:** things that will make a Grok agent loop (flaky tests, slow specs, tools that cannot run offline, generator churn), with the specific mitigation.
6. **Open questions for Grant:** only questions that truly block, each with a recommended default. If none, write "none".
You may only TIGHTEN the prompt: you cannot widen scope, add packages, or change the "must not change" lists except to add to them.
For MX-1, also identify the exact collision-free 32x32 cells just outside the market door and the tavern door and say how you determined them (read the collision layer). For PUB-1, pre-run the reference audit logic by hand on the five biggest files in client/public/images and report any string-built path pattern that the prompt's audit would miss.
**Budget:** read-only investigation, no builds beyond `npm ci` if you need to run a test to confirm a fact, no Playwright runs longer than one spec. Stop after pushing.

**Final message:** the branch name, the list of files written, any BLOCKER (overlap or wrong premise), and any open question for Grant. Nothing else.
