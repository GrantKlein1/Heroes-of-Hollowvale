const { Router } = require('express');
const { getNPC, NPC_IDS } = require('../npcData');
const memory = require('../memory');
const { chatCompletion } = require('../groqClient');

const router = Router();

// POST /api/chat
// Body: { npc: 'bartender'|'wizard'|'rogue', message: string, context?: Array<{role:'user'|'assistant', content:string}> }
router.post('/chat', async (req, res, next) => {
  try {
    const { npc, message, context } = req.body || {};
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

  // Use the NPC's native system prompt without brevity constraints to avoid truncating longer answers
  const systemPrompt = npcDef.systemPrompt;

    // Compose messages: system + (server history + extra context) + latest user
    const baseMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      ...extraContext,
      { role: 'user', content: message }
    ].slice(-11); // keep within small window (system + up to 10)

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

    // Update memory (store last 5 exchanges = 10 messages)
    memory.addExchange(npc, message, replyText);

    return res.json({ reply: replyText, npc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
