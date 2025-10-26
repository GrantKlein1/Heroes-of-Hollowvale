const axios = require('axios');

/**
 * Calls Groq chat completions API using an OpenAI-compatible endpoint.
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {Array<{role:string, content:string}>} opts.messages - Must include system and user messages
 * @param {string} [opts.model]
 * @returns {Promise<{text:string, raw?:any}>}
 */
async function chatCompletion({ systemPrompt, messages, model }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Set it in your .env to enable real replies.');
  }

  // Enforce instant mode only (performance/cost optimized)
  const candidates = [
    'llama-3.1-8b-instant'
  ];

  // Ensure first message is system
  let msgs = messages || [];
  if (!msgs.length || msgs[0]?.role !== 'system') {
    msgs = [{ role: 'system', content: systemPrompt || '' }, ...msgs];
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  let lastErr;
  for (const m of candidates) {
    try {
      const response = await axios.post(
        url,
        {
          model: m,
          messages: msgs,
          temperature: 0.8,
          // Allow longer responses to avoid truncation
          max_tokens: 1024,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      const choice = response?.data?.choices?.[0];
      const text = choice?.message?.content ?? '';
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Groq] using model: ${m}`);
      }
      return { text, raw: response.data };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg = (data && (data.error?.message || data.message)) || err.message;

      // If it's a model issue (400 invalid/unknown/decommissioned), try next candidate
      const isModelIssue =
        status === 400 && /model|decommission|not\s*found|unknown/i.test(String(msg));

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Groq] model '${m}' failed (${status}): ${msg}`);
      }

      lastErr = err;
      if (isModelIssue) continue; // try next model

      // Not a model issue -> rethrow with more context
      const code = data?.error?.type || data?.error?.code;
      const enriched = new Error(`Groq API ${status || ''} ${code || ''}: ${msg}`.trim());
      enriched.status = 502;
      throw enriched;
    }
  }

  // All candidates failed: surface last error with context
  const status = lastErr?.response?.status;
  const data = lastErr?.response?.data;
  const msg = (data && (data.error?.message || data.message)) || lastErr?.message || 'Unknown error';
  const code = data?.error?.type || data?.error?.code;
  const finalErr = new Error(`Groq API ${status || ''} ${code || ''}: ${msg}`.trim());
  finalErr.status = 502;
  throw finalErr;
}

module.exports = { chatCompletion };
