/**
 * Message service for sending game-related messages via WOLF client
 * Handles all phrase lookups and message formatting
 */
class MessageService {
  /** @type {import('wolf.js').WOLF} */
  #client;

  /** @type {string} */
  #keyword;

  /**
   * @param {import('wolf.js').WOLF} client - WOLF client instance
   */
  constructor(client) {
    this.#client = client;
    this.#keyword = client.config.keyword;
  }

  // ===== Phrase Helpers =====

  /**
   * Get phrase by language and name
   * @param {string} language
   * @param {string} phraseName
   * @returns {string}
   */
  getPhrase(language, phraseName) {
    return this.#client.phrase.getByLanguageAndName(language, phraseName);
  }

  /**
   * Get phrase by command context
   * @param {import('wolf.js').CommandContext} command
   * @param {string} phraseName
   * @returns {string}
   */
  getPhraseByCommand(command, phraseName) {
    return this.#client.phrase.getByCommandAndName(command, phraseName);
  }

  /**
   * Replace placeholders in a phrase
   * @param {string} phrase
   * @param {Object} replacements
   * @returns {string}
   */
  replacePlaceholders(phrase, replacements) {
    return this.#client.utility.string.replace(phrase, replacements);
  }

  /**
   * Format number with commas
   * @param {number} num
   * @returns {string}
   */
  formatNumber(num) {
    return this.#client.utility.number.addCommas(num);
  }

  /**
   * Get user profile by ID
   * @param {number} userId
   * @returns {Promise<import('wolf.js').Subscriber>}
   */
  async getUser(userId) {
    return this.#client.subscriber.getById(userId);
  }

  /**
   * Get multiple user profiles
   * @param {number[]} userIds
   * @returns {Promise<import('wolf.js').Subscriber[]>}
   */
  async getUsers(userIds) {
    return this.#client.subscriber.getByIds(userIds);
  }

  // ===== Send Message =====

  /**
   * Send a message to a channel
   * @param {number} channelId
   * @param {string} message
   */
  async send(channelId, message) {
    await this.#client.messaging.sendGroupMessage(channelId, message);
  }

  // ===== Game Creation Messages =====

