/**
 * MainGameScene — action → audio wiring for the React+Canvas game loop.
 *
 * This project does not use Phaser; Game.jsx owns the scene state machine.
 * This module centralizes SFX triggers (footsteps, doors, combat, spells)
 * so the loop can call thin helpers instead of ad-hoc Audio() calls.
 */

import { sfxEngine, SFX } from './sfxEngine'
import { eventBus, GameEvents } from '../lib/eventBus'
import { PATHS } from '../config/paths'

/** Default preload manifest for combat / interaction SFX */
export const SFX_MANIFEST = {
  [SFX.FOOTSTEP]: PATHS.sfxFootstep,
  [SFX.DOOR_OPEN]: PATHS.sfxDoorOpen,
  [SFX.HIT]: PATHS.sfxHit,
  [SFX.SPELL_CAST]: PATHS.sfxSpellCast || PATHS.fireballCastSfx,
  [SFX.FIRE_IMPACT]: PATHS.sfxFireImpact || PATHS.fireImpactSfx,
  [SFX.MELEE_SWING]: PATHS.sfxMeleeSwing,
}

const FOOTSTEP_INTERVAL_MS = 280
let lastFootstepAt = 0

/**
 * Preload all game SFX. Call after a user gesture (Start Game) so AudioContext unlocks.
 */
export async function preloadSceneAudio() {
  await sfxEngine.unlock()
  return sfxEngine.preload(SFX_MANIFEST)
}

export function setSfxVolume(vol01) {
  sfxEngine.setVolume(vol01)
}

export function setSfxEnabled(on) {
  sfxEngine.setEnabled(on)
}

/** Throttled footstep while the player is moving */
export function onPlayerMove({ moving, now = performance.now() } = {}) {
  if (!moving) return
  if (now - lastFootstepAt < FOOTSTEP_INTERVAL_MS) return
  lastFootstepAt = now
  // Slight rate jitter so steps don't sound mechanical
  const rate = 0.92 + Math.random() * 0.16
  sfxEngine.play(SFX.FOOTSTEP, { volume: 0.45, playbackRate: rate })
}

/** Door / zone transition */
export function onDoorOpen() {
  sfxEngine.play(SFX.DOOR_OPEN, { volume: 0.7 })
  eventBus.emit(GameEvents.SFX_PLAY, { id: SFX.DOOR_OPEN })
}

/** Melee swing (whether or not it connects) */
export function onMeleeSwing() {
  sfxEngine.play(SFX.MELEE_SWING, { volume: 0.55 })
}

/** Successful melee hit on an enemy */
export function onMeleeHit() {
  sfxEngine.play(SFX.HIT, { volume: 0.75 })
}

/** Mage / spell projectile cast */
export function onSpellCast() {
  sfxEngine.play(SFX.SPELL_CAST, { volume: 0.65 })
}

/** Fireball / poison impact */
export function onSpellImpact() {
  sfxEngine.play(SFX.FIRE_IMPACT, { volume: 0.7 })
}

/** Player took damage */
export function onPlayerHurt() {
  sfxEngine.play(SFX.HIT, { volume: 0.5, playbackRate: 0.85 })
}

/**
 * Emit NPC interaction over EventBus so React can open dialogue + start TTS.
 * @param {{ npc: string, greeting?: string, voiceId?: string }} detail
 */
export function emitNpcInteract(detail) {
  eventBus.emit(GameEvents.NPC_INTERACT, {
    npc: detail?.npc || 'bartender',
    greeting: detail?.greeting || '',
    voiceId: detail?.voiceId,
    at: performance.now(),
  })
}

/**
 * Request spoken dialogue (TTS stream) for an NPC line.
 * React listeners call the streaming TTS player.
 */
export function emitNpcSpeak({ npc = 'bartender', text, voiceId } = {}) {
  if (!text) return
  eventBus.emit(GameEvents.NPC_SPEAK, { npc, text, voiceId, at: performance.now() })
}

/**
 * Wrap a scene transition callback so door SFX always plays once.
 */
export function withDoorSfx(fn) {
  return (...args) => {
    onDoorOpen()
    return fn?.(...args)
  }
}

export default {
  preloadSceneAudio,
  setSfxVolume,
  setSfxEnabled,
  onPlayerMove,
  onDoorOpen,
  onMeleeSwing,
  onMeleeHit,
  onSpellCast,
  onSpellImpact,
  onPlayerHurt,
  emitNpcInteract,
  emitNpcSpeak,
  withDoorSfx,
  SFX_MANIFEST,
  SFX,
}
