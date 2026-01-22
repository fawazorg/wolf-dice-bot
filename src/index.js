/**
 * @fileoverview Main entry point for the dice game bot library.
 * Exports all core game components, engine utilities, services, and managers.
 * This module aggregates exports from all layers of the architecture.
 * @module wolf-dice-bot
 */

// Core game logic
export {
  Channel,
  Dice,
  GameState,
  Player,
  Round,
  isValidState,
  getNextState
} from "./core/index.js";

// Game engine
export { GameEngine, Validator } from "./game/index.js";

// Platform layer
export { GameManager, DiceClient, MessageService } from "./platform/index.js";
