import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendChatStream, sendChatWithFallback } from '../api.js'

describe('Client Chat Streaming & Fallback (api.js)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function createSSEStream(chunks) {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
  }

  it('sendChatStream streams meta, deltas, and done events properly', async () => {
    const ssePayload = [
      'event: meta\ndata: {"npc":"bartender","sessionId":"sess-123","caps":{"maxSentences":8}}\n\n',
      'event: delta\ndata: {"text":"Greetings,"}\n\n',
      'event: delta\ndata: {"text":" traveler."}\n\n',
      'event: done\ndata: {"reply":"Greetings, traveler.","npc":"bartender","sessionId":"sess-123"}\n\n',
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream(ssePayload),
    })

    const onMeta = vi.fn()
    const onDelta = vi.fn()

    const result = await sendChatStream({
      npc: 'bartender',
      message: 'Hello!',
      sessionId: 'sess-123',
      onMeta,
      onDelta,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/stream',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    expect(onMeta).toHaveBeenCalledWith(
      expect.objectContaining({ npc: 'bartender', sessionId: 'sess-123' })
    )

    expect(onDelta).toHaveBeenCalledTimes(2)
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Greetings,', 'Greetings,')
    expect(onDelta).toHaveBeenNthCalledWith(2, ' traveler.', 'Greetings, traveler.')

    expect(result.reply).toBe('Greetings, traveler.')
    expect(result.npc).toBe('bartender')
    expect(result.sessionId).toBe('sess-123')
  })

  it('sendChatWithFallback falls back to /api/chat when stream returns non-200', async () => {
    const fallbackResponse = {
      reply: 'Fallback bartender reply.',
      npc: 'bartender',
      meta: { sessionId: 'sess-fallback' },
    }

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/chat/stream')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
      }
      if (url.includes('/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => fallbackResponse,
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const onDelta = vi.fn()
    const result = await sendChatWithFallback({
      npc: 'bartender',
      message: 'Hello!',
      sessionId: 'sess-fallback',
      onDelta,
    })

    expect(result.reply).toBe('Fallback bartender reply.')
    expect(onDelta).toHaveBeenCalledWith('Fallback bartender reply.', 'Fallback bartender reply.')
  })

  it('sendChatWithFallback falls back to /api/chat when SSE emits an error event', async () => {
    const errorSSE = [
      'event: meta\ndata: {"npc":"bartender"}\n\n',
      'event: error\ndata: {"error":"Groq capacity exceeded"}\n\n',
    ]

    const fallbackResponse = {
      reply: 'Handled by standard chat.',
      npc: 'bartender',
    }

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/chat/stream')) {
        return Promise.resolve({
          ok: true,
          body: createSSEStream(errorSSE),
        })
      }
      if (url.includes('/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => fallbackResponse,
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const onDelta = vi.fn()
    const result = await sendChatWithFallback({
      npc: 'bartender',
      message: 'Dragon info',
      onDelta,
    })

    expect(result.reply).toBe('Handled by standard chat.')
    expect(onDelta).toHaveBeenCalledWith('Handled by standard chat.', 'Handled by standard chat.')
  })
})
