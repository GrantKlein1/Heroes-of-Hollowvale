// Simple in-memory store of recent conversations per NPC
// Stores up to 10 messages (5 exchanges): user/assistant pairs

const MAX_MESSAGES = 10;
const store = new Map(); // npcId -> [{ role, content }]

function getHistory(npcId) {
  return [...(store.get(npcId) || [])];
}

function addExchange(npcId, userMsg, assistantMsg) {
  const history = store.get(npcId) || [];
  history.push({ role: 'user', content: userMsg });
  history.push({ role: 'assistant', content: assistantMsg });
  store.set(npcId, history.slice(-MAX_MESSAGES));
}

function reset(npcId) {
  store.set(npcId, []);
}

module.exports = { getHistory, addExchange, reset };