  /**
   * Reply: Game created
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerCount
   */
  async replyCreated(channelId, language, playerCount) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_created`);
    const response = this.replacePlaceholders(phrase, { count: playerCount });
    await this.send(channelId, response);
  }

  /**
   * Reply: Invalid create command
   * @param {import('wolf.js').CommandContext} command
   */
  async replyWrongCreate(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_wrong_creation`);
    await this.send(command.targetChannelId, phrase);
  }

  /**
   * Reply: Invalid balance amount
   * @param {import('wolf.js').CommandContext} command
   */
  async replyInvalidBalance(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_invalid_balance`);
    await this.send(command.targetChannelId, phrase);
  }

  /**
   * Reply: Game already exists
   * @param {import('wolf.js').CommandContext} command
   */
  async replyAlreadyCreated(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_already_created`);
    await this.send(command.targetChannelId, phrase);
  }

  /**
   * Reply: Game does not exist
   * @param {import('wolf.js').CommandContext} command
   */
  async replyNotExist(command) {
    const phrase = this.getPhrase(command.language, `${this.#keyword}_game_not_exist`);
    await this.send(command.targetChannelId, phrase);
  }

  // ===== Join Messages =====

  /**
   * Reply: Player joined
   * @param {import('wolf.js').CommandContext} command
   */
  async replyJoin(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_join`);
    const user = await this.getUser(command.sourceSubscriberId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(command.targetChannelId, response);
  }

  /**
   * Reply: Player already joined
   * @param {import('wolf.js').CommandContext} command
   */
  async replyAlreadyJoin(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_already_join`);
    const user = await this.getUser(command.sourceSubscriberId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(command.targetChannelId, response);
  }

  // ===== Game Flow Messages =====

  /**
   * Reply: Game started with player list
   * @param {number} channelId
   * @param {string} language
   * @param {string} playerList - Formatted player list
   */
  async replyGameStart(channelId, language, playerList) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_start`);
    const response = this.replacePlaceholders(phrase, { list: playerList });
    await this.send(channelId, response);
  }

  /**
   * Reply: Show players list
   * @param {import('wolf.js').CommandContext} command
   * @param {string} playerList - Formatted player list
   */
  async replyPlayers(command, playerList) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_players`);
    const response = this.replacePlaceholders(phrase, { list: playerList });
    await this.send(command.targetChannelId, response);
  }

  /**
   * Reply: Player balance
   * @param {import('wolf.js').CommandContext} command
   * @param {number} playerId
   * @param {number} balance
   */
  async replyPlayerBalance(command, playerId, balance) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_player_balance`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      id: user.id,
      nickname: user.nickname,
      balance: this.formatNumber(balance)
    });
    await this.send(command.targetChannelId, response);
  }

  /**
   * Reply: Player not found
   * @param {import('wolf.js').CommandContext} command
   */
  async replyPlayerNotFound(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_player_notfound`);
    const user = await this.getUser(command.sourceSubscriberId);
    const response = this.replacePlaceholders(phrase, {
      id: user.id,
      nickname: user.nickname
    });
    await this.send(command.targetChannelId, response);
  }

  /**
   * Reply: Game removed
   * @param {import('wolf.js').CommandContext} command
   */
  async replyGameRemoved(command) {
    const phrase = this.getPhraseByCommand(command, `${this.#keyword}_game_removed`);
    await this.send(command.targetChannelId, phrase);
  }

  // ===== Guessing Phase Messages =====

  /**
   * Reply: Make a guess prompt
   * @param {number} channelId
   * @param {string} language
   */
  async replyMakeAGuess(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_make_a_guess`);
    await this.send(channelId, phrase);
  }

  /**
   * Reply: Player turn with dice result
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   * @param {number} diceRoll
   * @param {string} playerList - Formatted player list
   */
  async replyPlayerTurn(channelId, language, playerId, diceRoll, playerList) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_turn`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      dice: diceRoll,
      nickname: user.nickname,
      id: user.id,
      list: playerList
    });
    await this.send(channelId, response);
  }

  /**
   * Reply: Player rewarded for exact guess
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   */
  async replyPlayerRewarded(channelId, language, playerId) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_rewarded`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(channelId, response);
  }

  // ===== Betting Phase Messages =====

  /**
   * Reply: Ask player for bet amount
   * @param {number} channelId
   * @param {string} language
   * @param {number} balance
   */
  async replyAskPlayerBalance(channelId, language, balance) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_ask_player_balance`);
    const response = this.replacePlaceholders(phrase, {
      balance: this.formatNumber(balance)
    });
    await this.send(channelId, response);
  }

  /**
   * Reply: Player balance already at 500
   * @param {number} channelId
   * @param {string} language
   */
  async replyAskPlayerBalanceAlready500(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_ask_player_balance_already_500`);
    await this.send(channelId, phrase);
  }

  /**
   * Reply: Bet must be multiple of 500
   * @param {number} channelId
   * @param {string} language
   */
  async replyAskPlayerBalanceError500(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_balance_500_error`);
    await this.send(channelId, phrase);
  }

  /**
   * Reply: Not enough balance for bet
   * @param {number} channelId
   * @param {string} language
   */
  async replyAskPlayerBalanceError(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_balance_not_enough_error`);
    await this.send(channelId, phrase);
  }

  // ===== Rolling Phase Messages =====

  /**
   * Reply: Ask player to roll
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   */
  async replyAskPlayerToRoll(channelId, language, playerId) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_ask_player_to_roll`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(channelId, response);
  }

  /**
   * Reply: Player rolled dice
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   * @param {number} dice
   */
  async replyPlayerRolled(channelId, language, playerId, dice) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_rolled`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id,
      dice
    });
    await this.send(channelId, response);
  }

  /**
   * Reply: Player time expired for roll
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   */
  async replyPlayerTimeIsUpRoll(channelId, language, playerId) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_time_is_up_roll`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(channelId, response);
  }

  // ===== Picking Phase Messages =====

  /**
   * Reply: Player didn't pick opponent
   * @param {number} channelId
   * @param {string} language
   * @param {number} playerId
   */
  async replyPlayerNotPick(channelId, language, playerId) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_player_not_pick`);
    const user = await this.getUser(playerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id
    });
    await this.send(channelId, response);
  }

  // ===== PVP Result Messages =====

  /**
   * Reply: PVP winner announcement
   * @param {number} channelId
   * @param {string} language
   * @param {number} loserId
   * @param {number} bet
   * @param {boolean} isOut - Whether loser is eliminated
   */
  async replyPVPWinner(channelId, language, loserId, bet, isOut) {
    const phraseWinner = this.getPhrase(language, `${this.#keyword}_game_pvp_winner`);
    const phraseOut = this.getPhrase(language, `${this.#keyword}_game_player_out`);
    const phrasePlayer = this.getPhrase(language, `${this.#keyword}_game_player`);

    const user = await this.getUser(loserId);
    const phrase = isOut
      ? phraseWinner + phraseOut + phrasePlayer
      : phraseWinner + phrasePlayer;

    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id,
      bet: this.formatNumber(bet)
    });
    await this.send(channelId, response);
  }

  /**
   * Reply: PVP draw
   * @param {number} channelId
   * @param {string} language
   */
  async replyPVPDraw(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_pvp_draw`);
    await this.send(channelId, phrase);
  }

  // ===== Game End Messages =====

  /**
   * Reply: Game finished (no guesses)
   * @param {number} channelId
   * @param {string} language
   */
  async replyGameFinish(channelId, language) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_finish`);
    await this.send(channelId, phrase);
  }

  /**
   * Reply: Game winner announcement
   * @param {number} channelId
   * @param {string} language
   * @param {number} winnerId
   * @param {string} winnersList - Formatted winners list
   */
  async replyGameWinner(channelId, language, winnerId, winnersList) {
    const phrase = this.getPhrase(language, `${this.#keyword}_game_winner`);
    const user = await this.getUser(winnerId);
    const response = this.replacePlaceholders(phrase, {
      nickname: user.nickname,
      id: user.id,
      list: winnersList
    });
    await this.send(channelId, response);
  }

  // ===== Formatting Helpers =====

  /**
   * Format player list for display
   * @param {Array<{id: number, balance: number}>} players
   * @returns {Promise<string>}
   */
  async formatPlayerList(players) {
    if (players.length === 0) {
      return '';
    }

    const userIds = players.map(p => p.id);
    const users = await this.getUsers(userIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    const lines = players.map((player, index) => {
      const user = userMap.get(player.id);
      const nickname = user ? user.nickname : 'Unknown';
      return `${index + 1} \u0640 ${nickname} (${player.id}) \u0640 ${this.formatNumber(player.balance)}`;
    });

    return lines.join('\n');
  }

  /**
   * Format winners/scores list for display
   * @param {Array<{playerId: number, points: number}>} scores
   * @returns {Promise<string>}
   */
  async formatWinnersList(scores) {
    if (scores.length === 0) {
      return '';
    }

    const userIds = scores.map(s => s.playerId);
    const users = await this.getUsers(userIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    const lines = scores.map((score, index) => {
      const user = userMap.get(score.playerId);
      const nickname = user ? user.nickname : 'Unknown';
      return `${index + 1} \u0640 ${nickname} (${score.playerId}) \u0640 ${score.points}`;
    });

    return '\n' + lines.join('\n');
  }
}

export default MessageService;
