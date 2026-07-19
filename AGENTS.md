# Heroes of Hollowvale (neural-tavern)

An AI-powered, top-down browser RPG. npm workspaces monorepo:
- `client/` — React 18 + Vite + Tailwind frontend (dev server on port `5173`).
- `server/` — Node.js + Express backend (port `5051`, `PORT` overridable). Serves `/api/chat`, `/api/tts`, `/api/health`. Chat uses Groq LLM grounded in local lore via RAG; TTS proxies ElevenLabs.

## Cursor Cloud specific instructions

- Run both services with `npm run dev` from the repo root (uses `concurrently`: server on `5051`, client on `5173`). The Vite dev server proxies `/api` → `http://localhost:5051`, so hit the app at `http://localhost:5173`.
- There are no automated tests and no lint script defined in any `package.json`. Build the client with `npm run build --workspace client`; the server has no build step.
- API keys are optional for local dev. With `GROQ_API_KEY` unset, `POST /api/chat` returns a stubbed reply (see `server/src/routes/chat.js`), so the game and chat UI are fully exercisable end-to-end without any secrets. Do NOT put placeholder values like `your_key_here` in `.env` — any non-empty `GROQ_API_KEY` forces a real Groq call that will fail. To enable real AI chat, set a valid `GROQ_API_KEY`; `ELEVENLABS_API_KEY` (voice) is optional and `/api/tts` returns HTTP 501 without it.
- Known gotcha (npm optional-deps bug): the committed `package-lock.json` can trigger `Error: Cannot find module @rollup/rollup-linux-x64-gnu` when Vite starts, which crashes only the client (the server still runs). Fix is a clean reinstall: `rm -rf node_modules package-lock.json && npm install`. The startup update script already does this, so a plain `npm install` on top of the committed lockfile may not be enough.
- RAG lore is prebuilt: `server/src/rag/lore.json` is committed and loads at startup ("[RAG] Loaded N lore chunks"). Regenerating it (`server/tools/embed_lore.js`) is optional and not needed to run the app.
