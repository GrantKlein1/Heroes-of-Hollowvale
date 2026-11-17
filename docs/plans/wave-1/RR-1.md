# RR-1 refined spec (Wave 1 planning, verified on `origin/main` @ `4e68ca0`)

Tightens `prompts/RR-1.md`. If this file conflicts with the prompt, the prompt wins.

## 1. Verified facts

| Prompt claim | Status | Evidence |
|---|---|---|
| `warmupReranker()` returns `false` when the model cannot load | CONFIRMED | `server/src/rag/rerank.js` 23-31: `try { await getCrossEncoder(); return true; } catch (err) { console.warn('[RAG Rerank] Failed to warmup cross-encoder:', ...); return false; }` |
| `rerank()` falls back to the original order | CONFIRMED, with details | 111-123: `catch (err) { ... const fallback = candidates.map((c) => { if (typeof c === 'string') { const item = { text: c, score: 0, rerankScore: 0 }; ... } return { ...c, rerankScore: 0 }; }); ... return fallback.slice(0, limit) }`. The failure is cached: `modelPromise` (4-17) keeps the rejected promise, so after one failure every later call fails fast and falls back. |
| Test "rerank orders a relevant chunk above an unrelated one" fails offline with "fetch failed" | CONFIRMED (ran it) | `node --test server/src/__tests__/rerank.test.js` here (egress to huggingface.co blocked): `not ok 2`, `# tests 7 # pass 6 # fail 1`, about 0.4 s. Actual `'The village baker in Brackenford…'` vs expected `'The Cavern of Embers lies…'` at `rerank.test.js:20`. |
| Other tests in the file are model-independent | CONFIRMED offline | Tests 1, 3-7 pass offline (`retrieveCandidates` and shadow mode degrade via `[RAG] Local embeddings failed: fetch failed`). |
| `npm test` server state | Fact | `npm run test --workspace server` offline: `# tests 52 # pass 51 # fail 1` (only this test). Client: 40 files / 595 tests pass. |
| `HF_HUB_OFFLINE=1` or `HF_ENDPOINT` can simulate offline | **WRONG** | `@xenova/transformers` (`node_modules/@xenova/transformers/src/env.js`) reads no environment variables; offline mode is only the in-process `env.allowRemoteModels`. Neither env var changes anything. Use `unshare -rn node --test server/src/__tests__/rerank.test.js` instead (verified here: `fetch` fails with `EAI_AGAIN` inside it). If `unshare` is unavailable, say so. |

Fallback contract details that the new test must respect (do not over-assert):
- Object candidates: returned as `{ ...c, rerankScore: 0 }`, so `score` and `cosScore` are preserved **only if present**. The fallback does **not** add `cosScore` (the success path does, at line 101). Assert `out[i].score === in[i].score` and `out[i].cosScore === in[i].cosScore`; do not assert `cosScore === score`.
- String candidates: returned as `{ text, score: 0, rerankScore: 0 }` with `toString()`/`valueOf()` returning the string.
- `topK` truncation applies to the fallback (line 122).

## 2. Exact MAY-change list

- `server/src/__tests__/rerank.test.js` only. No ADDITIONS.

## 3. Overlap check

- Open PRs: none. `hv/IT-1` = `main`.
- Wave 1: no other package touches `server/`.

## 4. Test plan

Structure (node:test, ESM, top-level await is fine):

```js
const modelReady = await warmupReranker();
const OFFLINE = 'cross-encoder model unavailable (offline)';
test('rerank orders a relevant chunk above an unrelated one', { skip: !modelReady && OFFLINE }, async () => { /* unchanged body */ });
test('rerank fallback keeps every candidate once, in input order, without throwing', { skip: modelReady && 'model available; fallback path not reachable without mocks' }, async () => { ... });
```

Fallback test cases (run only when `modelReady === false`):
- Strings `['a','b','c']` -> length 3, `out.map(o => o.text)` deep-equals the input, every `rerankScore === 0`.
- Objects `[{id:'c1',text:'x',score:0.75},{id:'c2',text:'y',score:0.6,cosScore:0.6}]` -> ids `['c1','c2']`, `score` 0.75/0.6 preserved, `cosScore` `undefined`/0.6 preserved, `rerankScore` 0.
- `await assert.doesNotReject(rerank('q', ['a']))`.
- Each candidate appears exactly once: `new Set(out.map(o => o.text)).size === input.length`.

Expected results:
- Offline today: test 2 fails (1 fail). After the change, offline: `# fail 0`, `# skipped 1` (the model test), and the fallback test passes.
- Online after the change: the model test runs; the fallback test is skipped.
- Evidence: `node --test server/src/__tests__/rerank.test.js` three times (state online or offline), plus one `unshare -rn node --test server/src/__tests__/rerank.test.js` run showing `# SKIP cross-encoder model unavailable (offline)`, plus `npm test`.

## 5. Risks and traps

1. **`t.skip()` does not stop the test body.** Calling `t.skip('…')` inside the callback only marks the test as skipped; the assertions after it still run and can fail. Use the `{ skip: … }` option (above), or `return` immediately after `t.skip(…)`.
2. The first test, "warmupReranker initializes cross-encoder without throwing", stays as is. With a top-level probe, its call returns the cached result instantly.
3. Online first run downloads the quantized model into `node_modules/@xenova/transformers/.cache`. A machine with that cache passes the model test even with no network. That is "available", not a bug.
4. Do not set `env.allowRemoteModels`, stub `fetch` or use a mock to force the fallback (forbidden by the prompt). That is why the fallback test only runs when the model is genuinely unavailable.
5. On a sandbox where egress hangs instead of resetting, the probe can wait for a TCP timeout. It resets in about 1 s here. Don't add retries.
6. No Playwright for this package: write "not applicable" in the PR.

## 6. Open questions for Grant

none
