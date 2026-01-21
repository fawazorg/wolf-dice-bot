import { v4 as uuidv4 } from "uuid";
import Player from "./Player.js";

/**
 * Game channel container managing players and game configuration
 */
class Channel {
  /** @type {number} Channel ID */
  #id;

  /** @type {string} Unique game session ID */
  #uuid;

  /** @type {string} Language code (en/ar) */
  #language;

  /** @type {number} Starting balance for players */
  #defaultBalance;

  /** @type {number} Maximum players allowed */
  #maxPlayers;

  /** @type {Map<number, Player>} Players in the game */
  #players;

  /**
   * @param {number} id - Channel ID
   * @param {string} language - Language code
   * @param {number} defaultBalance - Starting balance
   * @param {number} maxPlayers - Maximum players (default 16)
   */
  constructor(id, language, defaultBalance, maxPlayers = 16) {
    this.#id = id;
    this.#uuid = uuidv4();
    this.#language = language;
    this.#defaultBalance = defaultBalance;
    this.#maxPlayers = maxPlayers;
    this.#players = new Map();
  }

  /** @returns {number} */
  get id() {
    return this.#id;
  }

  /** @returns {string} */
  get uuid() {
    return this.#uuid;
  }

  /** @returns {string} */
  get language() {
    return this.#language;
  }

  /** @returns {number} */
  get defaultBalance() {
    return this.#defaultBalance;
  }

  /** @returns {number} */
  get maxPlayers() {
    return this.#maxPlayers;
  }

  /**
   * Add a player to the game
   * @param {number} playerId - WOLF subscriber ID
   * @returns {Player|null} The created player or null if already exists/full
   */
  addPlayer(playerId) {
    if (this.#players.has(playerId) || this.isFull()) {
      return null;
    }
    const player = new Player(playerId, this.#defaultBalance);
    this.#players.set(playerId, player);
    return player;
  }

  /**
   * Remove a player from the game
   * @param {number} playerId - WOLF subscriber ID
   * @returns {boolean} True if player was removed
   */
  removePlayer(playerId) {
    return this.#players.delete(playerId);
  }

  /**
   * Get a player by ID
   * @param {number} playerId - WOLF subscriber ID
   * @returns {Player|null}
   */
  getPlayer(playerId) {
    return this.#players.get(playerId) || null;
  }

  /**
   * Check if player is in the game
   * @param {number} playerId - WOLF subscriber ID
   * @returns {boolean}
   */
  hasPlayer(playerId) {
    return this.#players.has(playerId);
  }

  /**
   * Get all active players (balance > 0)
   * @returns {Player[]}
   */
  getActivePlayers() {
    return [...this.#players.values()].filter((p) => p.isActive());
  }

  /**
   * Get current player count
   * @returns {number}
   */
  getPlayerCount() {
    return this.#players.size;
  }

  /**
   * Check if game is full
   * @returns {boolean}
   */
  isFull() {
    return this.#players.size >= this.#maxPlayers;
  }

  /**
   * Get players with balance >= 500, sorted by balance descending
   * @param {number} minBalance - Minimum balance (default 500)
   * @returns {Player[]}
   */
  getRichestPlayers(minBalance = 500) {
    return [...this.#players.values()]
      .filter((p) => p.hasMinimumBalance(minBalance))
      .sort((a, b) => b.balance - a.balance);
  }

  /**
   * Get players who have made a guess this round
   * @returns {Player[]}
   */
  getPlayersWithGuesses() {
    return [...this.#players.values()].filter((p) => p.currentGuess !== null);
  }

  /**
   * Clear all player guesses
   */
  clearAllGuesses() {
    for (const player of this.#players.values()) {
      player.clearGuess();
    }
  }

  /**
   * Get all players as array
   * @returns {Player[]}
   */
  getAllPlayers() {
    return [...this.#players.values()];
  }

  /**
   * Get players Map for iteration
   * @returns {Map<number, Player>}
   */
  getPlayersMap() {
    return this.#players;
  }
}

export default Channel;
