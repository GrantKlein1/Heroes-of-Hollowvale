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

## Troubleshooting
- If ports conflict, change Vite dev server port in `client/vite.config.js` and API port via `PORT` env for the server.
- On Windows, commands are `npm`-friendly; no bash-specific scripts are used.
