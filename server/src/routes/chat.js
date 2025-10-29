const { Router } = require('express');
const { getNPC, NPC_IDS } = require('../npcData');
const memory = require('../memory');
const { chatCompletion } = require('../groqClient');
const { retrieveLoreForQuery } = require('../rag/store');

// --- Helpers ---------------------------------------------------------------
function truncateToSentences(text = '', max = 7) {
  if (!text || max <= 0) return '';
  // Split into sentences, keeping terminal punctuation if present.
  const parts = String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?\s*/g);
  if (!parts) return text.trim();
  const out = parts.slice(0, max).join('').trim();
  return out;
}

function classifyRequest(message, priorUserCount) {
  const m = String(message || '').toLowerCase();
  const isDragon = /dragon\s*quest|ashfang|blackspire|red\s*dragon/.test(m) || (m.includes('dragon') && m.includes('quest'));
  const isTownHistory = /(town\s*history|history\s*of\s*hollowvale|hollowvale\s*history|history\s*of\s*the\s*town)/.test(m);
  const isLeave = /\b(leave|goodbye|farewell|i['’]?m\s*leaving|im\s*leaving|bye|take\s*my\s*leave)\b/.test(m);
  const leaveAfterFive = isLeave && priorUserCount >= 5;

  // Determine sentence cap by rule precedence
  let maxSentences = 7;
  if (leaveAfterFive) maxSentences = 2;
  else if (isDragon) maxSentences = 5; // 4-5 sentences target; we cap at 5
  else if (isTownHistory) maxSentences = 6; // 5-6 target; cap at 6

  return { isDragon, isTownHistory, isLeave, leaveAfterFive, maxSentences };
}

const router = Router();

// POST /api/chat
// Body: { npc: 'bartender'|'wizard'|'rogue', message: string, context?: Array<{role:'user'|'assistant', content:string}> }
router.post('/chat', async (req, res, next) => {
  try {
    const { npc, message, context, ragHints } = req.body || {};
    if (!npc || !message) {
      return res.status(400).json({ error: 'npc and message are required' });
    }

    const npcDef = getNPC(npc);
    if (!npcDef) {
      return res.status(400).json({ error: `Unknown npc. Valid options: ${NPC_IDS.join(', ')}` });
    }

  const history = memory.getHistory(npc);

    // Normalize optional context from client (take last 5 entries, valid roles only)
    let extraContext = Array.isArray(context) ? context.filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-5) : [];

  // Determine brevity rules based on the request and prior Q count
  const priorUserCount = history.filter(m => m && m.role === 'user').length;
  const caps = classifyRequest(message, priorUserCount);

  // Combine persona with global brevity policy (model guidance)
  const systemPrompt = [
    npcDef.systemPrompt,
    '',
    'Brevity policy:',
    '- Keep replies concise, natural, and helpful.',
    '- For any general question: at most 7 sentences.',
    '- If the player asks about the Dragon Quest: 4–5 sentences (do not exceed 5).',
    '- If the player asks for the town history: 5–6 sentences (do not exceed 6).',
    '- After five player questions, if they ask to leave or say goodbye: at most 2 sentences.',
    '- Prefer short paragraphs; avoid numbered lists unless requested.',
  ].join('\n')

    // Build retrieval query with optional hints to improve grounding on short prompts
    let retrievalQuery = message
    if (ragHints && typeof ragHints === 'string' && ragHints.trim()) {
      retrievalQuery = `${message}\n\nHints:${ragHints.startsWith(' ')?'':''} ${ragHints}`.trim()
    }

    // RAG: retrieve up to 3 relevant lore chunks for this player input
    let loreChunks = []
    try {
      loreChunks = await retrieveLoreForQuery(retrievalQuery, 3)
    } catch (e) {
      console.warn('[RAG] retrieval failed, continuing without lore:', e.message)
    }
    const loreSystem = loreChunks.length
      ? {
          role: 'system',
          content:
            `Lore context (for grounding; do not contradict, and don’t quote verbatim unless asked):\n\n` +
            loreChunks.map((t, i) => `— [${i+1}] ${t}`).join('\n\n')
        }
      : null

    // Compose messages: system + (server history + extra context) + latest user
    const baseMessages = [
      { role: 'system', content: systemPrompt },
      ...(loreSystem ? [loreSystem] : []),
      ...history,
      ...extraContext,
      { role: 'user', content: message }
    ].slice(-12); // system + lore + up to 10 more

    const hasKey = !!process.env.GROQ_API_KEY;

  let replyText;

    // Stubbed mode for development without key
    if (!hasKey && process.env.NODE_ENV !== 'production') {
      const style = npcDef.name;
      replyText = `[Stubbed reply from ${style}] I hear you say: "${message}". Alas, my magic is limited without a GROQ_API_KEY.`;
    } else {
      const result = await chatCompletion({
        systemPrompt,
        messages: baseMessages,
        // Always use instant model for responsiveness and lower latency
        model: 'llama-3.1-8b-instant',
      });
      replyText = result.text;
    }

    // Enforce sentence cap server-side to guarantee limits
    const finalReply = truncateToSentences(replyText, caps.maxSentences);

    // Update memory (store last 5 exchanges = 10 messages)
    memory.addExchange(npc, message, finalReply);

    return res.json({ reply: finalReply, npc, meta: { caps } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
