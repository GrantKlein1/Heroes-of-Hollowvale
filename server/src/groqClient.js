import axios from 'axios';
import { GROQ_API_URL } from './config/paths.js';
import { getGroqApiKey } from './config/secrets.js';
import { resolveNpcChatMaxTokens } from './buildMessages.js';

function clampMaxTokens(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * Calls Groq chat completions API using an OpenAI-compatible endpoint.
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {Array<{role:string, content:string}>} opts.messages - Must include system and user messages
 * @param {string} [opts.model]
 * @param {number} [opts.maxTokens] Completion budget. Defaults to GROQ_MAX_TOKENS
 *   or 200. Pass a larger value when a caller needs a longer completion.
 * @returns {Promise<{text:string, raw?:any}>}
 */
async function chatCompletion({ systemPrompt, messages, model, maxTokens }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key is not set (expected GROQ_API_KEY or groqCloudKey).');
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

  const url = GROQ_API_URL;

  let lastErr;
  for (const m of candidates) {
    try {
      const response = await axios.post(
        url,
        {
          model: m,
          messages: msgs,
          temperature: 0.8,
          max_tokens: clampMaxTokens(
            maxTokens,
            resolveNpcChatMaxTokens(process.env.GROQ_MAX_TOKENS),
          ),
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

/**
 * Calls Groq chat completions API with streaming over an OpenAI-compatible SSE endpoint.
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {Array<{role:string, content:string}>} opts.messages
 * @param {string} [opts.model]
 * @param {number} [opts.maxTokens]
 * @param {Function} [opts.onDelta] (deltaText: string) => void
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{text:string}>}
 */
async function chatCompletionStream({ systemPrompt, messages, model, maxTokens, onDelta, signal }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key is not set (expected GROQ_API_KEY or groqCloudKey).');
  }

  const candidates = [
    'llama-3.1-8b-instant'
  ];

  let msgs = messages || [];
  if (!msgs.length || msgs[0]?.role !== 'system') {
    msgs = [{ role: 'system', content: systemPrompt || '' }, ...msgs];
  }

  const url = GROQ_API_URL;
  let lastErr;

  for (const m of candidates) {
    try {
      const response = await axios.post(
        url,
        {
          model: m,
          messages: msgs,
          temperature: 0.8,
          max_tokens: clampMaxTokens(
            maxTokens,
            resolveNpcChatMaxTokens(process.env.GROQ_MAX_TOKENS),
          ),
          stream: true,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 30000,
          signal,
        }
      );

      let fullText = '';
      let buffer = '';

      await new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep trailing incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const json = JSON.parse(dataStr);
              const deltaContent = json.choices?.[0]?.delta?.content;
              if (deltaContent) {
                fullText += deltaContent;
                if (typeof onDelta === 'function') {
                  onDelta(deltaContent);
                }
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        });

        response.data.on('end', () => {
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr !== '[DONE]') {
                try {
                  const json = JSON.parse(dataStr);
                  const deltaContent = json.choices?.[0]?.delta?.content;
                  if (deltaContent) {
                    fullText += deltaContent;
                    if (typeof onDelta === 'function') {
                      onDelta(deltaContent);
                    }
                  }
                } catch {}
              }
            }
          }
          resolve();
        });

        response.data.on('error', (err) => {
          reject(err);
        });
      });

      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Groq stream] using model: ${m}`);
      }
      return { text: fullText };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg = (data && (data.error?.message || data.message)) || err.message;

      const isModelIssue =
        status === 400 && /model|decommission|not\s*found|unknown/i.test(String(msg));

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Groq stream] model '${m}' failed (${status}): ${msg}`);
      }

      lastErr = err;
      if (isModelIssue) continue;

      const code = data?.error?.type || data?.error?.code;
      const enriched = new Error(`Groq API ${status || ''} ${code || ''}: ${msg}`.trim());
      enriched.status = 502;
      throw enriched;
    }
  }

  const status = lastErr?.response?.status;
  const data = lastErr?.response?.data;
  const msg = (data && (data.error?.message || data.message)) || lastErr?.message || 'Unknown error';
  const code = data?.error?.type || data?.error?.code;
  const finalErr = new Error(`Groq API ${status || ''} ${code || ''}: ${msg}`.trim());
  finalErr.status = 502;
  throw finalErr;
}

export { chatCompletion, chatCompletionStream };
