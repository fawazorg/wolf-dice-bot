const { v4: uuidv4 } = require("uuid");
const { Validator } = require("wolf.js");
const { setLastActive } = require("./active");
const { addPoint } = require("./score");
const { group } = require("./data");
class Game {
  /**
   * @type {import ("wolf.js").WOLFBot}
   */
  #API;
  #PLAYERS_COUNT;
  #TIME_TO_JOIN;
  #TIME_TO_CHOICE;
  #BOT_DICE;
  /**
   *
   * @param {import ("wolf.js").WOLFBot} api
   */
  constructor(api) {
    this.#API = api;
    this.#PLAYERS_COUNT = 16;
    this.#TIME_TO_JOIN = 30 * 1000;
    this.#TIME_TO_CHOICE = 15 * 1000;
    this.#BOT_DICE = 50;
  }
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @param {String} options
   */
  create = async (command, options) => {
    if (group.has(command.targetGroupId)) {
      await this.#replyAlreadyCreated(command);
      return false;
    }
    let defaultBalance = options || 500;
    if (defaultBalance !== "" && !this.#checkNumber(defaultBalance)) {
      await this.#replyWrongCreate(command);
      return false;
    }
    if (
      !(
        this.#getNumber(defaultBalance) <= 5000 &&
        this.#getNumber(defaultBalance) > 0 &&
        this.#getNumber(defaultBalance) % 500 === 0
      )
    ) {
      await this.#replyInvalidBalance(command);
      return;
    }
    this.#setupGroup(command.targetGroupId, command.language, this.#getNumber(defaultBalance));
    let g = group.get(command.targetGroupId);
    await this.#API
      .utility()
      .timer()
      .add(
        `game-${command.targetGroupId}`,
        "UpdateTimer",
        { gid: command.targetGroupId },
        this.#TIME_TO_JOIN
      );
    this.#setupPlayer(g.players, command.sourceSubscriberId, g.defaultBalance);
    await this.#replyCreated(g);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @returns
   */
  join = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return await this.#replyNotExist(command);
    }

