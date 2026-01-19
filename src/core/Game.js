import Channel from './Channel.js';
import Dice from './Dice.js';

/**
 * Game state constants
 */
export const GameState = {
  JOINING: 'joining',
  GUESSING: 'guessing',
  PICKING: 'picking',
  BETTING: 'betting',
  ROLLING: 'rolling',
  FINISHED: 'finished'
};

/**
 * Core game logic for the dice game
 * Manages game flow, rounds, and scoring without messaging concerns
 */
class Game {
  /** @type {Map<number, Channel>} Active games by channel ID */
  #channels;

  /** @type {Map<number, string>} Current game state by channel ID */
  #states;

  /** @type {Map<number, Map<number, number>>} Scores by channel ID -> player ID -> points */
  #scores;

  /** @type {number} Maximum players per game */
  #maxPlayers;

  /** @type {number} Maximum dice roll for guessing (1-50) */
  #maxGuessRoll;

  /** @type {number} Minimum bet amount */
  #minBet;

  constructor(maxPlayers = 16, maxGuessRoll = 50, minBet = 500) {
    this.#channels = new Map();
    this.#states = new Map();
    this.#scores = new Map();
    this.#maxPlayers = maxPlayers;
    this.#maxGuessRoll = maxGuessRoll;
    this.#minBet = minBet;
  }

  /** @returns {number} */
  get maxPlayers() {
    return this.#maxPlayers;
  }

  /** @returns {number} */
  get maxGuessRoll() {
    return this.#maxGuessRoll;
  }

  /** @returns {number} */
  get minBet() {
    return this.#minBet;
  }

  /**
   * Check if a channel has an active game
   * @param {number} channelId
   * @returns {boolean}
   */
  hasGame(channelId) {
    return this.#channels.has(channelId);
  }

  /**
   * Get channel by ID
   * @param {number} channelId
   * @returns {Channel|null}
   */
  getChannel(channelId) {
    return this.#channels.get(channelId) || null;
  }

  /**
   * Get current game state
   * @param {number} channelId
   * @returns {string|null}
   */
  getState(channelId) {
    return this.#states.get(channelId) || null;
  }

  /**
   * Set game state directly
   * @param {number} channelId
   * @param {string} state
   */
  setState(channelId, state) {
    if (this.#channels.has(channelId)) {
      this.#states.set(channelId, state);
    }
  }

  /**
   * Check if game is in joining phase
   * @param {number} channelId
   * @returns {boolean}
   */
  isJoinable(channelId) {
    return this.#states.get(channelId) === GameState.JOINING;
  }

  /**
   * Check if game has started (past joining phase)
   * @param {number} channelId
   * @returns {boolean}
   */
  isStarted(channelId) {
    const state = this.#states.get(channelId);
    return state !== undefined && state !== GameState.JOINING;
  }

  /**
   * Create a new game in a channel
   * @param {number} channelId - Channel ID
   * @param {string} language - Language code (en/ar)
   * @param {number} defaultBalance - Starting balance (default 500)
   * @returns {{success: boolean, error?: string, channel?: Channel}}
   */
  createGame(channelId, language, defaultBalance = 500) {
    if (this.#channels.has(channelId)) {
      return { success: false, error: 'game_already_exists' };
    }

    if (!this.#isValidBalance(defaultBalance)) {
      return { success: false, error: 'invalid_balance' };
    }

    const channel = new Channel(channelId, language, defaultBalance, this.#maxPlayers);
    this.#channels.set(channelId, channel);
    this.#states.set(channelId, GameState.JOINING);
    this.#scores.set(channelId, new Map());

    return { success: true, channel };
  }

  /**
   * Add a player to a game
   * @param {number} channelId
   * @param {number} playerId - WOLF subscriber ID
   * @returns {{success: boolean, error?: string, player?: import('./Player.js').default}}
   */
  addPlayer(channelId, playerId) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    if (this.#states.get(channelId) !== GameState.JOINING) {
      return { success: false, error: 'game_not_joinable' };
    }

    if (channel.hasPlayer(playerId)) {
      return { success: false, error: 'already_joined' };
    }

    if (channel.isFull()) {
      return { success: false, error: 'game_full' };
    }

    const player = channel.addPlayer(playerId);
    return { success: true, player };
  }

  /**
   * Get a player from a game
   * @param {number} channelId
   * @param {number} playerId
   * @returns {import('./Player.js').default|null}
   */
  getPlayer(channelId, playerId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.getPlayer(playerId) : null;
  }

  /**
   * Check if player is in the game
   * @param {number} channelId
   * @param {number} playerId
   * @returns {boolean}
   */
  hasPlayer(channelId, playerId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.hasPlayer(playerId) : false;
  }

