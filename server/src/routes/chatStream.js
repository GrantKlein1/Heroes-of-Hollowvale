import crypto from 'node:crypto';
import { Router } from 'express';
import { getNPC, NPC_IDS } from '../npcData.js';
import * as memory from '../memory.js';
import { chatCompletionStream } from '../groqClient.js';
import { buildMessages, resolveNpcChatMaxTokens } from '../buildMessages.js';
import { retrieveLoreWithShadow } from '../rag/store.js';
import { getGroqApiKey } from '../config/secrets.js';
import { SentenceSplitter } from '../tts/sentenceSplitter.js';
import { createTurn, addSentence, finishTurn, abortTurn, getTurn } from '../tts/turnAudio.js';

export function getLlmTimeoutMs() {
  const envVal = process.env.GROQ_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS;
  const parsed = parseInt(envVal, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20_000;
}

// In-flight active turns keyed by `${sessionId}:${npc}`
const activeTurns = new Map();

export function resetActiveTurns() {
  activeTurns.clear();
}

export function getActiveTurnCount() {
  return activeTurns.size;
}

function classifyRequest(message, priorUserCount) {
  const m = String(message || '').toLowerCase();
  const isDragon = /dragon\s*quest|veyrath|cavern\s*of\s*embers|blackspire|red\s*dragon/.test(m) || (m.includes('dragon') && m.includes('quest'));
  const isTownHistory = /(town\s*history|history\s*of\s*hollowvale|hollowvale\s*history|history\s*of\s*the\s*town)/.test(m);
  const isLeave = /\b(leave|goodbye|farewell|i['’]?m\s*leaving|im\s*leaving|bye|take\s*my\s*leave)\b/.test(m);
  const leaveAfterFive = isLeave && priorUserCount >= 5;

  const maxSentences = 8;
  return { isDragon, isTownHistory, isLeave, leaveAfterFive, maxSentences };
}

const router = Router();

// POST /api/chat/stream
// Body: { npc: 'bartender'|'wizard'|'rogue', message: string, context?: Array<{role:'user'|'assistant', content:string}>, sessionId?: string, ragHints?: string }
router.post('/chat/stream', async (req, res, next) => {
  const startTime = Date.now();
  let ttfb = null;
  let turnId = null;
  let turnKey = null;
  let sentenceCount = 0;
  let hasLoggedMetrics = false;
  let timeoutTimer = null;
  let isAborted = false;
  let isTimedOut = false;
  const abortController = new AbortController();

  const markFirstByte = () => {
    if (ttfb === null) {
      ttfb = Date.now() - startTime;
    }
  };

  const finishMetrics = ({ aborted = false, timeout = false } = {}) => {
    if (hasLoggedMetrics || !turnId) return;
    hasLoggedMetrics = true;

    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }

    if (turnKey && activeTurns.get(turnKey)?.turnId === turnId) {
      activeTurns.delete(turnKey);
    }

    const total = Date.now() - startTime;
    const turnObj = turnId ? getTurn(turnId) : null;
    const firstAudio = turnObj?.firstAudioTime ?? null;

    console.info(
      `[TurnMetrics] ${JSON.stringify({
        turnId,
        npc: req.body?.npc || null,
        sessionId: reqSessionIdClean || null,
        ttfb,
        'first-audio': firstAudio,
        firstAudio,
        total,
        sentences: sentenceCount,
        aborted,
        timeout,
      })}`
    );
  };

  let reqSessionIdClean = null;

  try {
    const { npc, message, context, ragHints, sessionId: reqSessionId } = req.body || {};
    if (!npc || !message) {
      return res.status(400).json({ error: 'npc and message are required' });
    }

    const npcDef = getNPC(npc);
    if (!npcDef) {
      return res.status(400).json({ error: `Unknown npc. Valid options: ${NPC_IDS.join(', ')}` });
    }

    // Determine session ID: client provided or fallback to an anonymous per-request ID
    const rawSessionId = (typeof reqSessionId === 'string' && reqSessionId.trim())
      ? reqSessionId.trim()
      : (typeof req.headers?.['x-session-id'] === 'string' && req.headers['x-session-id'].trim()
        ? req.headers['x-session-id'].trim()
        : null);

    const sessionId = rawSessionId || (crypto.randomUUID ? `anon_${crypto.randomUUID()}` : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    reqSessionIdClean = sessionId;
    turnKey = `${sessionId}:${npc}`;

    // 1. Check for prior in-flight turn for this session+npc and abort it
    const priorTurn = activeTurns.get(turnKey);
    if (priorTurn) {
      priorTurn.isAborted = true;
      try {
        priorTurn.abortController.abort(new Error('Turn superseded by newer request'));
      } catch {
        /* ignore */
      }
      abortTurn(priorTurn.turnId, 'superseded');

      try {
        if (!priorTurn.res.writableEnded) {
          priorTurn.res.write(`event: aborted\ndata: ${JSON.stringify({ aborted: true, reason: 'superseded', turnId: priorTurn.turnId })}\n\n`);
          priorTurn.res.end();
        }
      } catch {
        /* ignore write error */
      }
      priorTurn.finishMetrics({ aborted: true });
    }

    // 2. Set up SSE headers and flush them immediately
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    markFirstByte();

    // 3. Allocate audio turn for streaming TTS
    const turn = createTurn();
    turnId = turn.turnId;

    const history = memory.getHistory(sessionId, npc);
    const priorUserCount = history.filter(m => m && m.role === 'user').length;
    const caps = classifyRequest(message, priorUserCount);

    // 4. Register current turn as active
    activeTurns.set(turnKey, {
      turnId,
      res,
      abortController,
      finishMetrics,
      startTime,
      isAborted: false,
    });

    // 5. Emit meta event
    res.write(`event: meta\ndata: ${JSON.stringify({ npc, sessionId, caps, turnId })}\n\n`);

    // Handle client connection disconnect
    if (res && typeof res.on === 'function') {
      res.on('close', () => {
        if (!res.writableEnded && !isAborted && !isTimedOut) {
          isAborted = true;
          try {
            abortController.abort(new Error('Client disconnected'));
          } catch {
            /* ignore */
          }
          abortTurn(turnId, 'client_disconnect');
          finishMetrics({ aborted: true });
        }
      });
    }

    // Check if turn was aborted during initial setup
    if (isAborted || isTimedOut) {
      return;
    }

    const splitter = new SentenceSplitter({
      onSentence: (sentence) => {
        sentenceCount++;
        addSentence(turnId, sentence);
      },
    });

    // Normalize optional context from client (take last 5 entries, valid roles only)
    let extraContext = Array.isArray(context) ? context.filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-5) : [];

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
      ' EXAMPLE1: The Cavern of Embers lies beyond the Blackspire Mountains, cloaked in mist and legend.',
      '      From the tavern, follow the winding road directly south of here.',
      '      Take the path through the forest winding and narrow, lined with whispering pines.',
      '      The trail turns sharply right, stones shifting beneath your boots.',
      '      Soon, the mountain yawns open: a jagged mouth of shadow and silence.', 
      'EXAMPLE2: The Cavern of Embers rests beyond the Blackspire Mountains, hidden behind mist and pine.',
      '      Leave the tavern, follow the cobbled road south past the market and old windmill.',
      '      Take the path narrow, winding, and lined with moss-covered stones.',
      '      The trail climbs steadily, wind whispering through the trees.',
      '      Eventually, the mountain opens: a dark mouth carved into jagged rock.',
      'EXAMPLE3: The Cavern of Embers waits in the Blackspires, cloaked in fog and silence.',
      '       From the tavern, take the road that twists past the market and windmill.',
      '       Go left at the fork—steep, slick, and shadowed by looming cliffs.',
      '       The path narrows, stones loose beneath your boots.',
      '       Soon, the cavern appears: wide, dark, and watching.'
    ].join('\n');

    let retrievalQuery = message;
    if (ragHints && typeof ragHints === 'string' && ragHints.trim()) {
      retrievalQuery = `${message}\n\nHints: ${ragHints}`.trim();
    }

    let loreChunks = [];
    try {
      const { loreChunks: retrievedLore, shadowMetrics } = await retrieveLoreWithShadow(retrievalQuery, {
        candidateK: 10,
        topK: 3,
      });
      loreChunks = retrievedLore;
      const maxCosStr = shadowMetrics?.maxCos !== undefined ? shadowMetrics.maxCos.toFixed(4) : '0.0000';
      const rerankTopScoreStr = (shadowMetrics?.rerankTopScore !== null && shadowMetrics?.rerankTopScore !== undefined)
        ? shadowMetrics.rerankTopScore.toFixed(4)
        : 'none';
      const scoresStr = Array.isArray(shadowMetrics?.rerankScores)
        ? `[${shadowMetrics.rerankScores.map(s => Number(s).toFixed(4)).join(', ')}]`
        : '[]';
      console.info(`[RAG Shadow] maxCos: ${maxCosStr}, rerankTopScore: ${rerankTopScoreStr}, rerankScores: ${scoresStr}`);
    } catch (e) {
      console.warn('[RAG] retrieval failed, continuing without lore:', e.message);
    }

    if (isAborted || isTimedOut) {
      return;
    }

    const loreSystem = loreChunks.length
      ? {
          role: 'system',
          content:
            `Lore context (for grounding; do not contradict, and don't quote verbatim unless asked):\n\n` +
            loreChunks.map((t, i) => `— [${i+1}] ${t}`).join('\n\n')
        }
      : null;

    const promptMessages = buildMessages({
      systemPrompt,
      loreSystem,
      history,
      extraContext,
      userMessage: message,
    });

    // 6. Upstream LLM timeout timer: governs the upstream generation call
    if (typeof res._onLlmStart === 'function') {
      try {
        res._onLlmStart();
      } catch {
        /* ignore */
      }
    }

    const llmTimeoutMs = getLlmTimeoutMs();
    if (llmTimeoutMs > 0 && Number.isFinite(llmTimeoutMs)) {
      timeoutTimer = setTimeout(() => {
        isTimedOut = true;
        try {
          abortController.abort(new Error('Upstream LLM timeout'));
        } catch {
          /* ignore */
        }
        abortTurn(turnId, 'timeout');

        try {
          if (!res.writableEnded) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: 'Upstream LLM timeout', code: 'TIMEOUT', turnId })}\n\n`);
            res.end();
          }
        } catch {
          /* ignore */
        }
        finishMetrics({ timeout: true });
      }, llmTimeoutMs);
    }

    const hasKey = !!getGroqApiKey();
    let finalReply = '';

    if (!hasKey && process.env.NODE_ENV !== 'production') {
      // Stub chat path
      if (process.env.FORCE_LLM_TIMEOUT) {
        // Intentional delay for timeout verification
        await new Promise((resolve) => {
          const t = setTimeout(resolve, parseInt(process.env.FORCE_LLM_TIMEOUT, 10) || 5000);
          abortController.signal.addEventListener('abort', () => {
            clearTimeout(t);
            resolve();
          });
        });
      }

      if (isAborted || isTimedOut) {
        return;
      }

      const style = npcDef.name;
      finalReply = `[Stubbed reply from ${style}] I hear you say: "${message}". Alas, my magic is limited without a GROQ_API_KEY.`;
      const tokens = finalReply.match(/\S+\s*/g) || [finalReply];
      const delayMs = parseInt(process.env.STUB_STREAM_DELAY_MS, 10) || 0;

      for (const token of tokens) {
        if (isAborted || isTimedOut) break;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        if (isAborted || isTimedOut) break;
        res.write(`event: delta\ndata: ${JSON.stringify({ text: token })}\n\n`);
        splitter.feed(token);
      }
    } else {
      const result = await chatCompletionStream({
        systemPrompt,
        messages: promptMessages,
        model: 'llama-3.1-8b-instant',
        maxTokens: resolveNpcChatMaxTokens(process.env.GROQ_MAX_TOKENS),
        signal: abortController.signal,
        onDelta: (deltaText) => {
          if (isAborted || isTimedOut) return;
          res.write(`event: delta\ndata: ${JSON.stringify({ text: deltaText })}\n\n`);
          splitter.feed(deltaText);
        },
      });
      finalReply = String(result.text || '').trim();
    }

    if (isAborted || isTimedOut) {
      return;
    }

    // Flush any remaining partial sentence
    const finalSentence = splitter.flush();
    if (finalSentence) {
      sentenceCount++;
      addSentence(turnId, finalSentence);
    }
    finishTurn(turnId);

    // Persist to conversation memory
    memory.addExchange(sessionId, npc, message, finalReply);

    // Emit done event
    res.write(`event: done\ndata: ${JSON.stringify({ reply: finalReply, npc, sessionId, turnId })}\n\n`);
    res.end();

    finishMetrics({ aborted: false, timeout: false });
  } catch (err) {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }

    if (isTimedOut) {
      finishMetrics({ timeout: true });
      return;
    }

    if (isAborted || abortController.signal.aborted) {
      finishMetrics({ aborted: true });
      return;
    }

    if (res.headersSent) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Stream error' })}\n\n`);
        res.end();
      } catch {
        /* ignore */
      }
      finishMetrics({ aborted: false, timeout: false });
    } else {
      finishMetrics({ aborted: false, timeout: false });
      next(err);
    }
  } finally {
    if (typeof res._onComplete === 'function') {
      try {
        res._onComplete();
      } catch {
        /* ignore */
      }
    }
  }
});

export default router;
