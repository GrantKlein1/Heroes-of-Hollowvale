import Phaser from 'phaser';

/**
 * Shared EventEmitter for React UI ↔ game engine communication
 * (dialogue boxes, health bars, movement, triggers, etc.).
 */
export const EventBus = new Phaser.Events.EventEmitter();
