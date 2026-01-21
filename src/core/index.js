/**
 * @fileoverview Core game logic module.
 * Exports pure game classes and utilities without external dependencies.
 * @module core
 */

export { default as Channel } from "./Channel.js";
export { default as Dice } from "./Dice.js";
export { default as Game } from "./Game.js";
export { default as Player } from "./Player.js";
export { default as Round } from "./Round.js";
export { GameState, isValidState, getNextState } from "./GameState.js";