  /**
   * Get player count in a game
   * @param {number} channelId
   * @returns {number}
   */
  getPlayerCount(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.getPlayerCount() : 0;
  }

  /**
   * Start the guessing phase
   * @param {number} channelId
   * @returns {{success: boolean, error?: string}}
   */
  startGuessingPhase(channelId) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    this.#states.set(channelId, GameState.GUESSING);
    channel.clearAllGuesses();
    return { success: true };
  }

  /**
   * Set a player's guess
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} guess - Guess value (1-50)
   * @returns {{success: boolean, error?: string}}
   */
  setPlayerGuess(channelId, playerId, guess) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    if (this.#states.get(channelId) !== GameState.GUESSING) {
      return { success: false, error: 'not_guessing_phase' };
    }

    const player = channel.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'player_not_found' };
    }

    if (!player.hasMinimumBalance(this.#minBet)) {
      return { success: false, error: 'insufficient_balance' };
    }

    if (guess < 1 || guess > this.#maxGuessRoll) {
      return { success: false, error: 'invalid_guess' };
    }

    // Check if guess is already taken by another eligible player
    const richPlayers = channel.getRichestPlayers(this.#minBet);
    const guessTaken = richPlayers.some(p => p.id !== playerId && p.currentGuess === guess);

    if (guessTaken) {
      // Assign a fallback guess value (original code used timeToChoice which is 15000)
      // We'll just silently accept and set the guess anyway - caller can handle duplicates
      player.setGuess(guess);
      return { success: true, duplicate: true };
    }

    player.setGuess(guess);
    return { success: true };
  }

  /**
   * Check if a guess is valid (within range)
   * @param {number} guess
   * @returns {boolean}
   */
  isValidGuess(guess) {
    return guess >= 1 && guess <= this.#maxGuessRoll;
  }

  /**
   * Check if no players made guesses
   * @param {number} channelId
   * @returns {boolean}
   */
  hasNoGuesses(channelId) {
    const channel = this.#channels.get(channelId);
    if (!channel) return true;
    return channel.getPlayersWithGuesses().length === 0;
  }

  /**
   * End guessing phase and determine closest guesser
   * @param {number} channelId
   * @returns {{success: boolean, error?: string, roll?: number, winner?: import('./Player.js').default, isExact?: boolean}}
   */
  endGuessingPhase(channelId) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    const playersWithGuesses = channel.getPlayersWithGuesses();
    if (playersWithGuesses.length === 0) {
      return { success: false, error: 'no_guesses' };
    }

    const roll = Dice.rollGuess();
    const winner = Dice.findClosestGuess(playersWithGuesses, roll);
    const isExact = Dice.isExactMatch(winner.currentGuess, roll);

    // Award bonus for exact match
    if (isExact) {
      winner.addBonus(Dice.EXACT_BONUS);
      this.#addPoints(channelId, winner.id, Dice.EXACT_POINTS);
    }

    this.#states.set(channelId, GameState.PICKING);
    return { success: true, roll, winner, isExact };
  }

  /**
   * Get eligible opponents for PVP (players with min balance, excluding picker)
   * @param {number} channelId
   * @param {number} pickerId - Player doing the picking
   * @returns {import('./Player.js').default[]}
   */
  getEligibleOpponents(channelId, pickerId) {
    const channel = this.#channels.get(channelId);
    if (!channel) return [];

    return channel.getRichestPlayers(this.#minBet).filter(p => p.id !== pickerId);
  }

  /**
   * Validate and set bet amount
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} betAmount
   * @returns {{success: boolean, error?: string, bet?: number}}
   */
  validateBet(channelId, playerId, betAmount) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    const player = channel.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'player_not_found' };
    }

    if (betAmount % this.#minBet !== 0) {
      return { success: false, error: 'invalid_bet_increment' };
    }

    if (!player.canAffordBet(betAmount)) {
      return { success: false, error: 'insufficient_balance' };
    }

    this.#states.set(channelId, GameState.ROLLING);
    return { success: true, bet: betAmount };
  }

  /**
   * Execute PVP roll phase
   * @param {number} channelId
   * @returns {{success: boolean, error?: string, roll?: number}}
   */
  playerRoll(channelId) {
    if (!this.#channels.has(channelId)) {
      return { success: false, error: 'game_not_exists' };
    }

    const roll = Dice.rollPVP();
    return { success: true, roll };
  }

  /**
   * Execute a rigged PVP roll (for admin)
   * @param {number} channelId
   * @param {number} value - Fixed roll value
   * @returns {{success: boolean, error?: string, roll?: number}}
   */
  playerRollFixed(channelId, value) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    return { success: true, roll: value };
  }

  /**
   * Resolve PVP round
   * @param {number} channelId
   * @param {number} player1Id
   * @param {number} roll1
   * @param {number} player2Id
   * @param {number} roll2
   * @param {number} bet
   * @returns {{success: boolean, result: 'player1'|'player2'|'draw', winner?: import('./Player.js').default, loser?: import('./Player.js').default, isEliminated?: boolean}}
   */
  resolvePVP(channelId, player1Id, roll1, player2Id, roll2, bet) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { success: false, result: 'draw' };
    }

    const comparison = Dice.compareRolls(roll1, roll2);

    if (comparison === 0) {
      return { success: true, result: 'draw' };
    }

    const winnerId = comparison === 1 ? player1Id : player2Id;
    const loserId = comparison === 1 ? player2Id : player1Id;
    const winner = channel.getPlayer(winnerId);
    const loser = channel.getPlayer(loserId);

    if (loser) {
      const isEliminated = loser.deductBalance(bet);

      if (isEliminated) {
        channel.removePlayer(loserId);
      }

      // Award point to winner
      this.#addPoints(channelId, winnerId, 1);

      return {
        success: true,
        result: comparison === 1 ? 'player1' : 'player2',
        winner,
        loser,
        isEliminated
      };
    }

    return { success: true, result: comparison === 1 ? 'player1' : 'player2', winner };
  }

  /**
   * Check if game should end (only one player with min balance remaining)
   * @param {number} channelId
   * @returns {{ended: boolean, winner?: import('./Player.js').default}}
   */
  checkGameEnd(channelId) {
    const channel = this.#channels.get(channelId);
    if (!channel) {
      return { ended: true };
    }

    const richPlayers = channel.getRichestPlayers(this.#minBet);

    if (richPlayers.length <= 1) {
      this.#states.set(channelId, GameState.FINISHED);
      return { ended: true, winner: richPlayers[0] || null };
    }

    return { ended: false };
  }

  /**
   * Add points to a player (public method for external scoring)
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} points
   */
  addPoints(channelId, playerId, points) {
    this.#addPoints(channelId, playerId, points);
  }

  /**
   * Get final scores for a game
   * @param {number} channelId
   * @returns {Map<number, number>} Player ID -> Points
   */
  getScores(channelId) {
    return this.#scores.get(channelId) || new Map();
  }

  /**
   * Get sorted scores (descending by points)
   * @param {number} channelId
   * @returns {Array<{playerId: number, points: number}>}
   */
  getSortedScores(channelId) {
    const scores = this.#scores.get(channelId);
    if (!scores) return [];

    return [...scores.entries()]
      .map(([playerId, points]) => ({ playerId, points }))
      .sort((a, b) => b.points - a.points);
  }

  /**
   * End and clean up a game
   * @param {number} channelId
   * @returns {{success: boolean, scores?: Map<number, number>}}
   */
  endGame(channelId) {
    const scores = this.#scores.get(channelId);

    this.#channels.delete(channelId);
    this.#states.delete(channelId);
    this.#scores.delete(channelId);

    return { success: true, scores };
  }

  /**
   * Get all players in a game
   * @param {number} channelId
   * @returns {import('./Player.js').default[]}
   */
  getAllPlayers(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.getAllPlayers() : [];
  }

  /**
   * Get players eligible for next round (have minimum balance)
   * @param {number} channelId
   * @returns {import('./Player.js').default[]}
   */
  getEligiblePlayers(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.getRichestPlayers(this.#minBet) : [];
  }

  /**
   * Check if game is still valid (exists and UUID matches)
   * @param {number} channelId
   * @param {string} uuid
   * @returns {boolean}
   */
  isGameValid(channelId, uuid) {
    const channel = this.#channels.get(channelId);
    return channel !== undefined && channel.uuid === uuid;
  }

  /**
   * Get game UUID
   * @param {number} channelId
   * @returns {string|null}
   */
  getGameUUID(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.uuid : null;
  }

  /**
   * Get game language
   * @param {number} channelId
   * @returns {string|null}
   */
  getLanguage(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.language : null;
  }

  /**
   * Get default balance for a game
   * @param {number} channelId
   * @returns {number|null}
   */
  getDefaultBalance(channelId) {
    const channel = this.#channels.get(channelId);
    return channel ? channel.defaultBalance : null;
  }

  // Private helpers

  /**
   * Add points to a player
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} points
   */
  #addPoints(channelId, playerId, points) {
    const scores = this.#scores.get(channelId);
    if (scores) {
      const current = scores.get(playerId) || 0;
      scores.set(playerId, current + points);
    }
  }

  /**
   * Validate balance amount (must be > 0, <= 5000, divisible by 500)
   * @param {number} balance
   * @returns {boolean}
   */
  #isValidBalance(balance) {
    return balance > 0 && balance <= 5000 && balance % 500 === 0;
  }
}

export default Game;
