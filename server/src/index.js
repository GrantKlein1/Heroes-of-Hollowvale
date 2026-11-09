import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { API_ROUTE_PREFIX } from './config/paths.js';
import { getElevenLabsApiKey, getGroqApiKey } from './config/secrets.js';
import { warmupReranker } from './rag/rerank.js';
import { attachWsTts, isWsTtsEnabled } from './tts/wsTts.js';
import chatRouter from './routes/chat.js';
import chatStreamRouter from './routes/chatStream.js';
import ttsRouter from './routes/tts.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config(); // also load from project root if present

const app = express();
const PORT = process.env.PORT || 5051;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health
app.get(`${API_ROUTE_PREFIX}/health`, (req, res) => {
  res.json({
    status: 'ok',
    service: 'neural-tavern',
    time: new Date().toISOString(),
    keys: {
      groq: !!getGroqApiKey(),
      elevenLabs: !!getElevenLabsApiKey(),
    },
  });
});

// Routes
app.use(API_ROUTE_PREFIX, chatRouter);
app.use(API_ROUTE_PREFIX, chatStreamRouter);
app.use(API_ROUTE_PREFIX, ttsRouter);

// Error handler
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Neural Tavern server listening on http://localhost:${PORT}${API_ROUTE_PREFIX}`);
  console.log(`[keys] groq=${!!getGroqApiKey()} elevenLabs=${!!getElevenLabsApiKey()}`);
  if (isWsTtsEnabled()) {
    console.log('[TTS] WebSocket TTS mode enabled (Option A) on /api/tts/ws');
  }
  warmupReranker().then((ok) => {
    if (ok) console.log('[RAG Rerank] Cross-encoder warmup complete');
  }).catch((err) => {
    console.warn('[RAG Rerank] Warmup warning:', err?.message || err);
  });
});

if (isWsTtsEnabled()) {
  attachWsTts(server);
}
