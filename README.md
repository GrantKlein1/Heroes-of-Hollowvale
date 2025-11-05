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

## Quick Start (Windows)

1) Install dependencies
- Server
  ```powershell
  cd ".\server"
  npm install
  ```
- Client
  ```powershell
  cd "..\client"
  npm install
  ```

2) Add environment variables (server/.env)
```env
# server/.env
GROQ_API_KEY=your_groq_key
ELEVENLABS_API_KEY=your_elevenlabs_key
# Optional defaults
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
PORT=5051
RAG_DEBUG=1
```

3) Prepare lore (RAG) from newLore.txt
- Recommended (Python one‑time embedding)
  ```powershell
  cd ".\server\tools"
  pip install sentence-transformers numpy
  python ".\embed_lore.py" "..\..\newLore.txt"
  ```
  This writes `server/src/rag/lore.json`.

4) Run
- Server (from server/)
  ```powershell
  node ".\src\index.js"
  ```
  API at http://localhost:5051/api
- Client (from client/)
  ```powershell
  npx vite --host
  ```
  UI at http://localhost:5173

Notes:
- Do not commit .env files or keys.
- If `lore.json` is missing, chat still works but without lore grounding.

## How RAG Works

- Your `newLore.txt` is embedded into chunks (text + vectors) stored in `server/src/rag/lore.json`.
- On every `/api/chat`, the server retrieves top‑K relevant lore chunks for the user’s message and injects them into the system context before calling Groq.
- Client requests are concise (e.g., “Tell me about the Dragon Quest.”); the server prompt enforces brevity and grounding.

Re‑embed whenever `newLore.txt` changes (run step 3 again).

## API

- POST /api/chat
  - Body: `{ npc: "bartender", message: string, context?: Message[], ragHints?: string }`
  - Returns: `{ reply: string }`
- POST /api/tts
  - Body: `{ text: string, voiceId?: string, modelId?: string, outputFormat?: string }`
  - Returns: audio/mpeg bytes (used by the client to auto‑play bartender speech)

Quick TTS test:
```powershell
curl -sS -X POST http://localhost:5051/api/tts ^
  -H "Content-Type: application/json" ^
  -d "{\"text\":\"Greetings from Hollowvale.\"}" ^
  --output tts_test.mp3
start .\tts_test.mp3
```

## Controls

- Movement: WASD or Arrow Keys
- Interact: E (tavern door, exits, dungeon entrances, treasure room)
- Inventory: V (drag/swap/merge; right‑click splits or places 1)
- Hotbar: 1–9 select; Q drops one from selected; F swaps selected with offhand
- Options: button at top‑right (volume affects music and TTS)
- Debug picker: F2 or ` (shows normalized coordinates)

## Assets

- Place images under `client/public/images/` (see `client/src/config/paths.js`).
- Title images: `PATHS.titleBg`, `PATHS.titleLogo`
- Backgrounds: village, tavern, path, dungeon entrance, dungeon interior, hiddenTreasureRoom.png
- Animated fire: `images/animatedFireSmall/animatedFireSmall.gif`

## Development Notes

- Server listens on port 5051 by default; adjust with `PORT`.
- RAG logging: set `RAG_DEBUG=1` to print retrieval info to the server console.
- Replies are not truncated server‑side; brevity is enforced via system prompt (aim 5–6, up to 8 when needed).
