import { Validator } from "wolf.js";
import Game from "../core/Game.js";
import MessageService from "../services/MessageService.js";
/**
 * GameManager integrates Game logic with MessageService and WOLF.js client
 * Handles timers, message subscriptions, and game flow coordination
 */
class GameManager {
  /** @type {import('wolf.js').WOLF} */
  #client;

  /** @type {Game} */
  #game;

  /** @type {MessageService} */
  #messages;

  /** @type {number} Time allowed for joining (ms) */
  #timeToJoin;

  /** @type {number} Time allowed for choices (ms) */
  #timeToChoice;

  /** @type {Set<number>} Admin user IDs */
  #admins;

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
    this.#game = new Game(options.maxPlayers || 16);
    this.#messages = new MessageService(client);
    this.#timeToJoin = options.timeToJoin || 30000;
    this.#timeToChoice = options.timeToChoice || 15000;
    this.#admins = new Set(options.admins || []);
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
    if (this.#game.hasGame(channelId)) {
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

    // Create the game
    const result = this.#game.createGame(channelId, command.language, balance);
    if (!result.success) {
      return false;
    }

    // Add creator as first player
    this.#game.addPlayer(channelId, command.sourceSubscriberId);

    // Set join timer
    await this.#client.utility.timer.add(
      `game-${channelId}`,
      "UpdateTimer",
      { channleId: channelId },
      this.#timeToJoin
    );

    // Send created message
    await this.#messages.replyCreated(channelId, command.language, this.#game.maxPlayers);

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
    if (!this.#game.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return false;
    }

    // Check if joinable
    if (!this.#game.isJoinable(channelId)) {
      return false;
    }

    // Try to add player
    const result = this.#game.addPlayer(channelId, playerId);

    if (!result.success) {
      if (result.error === "already_joined") {
        await this.#messages.replyAlreadyJoin(command);
      }
      return false;
    }

    // Send join message
    await this.#messages.replyJoin(command);

    // Check if game is full and should start
    const channel = this.#game.getChannel(channelId);
    if (channel && channel.isFull()) {
      await this.start(channelId);
    }

