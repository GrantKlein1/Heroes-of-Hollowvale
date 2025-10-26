// Simple in-memory store of recent conversations per NPC
// Stores up to 10 messages (5 exchanges): user/assistant pairs

const store = {
  // npcId: [ { role: 'user'|'assistant', content: string } ]
};

function getHistory(npcId) {
  return store[npcId] ? [...store[npcId]] : [];
}

function addExchange(npcId, userMsg, assistantMsg) {
  if (!store[npcId]) store[npcId] = [];
  store[npcId].push({ role: 'user', content: userMsg });
  store[npcId].push({ role: 'assistant', content: assistantMsg });
  // Keep only last 10 messages
  if (store[npcId].length > 10) {
    store[npcId] = store[npcId].slice(-10);
  }
}

function reset(npcId) {
  store[npcId] = [];
}

module.exports = { getHistory, addExchange, reset };
