# Local Rerank & Streaming TTS Architecture (SWE Reference)

> **Status:** Active specification for Lane L (Packages BUG-1, BUG-2, L-2 through L-8).  
> **Source:** Synthesized from Cursor SWE architectural specifications and [`ANTIGRAVITY-PLAN.md`](./ANTIGRAVITY-PLAN.md).

---

## 1. RAG & LLM Integration (Groq)

- **Backend Route:** `server/src/routes/chat.js` on Express port `5051`.
- **Lore Grounding:**
  - LLM queries are grounded via vector retrieval against embedded lore (`server/src/rag/lore.json`).
  - Canon lore source is strictly [`newLore_expanded.txt`](../../newLore_expanded.txt).
  - Package L-2 re-chunks the expanded chronicle by section heading (~150 words per chunk with 30-word overlap) using `@xenova/transformers`.
- **Persona Preservation (PR #19):**
  - NPC personas, tone guidelines, and relevant lore context are permanently pinned in system prompts to prevent character drift.
- **Per-Player Conversation Memory (BUG-2):**
  - Fixes shared NPC memory by scoping conversation histories by `sessionId` or `playerId` + `npcId`.

---

## 2. Text-to-Speech (ElevenLabs) & Audio Pipeline

- **TTS Route:** `server/src/routes/tts.js` proxying ElevenLabs API.
- **Graceful Fallbacks:** If `ELEVENLABS_API_KEY` is unset, `/api/tts` returns HTTP 501 without crashing; client audio falls back gracefully.
- **Streaming Audio:** Server streams synthesized voice chunks to minimize latency before speech begins in the browser.
- **Voice Customization:** Custom voice parameters tuned per NPC (e.g., deeper, slower voice for the bartender).

---

## 3. L-4 rerank flag and lore eval

`RAG_RERANK` and `COS_GATE` are read by `server/src/routes/chat.js` and `server/src/routes/chatStream.js` through `retrieveLoreForTurn` in `server/src/rag/store.js`.

| `RAG_RERANK` | Retrieval | Lore injected |
|---|---|---|
| unset, empty, unknown, or `off` (default) | cosine top 3, cross-encoder not called | cosine chunks |
| `shadow` | cosine top 3, cross-encoder scored for logs only | cosine chunks (same replies as off) |
| `on` | cross-encoder order of the cosine top 10 | reranked chunks, unless `COS_GATE` skips them |

`COS_GATE` applies only in `on` mode. A finite value skips lore injection when `maxCos` is below it. The skip is decided before the cross-encoder runs. Unset or non-numeric `COS_GATE` does not skip.

Each turn that injects lore logs `[RAG Lore] mode=<mode> tokens: <n>`. The grounding message is capped at 600 whitespace tokens (three L-2 chunks of about 175 words plus the preamble). Real chunks already fit, so the cap does not change today's passages.

`server/eval/lore_eval.json` holds 55 player questions labelled with chunk ids taken from `server/src/rag/lore.json`. `node server/eval/run.mjs` prints recall@3 for cosine and, when `Xenova/ms-marco-MiniLM-L-6-v2` loads, for rerank. If the cross-encoder cannot load it still prints the cosine numbers and exits 2.

Offline run in this sandbox (MiniLM download failed, so scores are token-overlap, not embedding cosine; cross-encoder warmup returned false):

- cosine recall@3: 0.9636 (53/55 hit@3)
- mean maxCos correct top hit: 0.2835 (n=46)
- mean maxCos wrong top hit: 0.2828 (n=9)
- candidate `COS_GATE`: 0.2171 (keeps 42/46 correct top hits, drops 0/9 wrong top hits)

**Recommended `COS_GATE`: leave unset.** `0.2171` does not separate correct from wrong on this run, and it is not in MiniLM cosine units. Re-run the eval where both models load before setting the gate. Keep `RAG_RERANK` off unless that run shows rerank recall@3 beating cosine.

