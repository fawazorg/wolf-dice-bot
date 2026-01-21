import { Validator } from "wolf.js";
import { RedisGameEngine } from "../engine/index.js";
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

  /** @type {RedisGameEngine} */
  #engine;

  /** @type {MessageService} */
  #messages;

  /** @type {number} Time allowed for joining (ms) */
  #timeToJoin;

  /** @type {number} Time allowed for choices (ms) */
  #timeToChoice;

  /** @type {Map<number, string>} Channel languages (cached for messaging) */
  #languages;

  /** @type {Map<number, number>} Initial player counts (for final scoring) */
  #initialPlayerCounts;

  /** @type {Set<number>} Channels with active roll listeners */
  #activeRollListeners;

  /**
   * @param {import('wolf.js').WOLF} client - WOLF client instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxPlayers=16] - Maximum players per game
   * @param {number} [options.timeToJoin=30000] - Time to join in ms
   * @param {number} [options.timeToChoice=15000] - Time for choices in ms
   */
  constructor(client, options = {}) {
    this.#client = client;
    this.#engine = new RedisGameEngine({
      maxPlayers: options.maxPlayers || 16,
      timeToJoin: options.timeToJoin || 30000,
      timeToChoice: options.timeToChoice || 15000,
      maxGuessRoll: 50,
      minBet: 500
    });
    this.#messages = new MessageService(client);
    this.#timeToJoin = options.timeToJoin || 30000;
    this.#timeToChoice = options.timeToChoice || 15000;
    this.#languages = new Map();
    this.#initialPlayerCounts = new Map();
    this.#activeRollListeners = new Set();

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
    this.#engine.on('pick:auto', (data) => this.#onPickAuto(data));
    this.#engine.on('roll:received', (data) => this.#onRollReceived(data));
    this.#engine.on('roll:timeout', (data) => this.#onRollTimeout(data));
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
    if (await this.#engine.hasGame(channelId)) {
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

    // Create the game (use command.sourceSubscriberId as creatorId)
    const result = await this.#engine.createGame(channelId, command.language, balance, command.sourceSubscriberId);
    if (!result.success) {
      return false;
    }

    // Add creator as first player
    await this.#engine.addPlayer(channelId, command.sourceSubscriberId);

    // Set join timer
    await this.#client.utility.timer.add(
      `game-${channelId}`,
      "UpdateTimer",
      { channelId },
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
    if (!(await this.#engine.hasGame(channelId))) {
      await this.#messages.replyNotExist(command);
      return false;
    }

    // Try to add player
    const result = await this.#engine.addPlayer(channelId, playerId);

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

    if (!(await this.#engine.hasGame(channelId))) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const players = await this.#engine.getEligiblePlayers(channelId);
    const playerList = await this.#messages.formatPlayerList(players);
    await this.#messages.replyPlayers(command, playerList);
  }

  /**
   * Remove a game
   * @param {import('wolf.js').CommandContext} command
   */
  async remove(command) {
    const channelId = command.targetChannelId;

    if (!(await this.#engine.hasGame(channelId))) {
      await this.#messages.replyNotExist(command);
      return;
    }

    // Cancel the wolf.js client timer to prevent stale timeout messages
    await this.#client.utility.timer.cancel(`game-${channelId}`);

    await this.#engine.removeGame(channelId);
    await this.#messages.replyGameRemoved(command);
  }

  /**
   * Get player balance
   * @param {import('wolf.js').CommandContext} command
   */
  async balance(command) {
    const channelId = command.targetChannelId;
    const playerId = command.sourceSubscriberId;

    if (!(await this.#engine.hasGame(channelId))) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const balance = await this.#engine.getPlayerBalance(channelId, playerId);
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
    await this.#engine.onJoinTimeout(channelId);
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

    const result = await this.#engine.handleGuess(channelId, playerId, guess);
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

    const result = await this.#engine.handlePick(channelId, playerId, pickIndex);
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

    const result = await this.#engine.handleBet(channelId, playerId, amount);
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

    const result = await this.#engine.handleRoll(channelId, playerId, null);
    return result.success;
  }

  /**
   * Check if a channel has an active game
   * @param {number} channelId
   * @returns {Promise<boolean>}
   */
  async hasGame(channelId) {
    return this.#engine.hasGame(channelId);
  }

  /**
   * Get game state
   * @param {number} channelId
   * @returns {Promise<string|null>}
   */
  async getState(channelId) {
    return this.#engine.getState(channelId);
  }

  /**
   * Get game language
   * @param {number} channelId
   * @returns {Promise<string|null>}
   */
  async getLanguage(channelId) {
    return this.#engine.getLanguage(channelId);
  }

  /**
   * Get eligible players
   * @param {number} channelId
   * @returns {Promise<Array<{id: number, balance: number}>>}
   */
  async getEligiblePlayers(channelId) {
    return this.#engine.getEligiblePlayers(channelId);
  }

  /**
   * Get sorted scores
   * @param {number} channelId
   * @returns {Promise<Array<{playerId: number, points: number}>>}
   */
  async getSortedScores(channelId) {
    return this.#engine.getSortedScores(channelId);
  }

  /**
   * Get game creator ID
   * @param {number} channelId
   * @returns {Promise<number|null>}
   */
  async getGameCreator(channelId) {
    return this.#engine.getGameCreator(channelId);
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
    this.#activeRollListeners.delete(channelId);
  }

  /**
   * Handle player:joined event
   * @param {{channelId: number, playerId: number}} data
   * @private
   */
  async #onPlayerJoined(data) {
    const { channelId, playerId } = data;
    const language = this.#languages.get(channelId) || 'en';

    const phrase = this.#messages.getPhrase(language, "dice_game_player_joined");
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
      const players = await this.#engine.getEligiblePlayers(channelId);
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
   * @param {{channelId: number, pickerId: number, opponentId: number, pickerBalance: number, isAutoPick?: boolean}} data
   * @private
   */
  async #onPhaseBetting(data) {
    const { channelId, pickerBalance, isAutoPick } = data;
    const language = this.#languages.get(channelId) || 'en';

    if (pickerBalance === this.#engine.minBet) {
      // Skip betting, use minimum
      await this.#engine.handleBet(channelId, data.pickerId, this.#engine.minBet);
    } else {
      // Skip sending bet message if auto-pick (already included in auto-pick message)
      if (!isAutoPick) {
        await this.#messages.replyAskPlayerBalance(channelId, language, pickerBalance);
      }
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

    // Prevent duplicate listeners
    if (this.#activeRollListeners.has(channelId)) {
      return;
    }

    this.#activeRollListeners.add(channelId);

    try {
      const language = this.#languages.get(channelId) || 'en';

      await this.#messages.replyAskPlayerToRoll(channelId, language, candidateId);

      // Small delay to ensure betting phase fully exits
      await this.#client.utility.delay(100);

      // Start listening for rolls
      await this.#listenForRolls(channelId, candidateId);
    } finally {
      // Always remove the listener lock
      this.#activeRollListeners.delete(channelId);
    }
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
   * Handle pick:auto event
   * @param {{channelId: number, roll: number, candidateId: number, opponentId: number, candidateBalance: number}} data
   * @private
   */
  async #onPickAuto(data) {
    const { channelId, roll, candidateId, opponentId, candidateBalance } = data;
    const language = this.#languages.get(channelId) || 'en';

    const phrase = this.#messages.getPhrase(language, "dice_game_auto_pick_opponent");
    const candidate = await this.#messages.getUser(candidateId);
    const opponent = await this.#messages.getUser(opponentId);
    const response = this.#messages.replacePlaceholders(phrase, {
      dice: roll,
      nickname: candidate.nickname,
      id: candidate.id,
      opponentNickname: opponent.nickname,
      opponentId: opponent.id,
      balance: candidateBalance
    });
    await this.#messages.send(channelId, response);
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

    // Save dice roll statistics to database
    const Player = (await import("../database/models/player.js")).default;
    await Player.increaseStatus(playerId, roll);

    // Note: Turn switching is handled by #listenForRolls
    // The engine's PVP resolution will be triggered when both have rolled
  }

  /**
   * Handle roll:timeout event
   * @param {{channelId: number, playerId: number, winnerId: number, loserId: number, bet: number, isEliminated: boolean}} data
   * @private
   */
  async #onRollTimeout(data) {
    const { channelId, loserId, bet, isEliminated } = data;
    const language = this.#languages.get(channelId) || 'en';

    await this.#messages.replyPVPWinner(channelId, language, loserId, bet, isEliminated);
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

    // Note: #listenForRolls will handle prompting the candidate for the re-roll
    // We don't prompt here to avoid duplicate messages
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
      await this.#engine.handlePick(channelId, pickerId, pickIndex);
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
    let hasReceivedAnyMessage = false;

    while ((await this.#engine.getState(channelId)) === 'betting') {
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) =>
          msg.isGroup &&
          msg.targetChannelId === channelId &&
          msg.sourceSubscriberId === playerId &&
          this.#isValidNumber(msg.body),
        this.#timeToChoice
      );

      // Check if state changed (game ended or timer triggered default bet)
      if ((await this.#engine.getState(channelId)) !== 'betting') {
        return;
      }

      if (!message) {
        // Timeout with no message
        if (!hasReceivedAnyMessage) {
          // Player never tried - use default bet
          await this.#engine.handleBet(channelId, playerId, this.#engine.minBet);
          return;
        }
        // Player tried but entered wrong - keep waiting indefinitely
        continue;
      }

      hasReceivedAnyMessage = true;
      const amount = this.#parseNumber(message.body);
      const result = await this.#engine.handleBet(channelId, playerId, amount);

      if (result.success) {
        return;
      }

      // Show error based on validation result and let player try again
      if (result.error === 'invalid_bet_increment') {
        await this.#messages.replyAskPlayerBalanceError500(channelId, language);
      } else if (result.error === 'insufficient_balance') {
        await this.#messages.replyAskPlayerBalanceError(channelId, language);
      }

      // Reset the betting timer to give player full time to enter correct amount
      await this.#engine.resetBettingTimer(channelId, playerId);
      // Continue looping - player can try again with fresh timeout
    }
  }

  /**
   * Check if message is a potentially valid pick (basic validation only)
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

    // Only validate that it's a number - range check is done after getting eligible players
    return this.#isValidNumber(message.body);
  }

  /**
   * Listen for guess messages from all eligible players
   * @param {number} channelId
   * @private
   */
  async #listenForGuess(channelId) {
    const eligiblePlayers = await this.#engine.getEligiblePlayers(channelId);
    const eligibleIds = new Set(eligiblePlayers.map(p => p.id));
    const receivedGuesses = new Set();

    // Listen until timer expires or all players have guessed
    while ((await this.#engine.getState(channelId)) === 'guessing') {
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
        if ((await this.#engine.getState(channelId)) !== 'guessing') {
          return;
        }
        continue;
      }

      const playerId = message.sourceSubscriberId;
      const guess = this.#parseNumber(message.body);

      const result = await this.#engine.handleGuess(channelId, playerId, guess);

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
   * Check if message is a valid roll command
   * Accepts all language variants (English "roll", Arabic "لف", etc.)
   * @param {string} body - Message body
   * @param {string} language - Language code
   * @returns {boolean}
   * @private
   */
  #isValidRollCommand(body, _language) {
    const normalizedBody = body.trim().toLowerCase();
    const rollPhrases = this.#client.phrase.getAllByName("dice_game_roll_command");

    // Check against all language variants
    for (const phrase of rollPhrases) {
      if (normalizedBody === phrase.value.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Listen for roll messages from candidate and opponent
   * @param {number} channelId
   * @param {number} startingPlayerId - ID of player who should roll first
   * @private
   */
  async #listenForRolls(channelId, startingPlayerId) {
    const language = this.#languages.get(channelId) || 'en';

    // Listen for rolls from both players
    // Reset tracking on each iteration to handle draws
    let currentPlayerToRoll = startingPlayerId;
    while ((await this.#engine.getState(channelId)) === 'rolling') {
      const round = await this.#engine.getRoundInfo(channelId);

      if (!round) {
        return;
      }

      // Wait for a message from the current player with the roll phrase
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) =>
          msg.isGroup &&
          msg.targetChannelId === channelId &&
          msg.sourceSubscriberId === currentPlayerToRoll &&
          this.#isValidRollCommand(msg.body, language),
        this.#timeToChoice
      );

      if (!message) {
        // Check if game still exists before sending timeout message
        const currentState = await this.#engine.getState(channelId);
        if (currentState !== 'rolling') {
          return; // Game was cancelled or ended - don't send stale message
        }
        // Timeout - player loses automatically
        await this.#messages.replyPlayerTimeIsUpRoll(channelId, language, currentPlayerToRoll);
        await this.#engine.handleRollTimeout(channelId, currentPlayerToRoll);
        return;
      }

      const playerId = message.sourceSubscriberId;

      const result = await this.#engine.handleRoll(channelId, playerId, null);

      // Check if game ended while waiting
      if ((await this.#engine.getState(channelId)) !== 'rolling') {
        return;
      }

      if (result.success) {
        // After candidate rolls, switch to opponent and prompt them
        if (playerId === round.candidateId) {
          // Check if we should prompt opponent (only if still in rolling state)
          await new Promise(resolve => setTimeout(resolve, 100));

          const currentState = await this.#engine.getState(channelId);

          if (currentState === 'rolling') {
            await this.#messages.replyAskPlayerToRoll(channelId, language, round.opponentId);
            // Continue loop to wait for opponent's roll
            currentPlayerToRoll = round.opponentId;
          } else {
            // State changed - game ended or draw
            return;
          }
        } else {
          // Opponent rolled - check if both have rolled (engine handles PVP)
          await new Promise(resolve => setTimeout(resolve, 100));

          const currentState = await this.#engine.getState(channelId);

          if (currentState !== 'rolling') {
            // PVP was resolved, game moved to next phase or ended
            return;
          }
          // Still rolling - must be a draw, reset to candidate and prompt them
          currentPlayerToRoll = round.candidateId;
          await this.#messages.replyAskPlayerToRoll(channelId, language, round.candidateId);
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
    const { addPoint } = await import("../database/helpers/player.js");

    for (const { playerId, points } of scores) {
      await addPoint(playerId, points);
    }
  }
}

export default GameManager;
