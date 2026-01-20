import { GameState } from '../core/GameState.js';
import { Channel, Dice, Round } from '../core/index.js';
import Timer from './Timer.js';
import Validator from './Validator.js';

/**
 * Event-driven game engine for the dice game
 * Orchestrates game flow, phase transitions, and emits events for integration layer
 *
 * The engine is platform-agnostic and has no direct dependencies on WOLF.js
 */
class GameEngine {
  /** @type {Map<number, Channel>} Active games by channel ID */
  #games;

  /** @type {Map<number, string>} Game states by channel ID */
  #states;

  /** @type {Map<number, number>} Round numbers by channel ID */
  #rounds;

  /** @type {Map<number, Round>} Current round data by channel ID */
  #currentRounds;

  /** @type {Map<number, Map<number, number>>} Scores by channel ID -> player ID -> points */
  #scores;

  /** @type {Map<number, Timer>} Active timers by channel ID */
  #timers;

  /** @type {Map<string, Function>} Event listeners */
  #listeners;

  /** @type {Object} Game configuration */
  #config;

  /** @type {number} Max players per game */
  #maxPlayers;

  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.maxPlayers=16] - Maximum players per game
   * @param {number} [options.timeToJoin=30000] - Join phase timeout (ms)
   * @param {number} [options.timeToChoice=15000] - Choice phase timeout (ms)
   * @param {number} [options.maxGuessRoll=50] - Maximum guess roll
   * @param {number} [options.minBet=500] - Minimum bet amount
   */
  constructor(options = {}) {
    this.#games = new Map();
    this.#states = new Map();
    this.#rounds = new Map();
    this.#currentRounds = new Map();
    this.#scores = new Map();
    this.#timers = new Map();
    this.#listeners = new Map();
    this.#maxPlayers = options.maxPlayers || 16;

    this.#config = {
      maxPlayers: this.#maxPlayers,
      timeToJoin: options.timeToJoin || 30000,
      timeToChoice: options.timeToChoice || 15000,
      maxGuessRoll: options.maxGuessRoll || 50,
      minBet: options.minBet || 500
    };
  }

  // ===== Configuration Getters =====

  /** @returns {number} Maximum players per game */
  get maxPlayers() {
    return this.#maxPlayers;
  }

  /** @returns {number} Join timeout (ms) */
  get timeToJoin() {
    return this.#config.timeToJoin;
  }

  /** @returns {number} Choice timeout (ms) */
  get timeToChoice() {
    return this.#config.timeToChoice;
  }

  /** @returns {number} Minimum bet amount */
  get minBet() {
    return this.#config.minBet;
  }

  // ===== Game Lifecycle =====

  /**
   * Create a new game
   * @param {number} channelId - Channel ID
   * @param {string} language - Language code (en/ar)
   * @param {number} defaultBalance - Starting balance
   * @returns {{success: boolean, error?: string}}
   */
  createGame(channelId, language, defaultBalance) {
    if (this.#games.has(channelId)) {
      return { success: false, error: 'game_already_exists' };
    }

    // Validate balance
    const balanceCheck = Validator.validateBalance(defaultBalance);
    if (!balanceCheck.valid) {
      return { success: false, error: balanceCheck.error };
    }

    const channel = new Channel(channelId, language, defaultBalance, this.#maxPlayers);
    this.#games.set(channelId, channel);
    this.#states.set(channelId, GameState.JOINING);
    this.#rounds.set(channelId, 0);
    this.#scores.set(channelId, new Map());
    this.#currentRounds.set(channelId, new Round(0));

    this.#emit('game:created', { channelId, language, balance: defaultBalance });

    return { success: true };
  }

  /**
   * Add a player to a game
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @returns {{success: boolean, error?: string}}
   */
  addPlayer(channelId, playerId) {
    const channel = this.#games.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    if (this.#states.get(channelId) !== GameState.JOINING) {
      return { success: false, error: 'game_not_joinable' };
    }

    const result = channel.addPlayer(playerId);
    if (!result) {
      return { success: false, error: channel.isFull() ? 'game_full' : 'already_joined' };
    }

    this.#emit('player:joined', { channelId, playerId });

    // Check if game is full
    if (channel.isFull()) {
      this.#startGuessingPhase(channelId);
    }

    return { success: true };
  }

  /**
   * Remove a game
   * @param {number} channelId - Channel ID
   * @returns {{success: boolean, error?: string}}
   */
  removeGame(channelId) {
    if (!this.#games.has(channelId)) {
      return { success: false, error: 'game_not_exists' };
    }

    this.#cancelTimer(channelId);
    this.#games.delete(channelId);
    this.#states.delete(channelId);
    this.#rounds.delete(channelId);
    this.#currentRounds.delete(channelId);
    this.#scores.delete(channelId);

    this.#emit('game:removed', { channelId });

    return { success: true };
  }

  /**
   * Handle join timeout
   * @param {number} channelId - Channel ID
   */
  onJoinTimeout(channelId) {
    if (!this.#games.has(channelId)) {
      return;
    }

    const state = this.#states.get(channelId);
    if (state !== GameState.JOINING) {
      return;
    }

    const channel = this.#games.get(channelId);
    const playerCount = channel.getPlayerCount();

    if (playerCount <= 1) {
      // Not enough players, end game
      this.#emit('game:finished', { channelId, reason: 'insufficient_players' });
      this.removeGame(channelId);
    } else {
      // Start the game
      this.#startGuessingPhase(channelId);
    }
  }

  // ===== Phase Management =====

  /**
   * Start the guessing phase
   * @param {number} channelId - Channel ID
   */
  #startGuessingPhase(channelId) {
    this.#cancelTimer(channelId);

    const channel = this.#games.get(channelId);
    if (!channel) return;

    this.#states.set(channelId, GameState.GUESSING);
    channel.clearAllGuesses();

    const round = new Round((this.#rounds.get(channelId) || 0) + 1);
    this.#rounds.set(channelId, round.number);
    this.#currentRounds.set(channelId, round);

    const eligiblePlayers = channel.getRichestPlayers(this.#config.minBet);
    const playerData = eligiblePlayers.map(p => ({ id: p.id, balance: p.balance }));

    this.#emit('phase:guessing', {
      channelId,
      round: round.number,
      players: playerData
    });

    // Start phase timer
    this.#startTimer(channelId, () => {
      this.#endGuessingPhase(channelId);
    }, this.#config.timeToChoice);
  }

  /**
   * Handle a player's guess
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @param {number} guess - Guess value (1-50)
   * @returns {{success: boolean, error?: string}}
   */
  handleGuess(channelId, playerId, guess) {
    const channel = this.#games.get(channelId);
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

    if (!player.hasMinimumBalance(this.#config.minBet)) {
      return { success: false, error: 'insufficient_balance' };
    }

    const validation = Validator.validateGuess(guess);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const round = this.#currentRounds.get(channelId);
    round.recordGuess(playerId, guess);
    player.setGuess(guess);

    this.#emit('guess:received', { channelId, playerId, guess });

    return { success: true };
  }

  /**
   * End guessing phase and determine winner
   * @param {number} channelId - Channel ID
   */
  #endGuessingPhase(channelId) {
    this.#cancelTimer(channelId);

    const channel = this.#games.get(channelId);
    if (!channel) return;

    const round = this.#currentRounds.get(channelId);
    const playersWithGuesses = channel.getPlayersWithGuesses();

    if (playersWithGuesses.length === 0) {
      this.#emit('game:finished', { channelId, reason: 'no_guesses' });
      this.removeGame(channelId);
      return;
    }

    const roll = Dice.rollGuess();
    const winner = Dice.findClosestGuess(playersWithGuesses, roll);
    const isExact = Dice.isExactMatch(winner.currentGuess, roll);

    round.setTargetNumber(roll);
    round.setCandidate(winner, isExact);

    // Award exact match bonus
    if (isExact) {
      winner.addBonus(Dice.EXACT_BONUS);
      this.#addPoints(channelId, winner.id, Dice.EXACT_POINTS);
      this.#emit('guess:exact', { channelId, playerId: winner.id, bonus: Dice.EXACT_BONUS });
    }

    this.#states.set(channelId, GameState.PICKING);

    const eligiblePlayers = channel.getRichestPlayers(this.#config.minBet);
    const playerData = eligiblePlayers.map(p => ({ id: p.id, balance: p.balance }));

    this.#emit('phase:picking', {
      channelId,
      round: round.number,
      roll,
      winnerId: winner.id,
      isExact,
      players: playerData
    });

    // Start picking timer
    this.#startTimer(channelId, () => {
      // If timeout, skip to next round
      this.#startGuessingPhase(channelId);
    }, this.#config.timeToChoice);
  }

  /**
   * Handle opponent pick
   * @param {number} channelId - Channel ID
   * @param {number} pickerId - The candidate's ID
   * @param {number} pickIndex - Picked index (1-based)
   * @returns {{success: boolean, error?: string}}
   */
  handlePick(channelId, pickerId, pickIndex) {
    const channel = this.#games.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    if (this.#states.get(channelId) !== GameState.PICKING) {
      return { success: false, error: 'not_picking_phase' };
    }

    const round = this.#currentRounds.get(channelId);
    if (round.candidate?.id !== pickerId) {
      return { success: false, error: 'not_candidate' };
    }

    const eligiblePlayers = channel.getRichestPlayers(this.#config.minBet);
    const pickerIndex = eligiblePlayers.findIndex(p => p.id === pickerId);

    const validation = Validator.validatePick(pickIndex, eligiblePlayers.length, pickerIndex);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const opponent = eligiblePlayers[validation.normalizedIndex];
    round.setOpponent(opponent);

    this.#states.set(channelId, GameState.BETTING);

    this.#emit('phase:betting', {
      channelId,
      pickerId,
      opponentId: opponent.id,
      pickerBalance: round.candidate.balance
    });

    // Start betting timer
    this.#startTimer(channelId, () => {
      // On timeout, use minimum bet
      this.#handleBet(channelId, pickerId, this.#config.minBet);
    }, this.#config.timeToChoice);

    return { success: true };
  }

  /**
   * Handle bet placement
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @param {number} amount - Bet amount
   * @returns {{success: boolean, error?: string}}
   */
  #handleBet(channelId, playerId, amount) {
    const channel = this.#games.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    const player = channel.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'player_not_found' };
    }

    const validation = Validator.validateBet(amount, player.balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const round = this.#currentRounds.get(channelId);
    round.setBet(amount);

    this.#states.set(channelId, GameState.ROLLING);

    this.#emit('phase:rolling', {
      channelId,
      bet: amount,
      candidateId: round.candidate.id,
      opponentId: round.opponent.id
    });

    return { success: true };
  }

  /**
   * Public method to handle bet from command
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @param {number} amount - Bet amount
   * @returns {{success: boolean, error?: string}}
   */
  handleBet(channelId, playerId, amount) {
    return this.#handleBet(channelId, playerId, amount);
  }

  /**
   * Handle player roll
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @param {number|null} fixedValue - Fixed value for admin cheat, or null
   * @returns {{success: boolean, error?: string, roll?: number}}
   */
  handleRoll(channelId, playerId, fixedValue = null) {
    const channel = this.#games.get(channelId);
    if (!channel) {
      return { success: false, error: 'game_not_exists' };
    }

    if (this.#states.get(channelId) !== GameState.ROLLING) {
      return { success: false, error: 'not_rolling_phase' };
    }

    const round = this.#currentRounds.get(channelId);

    // Determine if this is the candidate or opponent rolling
    const isCandidate = round.candidate?.id === playerId;
    const isOpponent = round.opponent?.id === playerId;

    if (!isCandidate && !isOpponent) {
      return { success: false, error: 'player_not_in_round' };
    }

    const roll = fixedValue !== null ? fixedValue : Dice.rollPVP();

    if (isCandidate) {
      round.setCandidateRoll(roll);
    } else {
      round.setOpponentRoll(roll);
    }

    this.#emit('roll:received', { channelId, playerId, roll });

    // Check if both have rolled
    if (round.hasBothRolls()) {
      this.#resolvePVP(channelId);
    }

    return { success: true, roll };
  }

  /**
   * Resolve PVP round result
   * @param {number} channelId - Channel ID
   */
  #resolvePVP(channelId) {
    this.#cancelTimer(channelId);

    const round = this.#currentRounds.get(channelId);
    const channel = this.#games.get(channelId);

    const result = round.getPVPResult();
    const bet = round.bet;

    if (result.isTie) {
      this.#emit('pvp:draw', { channelId, bet });
      round.clearRolls();
      return;
    }

    const winnerId = result.winner === 'candidate' ? round.candidate.id : round.opponent.id;
    const loserId = result.loser === 'candidate' ? round.candidate.id : round.opponent.id;
    const loser = channel.getPlayer(loserId);

    const isEliminated = loser.deductBalance(bet);

    if (isEliminated) {
      channel.removePlayer(loserId);
    }

    this.#addPoints(channelId, winnerId, 1);

    this.#emit('pvp:result', {
      channelId,
      winnerId,
      loserId,
      bet,
      isEliminated
    });

    // Check if game should end
    const endCheck = this.#checkGameEnd(channelId);
    if (endCheck.ended) {
      this.#endGame(channelId, endCheck.winner);
    } else {
      // Start next round
      this.#delay(() => this.#startGuessingPhase(channelId), 1000);
    }
  }

  /**
   * Check if game should end
   * @param {number} channelId - Channel ID
   * @returns {{ended: boolean, winner?: Player}}
   */
  #checkGameEnd(channelId) {
    const channel = this.#games.get(channelId);
    if (!channel) {
      return { ended: true };
    }

    const richPlayers = channel.getRichestPlayers(this.#config.minBet);

    if (richPlayers.length <= 1) {
      this.#states.set(channelId, GameState.FINISHED);
      return { ended: true, winner: richPlayers[0] || null };
    }

    return { ended: false };
  }

  /**
   * End game and announce winner
   * @param {number} channelId - Channel ID
   * @param {Player} winner - Winning player
   */
  #endGame(channelId, winner) {
    const channel = this.#games.get(channelId);
    const initialPlayerCount = channel.getAllPlayers().length;

    // Award final bonus points
    if (winner) {
      this.#addPoints(channelId, winner.id, initialPlayerCount);
    }

    const scores = this.getSortedScores(channelId);

    this.#emit('game:ended', {
      channelId,
      winnerId: winner?.id,
      scores
    });

    // Cleanup
    this.#games.delete(channelId);
    this.#states.delete(channelId);
    this.#rounds.delete(channelId);
    this.#currentRounds.delete(channelId);
    // Keep scores for final read
  }

  // ===== Query Methods =====

  /**
   * Check if game exists
   * @param {number} channelId - Channel ID
   * @returns {boolean}
   */
  hasGame(channelId) {
    return this.#games.has(channelId);
  }

  /**
   * Get game state
   * @param {number} channelId - Channel ID
   * @returns {string|null}
   */
  getState(channelId) {
    return this.#states.get(channelId) || null;
  }

  /**
   * Get game language
   * @param {number} channelId - Channel ID
   * @returns {string|null}
   */
  getLanguage(channelId) {
    const channel = this.#games.get(channelId);
    return channel ? channel.language : null;
  }

  /**
   * Get eligible players (have min balance)
   * @param {number} channelId - Channel ID
   * @returns {Array<{id: number, balance: number}>}
   */
  getEligiblePlayers(channelId) {
    const channel = this.#games.get(channelId);
    if (!channel) return [];

    const players = channel.getRichestPlayers(this.#config.minBet);
    return players.map(p => ({ id: p.id, balance: p.balance }));
  }

  /**
   * Get player balance
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @returns {number|null}
   */
  getPlayerBalance(channelId, playerId) {
    const channel = this.#games.get(channelId);
    if (!channel) return null;

    const player = channel.getPlayer(playerId);
    return player ? player.balance : null;
  }

  /**
   * Get sorted scores
   * @param {number} channelId - Channel ID
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
   * Get current round info
   * @param {number} channelId - Channel ID
   * @returns {Object|null}
   */
  getRoundInfo(channelId) {
    const round = this.#currentRounds.get(channelId);
    return round ? round.toJSON() : null;
  }

  // ===== Event System =====

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  #emit(event, data) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  // ===== Private Helpers =====

  /**
   * Add points to a player
   * @param {number} channelId - Channel ID
   * @param {number} playerId - Player ID
   * @param {number} points - Points to add
   */
  #addPoints(channelId, playerId, points) {
    const scores = this.#scores.get(channelId);
    if (scores) {
      const current = scores.get(playerId) || 0;
      scores.set(playerId, current + points);
    }
  }

  /**
   * Start a timer for a channel
   * @param {number} channelId - Channel ID
   * @param {Function} callback - Timeout callback
   * @param {number} duration - Duration in ms
   */
  #startTimer(channelId, callback, duration) {
    this.#cancelTimer(channelId);

    const timer = new Timer(`game-${channelId}`);
    timer.start(callback, duration);
    this.#timers.set(channelId, timer);
  }

  /**
   * Cancel timer for a channel
   * @param {number} channelId - Channel ID
   */
  #cancelTimer(channelId) {
    const timer = this.#timers.get(channelId);
    if (timer) {
      timer.stop();
      this.#timers.delete(channelId);
    }
  }

  /**
   * Delay helper
   * @param {Function} callback - Callback function
   * @param {number} ms - Milliseconds
   */
  #delay(callback, ms) {
    setTimeout(callback, ms);
  }
}

export default GameEngine;
