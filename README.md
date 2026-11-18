# Heroes of Hollowvale

A small AI-powered, top-down browser game. Explore Brackenford, the Embered Flagon, and the Cavern of Embers, talk to the bartender powered by the Groq LLM, and hear voiced replies via ElevenLabs TTS. Bartender replies are grounded in `server/src/rag/lore.json`. Place-name canon is `newLore_expanded.txt`.

## Features

- Top-down movement. Brackenford's south door targets the wilderness.
- Bartender chat (Groq LLM) with retrieval-augmented generation from `server/src/rag/lore.json`
- ElevenLabs text-to-speech for bartender replies (auto-plays; volume tied to Options)
- Inventory with drag/swap/merge, hotbar (1–9), Q to attack when the correct weapon is equipped, F to swap with offhand
- Brevity guidance: bartender replies stay within 6 sentences unless necessary, and never exceed 7. The server does not truncate the reply.

## Stack

- Frontend: React 18, Vite, Tailwind CSS, and Phaser 3
- Backend: Node.js + Express on port 5051
- Client: Vite on port 5173. `npm run dev` from the repo root starts both. Vite proxies `/api` to the server.
- Tests: `npm test` runs client Vitest, then server `node --test`
- AI LLM: Groq (`GROQ_API_KEY`). With the key unset, chat returns a stub.
- TTS: ElevenLabs (`ELEVENLABS_API_KEY`). With the key unset, `/api/tts` returns 501.
- RAG: local retrieval from `server/src/rag/lore.json`. Place-name canon is `newLore_expanded.txt`.
- Memory: in-memory per-NPC window of recent turns

## Development

From the repo root, `npm install`, then `npm run dev`. Open http://localhost:5173 (client). The API is Express on port 5051, proxied by Vite at `/api`.

`npm test` runs the unit tests. `npm run build --workspace client` builds the client. CI runs those two commands. Playwright is the separate script `npm run test:e2e`.

## Lore retrieval flags

`/api/chat` and `/api/chat/stream` read two optional env vars. With both unset, replies use the same cosine top-3 lore as before.

- `RAG_RERANK=off|shadow|on` (default `off`). `off` retrieves by cosine and does not call the cross-encoder. `shadow` still injects those cosine chunks and logs `maxCos`, `rerankTopScore`, and `rerankScores`. `on` injects the cross-encoder order.
- `COS_GATE` (optional, used only when `RAG_RERANK=on`). If it is a finite number and the best cosine score is below it, no lore is injected. Unset or non-numeric disables the skip.

Injected lore is logged as `[RAG Lore] mode=<mode> tokens: <n>` and kept at or under 600 whitespace tokens. `node server/eval/run.mjs` prints cosine recall@3, rerank recall@3 when the cross-encoder loads, and a suggested `COS_GATE`. The offline run could not load MiniLM or the cross-encoder (exit 2). Its token-overlap candidate was `0.2171`, and that threshold did not separate correct top hits from wrong ones, so the recommended value is to leave `COS_GATE` unset until the eval is run where both models load. Keep `RAG_RERANK` off unless that run shows rerank recall@3 beating cosine.
