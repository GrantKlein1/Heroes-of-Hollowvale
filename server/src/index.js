import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { API_ROUTE_PREFIX } from './config/paths.js';
import chatRouter from './routes/chat.js';
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
  res.json({ status: 'ok', service: 'neural-tavern', time: new Date().toISOString() });
});

// Routes
app.use(API_ROUTE_PREFIX, chatRouter);
app.use(API_ROUTE_PREFIX, ttsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Neural Tavern server listening on http://localhost:${PORT}${API_ROUTE_PREFIX}`);
});
