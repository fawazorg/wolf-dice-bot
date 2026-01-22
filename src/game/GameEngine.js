/**
 * @fileoverview Redis-backed game engine for the dice game.
 * Replaces in-memory GameEngine with Redis storage for multi-instance support.
 * @module game/GameEngine
 */

import { GameState } from "../core/GameState.js";
import { Dice } from "../core/index.js";
import GameStore from "./GameStore.js";
import Validator from "./Validator.js";

/**
 * Redis-backed game engine
 * Orchestrates game flow with Redis persistence and UUID-validated timers
 */
class RedisGameEngine {
  /** @type {GameStore} */
  #store;

  /** @type {Map<string, Function[]>} Event listeners */
  #listeners;

  /** @type {Object} Game configuration */
  #config;

  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.maxPlayers=16] - Maximum players per game
   * @param {number} [options.timeToJoin=30000] - Join phase timeout (ms)
   * @param {number} [options.timeToChoice=15000] - Choice phase timeout (ms)
   * @param {number} [options.maxGuessRoll=50] - Maximum guess roll
   * @param {number} [options.minBet=500] - Minimum bet amount
   */
  constructor(options = {}) {
    this.#store = new GameStore();
    this.#listeners = new Map();

    this.#config = {
      maxPlayers: options.maxPlayers || 16,
      timeToJoin: options.timeToJoin || 30000,
      timeToChoice: options.timeToChoice || 15000,
      maxGuessRoll: options.maxGuessRoll || 50,
      minBet: options.minBet || 500
    };
  }

  // ===== Configuration Getters =====

  get maxPlayers() {
    return this.#config.maxPlayers;
  }
  get timeToJoin() {
    return this.#config.timeToJoin;
  }
  get timeToChoice() {
    return this.#config.timeToChoice;
  }
  get minBet() {
    return this.#config.minBet;
  }

  // ===== Game Lifecycle =====

  /**
   * Create a new game
   * @param {number} channelId
   * @param {string} language
   * @param {number} defaultBalance
   * @param {number} creatorId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createGame(channelId, language, defaultBalance, creatorId) {
    const balanceCheck = Validator.validateBalance(defaultBalance);
    if (!balanceCheck.valid) {
      return { success: false, error: balanceCheck.error };
    }

    const result = await this.#store.createGame(
      channelId,
      language,
      defaultBalance,
      creatorId,
      this.#config.maxPlayers
    );

    if (result.success) {
      this.#emit("game:created", { channelId, language, balance: defaultBalance });
    }

    return result;
  }

  /**
   * Add a player to a game
   * @param {number} channelId
   * @param {number} playerId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addPlayer(channelId, playerId) {
    const result = await this.#store.addPlayer(channelId, playerId);

    if (result.success) {
      this.#emit("player:joined", { channelId, playerId });

      const game = await this.#store.getGame(channelId);
      const playerCount = await this.#store.getPlayerCount(channelId);

      if (playerCount >= game.maxPlayers) {
        await this.#startGuessingPhase(channelId);
      }
    }

    return result;
  }

  /**
   * Remove a game
   * @param {number} channelId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeGame(channelId) {
    const result = await this.#store.removeGame(channelId);

    if (result.success) {
      this.#emit("game:removed", { channelId });
    }

    return result;
  }

  /**
   * Handle join timeout
   * @param {number} channelId
   */
  async onJoinTimeout(channelId) {
    const exists = await this.#store.hasGame(channelId);
    if (!exists) return;

    const state = await this.#store.getState(channelId);
    if (state !== GameState.JOINING) return;

    const playerCount = await this.#store.getPlayerCount(channelId);

    if (playerCount <= 1) {
      this.#emit("game:finished", { channelId, reason: "insufficient_players" });
      await this.removeGame(channelId);
    } else {
      await this.#startGuessingPhase(channelId);
    }
  }

  // ===== Phase Management =====

  /**
   * Start the guessing phase
   * @param {number} channelId
   */
  async #startGuessingPhase(channelId) {
    const uuid = await this.#store.getGameUuid(channelId);
    if (!uuid) return;

    this.#store.cancelTimer(channelId);
    this.#store.cancelDelay(channelId);

    await this.#store.setState(channelId, GameState.GUESSING);
    await this.#store.clearAllGuesses(channelId);

    const game = await this.#store.getGame(channelId);
    const roundNumber = game.roundNumber + 1;
    await this.#store.startNewRound(channelId, roundNumber);

    const eligiblePlayers = await this.#store.getRichestPlayers(channelId, this.#config.minBet);
    const playerData = eligiblePlayers.map((p) => ({ id: p.id, balance: p.balance }));

    this.#emit("phase:guessing", { channelId, round: roundNumber, players: playerData });

    this.#store.startTimer(
      channelId,
      uuid,
      async () => {
        await this.#endGuessingPhase(channelId);
      },
      this.#config.timeToChoice
    );
  }

  /**
   * Handle a player's guess
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} guess
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async handleGuess(channelId, playerId, guess) {
    const state = await this.#store.getState(channelId);
    if (state !== GameState.GUESSING) {
      return { success: false, error: "not_guessing_phase" };
    }

    const player = await this.#store.getPlayer(channelId, playerId);
    if (!player) {
      return { success: false, error: "player_not_found" };
    }

    if (player.balance < this.#config.minBet) {
      return { success: false, error: "insufficient_balance" };
    }

    const validation = Validator.validateGuess(guess);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await this.#store.recordGuess(channelId, playerId, guess);
    this.#emit("guess:received", { channelId, playerId, guess });

    return { success: true };
  }

  /**
   * End guessing phase and determine winner
   * @param {number} channelId
   */
  async #endGuessingPhase(channelId) {
    this.#store.cancelTimer(channelId);

    const uuid = await this.#store.getGameUuid(channelId);
    if (!uuid) return;

    const playersWithGuesses = await this.#store.getPlayersWithGuesses(channelId);

    if (playersWithGuesses.length === 0) {
      this.#emit("game:finished", { channelId, reason: "no_guesses" });
      await this.removeGame(channelId);
      return;
    }

    const roll = Dice.rollGuess();
    const winner = Dice.findClosestGuess(playersWithGuesses, roll);
    const isExact = Dice.isExactMatch(winner.currentGuess, roll);

    await this.#store.updateRound(channelId, {
      targetNumber: roll,
      candidateId: winner.id,
      isExactMatch: isExact
    });

    if (isExact) {
      const newBalance = winner.balance + Dice.EXACT_BONUS;
      await this.#store.updatePlayer(channelId, winner.id, { balance: newBalance });
      await this.#store.addPoints(channelId, winner.id, Dice.EXACT_POINTS);
      this.#emit("guess:exact", { channelId, playerId: winner.id, bonus: Dice.EXACT_BONUS });
    }

    await this.#store.setState(channelId, GameState.PICKING);

    const allEligible = await this.#store.getRichestPlayers(channelId, this.#config.minBet);
    const eligiblePlayers = allEligible.filter((p) => p.id !== winner.id);

    if (eligiblePlayers.length === 1) {
      const autoPickedOpponent = eligiblePlayers[0];
      await this.#store.updateRound(channelId, { opponentId: autoPickedOpponent.id });

      this.#emit("pick:auto", {
        channelId,
        roll,
        candidateId: winner.id,
        opponentId: autoPickedOpponent.id,
        candidateBalance: winner.balance
      });

      await this.#store.setState(channelId, GameState.BETTING);
      this.#emit("phase:betting", {
        channelId,
        pickerId: winner.id,
        opponentId: autoPickedOpponent.id,
        pickerBalance: winner.balance,
        isAutoPick: true
      });

      this.#store.startTimer(
        channelId,
        uuid,
        async () => {
          await this.#handleBet(channelId, winner.id, this.#config.minBet);
        },
        this.#config.timeToChoice
      );

      return;
    }

    if (eligiblePlayers.length === 0) {
      await this.#startGuessingPhase(channelId);
      return;
    }

    const playerData = eligiblePlayers.map((p) => ({ id: p.id, balance: p.balance }));

    this.#emit("phase:picking", {
      channelId,
      round: (await this.#store.getRound(channelId)).number,
      roll,
      winnerId: winner.id,
      isExact,
      players: playerData
    });

    this.#store.startTimer(
      channelId,
      uuid,
      async () => {
        await this.#startGuessingPhase(channelId);
      },
      this.#config.timeToChoice
    );
  }

  /**
   * Handle opponent pick
   * @param {number} channelId
   * @param {number} pickerId
   * @param {number} pickIndex
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async handlePick(channelId, pickerId, pickIndex) {
    const state = await this.#store.getState(channelId);
    if (state !== GameState.PICKING) {
      return { success: false, error: "not_picking_phase" };
    }

    const round = await this.#store.getRound(channelId);
    if (round.candidateId !== pickerId) {
      return { success: false, error: "not_candidate" };
    }

    const allEligible = await this.#store.getRichestPlayers(channelId, this.#config.minBet);
    const eligiblePlayers = allEligible.filter((p) => p.id !== pickerId);

    const normalizedIndex = pickIndex - 1;
    if (normalizedIndex < 0 || normalizedIndex >= eligiblePlayers.length) {
      return { success: false, error: "pick_out_of_range" };
    }

    const opponent = eligiblePlayers[normalizedIndex];
    await this.#store.updateRound(channelId, { opponentId: opponent.id });

    this.#store.cancelTimer(channelId);
    await this.#store.setState(channelId, GameState.BETTING);

    const candidate = await this.#store.getPlayer(channelId, pickerId);

    this.#emit("phase:betting", {
      channelId,
      pickerId,
      opponentId: opponent.id,
      pickerBalance: candidate.balance
    });

    const uuid = await this.#store.getGameUuid(channelId);
    this.#store.startTimer(
      channelId,
      uuid,
      async () => {
        await this.#handleBet(channelId, pickerId, this.#config.minBet);
      },
      this.#config.timeToChoice
    );

    return { success: true };
  }

  /**
   * Handle bet placement
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} amount
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async #handleBet(channelId, playerId, amount) {
    const player = await this.#store.getPlayer(channelId, playerId);
    if (!player) {
      return { success: false, error: "player_not_found" };
    }

    const validation = Validator.validateBet(amount, player.balance);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    this.#store.cancelTimer(channelId);
    await this.#store.updateRound(channelId, { bet: amount });
    await this.#store.setState(channelId, GameState.ROLLING);

    const round = await this.#store.getRound(channelId);

    this.#emit("phase:rolling", {
      channelId,
      bet: amount,
      candidateId: round.candidateId,
      opponentId: round.opponentId
    });

    return { success: true };
  }

  /**
   * Public method to handle bet from command
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} amount
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async handleBet(channelId, playerId, amount) {
    return this.#handleBet(channelId, playerId, amount);
  }

  /**
   * Handle player roll
   * @param {number} channelId
   * @param {number} playerId
   * @param {number|null} fixedValue
   * @returns {Promise<{success: boolean, error?: string, roll?: number}>}
   */
  async handleRoll(channelId, playerId, fixedValue = null) {
    const state = await this.#store.getState(channelId);
    if (state !== GameState.ROLLING) {
      return { success: false, error: "not_rolling_phase" };
    }

    const round = await this.#store.getRound(channelId);
    const isCandidate = round.candidateId === playerId;
    const isOpponent = round.opponentId === playerId;

    if (!isCandidate && !isOpponent) {
      return { success: false, error: "player_not_in_round" };
    }

    const roll = fixedValue !== null ? fixedValue : Dice.rollPVP();

    if (isCandidate) {
      await this.#store.updateRound(channelId, { candidateRoll: roll });
    } else {
      await this.#store.updateRound(channelId, { opponentRoll: roll });
    }

    this.#emit("roll:received", { channelId, playerId, roll });

    const updatedRound = await this.#store.getRound(channelId);
    if (updatedRound.candidateRoll !== null && updatedRound.opponentRoll !== null) {
      await this.#resolvePVP(channelId);
    }

    return { success: true, roll };
  }

  /**
   * Handle roll timeout
   * @param {number} channelId
   * @param {number} playerId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async handleRollTimeout(channelId, playerId) {
    const state = await this.#store.getState(channelId);
    if (state !== GameState.ROLLING) {
      return { success: false, error: "not_rolling_phase" };
    }

    const round = await this.#store.getRound(channelId);
    const isCandidate = round.candidateId === playerId;
    const isOpponent = round.opponentId === playerId;

    if (!isCandidate && !isOpponent) {
      return { success: false, error: "player_not_in_round" };
    }

    const winnerId = isCandidate ? round.opponentId : round.candidateId;
    const loserId = playerId;

    const loser = await this.#store.getPlayer(channelId, loserId);
    const newBalance = loser.balance - round.bet;
    const isEliminated = newBalance <= 0;

    await this.#store.updatePlayer(channelId, loserId, { balance: newBalance });

    if (isEliminated) {
      await this.#store.removePlayer(channelId, loserId);
    }

    await this.#store.addPoints(channelId, winnerId, 1);
    this.#emit("roll:timeout", {
      channelId,
      playerId,
      winnerId,
      loserId,
      bet: round.bet,
      isEliminated
    });

    await this.#store.setState(channelId, null);

    const endCheck = await this.#checkGameEnd(channelId);
    if (endCheck.ended) {
      await this.#endGame(channelId, endCheck.winner);
    } else {
      const uuid = await this.#store.getGameUuid(channelId);
      this.#store.scheduleDelay(
        channelId,
        uuid,
        async () => {
          await this.#startGuessingPhase(channelId);
        },
        1000
      );
    }

    return { success: true };
  }

  /**
   * Resolve PVP round result
   * @param {number} channelId
   */
  async #resolvePVP(channelId) {
    this.#store.cancelTimer(channelId);

    const round = await this.#store.getRound(channelId);
    const bet = round.bet;

    let result;
    if (round.candidateRoll > round.opponentRoll) {
      result = { winner: "candidate", loser: "opponent", isTie: false };
    } else if (round.opponentRoll > round.candidateRoll) {
      result = { winner: "opponent", loser: "candidate", isTie: false };
    } else {
      result = { winner: null, loser: null, isTie: true };
    }

    if (result.isTie) {
      this.#emit("pvp:draw", { channelId, bet });
      await this.#store.clearRolls(channelId);
      return;
    }

    const winnerId = result.winner === "candidate" ? round.candidateId : round.opponentId;
    const loserId = result.loser === "candidate" ? round.candidateId : round.opponentId;

    const loser = await this.#store.getPlayer(channelId, loserId);
    const newBalance = loser.balance - bet;
    const isEliminated = newBalance <= 0;

    await this.#store.updatePlayer(channelId, loserId, { balance: newBalance });

    if (isEliminated) {
      await this.#store.removePlayer(channelId, loserId);
    }

    await this.#store.addPoints(channelId, winnerId, 1);

    this.#emit("pvp:result", { channelId, winnerId, loserId, bet, isEliminated });

    await this.#store.setState(channelId, null);

    const endCheck = await this.#checkGameEnd(channelId);
    if (endCheck.ended) {
      await this.#endGame(channelId, endCheck.winner);
    } else {
      const uuid = await this.#store.getGameUuid(channelId);
      this.#store.scheduleDelay(
        channelId,
        uuid,
        async () => {
          await this.#startGuessingPhase(channelId);
        },
        1000
      );
    }
  }

  /**
   * Check if game should end
   * @param {number} channelId
   * @returns {Promise<{ended: boolean, winner?: Object}>}
   */
  async #checkGameEnd(channelId) {
    const richPlayers = await this.#store.getRichestPlayers(channelId, this.#config.minBet);

    if (richPlayers.length <= 1) {
      await this.#store.setState(channelId, GameState.FINISHED);
      return { ended: true, winner: richPlayers[0] || null };
    }

    return { ended: false };
  }

  /**
   * End game and announce winner
   * @param {number} channelId
   * @param {Object} winner
   */
  async #endGame(channelId, winner) {
    const players = await this.#store.getAllPlayers(channelId);
    const initialPlayerCount = players.length;

    if (winner) {
      await this.#store.addPoints(channelId, winner.id, initialPlayerCount);
    }

    const scores = await this.#store.getSortedScores(channelId);

    this.#emit("game:ended", {
      channelId,
      winnerId: winner?.id,
      scores
    });

    await this.#store.removeGame(channelId);
  }

  // ===== Query Methods =====

  async hasGame(channelId) {
    return this.#store.hasGame(channelId);
  }

  async getState(channelId) {
    return this.#store.getState(channelId);
  }

  async getLanguage(channelId) {
    return this.#store.getLanguage(channelId);
  }

  async getEligiblePlayers(channelId) {
    const players = await this.#store.getRichestPlayers(channelId, this.#config.minBet);
    return players.map((p) => ({ id: p.id, balance: p.balance }));
  }

  async getPlayerBalance(channelId, playerId) {
    const player = await this.#store.getPlayer(channelId, playerId);
    return player ? player.balance : null;
  }

  async getSortedScores(channelId) {
    return this.#store.getSortedScores(channelId);
  }

  async getRoundInfo(channelId) {
    return this.#store.getRound(channelId);
  }

  /**
   * Get game creator ID
   * @param {number} channelId
   * @returns {Promise<number|null>}
   */
  async getGameCreator(channelId) {
    return this.#store.getGameCreator(channelId);
  }

  /**
   * Reset betting timer
   * @param {number} channelId
   * @param {number} playerId
   */
  async resetBettingTimer(channelId, playerId) {
    const state = await this.#store.getState(channelId);
    if (state !== GameState.BETTING) return;

    const uuid = await this.#store.getGameUuid(channelId);
    this.#store.startTimer(
      channelId,
      uuid,
      async () => {
        await this.#handleBet(channelId, playerId, this.#config.minBet);
      },
      this.#config.timeToChoice
    );
  }

  // ===== Event System =====

  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);
  }

  off(event, callback) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

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
}

export default RedisGameEngine;
