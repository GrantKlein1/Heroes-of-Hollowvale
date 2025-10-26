const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config(); // also load from project root if present

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'neural-tavern', time: new Date().toISOString() });
});

// Routes
const chatRouter = require('./routes/chat');
app.use('/api', chatRouter);

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Neural Tavern server listening on http://localhost:${PORT}`);
});
