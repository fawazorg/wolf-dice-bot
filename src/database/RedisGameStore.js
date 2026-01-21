/**
 * @fileoverview Redis-based game state storage with atomic operations.
 * Replaces in-memory Maps with Redis for distributed multi-instance support.
 * @module database/RedisGameStore
 */

import { v4 as uuidv4 } from 'uuid';
import { getRedis } from './RedisConnection.js';
import logger from '../utils/logger.js';

/** @constant {number} Game TTL in seconds (3 minutes) */
const GAME_TTL = 180;

/** @constant {string} Key prefix for all game-related keys */
const KEY_PREFIX = 'dice';

/**
 * Redis-based game state storage
 * Provides atomic operations for game lifecycle management
 */
class RedisGameStore {
  /** @type {import('ioredis').Redis} */
  #redis;

  /** @type {Map<number, NodeJS.Timeout>} Local timer handles by channel ID */
  #timers;

  /** @type {Map<number, NodeJS.Timeout>} Pending delays by channel ID */
  #pendingDelays;

  constructor() {
    this.#redis = getRedis();
    this.#timers = new Map();
    this.#pendingDelays = new Map();
  }

  // ===== Key Helpers =====

  #gameKey(channelId) {
    return `${KEY_PREFIX}:game:${channelId}`;
  }

  #playersKey(channelId) {
    return `${KEY_PREFIX}:game:${channelId}:players`;
  }

  #scoresKey(channelId) {
    return `${KEY_PREFIX}:game:${channelId}:scores`;
  }

  #roundKey(channelId) {
    return `${KEY_PREFIX}:game:${channelId}:round`;
  }

  // ===== Game Lifecycle =====

  /**
   * Create a new game atomically (prevents duplicates across instances)
   * @param {number} channelId
   * @param {string} language
   * @param {number} defaultBalance
   * @param {number} creatorId
   * @param {number} maxPlayers
   * @returns {Promise<{success: boolean, error?: string, uuid?: string}>}
   */
  async createGame(channelId, language, defaultBalance, creatorId, maxPlayers = 16) {
    const gameKey = this.#gameKey(channelId);
    const uuid = uuidv4();

    // Atomic create using SET NX
    const created = await this.#redis.set(`${gameKey}:lock`, 'CREATING', 'NX', 'PX', 500);

    if (!created) {
      const exists = await this.#redis.exists(gameKey);
      if (exists) {
        return { success: false, error: 'game_already_exists' };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.createGame(channelId, language, defaultBalance, creatorId, maxPlayers);
    }

    try {
      const now = Date.now();
      const pipeline = this.#redis.pipeline();

      pipeline.hset(gameKey, {
        state: 'joining',
        language,
        defaultBalance: defaultBalance.toString(),
        maxPlayers: maxPlayers.toString(),
        creatorId: creatorId.toString(),
        roundNumber: '0',
        uuid,
        createdAt: now.toString(),
        updatedAt: now.toString()
      });
      pipeline.expire(gameKey, GAME_TTL);

      pipeline.del(this.#playersKey(channelId));
      pipeline.expire(this.#playersKey(channelId), GAME_TTL);

      pipeline.del(this.#scoresKey(channelId));
      pipeline.expire(this.#scoresKey(channelId), GAME_TTL);

      pipeline.hset(this.#roundKey(channelId), {
        number: '0',
        targetNumber: '',
        candidateId: '',
        opponentId: '',
        bet: '0',
        candidateRoll: '',
        opponentRoll: '',
        isExactMatch: 'false',
        guesses: '{}'
      });
      pipeline.expire(this.#roundKey(channelId), GAME_TTL);

      pipeline.sadd(`${KEY_PREFIX}:channels:active`, channelId.toString());

      await pipeline.exec();
      logger.info('Game created', { channelId, uuid, language, defaultBalance });
      return { success: true, uuid };
    } finally {
      await this.#redis.del(`${gameKey}:lock`);
    }
  }

  /**
   * Check if a game exists
   * @param {number} channelId
   * @returns {Promise<boolean>}
   */
  async hasGame(channelId) {
    const exists = await this.#redis.exists(this.#gameKey(channelId));
    return exists === 1;
  }

  /**
   * Get game UUID (for stale callback validation)
   * @param {number} channelId
   * @returns {Promise<string|null>}
   */
  async getGameUuid(channelId) {
    return this.#redis.hget(this.#gameKey(channelId), 'uuid');
  }

  /**
   * Get game state
   * @param {number} channelId
   * @returns {Promise<string|null>}
   */
  async getState(channelId) {
    return this.#redis.hget(this.#gameKey(channelId), 'state');
  }

  /**
   * Set game state and refresh TTL
   * @param {number} channelId
   * @param {string} state
   * @returns {Promise<boolean>}
   */
  async setState(channelId, state) {
    const gameKey = this.#gameKey(channelId);
    const exists = await this.#redis.exists(gameKey);
    if (!exists) return false;

    await this.#redis.hset(gameKey, {
      state,
      updatedAt: Date.now().toString()
    });
    await this.#refreshTTL(channelId);
    return true;
  }

  /**
   * Get full game data
   * @param {number} channelId
   * @returns {Promise<Object|null>}
   */
  async getGame(channelId) {
    const data = await this.#redis.hgetall(this.#gameKey(channelId));
    if (!data || Object.keys(data).length === 0) return null;

    return {
      state: data.state,
      language: data.language,
      defaultBalance: parseInt(data.defaultBalance, 10),
      maxPlayers: parseInt(data.maxPlayers, 10),
      creatorId: data.creatorId ? parseInt(data.creatorId, 10) : null,
      roundNumber: parseInt(data.roundNumber, 10),
      uuid: data.uuid,
      createdAt: parseInt(data.createdAt, 10),
      updatedAt: parseInt(data.updatedAt, 10)
    };
  }

  /**
   * Get game language
   * @param {number} channelId
   * @returns {Promise<string|null>}
   */
  async getLanguage(channelId) {
    return this.#redis.hget(this.#gameKey(channelId), 'language');
  }

  /**
   * Get game creator ID
   * @param {number} channelId
   * @returns {Promise<number|null>}
   */
  async getGameCreator(channelId) {
    const creatorId = await this.#redis.hget(this.#gameKey(channelId), 'creatorId');
    return creatorId ? parseInt(creatorId, 10) : null;
  }

  /**
   * Remove a game and all associated data
   * @param {number} channelId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeGame(channelId) {
    const exists = await this.hasGame(channelId);
    if (!exists) {
      return { success: false, error: 'game_not_exists' };
    }

    this.cancelTimer(channelId);
    this.cancelDelay(channelId);

    const pipeline = this.#redis.pipeline();
    pipeline.del(this.#gameKey(channelId));
    pipeline.del(this.#playersKey(channelId));
    pipeline.del(this.#scoresKey(channelId));
    pipeline.del(this.#roundKey(channelId));
    pipeline.del(`${this.#gameKey(channelId)}:lock`);
    pipeline.srem(`${KEY_PREFIX}:channels:active`, channelId.toString());

    await pipeline.exec();
    logger.info('Game removed', { channelId });
    return { success: true };
  }

  // ===== Player Management =====

  /**
   * Add a player to the game
   * @param {number} channelId
   * @param {number} playerId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addPlayer(channelId, playerId) {
    const game = await this.getGame(channelId);
    if (!game) {
      return { success: false, error: 'game_not_exists' };
    }

    if (game.state !== 'joining') {
      return { success: false, error: 'game_not_joinable' };
    }

    const playersKey = this.#playersKey(channelId);
    const exists = await this.#redis.hexists(playersKey, playerId.toString());
    if (exists) {
      return { success: false, error: 'already_joined' };
    }

    const playerCount = await this.#redis.hlen(playersKey);
    if (playerCount >= game.maxPlayers) {
      return { success: false, error: 'game_full' };
    }

    const playerData = JSON.stringify({
      id: playerId,
      balance: game.defaultBalance,
      currentGuess: null
    });

    await this.#redis.hset(playersKey, playerId.toString(), playerData);
    await this.#refreshTTL(channelId);
    return { success: true };
  }

  /**
   * Remove a player from the game
   * @param {number} channelId
   * @param {number} playerId
   * @returns {Promise<boolean>}
   */
  async removePlayer(channelId, playerId) {
    const result = await this.#redis.hdel(this.#playersKey(channelId), playerId.toString());
    return result === 1;
  }

  /**
   * Get a player's data
   * @param {number} channelId
   * @param {number} playerId
   * @returns {Promise<Object|null>}
   */
  async getPlayer(channelId, playerId) {
    const data = await this.#redis.hget(this.#playersKey(channelId), playerId.toString());
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update a player's data
   * @param {number} channelId
   * @param {number} playerId
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  async updatePlayer(channelId, playerId, updates) {
    const player = await this.getPlayer(channelId, playerId);
    if (!player) return false;

    const updated = { ...player, ...updates };
    await this.#redis.hset(
      this.#playersKey(channelId),
      playerId.toString(),
      JSON.stringify(updated)
    );
    return true;
  }

  /**
   * Get all players in a game
   * @param {number} channelId
   * @returns {Promise<Array<Object>>}
   */
  async getAllPlayers(channelId) {
    const data = await this.#redis.hgetall(this.#playersKey(channelId));
    if (!data) return [];
    return Object.values(data).map((json) => JSON.parse(json));
  }

  /**
   * Get player count
   * @param {number} channelId
   * @returns {Promise<number>}
   */
  async getPlayerCount(channelId) {
    return this.#redis.hlen(this.#playersKey(channelId));
  }

  /**
   * Get players with minimum balance, sorted by balance desc
   * @param {number} channelId
   * @param {number} minBalance
   * @returns {Promise<Array<Object>>}
   */
  async getRichestPlayers(channelId, minBalance = 500) {
    const players = await this.getAllPlayers(channelId);
    return players.filter((p) => p.balance >= minBalance).sort((a, b) => b.balance - a.balance);
  }

  /**
   * Clear all player guesses
   * @param {number} channelId
   * @returns {Promise<void>}
   */
  async clearAllGuesses(channelId) {
    const players = await this.getAllPlayers(channelId);
    const pipeline = this.#redis.pipeline();

    for (const player of players) {
      player.currentGuess = null;
      pipeline.hset(this.#playersKey(channelId), player.id.toString(), JSON.stringify(player));
    }
    await pipeline.exec();
  }

  /**
   * Get players who have made a guess
   * @param {number} channelId
   * @returns {Promise<Array<Object>>}
   */
  async getPlayersWithGuesses(channelId) {
    const players = await this.getAllPlayers(channelId);
    return players.filter((p) => p.currentGuess !== null);
  }

  // ===== Score Management =====

  /**
   * Add points to a player
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} points
   * @returns {Promise<void>}
   */
  async addPoints(channelId, playerId, points) {
    await this.#redis.hincrby(this.#scoresKey(channelId), playerId.toString(), points);
  }

  /**
   * Get sorted scores
   * @param {number} channelId
   * @returns {Promise<Array<{playerId: number, points: number}>>}
   */
  async getSortedScores(channelId) {
    const data = await this.#redis.hgetall(this.#scoresKey(channelId));
    if (!data) return [];

    return Object.entries(data)
      .map(([playerId, points]) => ({
        playerId: parseInt(playerId, 10),
        points: parseInt(points, 10)
      }))
      .sort((a, b) => b.points - a.points);
  }

  // ===== Round Management =====

  /**
   * Get current round data
   * @param {number} channelId
   * @returns {Promise<Object|null>}
   */
  async getRound(channelId) {
    const data = await this.#redis.hgetall(this.#roundKey(channelId));
    if (!data || Object.keys(data).length === 0) return null;

    return {
      number: parseInt(data.number, 10),
      targetNumber: data.targetNumber ? parseInt(data.targetNumber, 10) : null,
      candidateId: data.candidateId ? parseInt(data.candidateId, 10) : null,
      opponentId: data.opponentId ? parseInt(data.opponentId, 10) : null,
      bet: parseInt(data.bet, 10),
      candidateRoll: data.candidateRoll ? parseInt(data.candidateRoll, 10) : null,
      opponentRoll: data.opponentRoll ? parseInt(data.opponentRoll, 10) : null,
      isExactMatch: data.isExactMatch === 'true',
      guesses: data.guesses ? JSON.parse(data.guesses) : {}
    };
  }

  /**
   * Update round data
   * @param {number} channelId
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  async updateRound(channelId, updates) {
    const roundKey = this.#roundKey(channelId);
    const fields = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        fields[key] = '';
      } else if (typeof value === 'object') {
        fields[key] = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        fields[key] = value.toString();
      } else {
        fields[key] = value.toString();
      }
    }

    await this.#redis.hset(roundKey, fields);
    await this.#refreshTTL(channelId);
  }

  /**
   * Start a new round
   * @param {number} channelId
   * @param {number} roundNumber
   * @returns {Promise<void>}
   */
  async startNewRound(channelId, roundNumber) {
    await this.#redis.hset(this.#roundKey(channelId), {
      number: roundNumber.toString(),
      targetNumber: '',
      candidateId: '',
      opponentId: '',
      bet: '0',
      candidateRoll: '',
      opponentRoll: '',
      isExactMatch: 'false',
      guesses: '{}'
    });
    await this.#redis.hincrby(this.#gameKey(channelId), 'roundNumber', 1);
    await this.#refreshTTL(channelId);
  }

  /**
   * Record a player's guess
   * @param {number} channelId
   * @param {number} playerId
   * @param {number} guess
   * @returns {Promise<void>}
   */
  async recordGuess(channelId, playerId, guess) {
    const roundKey = this.#roundKey(channelId);
    const guessesStr = (await this.#redis.hget(roundKey, 'guesses')) || '{}';
    const guesses = JSON.parse(guessesStr);
    guesses[playerId] = guess;
    await this.#redis.hset(roundKey, 'guesses', JSON.stringify(guesses));
    await this.updatePlayer(channelId, playerId, { currentGuess: guess });
  }

  /**
   * Clear dice rolls (for re-rolls on tie)
   * @param {number} channelId
   * @returns {Promise<void>}
   */
  async clearRolls(channelId) {
    await this.#redis.hset(this.#roundKey(channelId), {
      candidateRoll: '',
      opponentRoll: ''
    });
  }

  // ===== Timer Management (with UUID validation) =====

  /**
   * Start a timer for a channel
   * @param {number} channelId
   * @param {string} expectedUuid - UUID to validate against stale callbacks
   * @param {Function} callback
   * @param {number} duration - Duration in ms
   */
  startTimer(channelId, expectedUuid, callback, duration) {
    this.cancelTimer(channelId);

    const handle = setTimeout(async () => {
      const currentUuid = await this.getGameUuid(channelId);
      if (currentUuid !== expectedUuid) {
        logger.debug('Timer callback ignored (game changed)', { channelId });
        return;
      }
      callback();
    }, duration);

    this.#timers.set(channelId, handle);
  }

  /**
   * Cancel timer for a channel
   * @param {number} channelId
   */
  cancelTimer(channelId) {
    const handle = this.#timers.get(channelId);
    if (handle) {
      clearTimeout(handle);
      this.#timers.delete(channelId);
    }
  }

  /**
   * Schedule a delayed callback
   * @param {number} channelId
   * @param {string} expectedUuid
   * @param {Function} callback
   * @param {number} ms
   */
  scheduleDelay(channelId, expectedUuid, callback, ms) {
    this.cancelDelay(channelId);

    const handle = setTimeout(async () => {
      this.#pendingDelays.delete(channelId);
      const currentUuid = await this.getGameUuid(channelId);
      if (currentUuid !== expectedUuid) return;
      callback();
    }, ms);

    this.#pendingDelays.set(channelId, handle);
  }

  /**
   * Cancel pending delay for a channel
   * @param {number} channelId
   */
  cancelDelay(channelId) {
    const handle = this.#pendingDelays.get(channelId);
    if (handle) {
      clearTimeout(handle);
      this.#pendingDelays.delete(channelId);
    }
  }

  // ===== Private Helpers =====

  async #refreshTTL(channelId) {
    const pipeline = this.#redis.pipeline();
    pipeline.expire(this.#gameKey(channelId), GAME_TTL);
    pipeline.expire(this.#playersKey(channelId), GAME_TTL);
    pipeline.expire(this.#scoresKey(channelId), GAME_TTL);
    pipeline.expire(this.#roundKey(channelId), GAME_TTL);
    await pipeline.exec();
  }

  /**
   * Get Redis client for advanced operations
   * @returns {import('ioredis').Redis}
   */
  getRedisClient() {
    return this.#redis;
  }
}

export default RedisGameStore;
