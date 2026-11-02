// NPC chat prompt assembly.
// The system prompt and lore message are pinned; only the dialogue window is trimmed.

const MAX_CONVO_MESSAGES = 8;

function normalizeContent(content) {
  return String(content ?? '').replace(/\s+/g, ' ').trim();
}

function isDialogueTurn(message) {
  return !!message
    && (message.role === 'user' || message.role === 'assistant')
    && normalizeContent(message.content) !== '';
}

function turnKey(message) {
  return `${message.role}\u0000${normalizeContent(message.content)}`;
}

/**
 * Assemble Groq messages for one NPC reply.
 * Conversation is server history, then client context that is not already in
 * that history (same role + whitespace-normalized content), kept in order and
 * trimmed to the last 8 turns.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {{role?:string, content?:string}|null} [opts.loreSystem]
 * @param {Array<{role:string, content:string}>} [opts.history]
 * @param {Array<{role:string, content:string}>} [opts.extraContext]
 * @param {string} opts.userMessage
 * @returns {Array<{role:string, content:string}>}
 */
function buildMessages({
  systemPrompt,
  loreSystem = null,
  history = [],
  extraContext = [],
  userMessage,
} = {}) {
  const historyTurns = (Array.isArray(history) ? history : []).filter(isDialogueTurn);
  const seenInHistory = new Set(historyTurns.map(turnKey));

  const contextTurns = [];
  for (const entry of Array.isArray(extraContext) ? extraContext : []) {
    if (!isDialogueTurn(entry)) continue;
    if (seenInHistory.has(turnKey(entry))) continue;
    contextTurns.push(entry);
  }

  const convo = [...historyTurns, ...contextTurns]
    .slice(-MAX_CONVO_MESSAGES)
    .map((message) => ({ role: message.role, content: String(message.content) }));

  const messages = [{ role: 'system', content: String(systemPrompt ?? '') }];

  const loreContent = loreSystem ? String(loreSystem.content ?? '') : '';
  if (normalizeContent(loreContent) !== '') {
    messages.push({ role: 'system', content: loreContent });
  }

  messages.push(...convo);
  messages.push({ role: 'user', content: String(userMessage ?? '') });
  return messages;
}

/**
 * Token budget for NPC chat replies.
 * GROQ_MAX_TOKENS overrides; invalid or empty values fall back to 200.
 * @param {string|number|undefined|null} raw
 * @returns {number}
 */
function resolveNpcChatMaxTokens(raw) {
  if (raw == null || String(raw).trim() === '') return 200;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.floor(n);
}

export { buildMessages, resolveNpcChatMaxTokens };
