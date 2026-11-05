// In-memory store of recent conversations per (sessionId, npc)
// Stores up to 10 messages (5 exchanges): user/assistant pairs per session and NPC.
// LRU and TTL capped so memory cannot grow unbounded.

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let maxEntries = DEFAULT_MAX_ENTRIES;
let ttlMs = DEFAULT_TTL_MS;

// Map maintains insertion order: oldest accessed key is at the front, newest at the back.
const store = new Map();

function makeKey(sessionId, npcId) {
  const s = (sessionId != null && String(sessionId).trim()) ? String(sessionId).trim() : 'anonymous';
  const n = (npcId != null && String(npcId).trim()) ? String(npcId).trim() : 'unknown';
  return `${s}::${n}`;
}

function isExpired(entry, now = Date.now()) {
  if (!entry || !ttlMs || ttlMs <= 0) return false;
  return (now - entry.updatedAt) > ttlMs;
}

function evictOldest() {
  while (store.size > maxEntries) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

/**
 * Retrieve conversation history for a given session and NPC.
 * Supports getHistory(sessionId, npcId) and backward-compatible getHistory(npcId).
 */
function getHistory(arg1, arg2) {
  let sessionId, npcId;
  if (arguments.length <= 1) {
    sessionId = 'anonymous';
    npcId = arg1;
  } else {
    sessionId = arg1;
    npcId = arg2;
  }

  const key = makeKey(sessionId, npcId);
  const entry = store.get(key);
  if (!entry) return [];

  const now = Date.now();
  if (isExpired(entry, now)) {
    store.delete(key);
    return [];
  }

  // Refresh LRU order on access
  entry.updatedAt = now;
  store.delete(key);
  store.set(key, entry);

  return [...entry.messages];
}

/**
 * Record a user/assistant exchange for a given session and NPC.
 * Supports addExchange(sessionId, npcId, userMsg, assistantMsg)
 * and backward-compatible addExchange(npcId, userMsg, assistantMsg).
 */
function addExchange(arg1, arg2, arg3, arg4) {
  let sessionId, npcId, userMsg, assistantMsg;
  if (arguments.length <= 3) {
    sessionId = 'anonymous';
    npcId = arg1;
    userMsg = arg2;
    assistantMsg = arg3;
  } else {
    sessionId = arg1;
    npcId = arg2;
    userMsg = arg3;
    assistantMsg = arg4;
  }

  const key = makeKey(sessionId, npcId);
  const now = Date.now();
  let entry = store.get(key);

  if (entry && isExpired(entry, now)) {
    store.delete(key);
    entry = null;
  }

  if (!entry) {
    entry = { messages: [], updatedAt: now };
  } else {
    entry.updatedAt = now;
  }

  entry.messages.push({ role: 'user', content: userMsg });
  entry.messages.push({ role: 'assistant', content: assistantMsg });

  if (entry.messages.length > 10) {
    entry.messages = entry.messages.slice(-10);
  }

  // Re-insert at end of Map (most recently used)
  store.delete(key);
  store.set(key, entry);

  // Evict if over capacity
  evictOldest();
}

/**
 * Reset memory for a given session/npc or reset everything if no args.
 */
function reset(arg1, arg2) {
  if (arguments.length === 0) {
    store.clear();
    return;
  }
  if (arguments.length === 1) {
    // If single arg, check if key exists or clear matching npc
    for (const key of Array.from(store.keys())) {
      if (key === `anonymous::${arg1}` || key.endsWith(`::${arg1}`) || key.startsWith(`${arg1}::`)) {
        store.delete(key);
      }
    }
    return;
  }
  const key = makeKey(arg1, arg2);
  store.delete(key);
}

/**
 * Helper to configure store limits for testing or custom runtime configurations.
 */
function configureMemory({ maxEntries: newMax, ttlMs: newTtl } = {}) {
  if (typeof newMax === 'number' && newMax >= 0) {
    maxEntries = newMax;
    evictOldest();
  }
  if (typeof newTtl === 'number' && newTtl >= 0) {
    ttlMs = newTtl;
  }
}

/**
 * Reset store state and restore default configuration.
 */
function resetMemoryStore() {
  store.clear();
  maxEntries = DEFAULT_MAX_ENTRIES;
  ttlMs = DEFAULT_TTL_MS;
}

/**
 * Get current store size.
 */
function getStoreSize() {
  return store.size;
}

export {
  getHistory,
  addExchange,
  reset,
  configureMemory,
  resetMemoryStore,
  getStoreSize,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL_MS,
};
