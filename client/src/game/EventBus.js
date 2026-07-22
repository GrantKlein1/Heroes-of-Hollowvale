import Phaser from 'phaser'

/**
 * Shared EventEmitter bridging Phaser scenes and React UI.
 * Scenes emit game-state events; React overlays emit UI commands.
 */
export const EventBus = new Phaser.Events.EventEmitter()

/** Well-known event names used across Phaser ↔ React */
export const GameEvents = {
  GAME_READY: 'game-ready',
  GAME_DESTROY: 'game-destroy',
  SCENE_READY: 'scene-ready',
  START_DIALOGUE: 'start-dialogue',
  END_DIALOGUE: 'end-dialogue',
  NPC_SPEAK: 'npc:speak',
  NPC_INTERACT: 'npc:interact',
  PLAYER_HEALTH: 'player-health-changed',
  PLAYER_MAX_HEALTH: 'player-max-health-changed',
  SFX_PLAY: 'sfx:play',
}

export default EventBus
