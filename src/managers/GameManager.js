import { Validator } from "wolf.js";
import { GameEngine } from "../engine/index.js";
import MessageService from "../services/MessageService.js";

/**
 * GameManager integrates GameEngine with MessageService and WOLF.js client
 * Listens to engine events and handles all messaging and platform integration
 *
 * This is a thin integration layer - all game logic is in GameEngine
 */
class GameManager {
  /** @type {import('wolf.js').WOLF} */
  #client;

  /** @type {GameEngine} */
  #engine;

  /** @type {MessageService} */
  #messages;

  /** @type {number} Time allowed for joining (ms) */
  #timeToJoin;

  /** @type {number} Time allowed for choices (ms) */
  #timeToChoice;

  /** @type {Set<number>} Admin user IDs */
  #admins;

  /** @type {Map<number, string>} Channel languages (cached for messaging) */
  #languages;

  /** @type {Map<number, number>} Initial player counts (for final scoring) */
  #initialPlayerCounts;

  /**
   * @param {import('wolf.js').WOLF} client - WOLF client instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxPlayers=16] - Maximum players per game
   * @param {number} [options.timeToJoin=30000] - Time to join in ms
   * @param {number} [options.timeToChoice=15000] - Time for choices in ms
   * @param {number[]} [options.admins=[]] - Admin user IDs
   */
  constructor(client, options = {}) {
    this.#client = client;
    this.#engine = new GameEngine({
      maxPlayers: options.maxPlayers || 16,
      timeToJoin: options.timeToJoin || 30000,
      timeToChoice: options.timeToChoice || 15000,
      maxGuessRoll: 50,
      minBet: 500
    });
    this.#messages = new MessageService(client);
    this.#timeToJoin = options.timeToJoin || 30000;
    this.#timeToChoice = options.timeToChoice || 15000;
    this.#admins = new Set(options.admins || []);
    this.#languages = new Map();
    this.#initialPlayerCounts = new Map();

    this.#setupEventListeners();
  }

  /**
   * Set up event listeners for GameEngine events
   * @private
   */
  #setupEventListeners() {
    // Game lifecycle events
    this.#engine.on('game:created', (data) => this.#onGameCreated(data));
    this.#engine.on('game:removed', (data) => this.#onGameRemoved(data));
    this.#engine.on('game:ended', (data) => this.#onGameEnded(data));
    this.#engine.on('game:finished', (data) => this.#onGameFinished(data));

    // Player events
    this.#engine.on('player:joined', (data) => this.#onPlayerJoined(data));

    // Phase events
    this.#engine.on('phase:guessing', (data) => this.#onPhaseGuessing(data));
    this.#engine.on('phase:picking', (data) => this.#onPhasePicking(data));
    this.#engine.on('phase:betting', (data) => this.#onPhaseBetting(data));
    this.#engine.on('phase:rolling', (data) => this.#onPhaseRolling(data));

    // Game action events
    this.#engine.on('guess:received', (data) => this.#onGuessReceived(data));
    this.#engine.on('guess:exact', (data) => this.#onGuessExact(data));
    this.#engine.on('roll:received', (data) => this.#onRollReceived(data));
    this.#engine.on('pvp:draw', (data) => this.#onPVPDraw(data));
    this.#engine.on('pvp:result', (data) => this.#onPVPResult(data));
  }

  // ===== Public API =====

  /**
   * Create a new game
   * @param {import('wolf.js').CommandContext} command
   * @param {string} balanceArg - Balance argument from command
   * @returns {Promise<boolean>}
   */
  async create(command, balanceArg) {
    const channelId = command.targetChannelId;

    // Check if game already exists
    if (this.#engine.hasGame(channelId)) {
      await this.#messages.replyAlreadyCreated(command);
      return false;
    }

    // Parse and validate balance
    const balance = balanceArg ? this.#parseNumber(balanceArg) : 500;

    if (balanceArg && !this.#isValidNumber(balanceArg)) {
      await this.#messages.replyWrongCreate(command);
      return false;
    }

    if (balance <= 0 || balance > 5000 || balance % 500 !== 0) {
      await this.#messages.replyInvalidBalance(command);
      return false;
    }

    // Cache language
    this.#languages.set(channelId, command.language);

    // Create the game
    const result = this.#engine.createGame(channelId, command.language, balance);
    if (!result.success) {
      return false;
    }

    // Add creator as first player
    this.#engine.addPlayer(channelId, command.sourceSubscriberId);

    // Set join timer
    await this.#client.utility.timer.add(
      `game-${channelId}`,
      "UpdateTimer",
      { channleId: channelId },
      this.#timeToJoin
    );

    return true;
  }

  /**
   * Join an existing game
   * @param {import('wolf.js').CommandContext} command
   * @returns {Promise<boolean>}
   */
  async join(command) {
    const channelId = command.targetChannelId;
    const playerId = command.sourceSubscriberId;

    // Check if game exists
    if (!this.#engine.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return false;
    }

    // Try to add player
    const result = this.#engine.addPlayer(channelId, playerId);

    if (!result.success) {
      if (result.error === "already_joined") {
        await this.#messages.replyAlreadyJoin(command);
      }
      return false;
    }

    return true;
  }

  /**
   * Show game players
   * @param {import('wolf.js').CommandContext} command
   */
  async show(command) {
    const channelId = command.targetChannelId;

    if (!this.#engine.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const players = this.#engine.getEligiblePlayers(channelId);
    const playerList = await this.#messages.formatPlayerList(players);
    await this.#messages.replyPlayers(command, playerList);
  }

  /**
   * Remove a game
   * @param {import('wolf.js').CommandContext} command
   */
  async remove(command) {
    const channelId = command.targetChannelId;

    if (!this.#engine.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    this.#engine.removeGame(channelId);
    await this.#messages.replyGameRemoved(command);
  }

  /**
   * Get player balance
   * @param {import('wolf.js').CommandContext} command
   */
  async balance(command) {
    const channelId = command.targetChannelId;
    const playerId = command.sourceSubscriberId;

    if (!this.#engine.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const balance = this.#engine.getPlayerBalance(channelId, playerId);
    if (balance === null) {
      await this.#messages.replyPlayerNotFound(command);
      return;
    }

    await this.#messages.replyPlayerBalance(command, playerId, balance);
  }

  /**
   * Handle join timer expiration
   * Called by UpdateTimer when join period ends
   * @param {number} channelId
   */
  async onJoinTimeout(channelId) {
    this.#engine.onJoinTimeout(channelId);
  }

  /**
   * Handle a player's guess message
   * @param {import('wolf.js').Message} message
   * @returns {Promise<boolean>} True if guess was accepted
   */
  async handleGuessMessage(message) {
    const channelId = message.targetChannelId;
    const playerId = message.sourceSubscriberId;
    const guess = this.#parseNumber(message.body);

    const result = this.#engine.handleGuess(channelId, playerId, guess);
    return result.success;
  }

  /**
   * Handle a player's pick message
   * @param {import('wolf.js').Message} message
   * @returns {Promise<boolean>} True if pick was accepted
   */
  async handlePickMessage(message) {
    const channelId = message.targetChannelId;
    const playerId = message.sourceSubscriberId;
    const pickIndex = this.#parseNumber(message.body);

    const result = this.#engine.handlePick(channelId, playerId, pickIndex);
    return result.success;
  }

  /**
   * Handle a player's bet message
   * @param {import('wolf.js').Message} message
   * @returns {Promise<boolean>} True if bet was accepted
   */
  async handleBetMessage(message) {
    const channelId = message.targetChannelId;
    const playerId = message.sourceSubscriberId;
    const amount = this.#parseNumber(message.body);

    const result = this.#engine.handleBet(channelId, playerId, amount);
    return result.success;
  }

  /**
   * Handle a player's roll command
   * @param {import('wolf.js').Message} message
   * @returns {Promise<boolean>} True if roll was accepted
   */
  async handleRollCommand(message) {
    const channelId = message.targetChannelId;
    const playerId = message.sourceSubscriberId;

    // Check for admin cheat
    const isAdminCheat = this.#admins.has(playerId) && message.body === "لف.";
    const fixedValue = isAdminCheat ? 6 : null;

    const result = this.#engine.handleRoll(channelId, playerId, fixedValue);
    return result.success;
  }

  /**
   * Check if a channel has an active game
   * @param {number} channelId
   * @returns {boolean}
   */
  hasGame(channelId) {
    return this.#engine.hasGame(channelId);
  }

  /**
   * Get game state
   * @param {number} channelId
   * @returns {string|null}
   */
  getState(channelId) {
    return this.#engine.getState(channelId);
  }

  /**
   * Get game language
   * @param {number} channelId
   * @returns {string|null}
   */
  getLanguage(channelId) {
    return this.#engine.getLanguage(channelId);
  }

  /**
   * Get eligible players
   * @param {number} channelId
   * @returns {Array<{id: number, balance: number}>}
   */
  getEligiblePlayers(channelId) {
    return this.#engine.getEligiblePlayers(channelId);
  }

  /**
   * Get sorted scores
   * @param {number} channelId
   * @returns {Array<{playerId: number, points: number}>}
   */
  getSortedScores(channelId) {
    return this.#engine.getSortedScores(channelId);
  }

  // ===== Event Handlers =====

  /**
   * Handle game:created event
   * @param {{channelId: number, language: string, balance: number}} data
   * @private
   */
  async #onGameCreated(data) {
    const { channelId, language } = data;
    await this.#messages.replyCreated(channelId, language, this.#engine.maxPlayers);
  }

  /**
   * Handle game:removed event
   * @param {{channelId: number}} data
   * @private
   */
  async #onGameRemoved(data) {
    // Cleanup cached data
    this.#languages.delete(data.channelId);
    this.#initialPlayerCounts.delete(data.channelId);
  }

  /**
   * Handle game:ended event (normal completion)
   * @param {{channelId: number, winnerId?: number, scores: Array}} data
   * @private
   */
  async #onGameEnded(data) {
    const { channelId, winnerId, scores } = data;
    const language = this.#languages.get(channelId) || 'en';

    // Reward players (save points to database)
    await this.#rewardPlayers(channelId, scores);

    if (winnerId) {
      await this.#announceWinner(channelId, language, winnerId, scores);
    }

    // Cleanup
    this.#languages.delete(channelId);
    this.#initialPlayerCounts.delete(channelId);
  }

  /**
   * Handle game:finished event (early termination)
   * @param {{channelId: number, reason: string}} data
   * @private
   */
  async #onGameFinished(data) {
    const { channelId, reason } = data;
    const language = this.#languages.get(channelId) || 'en';

    if (reason === 'no_guesses' || reason === 'insufficient_players') {
      await this.#messages.replyGameFinish(channelId, language);
    }

    // Cleanup
    this.#languages.delete(channelId);
    this.#initialPlayerCounts.delete(channelId);
  }

  /**
   * Handle player:joined event
   * @param {{channelId: number, playerId: number}} data
   * @private
   */
  async #onPlayerJoined(data) {
    const { channelId, playerId } = data;
    const language = this.#languages.get(channelId) || 'en';

    const phrase = this.#messages.getPhrase(language, `${this.#client.config.keyword}_game_join`);
    const user = await this.#messages.getUser(playerId);
    const response = this.#messages.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.#messages.send(channelId, response);
  }

  /**
   * Handle phase:guessing event
   * @param {{channelId: number, round: number, players: Array}} data
   * @private
   */
  async #onPhaseGuessing(data) {
    const { channelId, round } = data;
    const language = this.#languages.get(channelId) || 'en';

    // Store initial player count for final scoring
    if (round === 1) {
      const players = this.#engine.getEligiblePlayers(channelId);
      this.#initialPlayerCounts.set(channelId, players.length);
    }

    await this.#messages.replyMakeAGuess(channelId, language);

    // Start listening for guesses
    this.#listenForGuess(channelId);
  }

  /**
   * Handle phase:picking event
   * @param {{channelId: number, round: number, roll: number, winnerId: number, isExact: boolean, players: Array}} data
   * @private
   */
  async #onPhasePicking(data) {
    const { channelId, roll, winnerId, isExact, players } = data;
    const language = this.#languages.get(channelId) || 'en';

    // Announce exact match reward
    if (isExact) {
      await this.#messages.replyPlayerRewarded(channelId, language, winnerId);
    }

    // Format player list
    const playerList = await this.#messages.formatPlayerList(players);

    // Announce winner and show player list
    await this.#messages.replyPlayerTurn(channelId, language, winnerId, roll, playerList);

    // Start listening for pick
    this.#listenForPick(channelId, winnerId);
  }

  /**
   * Handle phase:betting event
   * @param {{channelId: number, pickerId: number, opponentId: number, pickerBalance: number}} data
   * @private
   */
  async #onPhaseBetting(data) {
    const { channelId, pickerBalance } = data;
    const language = this.#languages.get(channelId) || 'en';

    if (pickerBalance === this.#engine.minBet) {
      // Skip betting, use minimum
      this.#engine.handleBet(channelId, data.pickerId, this.#engine.minBet);
    } else {
      await this.#messages.replyAskPlayerBalance(channelId, language, pickerBalance);
      this.#listenForBet(channelId, data.pickerId);
    }
  }

  /**
   * Handle phase:rolling event
   * @param {{channelId: number, bet: number, candidateId: number, opponentId: number}} data
   * @private
   */
  async #onPhaseRolling(data) {
    const { channelId, candidateId } = data;
    const language = this.#languages.get(channelId) || 'en';

    await this.#messages.replyAskPlayerToRoll(channelId, language, candidateId);
  }

  /**
   * Handle guess:received event
   * @param {{channelId: number, playerId: number, guess: number}} data
   * @private
   */
  async #onGuessReceived(_data) {
    // Guess was received - engine handles validation
    // No additional action needed
  }

  /**
   * Handle guess:exact event
   * @param {{channelId: number, playerId: number, bonus: number}} data
   * @private
   */
  async #onGuessExact(_data) {
    // Exact match bonus handled in phase:picking
  }

  /**
   * Handle roll:received event
   * @param {{channelId: number, playerId: number, roll: number}} data
   * @private
   */
  async #onRollReceived(data) {
    const { channelId, playerId, roll } = data;
    const language = this.#languages.get(channelId) || 'en';

    await this.#messages.replyPlayerRolled(channelId, language, playerId, roll);

    // Get round info to check if both have rolled
    const round = this.#engine.getRoundInfo(channelId);
    if (round && round.candidateRoll && round.opponentRoll) {
      // Both rolled, second player should roll next
      // This is handled by the engine's PVP resolution
    } else if (round && round.candidateRoll && !round.opponentRoll) {
      // Ask opponent to roll
      const opponentId = round.opponentId;
      await this.#messages.replyAskPlayerToRoll(channelId, language, opponentId);
    }
  }

  /**
   * Handle pvp:draw event
   * @param {{channelId: number, bet: number}} data
   * @private
   */
  async #onPVPDraw(data) {
    const { channelId } = data;
    const language = this.#languages.get(channelId) || 'en';

    await this.#messages.replyPVPDraw(channelId, language);
  }

  /**
   * Handle pvp:result event
   * @param {{channelId: number, winnerId: number, loserId: number, bet: number, isEliminated: boolean}} data
   * @private
   */
  async #onPVPResult(data) {
    const { channelId, loserId, bet, isEliminated } = data;
    const language = this.#languages.get(channelId) || 'en';

    await this.#messages.replyPVPWinner(channelId, language, loserId, bet, isEliminated);
  }

  // ===== Private Helpers =====

  /**
   * Listen for opponent pick message
   * @param {number} channelId
   * @param {number} pickerId
   * @private
   */
  async #listenForPick(channelId, pickerId) {
    // Wait for pick with timeout
    const message = await this.#client.messaging.subscription.nextMessage(
      (msg) => this.#isValidPickMessage(msg, channelId, pickerId),
      this.#timeToChoice
    );

    if (message) {
      const pickIndex = this.#parseNumber(message.body);
      this.#engine.handlePick(channelId, pickerId, pickIndex);
    }
    // If timeout, engine will auto-advance
  }

  /**
   * Listen for bet message
   * @param {number} channelId
   * @param {number} playerId
   * @private
   */
  async #listenForBet(channelId, playerId) {
    const language = this.#languages.get(channelId) || 'en';

    while (this.#engine.getState(channelId) === 'betting') {
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) =>
          msg.isGroup &&
          msg.targetChannelId === channelId &&
          msg.sourceSubscriberId === playerId &&
          this.#isValidNumber(msg.body),
        this.#timeToChoice
      );

      if (!message) {
        // Timeout - use minimum bet
        this.#engine.handleBet(channelId, playerId, this.#engine.minBet);
        return;
      }

      const amount = this.#parseNumber(message.body);
      const result = this.#engine.handleBet(channelId, playerId, amount);

      if (result.success) {
        return;
      }

      // Show error based on validation result
      if (result.error === 'invalid_bet_increment') {
        await this.#messages.replyAskPlayerBalanceError500(channelId, language);
      } else if (result.error === 'insufficient_balance') {
        await this.#messages.replyAskPlayerBalanceError(channelId, language);
      } else {
        // Exit on other errors
        return;
      }
    }
  }

  /**
   * Check if message is a valid pick
   * @param {import('wolf.js').Message} message
   * @param {number} channelId
   * @param {number} pickerId
   * @returns {boolean}
   * @private
   */
  #isValidPickMessage(message, channelId, pickerId) {
    if (!message.isGroup || message.targetChannelId !== channelId) {
      return false;
    }

    if (message.sourceSubscriberId !== pickerId) {
      return false;
    }

    if (!this.#isValidNumber(message.body)) {
      return false;
    }

    const pick = this.#parseNumber(message.body);
    const eligiblePlayers = this.#engine.getEligiblePlayers(channelId);
    const pickerIndex = eligiblePlayers.findIndex((p) => p.id === pickerId);

    // Can't pick yourself (pick is 1-indexed, pickerIndex is 0-indexed)
    if (pick - 1 === pickerIndex) {
      return false;
    }

    // Pick must be within range of eligible players
    return pick >= 1 && pick <= eligiblePlayers.length;
  }

  /**
   * Listen for guess messages from all eligible players
   * @param {number} channelId
   * @private
   */
  async #listenForGuess(channelId) {
    const eligiblePlayers = this.#engine.getEligiblePlayers(channelId);
    const eligibleIds = new Set(eligiblePlayers.map(p => p.id));
    const receivedGuesses = new Set();

    // Listen until timer expires or all players have guessed
    while (this.#engine.getState(channelId) === 'guessing') {
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) =>
          msg.isGroup &&
          msg.targetChannelId === channelId &&
          eligibleIds.has(msg.sourceSubscriberId) &&
          !receivedGuesses.has(msg.sourceSubscriberId) &&
          this.#isValidNumber(msg.body),
        5000 // Check every 5 seconds
      );

      if (!message) {
        // Check if state changed (timer expired)
        if (this.#engine.getState(channelId) !== 'guessing') {
          return;
        }
        continue;
      }

      const playerId = message.sourceSubscriberId;
      const guess = this.#parseNumber(message.body);

      const result = this.#engine.handleGuess(channelId, playerId, guess);

      if (result.success) {
        receivedGuesses.add(playerId);

        // Check if all eligible players have guessed
        if (receivedGuesses.size === eligibleIds.size) {
          return;
        }
      }
    }
  }

  /**
   * Check if string is a valid number
   * @param {string} input
   * @returns {boolean}
   * @private
   */
  #isValidNumber(input) {
    const normalized = this.#client.utility.number.toEnglishNumbers(input);

    if (!Validator.isValidNumber(normalized)) {
      return false;
    }

    return !Validator.isLessThanOrEqualZero(parseInt(normalized));
  }

  /**
   * Parse string to number
   * @param {string} input
   * @returns {number}
   * @private
   */
  #parseNumber(input) {
    return parseInt(this.#client.utility.number.toEnglishNumbers(input));
  }

  /**
   * Announce game winner
   * @param {number} channelId
   * @param {string} language
   * @param {number} winnerId
   * @param {Array} scores
   * @private
   */
  async #announceWinner(channelId, language, winnerId, scores) {
    const winnersList = await this.#messages.formatWinnersList(scores);
    await this.#messages.replyGameWinner(channelId, language, winnerId, winnersList);
  }

  /**
   * Reward players (save points to database)
   * @param {number} channelId
   * @param {Array} scores
   * @private
   */
  async #rewardPlayers(_channelId, scores) {
    const { addPoint } = await import("../../dice/score.js");

    for (const { playerId, points } of scores) {
      await addPoint(playerId, points);
    }
  }
}

export default GameManager;
