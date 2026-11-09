import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendChatStream, sendChatWithFallback, resetActiveStreams } from '../api.js'
import * as dialogueAudio from '../dialogueAudio.js'

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

  it('second message aborts first stream and cancels speech', async () => {
    resetActiveStreams()
    const cancelSpy = vi.spyOn(dialogueAudio, 'cancelNpcSpeech')

    const secondPayload = [
      'event: meta\ndata: {"npc":"bartender"}\n\n',
      'event: done\ndata: {"reply":"Second message reply.","npc":"bartender"}\n\n',
    ]

    let callCount = 0
    let firstAbortSignal
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      callCount++
      if (callCount === 1) {
        firstAbortSignal = opts?.signal
        const firstStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: meta\ndata: {"npc":"bartender"}\n\n'))
            opts?.signal?.addEventListener('abort', () => {
              try {
                controller.error(new DOMException('The user aborted a request.', 'AbortError'))
              } catch {
                /* ignore */
              }
            })
          },
        })
        return Promise.resolve({
          ok: true,
          body: firstStream,
        })
      }
      return Promise.resolve({
        ok: true,
        body: createSSEStream(secondPayload),
      })
    })

    const p1 = sendChatStream({ npc: 'bartender', message: 'First', sessionId: 's-same' })
    // Allow first call microtasks to run
    await new Promise((r) => setTimeout(r, 10))

    expect(firstAbortSignal?.aborted).toBe(false)

    const p2 = sendChatStream({ npc: 'bartender', message: 'Second', sessionId: 's-same' })

    expect(firstAbortSignal?.aborted).toBe(true)
    expect(cancelSpy).toHaveBeenCalled()

    const res2 = await p2
    expect(res2.reply).toBe('Second message reply.')

    await expect(p1).rejects.toThrow(/abort/i)
  })

  it('handles server event: aborted marker by returning { aborted: true } and cancelling speech', async () => {
    resetActiveStreams()
    const cancelSpy = vi.spyOn(dialogueAudio, 'cancelNpcSpeech')

    const abortedPayload = [
      'event: meta\ndata: {"npc":"bartender","turnId":"t-abort"}\n\n',
      'event: delta\ndata: {"text":"Partial text before"}\n\n',
      'event: aborted\ndata: {"aborted":true,"reason":"superseded","turnId":"t-abort"}\n\n',
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream(abortedPayload),
    })

    const res = await sendChatStream({ npc: 'bartender', message: 'Will abort', sessionId: 's-1' })
    expect(res.aborted).toBe(true)
    expect(res.reply).toBe('Partial text before')
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('sendChatWithFallback re-throws on AbortError instead of falling back to /api/chat', async () => {
    resetActiveStreams()
    const chatFallbackSpy = vi.fn()

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/chat/stream')) {
        const err = new Error('The user aborted a request.')
        err.name = 'AbortError'
        return Promise.reject(err)
      }
      chatFallbackSpy()
      return Promise.resolve({ ok: true, json: async () => ({ reply: 'Fallback' }) })
    })

    await expect(
      sendChatWithFallback({ npc: 'bartender', message: 'Aborted message', sessionId: 's-abort' })
    ).rejects.toThrow(/aborted/i)

    expect(chatFallbackSpy).not.toHaveBeenCalled()
  })
})
