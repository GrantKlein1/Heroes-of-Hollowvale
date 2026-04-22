const { Router } = require('express');
const { getNPC, NPC_IDS } = require('../npcData');
const memory = require('../memory');
const { chatCompletion } = require('../groqClient');
const { retrieveLoreForQuery } = require('../rag/store');

// --- Helpers ---------------------------------------------------------------
const MAX_CLIENT_CONTEXT_MESSAGES = 5;
const MAX_MODEL_CONTEXT_MESSAGES = 10;

const BREVITY_SYSTEM_POLICY = [
  'Brevity policy:',
  '- Keep replies concise, natural, and in character.',
  '- Target 4 to 6 sentences; use 7 only when truly needed.',
  '- Keep each sentence under about 16 words.',
  '- Avoid numbered lists unless specifically requested.',
  '- Ground answers in provided lore when relevant.'
].join('\n');

function classifyRequest(message, priorUserCount) {
  const m = String(message || '').toLowerCase();
  const isDragon = /dragon\s*quest|ashfang|blackspire|red\s*dragon/.test(m) || (m.includes('dragon') && m.includes('quest'));
  const isTownHistory = /(town\s*history|history\s*of\s*hollowvale|hollowvale\s*history|history\s*of\s*the\s*town)/.test(m);
  const isLeave = /\b(leave|goodbye|farewell|i['’]?m\s*leaving|im\s*leaving|bye|take\s*my\s*leave)\b/.test(m);
  const leaveAfterFive = isLeave && priorUserCount >= 5;

  // Unified sentence cap across all responses
  const maxSentences = 8;
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

    // Normalize optional context from client (last few valid entries only)
    const extraContext = Array.isArray(context)
      ? context
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
          .slice(-MAX_CLIENT_CONTEXT_MESSAGES)
      : [];

  // Determine brevity rules based on the request and prior Q count
  const priorUserCount = history.filter(m => m && m.role === 'user').length;
  const caps = classifyRequest(message, priorUserCount);

    // Combine persona with concise global brevity policy.
    const systemPrompt = `${npcDef.systemPrompt}\n\n${BREVITY_SYSTEM_POLICY}`;

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
            `Lore context (for grounding; do not contradict, and don't quote verbatim unless asked):\n\n` +
            loreChunks.map((t, i) => `— [${i+1}] ${t}`).join('\n\n')
        }
      : null

    // Compose messages while preserving system/lore entries.
    // We only trim the conversational tail.
    const mergedContext = [...history, ...extraContext];
    const dedupedContext = [];
    const seen = new Set();
    for (const m of mergedContext) {
      const key = `${m.role}:${m.content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedContext.push(m);
    }
    const conversationalTail = [...dedupedContext, { role: 'user', content: message }]
      .slice(-MAX_MODEL_CONTEXT_MESSAGES);
    const baseMessages = [
      { role: 'system', content: systemPrompt },
      ...(loreSystem ? [loreSystem] : []),
      ...conversationalTail,
    ];

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

  // Do not truncate server-side; rely on model guidance above
  const finalReply = String(replyText || '').trim();

    // Update memory (store last 5 exchanges = 10 messages)
    memory.addExchange(npc, message, finalReply);

    return res.json({ reply: finalReply, npc, meta: { caps } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
