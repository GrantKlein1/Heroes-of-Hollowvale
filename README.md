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