    return true;
  }

  /**
   * Show game players
   * @param {import('wolf.js').CommandContext} command
   */
  async show(command) {
    const channelId = command.targetChannelId;

    if (!this.#game.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const players = this.#game.getEligiblePlayers(channelId);
    const playerData = players.map((p) => ({ id: p.id, balance: p.balance }));
    const playerList = await this.#messages.formatPlayerList(playerData);
    await this.#messages.replyPlayers(command, playerList);
  }

  /**
   * Remove a game
   * @param {import('wolf.js').CommandContext} command
   */
  async remove(command) {
    const channelId = command.targetChannelId;

    if (!this.#game.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    this.#game.endGame(channelId);
    await this.#messages.replyGameRemoved(command);
  }

  /**
   * Get player balance
   * @param {import('wolf.js').CommandContext} command
   */
  async balance(command) {
    const channelId = command.targetChannelId;
    const playerId = command.sourceSubscriberId;

    if (!this.#game.hasGame(channelId)) {
      await this.#messages.replyNotExist(command);
      return;
    }

    const player = this.#game.getPlayer(channelId, playerId);
    if (!player) {
      await this.#messages.replyPlayerNotFound(command);
      return;
    }

    await this.#messages.replyPlayerBalance(command, playerId, player.balance);
  }

  /**
   * Handle join timer expiration
   * Called by UpdateTimer when join period ends
   * @param {number} channelId
   */
  async onJoinTimeout(channelId) {
    if (!this.#game.hasGame(channelId)) {
      return;
    }

    const playerCount = this.#game.getPlayerCount(channelId);
    const isStarted = this.#game.isStarted(channelId);

    // Not enough players - end the game
    if (playerCount <= 1) {
      await this.#finishNoGuesses(channelId);
      return;
    }

    // Game hasn't started yet - start it
    if (!isStarted) {
      await this.start(channelId);
    }
  }

  /**
   * Check if a channel has an active game
   * @param {number} channelId
   * @returns {boolean}
   */
  hasGame(channelId) {
    return this.#game.hasGame(channelId);
  }

  /**
   * Start the game
   * @param {number} channelId
   */
  async start(channelId) {
    if (!this.#game.hasGame(channelId)) {
      return;
    }

    const gameUUID = this.#game.getGameUUID(channelId);
    const language = this.#game.getLanguage(channelId);
    const initialPlayerCount = this.#game.getPlayerCount(channelId);

    // Send game start message
    const players = this.#game.getEligiblePlayers(channelId);
    const playerData = players.map((p) => ({ id: p.id, balance: p.balance }));
    const playerList = await this.#messages.formatPlayerList(playerData);
    await this.#messages.replyGameStart(channelId, language, playerList);

    // Main game loop
    while (this.#game.isGameValid(channelId, gameUUID)) {
      // Check if game should end
      const endCheck = this.#game.checkGameEnd(channelId);
      if (endCheck.ended) {
        break;
      }

      await this.#delay(1000);

      // Guessing phase
      const guessResult = await this.#runGuessingPhase(channelId, gameUUID);
      if (!guessResult.success) {
        if (guessResult.noGuesses) {
          await this.#finishNoGuesses(channelId);
        }
        return;
      }

      await this.#delay(1000);

      // Announce winner and show player list
      const eligiblePlayers = this.#game.getEligiblePlayers(channelId);
      const listData = eligiblePlayers.map((p) => ({ id: p.id, balance: p.balance }));
      const list = await this.#messages.formatPlayerList(listData);
      await this.#messages.replyPlayerTurn(
        channelId,
        language,
        guessResult.winner.id,
        guessResult.roll,
        list
      );

      // Picking phase
      const opponent = await this.#runPickingPhase(channelId, gameUUID, guessResult.winner);
      if (!opponent) {
        continue;
      }

      await this.#delay(1000);

      // Betting phase
      const bet = await this.#runBettingPhase(channelId, gameUUID, guessResult.winner);

      // PVP rolling phase
      let pvpContinue = true;
      while (pvpContinue && this.#game.isGameValid(channelId, gameUUID)) {
        await this.#delay(1000);

        const roll1 = await this.#askPlayerRoll(channelId, gameUUID, guessResult.winner);
        if (roll1 === 0) {
          // First player timed out, opponent wins by default
          const pvpResult = this.#game.resolvePVP(
            channelId,
            guessResult.winner.id,
            0,
            opponent.id,
            6,
            bet
          );
          await this.#announcePVPResult(channelId, language, pvpResult, bet);
          pvpContinue = false;
          continue;
        }

        await this.#delay(1000);

        const roll2 = await this.#askPlayerRoll(channelId, gameUUID, opponent);

        await this.#delay(1000);

        // Resolve PVP
        const pvpResult = this.#game.resolvePVP(
          channelId,
          guessResult.winner.id,
          roll1,
          opponent.id,
          roll2,
          bet
        );

        pvpContinue = await this.#announcePVPResult(channelId, language, pvpResult, bet);
      }
    }

    await this.#delay(1000);

    // Game ended - announce winner
    if (this.#game.hasGame(channelId)) {
      const endCheck = this.#game.checkGameEnd(channelId);
      if (endCheck.winner) {
        // Add final points to winner
        this.#game.addPoints(channelId, endCheck.winner.id, initialPlayerCount);
        await this.#rewardPlayers(channelId);
        await this.#announceWinner(channelId, language, endCheck.winner);
      }
      this.#game.endGame(channelId);
    }
  }

  // ===== Phase Runners =====

  /**
   * Run the guessing phase
   * @param {number} channelId
   * @param {string} gameUUID
   * @returns {Promise<{success: boolean, noGuesses?: boolean, roll?: number, winner?: import('../core/Player.js').default, isExact?: boolean}>}
   */
  async #runGuessingPhase(channelId, gameUUID) {
    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return { success: false };
    }

    const language = this.#game.getLanguage(channelId);
    this.#game.startGuessingPhase(channelId);

    // Ask players to guess
    await this.#messages.replyMakeAGuess(channelId, language);

    // Wait for guesses
    let timeRemaining = true;
    setTimeout(() => {
      timeRemaining = false;
    }, this.#timeToChoice);

    while (timeRemaining && this.#game.isGameValid(channelId, gameUUID)) {
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) => this.#isValidGuessMessage(msg, channelId),
        10000
      );

      if (message) {
        const guess = this.#parseNumber(message.body);
        this.#game.setPlayerGuess(channelId, message.sourceSubscriberId, guess);
      }

      // Break after first guess received (matching original behavior)
      //  break;
    }

    // Check if any guesses were made
    if (this.#game.hasNoGuesses(channelId)) {
      return { success: false, noGuesses: true };
    }

    // End guessing and get result
    const result = this.#game.endGuessingPhase(channelId);
    if (!result.success) {
      return { success: false, noGuesses: true };
    }

    // Announce if exact match
    if (result.isExact) {
      await this.#messages.replyPlayerRewarded(channelId, language, result.winner.id);
    }

    return {
      success: true,
      roll: result.roll,
      winner: result.winner,
      isExact: result.isExact
    };
  }

  /**
   * Run the picking phase
   * @param {number} channelId
   * @param {string} gameUUID
   * @param {import('../core/Player.js').default} picker
   * @returns {Promise<import('../core/Player.js').default|null>}
   */
  async #runPickingPhase(channelId, gameUUID, picker) {
    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return null;
    }

    const language = this.#game.getLanguage(channelId);

    // Wait for pick
    const message = await this.#client.messaging.subscription.nextMessage(
      (msg) => this.#isValidPickMessage(msg, channelId, picker.id),
      this.#timeToChoice
    );

    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return null;
    }

    if (message) {
      const pickIndex = this.#parseNumber(message.body) - 1;
      const eligiblePlayers = this.#game.getEligiblePlayers(channelId);
      return eligiblePlayers[pickIndex] || null;
    }

    // Player didn't pick
    await this.#messages.replyPlayerNotPick(channelId, language, picker.id);
    return null;
  }

  /**
   * Run the betting phase
   * @param {number} channelId
   * @param {string} gameUUID
   * @param {import('../core/Player.js').default} player
   * @returns {Promise<number>}
   */
  async #runBettingPhase(channelId, gameUUID, player) {
    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return 500;
    }

    const language = this.#game.getLanguage(channelId);
    const minBet = this.#game.minBet;

    // If player only has minimum balance, skip betting
    if (player.balance === minBet) {
      return minBet;
    }

    // Ask for bet
    await this.#messages.replyAskPlayerBalance(channelId, language, player.balance);

    let validBet = false;
    let betAmount = minBet;

    while (!validBet) {
      const message = await this.#client.messaging.subscription.nextMessage(
        (msg) =>
          msg.isGroup &&
          msg.targetChannelId === channelId &&
          msg.sourceSubscriberId === player.id &&
          this.#isValidNumber(msg.body),
        this.#timeToChoice
      );

      if (!this.#game.isGameValid(channelId, gameUUID)) {
        return minBet;
      }

      if (!message) {
        return minBet;
      }

      betAmount = this.#parseNumber(message.body);
      const validateResult = this.#game.validateBet(channelId, player.id, betAmount);

      if (validateResult.success) {
        validBet = true;
      } else if (validateResult.error === "invalid_bet_increment") {
        await this.#messages.replyAskPlayerBalanceError500(channelId, language);
      } else if (validateResult.error === "insufficient_balance") {
        await this.#messages.replyAskPlayerBalanceError(channelId, language);
      } else {
        validBet = true; // Exit on other errors
      }
    }

    return betAmount;
  }

  /**
   * Ask a player to roll
   * @param {number} channelId
   * @param {string} gameUUID
   * @param {import('../core/Player.js').default} player
   * @returns {Promise<number>} Roll value or 0 if timed out
   */
  async #askPlayerRoll(channelId, gameUUID, player) {
    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return 0;
    }

    const language = this.#game.getLanguage(channelId);

    // Ask player to roll
    await this.#messages.replyAskPlayerToRoll(channelId, language, player.id);

    // Wait for roll command
    const message = await this.#client.messaging.subscription.nextMessage(
      (msg) => this.#isRollMessage(msg, player.id, channelId),
      this.#timeToChoice
    );

    if (!this.#game.isGameValid(channelId, gameUUID)) {
      return 0;
    }

    if (message) {
      // Check for admin cheat
      const isAdminCheat = this.#admins.has(player.id) && message.body === "لف.";
      const rollResult = isAdminCheat
        ? this.#game.playerRollFixed(channelId, 6)
        : this.#game.playerRoll(channelId);

      if (rollResult.success) {
        await this.#messages.replyPlayerRolled(channelId, language, player.id, rollResult.roll);
        return rollResult.roll;
      }
    }

    // Player timed out
    await this.#messages.replyPlayerTimeIsUpRoll(channelId, language, player.id);
    return 0;
  }

  // ===== Helper Methods =====

  /**
   * Announce PVP result
   * @param {number} channelId
   * @param {string} language
   * @param {Object} pvpResult
   * @param {number} bet
   * @returns {Promise<boolean>} True if should continue (draw), false otherwise
   */
  async #announcePVPResult(channelId, language, pvpResult, bet) {
    if (pvpResult.result === "draw") {
      await this.#messages.replyPVPDraw(channelId, language);
      return true;
    }

    if (pvpResult.loser) {
      await this.#messages.replyPVPWinner(
        channelId,
        language,
        pvpResult.loser.id,
        bet,
        pvpResult.isEliminated
      );
    }

    return false;
  }

  /**
   * Finish game with no guesses
   * @param {number} channelId
   */
  async #finishNoGuesses(channelId) {
    if (!this.#game.hasGame(channelId)) {
      return;
    }

    const language = this.#game.getLanguage(channelId);
    await this.#messages.replyGameFinish(channelId, language);
    this.#game.endGame(channelId);
  }

  /**
   * Announce game winner
   * @param {number} channelId
   * @param {string} language
   * @param {import('../core/Player.js').default} winner
   */
  async #announceWinner(channelId, language, winner) {
    const scores = this.#game.getSortedScores(channelId);
    const winnersList = await this.#messages.formatWinnersList(scores);
    await this.#messages.replyGameWinner(channelId, language, winner.id, winnersList);
  }

  /**
   * Reward players (save points to database)
   * @param {number} channelId
   */
  async #rewardPlayers(channelId) {
    // Import score module dynamically to avoid circular deps
    const { addPoint } = await import("../../dice/score.js");
    const scores = this.#game.getScores(channelId);

    for (const [playerId, points] of scores) {
      await addPoint(playerId, points);
    }
  }

  /**
   * Check if message is a valid guess
   * @param {import('wolf.js').Message} message
   * @param {number} channelId
   * @returns {boolean}
   */
  #isValidGuessMessage(message, channelId) {
    if (!message.isGroup || message.targetChannelId !== channelId) {
      return false;
    }

    if (!this.#isValidNumber(message.body)) {
      return false;
    }

    // Check if sender is an eligible player
    const eligiblePlayers = this.#game.getEligiblePlayers(channelId);
    return eligiblePlayers.some((p) => p.id === message.sourceSubscriberId);
  }

  /**
   * Check if message is a valid pick
   * @param {import('wolf.js').Message} message
   * @param {number} channelId
   * @param {number} pickerId
   * @returns {boolean}
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
    const eligiblePlayers = this.#game.getEligiblePlayers(channelId);
    const pickerIndex = eligiblePlayers.findIndex((p) => p.id === pickerId);

    // Can't pick yourself (pick is 1-indexed, pickerIndex is 0-indexed)
    if (pick - 1 === pickerIndex) {
      return false;
    }

    // Pick must be within range of eligible players
    return pick >= 1 && pick <= eligiblePlayers.length;
  }

  /**
   * Check if message is a roll command
   * @param {import('wolf.js').Message} message
   * @param {number} playerId
   * @param {number} channelId
   * @returns {boolean}
   */
  #isRollMessage(message, playerId, channelId) {
    // Admin cheat
    if (this.#admins.has(message.sourceSubscriberId) && message.body.toLowerCase() === "لف.") {
      return true;
    }

    if (!message.isGroup || message.targetChannelId !== channelId) {
      return false;
    }

    if (message.sourceSubscriberId !== playerId) {
      return false;
    }

    // Check against roll phrases
    const rollPhrases = this.#client.phrase.getAllByName("dice_game_roll");
    return rollPhrases.some((s) => s.value === message.body.toLowerCase());
  }

  /**
   * Check if string is a valid number
   * @param {string} input
   * @returns {boolean}
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
   */
  #parseNumber(input) {
    return parseInt(this.#client.utility.number.toEnglishNumbers(input));
  }

  /**
   * Delay helper
   * @param {number} ms
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return this.#client.utility.delay(ms);
  }
}

export default GameManager;
