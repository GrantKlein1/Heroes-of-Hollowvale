const { Router } = require('express');
const { getNPC, NPC_IDS } = require('../npcData');
const memory = require('../memory');
const { chatCompletion } = require('../groqClient');
const { retrieveLoreForQuery } = require('../rag/store');

// --- Helpers ---------------------------------------------------------------
function truncateToSentences(text = '', max = 8) {
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
    '- Do not exceed 6 sentences unless absolutely necessary, Never exceed 7 sentences.',
    '- All sentences should be less than 16 words long',
    '- Before responding, verify that sentence count and word count per sentence are within limits.',
    '- Prefer short paragraphs; avoid numbered lists unless specifically requested.',
    '- Here are 3 examples to provide guidance on response length only, not tone, lore, accuracy or anything else.:',
    ' EXAMPLE1: Ashfang Cavern lies beyond the Blackspire Mountains, cloaked in mist and legend.',
    '      From the tavern, follow the winding road directly south of here.',
    '      Take the path through the forest winding and narrow, lined with whispering pines.',
    '      The trail turns sharply right, stones shifting beneath your boots.',
    '      Soon, the mountain yawns open: a jagged mouth of shadow and silence.', 
    'EXAMPLE2: Ashfang Cavern rests beyond the Blackspire Mountains, hidden behind mist and pine.',
    '      Leave the tavern, follow the cobbled road south past the market and old windmill.',
    '      Take the path narrow, winding, and lined with moss-covered stones.',
    '      The trail climbs steadily, wind whispering through the trees.',
    '      Eventually, the mountain opens: a dark mouth carved into jagged rock.',
    'EXAMPLE3: Ashfang Cavern waits in the Blackspires, cloaked in fog and silence.',
    '       From the tavern, take the road that twists past the market and windmill.',
    '       Go left at the fork—steep, slick, and shadowed by looming cliffs.',
    '       The path narrows, stones loose beneath your boots.',
    '       Soon, the cavern appears: wide, dark, and watching.'
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
            `Lore context (for grounding; do not contradict, and don't quote verbatim unless asked):\n\n` +
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
