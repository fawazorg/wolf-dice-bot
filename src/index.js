/**
 * @fileoverview Main entry point for the dice game bot library.
 * Exports all core game components, engine utilities, services, and managers.
 * This module aggregates exports from all layers of the architecture.
 * @module wolf-dice-bot
 */

// Core game logic
export { Channel, Dice, Game, GameState, Player, Round, isValidState, getNextState } from './core/index.js';

// Engine layer
export { GameEngine, Random, Timer, Validator } from './engine/index.js';

// Services
export { MessageService } from './services/index.js';

// Managers
export { GameManager } from './managers/index.js';