    let g = group.get(command.targetGroupId);
    if (!g.joinable) {
      return false;
    }
    if (g.players.size >= g.playersCount) {
      return false;
    }
    if (g.players.has(command.sourceSubscriberId)) {
      // return await this.#replyAlreadyJoin(command);
      return;
    }
    this.#setupPlayer(g.players, command.sourceSubscriberId, g.defaultBalance);
    // await this.#replyJoin(command);
    if (g.players.size >= g.playersCount) {
      g.joinable = false;
      g.start = true;
      await this.start(g.id);
    }
  };

  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @returns
   */
  show = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return await this.#replyNotExist(command);
    }
    this.#replyPlayers(command);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   */
  remove = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return await this.#replyNotExist(command);
    }
    group.delete(command.targetGroupId);
    return await this.#replyGameRemoved(command);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @returns
   */
  balance = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return await this.#replyNotExist(command);
    }

    let tempGroup = group.get(command.targetGroupId);
    if (!tempGroup.players.has(command.sourceSubscriberId)) {
      await this.#replyPlayerNotFound(command);
      return;
    }
    let tempPlayer = tempGroup.players.get(command.sourceSubscriberId);
    await this.#replyPlayerBalance(command, tempPlayer);
  };
  /**
   *
   * @param {Number} gid
   */
  start = async (gid) => {
    if (!group.has(gid)) {
      return;
    }
    let g = group.get(gid);
    g.joinable = false;
    g.start = true;
    await this.#replyGameStart(g);
    const ScoreAmount = g.players.size;
    while (this.#getRichestPlayers(g.id).length !== 1) {
      await this.#API.utility().delay(1000);
      await this.#askPlayerToMakeGuesses(g);
      if (this.#checkGuessIsZero(g)) {
        await this.finish(g);
        break;
      }
      let botDice = this.#rollDice(this.#BOT_DICE);
      let closestPlayer = await this.#closestGuesses(g, botDice);
      await this.#API.utility().delay(1000);
      await this.#replyPlayerTurn(g, closestPlayer, botDice);
      let playerPicked = await this.#askPlayerPick(g, closestPlayer);
      if (!playerPicked) {
        continue;
      }
      await this.#API.utility().delay(1000);
      let bet = await this.#AskPlayerBalance(g, closestPlayer);
      let result = true;
      while (result) {
        await this.#API.utility().delay(1000);
        let p1 = await this.#askPlayerRoll(g, closestPlayer);
        if (p1 == 0) {
          result = await this.#checkWhoWon(g, closestPlayer, playerPicked, p1, 6, bet);
          continue;
        }
        await this.#API.utility().delay(1000);
        let p2 = await this.#askPlayerRoll(g, playerPicked);
        await this.#API.utility().delay(1000);
        result = await this.#checkWhoWon(g, closestPlayer, playerPicked, p1, p2, bet);
      }
    }
    await this.#API.utility().delay(1000);
    if (this.#isGroupHasGame(g)) {
      let tempGroup = group.get(g.id);
      await this.stop(tempGroup, ScoreAmount);
      group.delete(tempGroup.id);
    }
  };
  /**
   *
   * @param {Number} gid
   */
  finish = async (g) => {
    if (this.#isGroupHasGame(g)) {
      let tempGroup = group.get(g.id);
      await this.#replyGameFinish(tempGroup);
      await setLastActive(tempGroup.id);
      group.delete(tempGroup.id);
    }
  };

  /**
   *
   * @param {Number} gid
   */
  stop = async (g, ScoreAmount) => {
    let winner = this.#getRichestPlayers(g.id)[0];
    this.#addPointsToPlayer(g, winner.id, ScoreAmount);
    await this.#rewardPlayers(g);
    await this.#replyGameWinner(g, winner);
  };
  /**
   *
   * @param {*} gid
   * @param {*} language
   * @param {*} defaultBalance
   * @returns
   */
  #setupGroup = (gid, language, defaultBalance = 500) => {
    if (!group.has(gid)) {
      group.set(gid, {
        id: gid,
        uuid: uuidv4(),
        joinable: true,
        start: false,
        language,
        defaultBalance,
        playersCount: this.#PLAYERS_COUNT,
        players: new Map(),
        scores: new Map(),
      });
    }
    return group.get(gid);
  };
  /**
   *
   * @param {Map} players
   * @param {Number} id
   * @param {Number} defaultBalance
   * @returns
   */
  #setupPlayer = (players, id, defaultBalance) => {
    if (!players.has(id)) {
      players.set(id, {
        id,
        balance: defaultBalance,
        currentGuess: null,
      });
    }
  };
  /**
   *
   * @param {*} g
   */
  #askPlayerToMakeGuesses = async (g) => {
    if (!this.#isGroupHasGame(g)) {
      return;
    }
    this.#resetGussets(g);
    await this.#replyMakeAGuess(g);
    let exit = true;
    setTimeout(function () {
      exit = false;
    }, this.#TIME_TO_CHOICE);
    while (exit) {
      let r = await this.#API
        .messaging()
        .subscribe()
        .nextMessage(
          (message) =>
            message.isGroup &&
            this.#checkNumber(message.body) &&
            message.targetGroupId === g.id &&
            this.#getRichestPlayers(g.id).some((p) => p.id === message.sourceSubscriberId),
          10000
        );
      if (r) {
        this.#setPlayerGuess(g.id, r.sourceSubscriberId, r.body);
      }
    }
  };
  /**
   *
   * @param {number} gid
   * @param {*} pid
   * @param {*} guess
   */
  #setPlayerGuess = (gid, pid, guess) => {
    if (this.#checkGuess(guess)) {
      let n = this.#getNumber(guess);
      if (this.#getRichestPlayers(gid).some((p) => p.currentGuess === n)) {
        n = this.#TIME_TO_CHOICE;
      }
      if (group.has(gid)) {
        let g = group.get(gid);
        let player = g.players.get(pid);
        player.currentGuess = n;
      }
    }
  };
  /**
   *
   * @param {*} g
   */
  #resetGussets = (g) => {
    g.players.forEach((p) => {
      p.currentGuess = null;
    });
  };
  /**
   *
   * @param {*} guess
   * @returns
   */
  #checkGuess = (guess) => {
    let n = this.#getNumber(guess);
    return n <= 50 && n > 0;
  };
  /**
   *
   * @param {*} g
   * @returns
   */
  #checkGuessIsZero = (g) => {
    if (!this.#isGroupHasGame(g)) {
      return true;
    }
    let tempGroup = group.get(g.id);
    let tempArray = Array.from(tempGroup.players.values());
    return tempArray.filter((p) => p.currentGuess !== null).length <= 0;
  };
  /**
   *
   * @param {*} n
   * @returns
   */
  #checkNumber = (n) => {
    if (!Validator.isValidNumber(this.#API.utility().number().toEnglishNumbers(n))) {
      return false;
    }
    if (Validator.isLessThanOrEqualZero(parseInt(n))) {
      return false;
    }
    return true;
  };
  /**
   *
   * @param {*} g
   * @param {*} pid
   * @param {*} points
   */
  #addPointsToPlayer = (g, pid, points) => {
    if (g.scores.has(pid)) {
      let oldScore = g.scores.get(pid);
      g.scores.set(pid, oldScore + points);
    } else {
      g.scores.set(pid, points);
    }
  };
  /**
   *
   * @param {*} g
   */
  #rewardPlayers = async (g) => {
    g.scores.forEach(async (points, pid) => {
      await addPoint(pid, points);
    });
  };
  /**
   *
   * @param {*} g
   */
  #gameWinners = async (g) => {
    return new Promise(async (resolve, reject) => {
      let r = "\n";
      const mapSort = new Map([...g.scores.entries()].sort((a, b) => b[1] - a[1]));
      let keys = Array.from(mapSort.keys());
      let values = Array.from(mapSort.values());
      for (let i = 0; i < keys.length; i++) {
        const id = keys[i];
        const score = values[i];
        let user = await this.#API.subscriber().getById(id);
        if (i === keys.length - 1) {
          r += `${i + 1} ـ ${user.nickname} (${user.id}) ـ ${score}`;
        } else {
          r += `${i + 1} ـ ${user.nickname} (${user.id}) ـ ${score}\n`;
        }
      }
      resolve(r);
    });
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  #checkPlayerIsOut = (g, player) => {
    if (!this.#isGroupHasGame(g)) {
      return false;
    }
    let tempGroup = group.get(g.id);
    let tempPlayer = tempGroup.players.get(player.id);
    if (tempPlayer.balance > 0) {
      return false;
    }
    tempGroup.players.delete(player.id);
    return true;
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} balance
   * @returns
   */
  #checkBalance = async (g, player, balance) => {
    if (balance % 500 !== 0) {
      await this.#replyAskPlayerBalanceError500(g);
      return false;
    }
    if (player.balance < balance) {
      await this.#replyAskPlayerBalanceError(g);
      return false;
    }
    return true;
  };
  /**
   *
   * @param {*} g
   * @param {*} playerOne
   * @param {*} playerTow
   * @param {*} p1
   * @param {*} p2
   * @param {*} bet
   * @returns
   */
  #checkWhoWon = async (g, playerOne, playerTow, p1, p2, bet) => {
    if (!this.#isGroupHasGame(g)) {
      return true;
    }
    if (p1 > p2) {
      playerTow.balance -= bet;
      let isOut = this.#checkPlayerIsOut(g, playerTow);
      await this.#replyPVPWinner(g, playerTow, bet, isOut);
      this.#addPointsToPlayer(g, playerOne.id, 1);
      return false;
    }
    if (p2 > p1) {
      playerOne.balance -= bet;
      let isOut = this.#checkPlayerIsOut(g, playerOne);
      await this.#replyPVPWinner(g, playerOne, bet, isOut);
      this.#addPointsToPlayer(g, playerTow.id, 1);
      return false;
    }
    await this.#replyPVPDraw(g);
    return true;
  };
  /**
   *
   * @param {*} g
   * @param {*} botDice
   * @returns
   */
  #closestGuesses = async (g, botDice) => {
    if (!this.#isGroupHasGame(g)) {
      return null;
    }
    let tempGroup = group.get(g.id);
    let tempArray = Array.from(tempGroup.players.values());
    let array = tempArray.filter((p) => p.currentGuess !== null);
    let winner = array.sort(
      (a, b) => Math.abs(botDice - a.currentGuess) - Math.abs(botDice - b.currentGuess)
    )[0];
    if (winner.currentGuess === botDice) {
      winner.balance += 500;
      this.#addPointsToPlayer(tempGroup, winner.id, 2);
      await this.#replyPlayerRewarded(tempGroup, winner);
    }

    let player = tempGroup.players.get(winner.id);
    return player;
  };

  /**
   *
   * @param {*} num
   * @returns
   */
  #formatNumber = (num) => {
    return this.#API.utility().number().addCommas(num);
  };

  /**
   *
   * @param {*} n
   * @returns
   */
  #getNumber = (n) => {
    return parseInt(this.#API.utility().number().toEnglishNumbers(n));
  };
  /**
   *
   * @param {*} max
   * @returns
   */
  #rollDice = (max) => {
    return Math.floor(Math.random() * max) + 1;
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  #askPlayerPick = async (g, player) => {
    if (!this.#isGroupHasGame(g)) {
      return false;
    }

    let r = await this.#API
      .messaging()
      .subscribe()
      .nextMessage(
        (message) =>
          message.isGroup &&
          message.targetGroupId === g.id &&
          message.sourceSubscriberId === player.id &&
          this.#checkNumber(message.body) &&
          this.#getNumber(message.body) - 1 !==
            this.#getRichestPlayers(g.id).findIndex((p) => p.id === player.id) &&
          this.#getRichestPlayers(g.id).length >= this.#getNumber(message.body),
        this.#TIME_TO_CHOICE
      );
    if (!this.#isGroupHasGame(g)) {
      return false;
    }
    if (r) {
      return this.#getRichestPlayers(g.id)[this.#getNumber(r.body) - 1];
    }

    await this.#replyPlayerNotPick(g, player);
    return false;
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  #AskPlayerBalance = async (g, player) => {
    if (!this.#isGroupHasGame(g)) {
      return 500;
    }
    if (player.balance === 500) {
      await this.#replyAskPlayerBalanceAlready500(g);
      return 500;
    }
    await this.#replyAskPlayerBalance(g, player);
    let exit = false;
    let r = null;
    while (!exit) {
      r = await this.#API
        .messaging()
        .subscribe()
        .nextMessage(
          (message) =>
            message.isGroup &&
            message.targetGroupId === g.id &&
            message.sourceSubscriberId === player.id &&
            this.#checkNumber(message.body),
          this.#TIME_TO_CHOICE
        );
      if (!this.#isGroupHasGame(g)) {
        exit = true;
      }
      if (r) {
        exit = await this.#checkBalance(g, player, this.#getNumber(r.body));
      } else {
        exit = true;
      }
    }
    return r ? this.#getNumber(r.body) : 500;
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  #askPlayerRoll = async (g, player) => {
    if (!this.#isGroupHasGame(g)) {
      return 0;
    }
    await this.#replyAskPlayerToRoll(g, player);
    let r = await this.#API
      .messaging()
      .subscribe()
      .nextMessage(
        (message) =>
          message.isGroup &&
          this.#API
            .phrase()
            .getAllByName(`${this.#API.config.keyword}_game_roll`)
            .some((s) => s.value === message.body.toLocaleLowerCase()) &&
          message.targetGroupId === g.id &&
          message.sourceSubscriberId === player.id,
        this.#TIME_TO_CHOICE
      );
    if (!this.#isGroupHasGame(g)) {
      return 0;
    }
    if (r) {
      let dice = this.#rollDice(6);
      await this.#replyPlayerRolled(g, player, dice);
      return dice;
    }
    await this.#replyPlayerTimeIsUpRoll(g, player);
    return 0;
  };
  /**
   *
   * @param {*} g
   * @returns {boolean}
   */
  #isGroupHasGame = (g) => {
    if (!group.has(g.id)) {
      return false;
    }
    let newCopyGroup = group.get(g.id);
    if (g.uuid !== newCopyGroup.uuid) {
      return false;
    }
    return true;
  };
  /**
   *
   * @param {Number} gid
   * @returns
   */
  #printPlayers = async (gid) => {
    if (!group.has(gid)) {
      return "";
    }
    let results = "";
    let PlayersArray = this.#getRichestPlayers(gid);
    for (let index = 0; index < PlayersArray.length; index++) {
      let Player = PlayersArray[index];
      let User = await this.#API.subscriber().getById(Player.id);
      if (index === PlayersArray.length - 1) {
        results += `${index + 1} ـ ${User.nickname} (${User.id}) ـ ${this.#formatNumber(
          Player.balance
        )}`;
        return results;
      }
      results += `${index + 1} ـ ${User.nickname} (${User.id}) ـ ${this.#formatNumber(
        Player.balance
      )}\n`;
    }
    return results;
  };
  /**
   *
   * @param {Number} gid
   * @returns
   */
  #getRichestPlayers = (gid) => {
    if (!group.has(gid)) {
      return [];
    }
    let g = group.get(gid);
    let Players = Array.from(g.players.values());
    return Players.filter((p) => p.balance >= 500);
  };
  /**
   *
   * @param {*} g
   */
  #replyCreated = async (g) => {
    let DICE_GAME_Created = `${this.#API.config.keyword}_game_created`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Created);
    let response = this.#API.utility().string().replace(phrase, { count: g.playersCount });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyWrongCreate = async (command) => {
    let DICE_GAME_Wrong_Create = `${this.#API.config.keyword}_game_wrong_creation`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Wrong_Create);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyInvalidBalance = async (command) => {
    let DICE_GAME_Invalid_Balance = `${this.#API.config.keyword}_game_invalid_balance`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Invalid_Balance);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyAlreadyCreated = async (command) => {
    let DICE_GAME_Already_Created = `${this.#API.config.keyword}_game_already_created`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Already_Created);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {*} command
   */
  #replyNotExist = async (command) => {
    let DICE_GAME_NotExist = `${this.#API.config.keyword}_game_not_exist`;
    let phrase = this.#getPhrase(command.language, DICE_GAME_NotExist);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyJoin = async (command) => {
    let DICE_GAME_JOIN = `${this.#API.config.keyword}_game_join`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_JOIN);
    let user = await this.#API.subscriber().getById(command.sourceSubscriberId);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, response);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyAlreadyJoin = async (command) => {
    let DICE_GAME_Already_Join = `${this.#API.config.keyword}_game_already_join`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Already_Join);
    let user = await this.#API.subscriber().getById(command.sourceSubscriberId);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyGameStart = async (g) => {
    let DICE_GAME_Start = `${this.#API.config.keyword}_game_start`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Start);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { list: await this.#printPlayers(g.id) });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  #replyPlayers = async (command) => {
    let DICE_GAME_Players = `${this.#API.config.keyword}_game_players`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Players);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { list: await this.#printPlayers(command.targetGroupId) });
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, response);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @param {*} player
   */
  #replyPlayerBalance = async (command, player) => {
    let DICE_GAME_Player_Balance = `${this.#API.config.keyword}_game_player_balance`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Player_Balance);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, {
        id: user.id,
        nickname: user.nickname,
        balance: this.#formatNumber(player.balance),
      });
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, response);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   */
  #replyPlayerNotFound = async (command) => {
    let DICE_GAME_Player_NotFound = `${this.#API.config.keyword}_game_player_notfound`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Player_NotFound);
    let user = await this.#API.subscriber().getById(command.sourceSubscriberId);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { id: user.id, nickname: user.nickname });
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, response);
  };
  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   */
  #replyGameRemoved = async (command) => {
    let DICE_GAME_Player_NotFound = `${this.#API.config.keyword}_game_removed`;
    let phrase = this.#getPhraseByCommand(command, DICE_GAME_Player_NotFound);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {*} g
   */
  #replyMakeAGuess = async (g) => {
    let DICE_Make_A_Guess = `${this.#API.config.keyword}_game_make_a_guess`;
    let response = this.#getPhrase(g.language, DICE_Make_A_Guess);
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} botDice
   */
  #replyPlayerTurn = async (g, player, botDice) => {
    let DICE_GAME_Player_Turn = `${this.#API.config.keyword}_game_player_turn`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Player_Turn);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, {
        dice: botDice,
        nickname: user.nickname,
        id: user.id,
        list: await this.#printPlayers(g.id),
      });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyAskPlayerBalance = async (g, player) => {
    let DICE_GAME_Ask_Player_Balance = `${this.#API.config.keyword}_game_ask_player_balance`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Ask_Player_Balance);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { balance: this.#formatNumber(player.balance) });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyAskPlayerBalanceAlready500 = async (g) => {
    let DICE_Player_Balance_Already500 = `${
      this.#API.config.keyword
    }_game_ask_player_balance_already_500`;
    let phrase = this.#getPhrase(g.language, DICE_Player_Balance_Already500);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} g
   */
  #replyAskPlayerBalanceError500 = async (g) => {
    let DICE_Player_Balance_Error500 = `${this.#API.config.keyword}_game_player_balance_500_error`;
    let phrase = this.#getPhrase(g.language, DICE_Player_Balance_Error500);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} g
   */
  #replyAskPlayerBalanceError = async (g) => {
    let DICE_Balance_Not_Enough = `${
      this.#API.config.keyword
    }_game_player_balance_not_enough_error`;
    let phrase = this.#getPhrase(g.language, DICE_Balance_Not_Enough);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyAskPlayerToRoll = async (g, player) => {
    let DICE_GAME_Ask_Player_Roll = `${this.#API.config.keyword}_game_ask_player_to_roll`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Ask_Player_Roll);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} dice
   */
  #replyPlayerRolled = async (g, player, dice) => {
    let DICE_GAME_Plyer_Rolled = `${this.#API.config.keyword}_game_player_rolled`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Plyer_Rolled);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, dice });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} bet
   */
  #replyPVPWinner = async (g, player, bet, isOut) => {
    let DICE_GAME_PVP_Winner = `${this.#API.config.keyword}_game_pvp_winner`;
    let DICE_GAME_Player_Out = `${this.#API.config.keyword}_game_player_out`;
    let DICE_GAME_Player = `${this.#API.config.keyword}_game_player`;
    let phrase_winner = this.#getPhrase(g.language, DICE_GAME_PVP_Winner);
    let phrase_out = this.#getPhrase(g.language, DICE_GAME_Player_Out);
    let phrase_player = this.#getPhrase(g.language, DICE_GAME_Player);
    let user = await this.#API.subscriber().getById(player.id);
    let phrase = isOut ? phrase_winner + phrase_out + phrase_player : phrase_winner + phrase_player;
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, bet: this.#formatNumber(bet) });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyPVPDraw = async (g) => {
    let DICE_GAME_PVP_Draw = `${this.#API.config.keyword}_game_pvp_draw`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_PVP_Draw);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} g
   */
  #replyGameFinish = async (g) => {
    let DICE_GAME_Finish = `${this.#API.config.keyword}_game_finish`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Finish);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyPlayerTimeIsUpRoll = async (g, player) => {
    let DICE_GAME_Time_Is_Up = `${this.#API.config.keyword}_game_time_is_up_roll`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Time_Is_Up);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyPlayerNotPick = async (g, player) => {
    let DICE_GAME_Not_Pick = `${this.#API.config.keyword}_game_player_not_pick`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Not_Pick);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyPlayerRewarded = async (g, player) => {
    let DICE_GAME_Rewarded = `${this.#API.config.keyword}_game_player_rewarded`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Rewarded);
    let user = await this.#API.subscriber().getById(player.id);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyGameWinner = async (g, player) => {
    let DICE_GAME_Winner = `${this.#API.config.keyword}_game_winner`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Winner);
    let user = await this.#API.subscriber().getById(player.id);
    let list = await this.#gameWinners(g);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, list });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} language
   * @param {*} phrase
   * @returns
   */
  #getPhrase = (language, phrase) => {
    return this.#API.phrase().getByLanguageAndName(language, phrase);
  };
  /**
   *
   * @param {import "wolf.js".CommandObject} command
   * @param {*} phrase
   * @returns
   */
  #getPhraseByCommand = (command, phrase) => {
    return this.#API.phrase().getByCommandAndName(command, phrase);
  };
}

module.exports = Game;
