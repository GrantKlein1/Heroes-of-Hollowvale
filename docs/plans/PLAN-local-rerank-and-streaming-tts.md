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

