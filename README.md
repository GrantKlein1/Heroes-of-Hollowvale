# Heroes of Hollowvale
A small AI-powered browser game where you enter a cozy medieval tavern and chat with multiple NPCs (Bartender, Wizard, Rogue), each with a distinct personality powered by the Groq LLM API.

## Stack
- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js + Express
- AI: Groq LLM API (via environment variable)
- Memory: In-memory store per NPC (last 5 exchanges)

## Quick Start

1. Create an `.env` at the project root (or in `server/.env`) using the example:

```
GROQ_API_KEY=your_key_here
```

2. Install dependencies:

```
npm install
```

3. Run both client and server in dev mode:

```
npm run dev
```

- Client: http://localhost:5173
- Server API: http://localhost:5050/api

If `GROQ_API_KEY` is not set and `NODE_ENV=development`, the server returns stubbed replies so you can try the UI.

## Folder Structure
```
.
├── client/          # Vite + React + Tailwind frontend
├── server/          # Express backend with Groq integration
├── .env.example     # Copy to .env and add your GROQ key
├── package.json     # Workspaces + root scripts
└── README.md
```

## Notes
- Place game images under `client/public/images/`. For example, put the tavern background at `client/public/images/tavern.jpg` and reference it in code as `/images/tavern.jpg`. The app falls back to a gradient if missing.
- Personalities and memory are defined on the server in `src/npcData.js` and `src/memory.js`.
- This is a prototype—no database yet; memory resets on server restart.

### Centralized paths (change filenames in one place)

- Client paths: `client/src/config/paths.js`
	- API_BASE (defaults to `/api` or `VITE_API_BASE`)
	- IMAGES_BASE (defaults to `/images`)
	- PATHS: background/title images
	- CLASS_SPRITES: per-class base sprites
	- ITEM_ICONS: per-item icon filenames
	- DEFAULT_ITEM_ICON and COMPOSITE_SPRITES map (explicit per-class overlays)

- Server paths: `server/src/config/paths.js`
	- API_ROUTE_PREFIX (defaults to `/api`)
	- LORE_JSON_PATH (defaults to `server/src/rag/lore.json`)
	- GROQ_API_URL (Groq endpoint)

Edit these files to match your actual filenames and folder layout—no need to hunt through components or route handlers.

## Lore Retrieval (RAG-lite)
Ground replies in your own lore without fine‑tuning. The server can retrieve the most relevant lore chunks and inject them as system context for each `/api/chat` call.

1) Prepare and embed your lore (one‑time):

	 - Put your `lore.txt` anywhere.
	 - Install tools for embedding (Python):

		 ```cmd
		 pip install sentence-transformers numpy
		 ```

	 - Run the embed script:

		 ```cmd
		 cd "server\tools"
		 python embed_lore.py "..\..\lore.txt"
		 ```

	 - This writes `server/src/rag/lore.json` with chunk texts + vectors.

2) Enable retrieval (optional):

	 - Ensure `server/src/rag/lore.json` exists (from step 1). No API tokens are required.
	 - If `lore.json` is missing, the server skips retrieval gracefully.

How it works:

## Local embeddings (offline RAG)

The server can compute embeddings locally using Transformers.js, so you don’t need a Hugging Face Inference API token:

- Dependency: `@xenova/transformers` (installed under the `server` workspace)
- Model: `Xenova/all-MiniLM-L6-v2` (quantized). It downloads on first run and is cached.
- No external calls are made for embeddings at runtime.

Notes:
- You can keep using your existing `server/src/rag/lore.json` produced by the Python script.
- If embeddings are temporarily unavailable, the server gracefully falls back to a simple token-overlap similarity so chat continues to work.

- At runtime, the server embeds the player’s message locally via Transformers.js, ranks the top‑K similar lore chunks (cosine), and injects them as a system message before calling Groq.
- Files:
	- `server/src/rag/embeddings_local.js` — local embeddings via Transformers.js.
	- `server/src/rag/store.js` — loads `lore.json` and retrieves relevant chunks.
	- `server/src/routes/chat.js` — injects lore system context when available.

## Troubleshooting
- If ports conflict, change Vite dev server port in `client/vite.config.js` and API port via `PORT` env for the server.
- On Windows, commands are `npm`-friendly; no bash-specific scripts are used.
