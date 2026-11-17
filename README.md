# Heroes of Hollowvale

A small AI‑powered, top‑down browser game. Explore the village, tavern, and dungeon, talk to the bartender powered by the Groq LLM, and hear voiced replies via ElevenLabs TTS. Replies are grounded in your lore (RAG) from `newLore.txt`.

## Features

- Top‑down movement across scenes: Village → Path → Dungeon Entrance → Dungeon Interior → Hidden Treasure Room
- Bartender chat (Groq LLM) with Retrieval‑Augmented Generation from your lore
- ElevenLabs Text‑to‑Speech for bartender replies (auto‑plays; volume tied to Options)
- Inventory with drag/swap/merge, hotbar (1–9), Q to attack when correct weapon is equipped, F to swap with offhand
- Secret: top‑left E‑zone in dungeon entrance leads to a treasure room; exit returns you to the exact entry spot
- Animated fire GIF centered in dungeon interior
- Brevity guidance: bartender aims for 5–6 sentences; only when necessary up to 8 (no server truncation)

## Stack

- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js + Express
- AI LLM: Groq (GROQ_API_KEY)
- TTS: ElevenLabs (ELEVENLABS_API_KEY)
- RAG: Local file retrieval from `server/src/rag/lore.json` (embedded from `newLore.txt`)
- Memory: In‑memory per‑NPC window of recent turns

## Lore retrieval flags

`/api/chat` and `/api/chat/stream` read two optional env vars. With both unset, replies use the same cosine top-3 lore as before.

- `RAG_RERANK=off|shadow|on` (default `off`). `off` retrieves by cosine and does not call the cross-encoder. `shadow` still injects those cosine chunks and logs `maxCos`, `rerankTopScore`, and `rerankScores`. `on` injects the cross-encoder order.
- `COS_GATE` (optional, used only when `RAG_RERANK=on`). If it is a finite number and the best cosine score is below it, no lore is injected. Unset or non-numeric disables the skip.

Injected lore is logged as `[RAG Lore] mode=<mode> tokens: <n>` and kept at or under 600 whitespace tokens. `node server/eval/run.mjs` prints cosine recall@3, rerank recall@3 when the cross-encoder loads, and a suggested `COS_GATE`. The offline run could not load MiniLM or the cross-encoder (exit 2). Its token-overlap candidate was `0.2171`, and that threshold did not separate correct top hits from wrong ones, so the recommended value is to leave `COS_GATE` unset until the eval is run where both models load. Keep `RAG_RERANK` off unless that run shows rerank recall@3 beating cosine.
