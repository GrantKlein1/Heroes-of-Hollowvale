const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config(); // also load from project root if present

const { getElevenLabsApiKey, getGroqApiKey } = require('./config/secrets');

const app = express();
const PORT = process.env.PORT || 5051;
const { API_ROUTE_PREFIX } = require('./config/paths');

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
const chatRouter = require('./routes/chat');
app.use(API_ROUTE_PREFIX, chatRouter);
const ttsRouter = require('./routes/tts');
app.use(API_ROUTE_PREFIX, ttsRouter);

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Neural Tavern server listening on http://localhost:${PORT}${API_ROUTE_PREFIX}`);
  console.log(`[keys] groq=${!!getGroqApiKey()} elevenLabs=${!!getElevenLabsApiKey()}`);
});
