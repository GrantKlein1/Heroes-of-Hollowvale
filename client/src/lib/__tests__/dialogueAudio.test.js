import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  speakNpcDialogue,
  speakTurnAudio,
  streamTurnTTS,
  cancelNpcSpeech,
} from '../dialogueAudio'
import * as ttsPlayer from '../ttsPlayer'
import * as api from '../api'

vi.mock('../ttsPlayer', () => ({
  playStreamingAudio: vi.fn().mockResolvedValue(undefined),
  stopTtsPlayback: vi.fn(),
  setTtsPlayerVolume: vi.fn(),
  unlockTtsAudio: vi.fn().mockResolvedValue(true),
}))

vi.mock('../api', () => ({
  streamTTS: vi.fn(),
}))

describe('dialogueAudio (Option B Per-Sentence TTS)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cancelNpcSpeech()
  })

  it('streamTurnTTS handles 501 gracefully returning null (Acceptance Criterion 3)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 501,
      ok: false,
    })

    const stream = await streamTurnTTS({ turnId: 'turn-501-test' })
    expect(stream).toBeNull()
  })

  it('speakNpcDialogue with turnId handles 501 without throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 501,
      ok: false,
    })

    await expect(
      speakNpcDialogue(null, { turnId: 'turn-501', enabled: true })
    ).resolves.not.toThrow()
    expect(ttsPlayer.playStreamingAudio).not.toHaveBeenCalled()
  })

  it('speakNpcDialogue with text handles 501 error from streamTTS without throwing', async () => {
    const err501 = new Error('TTS error: 501 ElevenLabs API key is not set')
    err501.status = 501
    vi.mocked(api.streamTTS).mockRejectedValueOnce(err501)

    await expect(
      speakNpcDialogue('Greeting text', { enabled: true })
    ).resolves.not.toThrow()
    expect(ttsPlayer.playStreamingAudio).not.toHaveBeenCalled()
  })

  it('speakTurnAudio streams turn audio when 200 response is received', async () => {
    const mockBodyStream = new ReadableStream()
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      body: mockBodyStream,
    })

    await speakTurnAudio('turn-stream-200', { volume: 0.8, enabled: true })

    expect(ttsPlayer.unlockTtsAudio).toHaveBeenCalled()
    expect(ttsPlayer.setTtsPlayerVolume).toHaveBeenCalledWith(0.8)
    expect(ttsPlayer.playStreamingAudio).toHaveBeenCalledWith(mockBodyStream, expect.objectContaining({
      mime: 'audio/mpeg',
      volume: 0.8,
    }))
  })

  it('speakNpcDialogue delegates to speakTurnAudio when turnId is passed', async () => {
    const mockBodyStream = new ReadableStream()
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      body: mockBodyStream,
    })

    await speakNpcDialogue('Some fallback text', { turnId: 'turn-delegate', volume: 0.5, enabled: true })

    expect(ttsPlayer.playStreamingAudio).toHaveBeenCalledWith(mockBodyStream, expect.objectContaining({
      volume: 0.5,
    }))
  })

  it('cancelNpcSpeech stops playback and aborts active controller', () => {
    cancelNpcSpeech()
    expect(ttsPlayer.stopTtsPlayback).toHaveBeenCalled()
  })
})
