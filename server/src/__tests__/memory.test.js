import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHistory,
  addExchange,
  reset,
  configureMemory,
  resetMemoryStore,
  getStoreSize,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL_MS,
} from '../memory.js';

beforeEach(() => {
  resetMemoryStore();
});

test('session isolation: two sessionIds talking to the same NPC get separate histories', () => {
  addExchange('session-alpha', 'bartender', 'Hello barkeep!', 'Welcome to the tavern, traveler.');
  addExchange('session-beta', 'bartender', 'What drinks do you have?', 'We have fine dwarven ale.');

  const historyAlpha = getHistory('session-alpha', 'bartender');
  const historyBeta = getHistory('session-beta', 'bartender');

  assert.deepEqual(historyAlpha, [
    { role: 'user', content: 'Hello barkeep!' },
    { role: 'assistant', content: 'Welcome to the tavern, traveler.' },
  ]);

  assert.deepEqual(historyBeta, [
    { role: 'user', content: 'What drinks do you have?' },
    { role: 'assistant', content: 'We have fine dwarven ale.' },
  ]);
});

test('npc isolation: same sessionId talking to different NPCs gets separate histories', () => {
  addExchange('session-1', 'bartender', 'One cider please.', 'Coming right up.');
  addExchange('session-1', 'wizard', 'Teach me a spell.', 'Magic requires discipline.');

  const bartenderHistory = getHistory('session-1', 'bartender');
  const wizardHistory = getHistory('session-1', 'wizard');

  assert.equal(bartenderHistory.length, 2);
  assert.equal(bartenderHistory[0].content, 'One cider please.');

  assert.equal(wizardHistory.length, 2);
  assert.equal(wizardHistory[0].content, 'Teach me a spell.');
});

test('LRU capacity eviction: inserting beyond capacity evicts the oldest entry', () => {
  configureMemory({ maxEntries: 3, ttlMs: 60000 });

  addExchange('session-1', 'bartender', 'u1', 'a1');
  addExchange('session-2', 'bartender', 'u2', 'a2');
  addExchange('session-3', 'bartender', 'u3', 'a3');

  assert.equal(getStoreSize(), 3);

  // Adding 4th entry exceeds maxEntries=3 -> oldest ('session-1::bartender') should be evicted
  addExchange('session-4', 'bartender', 'u4', 'a4');

  assert.equal(getStoreSize(), 3);
  assert.deepEqual(getHistory('session-1', 'bartender'), []);
  assert.equal(getHistory('session-2', 'bartender').length, 2);
  assert.equal(getHistory('session-3', 'bartender').length, 2);
  assert.equal(getHistory('session-4', 'bartender').length, 2);
});

test('LRU recency update: reading an entry refreshes recency and preserves it over older unread entries', () => {
  configureMemory({ maxEntries: 2, ttlMs: 60000 });

  addExchange('session-1', 'bartender', 'u1', 'a1');
  addExchange('session-2', 'bartender', 'u2', 'a2');

  // Reading session-1 refreshes its position to most-recently-used
  const read = getHistory('session-1', 'bartender');
  assert.equal(read.length, 2);

  // Now adding session-3 should evict session-2 (now oldest), keeping session-1
  addExchange('session-3', 'bartender', 'u3', 'a3');

  assert.equal(getStoreSize(), 2);
  assert.deepEqual(getHistory('session-2', 'bartender'), []);
  assert.equal(getHistory('session-1', 'bartender').length, 2);
  assert.equal(getHistory('session-3', 'bartender').length, 2);
});

test('TTL expiration: entries older than ttlMs expire and return empty history', async () => {
  configureMemory({ maxEntries: 10, ttlMs: 30 });

  addExchange('session-ttl', 'bartender', 'Will you remember me?', 'For a short time.');
  assert.equal(getHistory('session-ttl', 'bartender').length, 2);

  // Wait for TTL to pass
  await new Promise((resolve) => setTimeout(resolve, 45));

  const expiredHistory = getHistory('session-ttl', 'bartender');
  assert.deepEqual(expiredHistory, []);
});

test('message history limit: keeps only the last 10 messages (5 exchanges) per session and NPC', () => {
  for (let i = 1; i <= 7; i++) {
    addExchange('session-limit', 'bartender', `User message ${i}`, `Assistant reply ${i}`);
  }

  const history = getHistory('session-limit', 'bartender');
  assert.equal(history.length, 10);
  assert.equal(history[0].content, 'User message 3');
  assert.equal(history[1].content, 'Assistant reply 3');
  assert.equal(history[8].content, 'User message 7');
  assert.equal(history[9].content, 'Assistant reply 7');
});

test('reset: clears specific session/npc or entire store', () => {
  addExchange('s1', 'bartender', 'u1', 'a1');
  addExchange('s2', 'bartender', 'u2', 'a2');

  // Targeted reset
  reset('s1', 'bartender');
  assert.deepEqual(getHistory('s1', 'bartender'), []);
  assert.equal(getHistory('s2', 'bartender').length, 2);

  // Full reset
  reset();
  assert.equal(getStoreSize(), 0);
  assert.deepEqual(getHistory('s2', 'bartender'), []);
});

test('backward compatibility: single argument or null sessionId defaults to anonymous session', () => {
  addExchange('bartender', 'legacy user msg', 'legacy reply');

  assert.equal(getHistory('bartender').length, 2);
  assert.equal(getHistory('anonymous', 'bartender').length, 2);
  assert.equal(getHistory(null, 'bartender').length, 2);
});
