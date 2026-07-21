import Phaser from 'phaser'

/**
 * Shared EventEmitter bridging Phaser scenes and React UI.
 * Scenes emit game-state events; React overlays emit UI commands.
 */
export const EventBus = new Phaser.Events.EventEmitter()

export default EventBus
