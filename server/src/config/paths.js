// Centralized server paths and URLs
const path = require('path')

// Route prefix for the API (must match client proxy and API_BASE)
const API_ROUTE_PREFIX = process.env.API_ROUTE_PREFIX || '/api'

// Location of embedded lore JSON used by RAG
const LORE_JSON_PATH = process.env.LORE_JSON_PATH || path.resolve(__dirname, '../rag/lore.json')

// Groq API endpoint (OpenAI-compatible)
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions'

module.exports = { API_ROUTE_PREFIX, LORE_JSON_PATH, GROQ_API_URL }
