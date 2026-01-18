import { v4 } from "uuid";
import { Validator } from "wolf.js";
import { setLastActive } from "./active.js";
import { admins, group } from "./data.js";
import { addPoint, updateStatus } from "./score.js";

export default class Game {
  API;
  PLAYERS_COUNT;
  TIME_TO_JOIN;
  TIME_TO_CHOICE;
  BOT_DICE;
  /**
   *
   * @param {import("wolf.js").WOLF} api
   */
  constructor(api) {
    this.API = api;
    this.PLAYERS_COUNT = 16;
    this.TIME_TO_JOIN = 30 * 1000;
    this.TIME_TO_CHOICE = 15 * 1000;
    this.BOT_DICE = 50;
  }

  /**
   *
   * @param {import ("wolf.js").Command} command
   * @param {String} options
   */
  create = async (command, options) => {
    if (group.has(command.targetGroupId)) {
      await this.replyAlreadyCreated(command);
      return false;
    }

    const defaultBalance = options || 500;

    if (defaultBalance !== "" && !this.checkNumber(defaultBalance)) {
      await this.replyWrongCreate(command);

      return false;
    }

    if (
      !(
        this.getNumber(defaultBalance) <= 5000 &&
        this.getNumber(defaultBalance) > 0 &&
        this.getNumber(defaultBalance) % 500 === 0
      )
    ) {
      await this.replyInvalidBalance(command);

      return;
    }
    this.setupGroup(command.targetGroupId, command.language, this.getNumber(defaultBalance));

    const g = group.get(command.targetGroupId);

    await this.API.utility()
      .timer()
      .add(
        `game-${command.targetGroupId}`,
        "UpdateTimer",
        { gid: command.targetGroupId },
        this.TIME_TO_JOIN
      );
    this.setupPlayer(g.players, command.sourceSubscriberId, g.defaultBalance);
    await this.replyCreated(g);
  };

  /**
   *
   * @param {import ("wolf.js").Command} command
   * @returns
   */
  join = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return this.replyNotExist(command);
    }

    const g = group.get(command.targetGroupId);

    if (!g.joinable) {
      return false;
    }

    if (g.players.size >= g.playersCount) {
      return false;
    }

    if (g.players.has(command.sourceSubscriberId)) {
      // return await this.replyAlreadyJoin(command);
      return;
    }
    this.setupPlayer(g.players, command.sourceSubscriberId, g.defaultBalance);

    // await this.replyJoin(command);
    if (g.players.size >= g.playersCount) {
      g.joinable = false;
      g.start = true;
      await this.start(g.id);
    }
  };

  /**
   *
   * @param {import ("wolf.js").Command} command
   * @returns
   */
  show = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return this.replyNotExist(command);
    }
    this.replyPlayers(command);
  };

  /**
   *
   * @param {import ("wolf.js").Command} command
   */
  remove = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return this.replyNotExist(command);
    }
    group.delete(command.targetGroupId);

    return this.replyGameRemoved(command);
  };

  /**
   *
   * @param {import ("wolf.js").Command} command
   * @returns
   */
  balance = async (command) => {
    if (!group.has(command.targetGroupId)) {
      return this.replyNotExist(command);
    }

    const tempGroup = group.get(command.targetGroupId);

    if (!tempGroup.players.has(command.sourceSubscriberId)) {
      await this.replyPlayerNotFound(command);

      return;
    }

    const tempPlayer = tempGroup.players.get(command.sourceSubscriberId);

    await this.replyPlayerBalance(command, tempPlayer);
  };

  /**
   *
   * @param {Number} gid
   */
  start = async (gid) => {
    if (!group.has(gid)) {
      return;
    }

    const g = group.get(gid);

    g.joinable = false;
    g.start = true;
    await this.replyGameStart(g);

    const ScoreAmount = g.players.size;

    while (this.getRichestPlayers(g.id).length !== 1) {
      await this.API.utility().delay(1000);
      await this.askPlayerToMakeGuesses(g);

      if (this.checkGuessIsZero(g)) {
        await this.finish(g);
        break;
      }

      const botDice = this.rollDice(this.BOT_DICE);
      const closestPlayer = await this.closestGuesses(g, botDice);

      await this.API.utility().delay(1000);
      await this.replyPlayerTurn(g, closestPlayer, botDice);

      const playerPicked = await this.askPlayerPick(g, closestPlayer);

      if (!playerPicked) {
        continue;
      }
      await this.API.utility().delay(1000);

      const bet = await this.AskPlayerBalance(g, closestPlayer);
      let result = true;

      while (result) {
        await this.API.utility().delay(1000);

        const p1 = await this.askPlayerRoll(g, closestPlayer);

        if (p1 === 0) {
          result = await this.checkWhoWon(g, closestPlayer, playerPicked, p1, 6, bet);
          continue;
        }
        await this.API.utility().delay(1000);

        const p2 = await this.askPlayerRoll(g, playerPicked);

        await this.API.utility().delay(1000);
        result = await this.checkWhoWon(g, closestPlayer, playerPicked, p1, p2, bet);
      }
    }
    await this.API.utility().delay(1000);

    if (this.isGroupHasGame(g)) {
      const tempGroup = group.get(g.id);

      await this.stop(tempGroup, ScoreAmount);
      group.delete(tempGroup.id);
    }
  };

  /**
   *
   * @param {Number} gid
   */
  finish = async (g) => {
    if (this.isGroupHasGame(g)) {
      const tempGroup = group.get(g.id);

      await this.replyGameFinish(tempGroup);
      group.delete(tempGroup.id);
    }
  };

  /**
   *
   * @param {Number} gid
   */
  stop = async (g, ScoreAmount) => {
    const winner = this.getRichestPlayers(g.id)[0];

    this.addPointsToPlayer(g, winner.id, ScoreAmount);
    await this.rewardPlayers(g);
    await this.replyGameWinner(g, winner);
  };

  /**
   *
   * @param {*} gid
   * @param {*} language
   * @param {*} defaultBalance
   * @returns
   */
  setupGroup = (gid, language, defaultBalance = 500) => {
    if (!group.has(gid)) {
      group.set(gid, {
        id: gid,
        uuid: v4(),
        joinable: true,
        start: false,
        language,
        defaultBalance,
        playersCount: this.PLAYERS_COUNT,
        players: new Map(),
        scores: new Map()
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
  setupPlayer = (players, id, defaultBalance) => {
    if (!players.has(id)) {
      players.set(id, {
        id,
        balance: defaultBalance,
        currentGuess: null
      });
    }
  };

  /**
   *
   * @param {*} g
   */
  askPlayerToMakeGuesses = async (g) => {
    if (!this.isGroupHasGame(g)) {
      return;
    }
    this.resetGussets(g);
    await this.replyMakeAGuess(g);

    let exit = true;

    setTimeout(function () {
      exit = false;
    }, this.TIME_TO_CHOICE);

    while (exit) {
      const r = await this.API.messaging()
        .subscribe()
        .nextMessage(
          (message) =>
            message.isGroup &&
            this.checkNumber(message.body) &&
            message.targetGroupId === g.id &&
            this.getRichestPlayers(g.id).some((p) => p.id === message.sourceSubscriberId),
          10000
        );

      if (r) {
        this.setPlayerGuess(g.id, r.sourceSubscriberId, r.body);
      }
    }
  };

  /**
   *
   * @param {number} gid
   * @param {*} pid
   * @param {*} guess
   */
  setPlayerGuess = (gid, pid, guess) => {
    if (this.checkGuess(guess)) {
      let n = this.getNumber(guess);

      if (this.getRichestPlayers(gid).some((p) => p.currentGuess === n)) {
        n = this.TIME_TO_CHOICE;
      }

      if (group.has(gid)) {
        const g = group.get(gid);
        const player = g.players.get(pid);

        player.currentGuess = n;
      }
    }
  };

  /**
   *
   * @param {*} g
   */
  resetGussets = (g) => {
    g.players.forEach((p) => {
      p.currentGuess = null;
    });
  };

  /**
   *
   * @param {*} guess
   * @returns
   */
  checkGuess = (guess) => {
    const n = this.getNumber(guess);

    return n <= 50 && n > 0;
  };

  /**
   *
   * @param {*} g
   * @returns
   */
  checkGuessIsZero = (g) => {
    if (!this.isGroupHasGame(g)) {
      return true;
    }

    const tempGroup = group.get(g.id);
    const tempArray = Array.from(tempGroup.players.values());

    return tempArray.filter((p) => p.currentGuess !== null).length <= 0;
  };

  /**
   *
   * @param {*} n
   * @returns
   */
  checkNumber = (n) => {
    if (!Validator.isValidNumber(this.API.utility().number().toEnglishNumbers(n))) {
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
  addPointsToPlayer = (g, pid, points) => {
    if (g.scores.has(pid)) {
      const oldScore = g.scores.get(pid);

      g.scores.set(pid, oldScore + points);
    } else {
      g.scores.set(pid, points);
    }
  };

  /**
   *
   * @param {*} g
   */
  rewardPlayers = async (g) => {
    g.scores.forEach(async (points, pid) => {
      await addPoint(pid, points);
    });
  };

  /**
   *
   * @param {*} g
   */
  gameWinners = async (g) => {
    try {
      const mapSort = new Map([...g.scores.entries()].sort((a, b) => b[1] - a[1]));

      const entries = [...mapSort.entries()];

      const users = await Promise.all(entries.map(([id]) => this.API.subscriber().getById(id)));

      let r = "\n";

      for (let i = 0; i < entries.length; i++) {
        const [, score] = entries[i];
        const user = users[i];

        r += `${i + 1} ـ ${user.nickname} (${user.id}) ـ ${score}`;

        if (i !== entries.length - 1) {
          r += "\n";
        }
      }

      return r;
    } catch (err) {
      console.error("gameWinners error:", err);
      throw err;
    }
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  checkPlayerIsOut = (g, player) => {
    if (!this.isGroupHasGame(g)) {
      return false;
    }

    const tempGroup = group.get(g.id);
    const tempPlayer = tempGroup.players.get(player.id);

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
  checkBalance = async (g, player, balance) => {
    if (balance % 500 !== 0) {
      await this.replyAskPlayerBalanceError500(g);

      return false;
    }

    if (player.balance < balance) {
      await this.replyAskPlayerBalanceError(g);

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
  checkWhoWon = async (g, playerOne, playerTow, p1, p2, bet) => {
    if (!this.isGroupHasGame(g)) {
      return true;
    }
    await setLastActive(g.id);

    if (p1 > p2) {
      playerTow.balance -= bet;

      const isOut = this.checkPlayerIsOut(g, playerTow);

      await this.replyPVPWinner(g, playerTow, bet, isOut);

      if (p1 > 0 && p2 > 0) {
        this.addPointsToPlayer(g, playerOne.id, 1);
      }

      return false;
    }

    if (p2 > p1) {
      playerOne.balance -= bet;

      const isOut = this.checkPlayerIsOut(g, playerOne);

      await this.replyPVPWinner(g, playerOne, bet, isOut);

      if (p1 > 0 && p2 > 0) {
        this.addPointsToPlayer(g, playerTow.id, 1);
      }

      return false;
    }
    await this.replyPVPDraw(g);

    return true;
  };

  /**
   *
   * @param {*} g
   * @param {*} botDice
   * @returns
   */
  closestGuesses = async (g, botDice) => {
    if (!this.isGroupHasGame(g)) {
      return null;
    }

    const tempGroup = group.get(g.id);
    const tempArray = Array.from(tempGroup.players.values());
    const array = tempArray.filter((p) => p.currentGuess !== null);
    const winner = array.sort(
      (a, b) => Math.abs(botDice - a.currentGuess) - Math.abs(botDice - b.currentGuess)
    )[0];

    if (winner.currentGuess === botDice) {
      winner.balance += 500;
      this.addPointsToPlayer(tempGroup, winner.id, 2);
      await this.replyPlayerRewarded(tempGroup, winner);
    }

    const player = tempGroup.players.get(winner.id);

    return player;
  };

  /**
   *
   * @param {*} num
   * @returns
   */
  formatNumber = (num) => {
    return this.API.utility().number().addCommas(num);
  };

  /**
   *
   * @param {*} n
   * @returns
   */
  getNumber = (n) => {
    return parseInt(this.API.utility().number().toEnglishNumbers(n));
  };

  /**
   *
   * @param {*} max
   * @returns
   */
  rollDice = (max) => {
    return Math.floor(Math.random() * max) + 1;
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  askPlayerPick = async (g, player) => {
    if (!this.isGroupHasGame(g)) {
      return false;
    }

    const r = await this.API.messaging()
      .subscribe()
      .nextMessage(
        (message) =>
          message.isGroup &&
          message.targetGroupId === g.id &&
          message.sourceSubscriberId === player.id &&
          this.checkNumber(message.body) &&
          this.getNumber(message.body) - 1 !==
            this.getRichestPlayers(g.id).findIndex((p) => p.id === player.id) &&
          this.getRichestPlayers(g.id).length >= this.getNumber(message.body),
        this.TIME_TO_CHOICE
      );

    if (!this.isGroupHasGame(g)) {
      return false;
    }

    if (r) {
      return this.getRichestPlayers(g.id)[this.getNumber(r.body) - 1];
    }

    await this.replyPlayerNotPick(g, player);

    return false;
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  AskPlayerBalance = async (g, player) => {
    if (!this.isGroupHasGame(g)) {
      return 500;
    }

    if (player.balance === 500) {
      //  await this.replyAskPlayerBalanceAlready500(g);
      return 500;
    }
    await this.replyAskPlayerBalance(g, player);

    let exit = false;
    let r = null;

    while (!exit) {
      r = await this.API.messaging()
        .subscribe()
        .nextMessage(
          (message) =>
            message.isGroup &&
            message.targetGroupId === g.id &&
            message.sourceSubscriberId === player.id &&
            this.checkNumber(message.body),
          this.TIME_TO_CHOICE
        );

      if (!this.isGroupHasGame(g)) {
        exit = true;
      }

      if (r) {
        exit = await this.checkBalance(g, player, this.getNumber(r.body));
      } else {
        exit = true;
      }
    }

    return r ? this.getNumber(r.body) : 500;
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @returns
   */
  askPlayerRoll = async (g, player) => {
    if (!this.isGroupHasGame(g)) {
      return 0;
    }
    await this.replyAskPlayerToRoll(g, player);

    const r = await this.API.messaging()
      .subscribe()
      .nextMessage((message) => this.PlayerRolled(message, player.id, g.id), this.TIME_TO_CHOICE);

    if (!this.isGroupHasGame(g)) {
      return 0;
    }

    if (r) {
      let dice = this.rollDice(6);

      if (admins.includes(player.id) && r.body === "لف.") {
        dice = 6;
      }
      await updateStatus(player.id, dice);
      await this.replyPlayerRolled(g, player, dice);

      return dice;
    }
    await this.replyPlayerTimeIsUpRoll(g, player);

    return 0;
  };

  PlayerRolled = (message, pid, gid) => {
    if (admins.includes(message.sourceSubscriberId) && message.body.toLocaleLowerCase() === "لف.") {
      return true;
    }

    if (
      message.isGroup &&
      message.targetGroupId === gid &&
      this.API.phrase()
        .getAllByName(`${this.API.config.keyword}_game_roll`)
        .some((s) => s.value === message.body.toLocaleLowerCase()) &&
      message.sourceSubscriberId === pid
    ) {
      return true;
    }

    return false;
  };

  /**
   *
   * @param {*} g
   * @returns {boolean}
   */
  isGroupHasGame = (g) => {
    if (!group.has(g.id)) {
      return false;
    }

    const newCopyGroup = group.get(g.id);

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
  printPlayers = async (gid) => {
    if (!group.has(gid)) {
      return "";
    }

    let results = "";
    const PlayersArray = this.getRichestPlayers(gid);

    for (let index = 0; index < PlayersArray.length; index++) {
      const Player = PlayersArray[index];
      const User = await this.API.subscriber().getById(Player.id);

      if (index === PlayersArray.length - 1) {
        results += `${index + 1} ـ ${User.nickname} (${User.id}) ـ ${this.formatNumber(
          Player.balance
        )}`;

        return results;
      }
      results += `${index + 1} ـ ${User.nickname} (${User.id}) ـ ${this.formatNumber(
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
  getRichestPlayers = (gid) => {
    if (!group.has(gid)) {
      return [];
    }

    const g = group.get(gid);
    const Players = Array.from(g.players.values());

    return Players.filter((p) => p.balance >= 500);
  };

  /**
   *
   * @param {*} g
   */
  replyCreated = async (g) => {
    const diceGameCreated = `${this.API.config.keyword}_game_created`;
    const phrase = this.getPhrase(g.language, diceGameCreated);
    const response = this.API.utility().string().replace(phrase, { count: g.playersCount });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyWrongCreate = async (command) => {
    const diceGameWrongCreate = `${this.API.config.keyword}_game_wrong_creation`;
    const phrase = this.getPhraseByCommand(command, diceGameWrongCreate);

    await this.API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyInvalidBalance = async (command) => {
    const diceGameInvalidBalance = `${this.API.config.keyword}_game_invalid_balance`;
    const phrase = this.getPhraseByCommand(command, diceGameInvalidBalance);

    await this.API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyAlreadyCreated = async (command) => {
    const diceGameAlreadyCreated = `${this.API.config.keyword}_game_already_created`;
    const phrase = this.getPhraseByCommand(command, diceGameAlreadyCreated);

    await this.API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };

  /**
   *
   * @param {*} command
   */
  replyNotExist = async (command) => {
    const diceGameNotExist = `${this.API.config.keyword}_game_not_exist`;
    const phrase = this.getPhrase(command.language, diceGameNotExist);

    await this.API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyJoin = async (command) => {
    const DICE_GAME_JOIN = `${this.API.config.keyword}_game_join`;
    const phrase = this.getPhraseByCommand(command, DICE_GAME_JOIN);
    const user = await this.API.subscriber().getById(command.sourceSubscriberId);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(command.targetGroupId, response);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyAlreadyJoin = async (command) => {
    const diceGameAlreadyJoin = `${this.API.config.keyword}_game_already_join`;
    const phrase = this.getPhraseByCommand(command, diceGameAlreadyJoin);
    const user = await this.API.subscriber().getById(command.sourceSubscriberId);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(command.targetGroupId, response);
  };

  /**
   *
   * @param {*} g
   */
  replyGameStart = async (g) => {
    const DICE_GAME_Start = `${this.API.config.keyword}_game_start`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Start);
    const response = this.API.utility()
      .string()
      .replace(phrase, { list: await this.printPlayers(g.id) });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   */
  replyPlayers = async (command) => {
    const DICE_GAME_Players = `${this.API.config.keyword}_game_players`;
    const phrase = this.getPhraseByCommand(command, DICE_GAME_Players);
    const response = this.API.utility()
      .string()
      .replace(phrase, { list: await this.printPlayers(command.targetGroupId) });

    await this.API.messaging().sendGroupMessage(command.targetGroupId, response);
  };

  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   * @param {*} player
   */
  replyPlayerBalance = async (command, player) => {
    const DICE_GAME_Player_Balance = `${this.API.config.keyword}_game_player_balance`;
    const phrase = this.getPhraseByCommand(command, DICE_GAME_Player_Balance);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, {
        id: user.id,
        nickname: user.nickname,
        balance: this.formatNumber(player.balance)
      });

    await this.API.messaging().sendGroupMessage(command.targetGroupId, response);
  };

  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   */
  replyPlayerNotFound = async (command) => {
    const DICE_GAME_Player_NotFound = `${this.API.config.keyword}_game_player_notfound`;
    const phrase = this.getPhraseByCommand(command, DICE_GAME_Player_NotFound);
    const user = await this.API.subscriber().getById(command.sourceSubscriberId);
    const response = this.API.utility()
      .string()
      .replace(phrase, { id: user.id, nickname: user.nickname });

    await this.API.messaging().sendGroupMessage(command.targetGroupId, response);
  };

  /**
   *
   * @param {import ("wolf.js").CommandObject} command
   */
  replyGameRemoved = async (command) => {
    const DICE_GAME_Player_NotFound = `${this.API.config.keyword}_game_removed`;
    const phrase = this.getPhraseByCommand(command, DICE_GAME_Player_NotFound);

    await this.API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };

  /**
   *
   * @param {*} g
   */
  replyMakeAGuess = async (g) => {
    const DICE_Make_A_Guess = `${this.API.config.keyword}_game_make_a_guess`;
    const response = this.getPhrase(g.language, DICE_Make_A_Guess);

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} botDice
   */
  replyPlayerTurn = async (g, player, botDice) => {
    const DICE_GAME_Player_Turn = `${this.API.config.keyword}_game_player_turn`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Player_Turn);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, {
        dice: botDice,
        nickname: user.nickname,
        id: user.id,
        list: await this.printPlayers(g.id)
      });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyAskPlayerBalance = async (g, player) => {
    const DICE_GAME_Ask_Player_Balance = `${this.API.config.keyword}_game_ask_player_balance`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Ask_Player_Balance);
    const response = this.API.utility()
      .string()
      .replace(phrase, { balance: this.formatNumber(player.balance) });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   */
  replyAskPlayerBalanceAlready500 = async (g) => {
    const DICE_Player_Balance_Already500 = `${
      this.API.config.keyword
    }_game_ask_player_balance_already_500`;
    const phrase = this.getPhrase(g.language, DICE_Player_Balance_Already500);

    await this.API.messaging().sendGroupMessage(g.id, phrase);
  };

  /**
   *
   * @param {*} g
   */
  replyAskPlayerBalanceError500 = async (g) => {
    const DICE_Player_Balance_Error500 = `${this.API.config.keyword}_game_player_balance_500_error`;
    const phrase = this.getPhrase(g.language, DICE_Player_Balance_Error500);

    await this.API.messaging().sendGroupMessage(g.id, phrase);
  };

  /**
   *
   * @param {*} g
   */
  replyAskPlayerBalanceError = async (g) => {
    const DICE_Balance_Not_Enough = `${
      this.API.config.keyword
    }_game_player_balance_not_enough_error`;
    const phrase = this.getPhrase(g.language, DICE_Balance_Not_Enough);

    await this.API.messaging().sendGroupMessage(g.id, phrase);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyAskPlayerToRoll = async (g, player) => {
    const DICE_GAME_Ask_Player_Roll = `${this.API.config.keyword}_game_ask_player_to_roll`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Ask_Player_Roll);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} dice
   */
  replyPlayerRolled = async (g, player, dice) => {
    const DICE_GAME_Plyer_Rolled = `${this.API.config.keyword}_game_player_rolled`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Plyer_Rolled);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, dice });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} bet
   */
  replyPVPWinner = async (g, player, bet, isOut) => {
    const diceGamePvpWinner = `${this.API.config.keyword}_game_pvp_winner`;
    const diceGamePlayerOut = `${this.API.config.keyword}_game_player_out`;
    const diceGamePlayer = `${this.API.config.keyword}_game_player`;
    const phrase_winner = this.getPhrase(g.language, diceGamePvpWinner);
    const phrase_out = this.getPhrase(g.language, diceGamePlayerOut);
    const phrase_player = this.getPhrase(g.language, diceGamePlayer);
    const user = await this.API.subscriber().getById(player.id);
    const phrase = isOut
      ? phrase_winner + phrase_out + phrase_player
      : phrase_winner + phrase_player;
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, bet: this.formatNumber(bet) });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   */
  replyPVPDraw = async (g) => {
    const DICE_GAME_PVP_Draw = `${this.API.config.keyword}_game_pvp_draw`;
    const phrase = this.getPhrase(g.language, DICE_GAME_PVP_Draw);

    await this.API.messaging().sendGroupMessage(g.id, phrase);
  };

  /**
   *
   * @param {*} g
   */
  replyGameFinish = async (g) => {
    const DICE_GAME_Finish = `${this.API.config.keyword}_game_finish`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Finish);

    await this.API.messaging().sendGroupMessage(g.id, phrase);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyPlayerTimeIsUpRoll = async (g, player) => {
    const DICE_GAME_Time_Is_Up = `${this.API.config.keyword}_game_time_is_up_roll`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Time_Is_Up);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyPlayerNotPick = async (g, player) => {
    const DICE_GAME_Not_Pick = `${this.API.config.keyword}_game_player_not_pick`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Not_Pick);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyPlayerRewarded = async (g, player) => {
    const DICE_GAME_Rewarded = `${this.API.config.keyword}_game_player_rewarded`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Rewarded);
    const user = await this.API.subscriber().getById(player.id);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} g
   * @param {*} player
   */
  replyGameWinner = async (g, player) => {
    const DICE_GAME_Winner = `${this.API.config.keyword}_game_winner`;
    const phrase = this.getPhrase(g.language, DICE_GAME_Winner);
    const user = await this.API.subscriber().getById(player.id);
    const list = await this.gameWinners(g);
    const response = this.API.utility()
      .string()
      .replace(phrase, { nickname: user.nickname, id: user.id, list });

    await this.API.messaging().sendGroupMessage(g.id, response);
  };

  /**
   *
   * @param {*} language
   * @param {*} phrase
   * @returns
   */
  getPhrase = (language, phrase) => {
    return this.API.phrase().getByLanguageAndName(language, phrase);
  };

  /**
   *
   * @param {import "wolf.js".CommandObject} command
   * @param {*} phrase
   * @returns
   */
  getPhraseByCommand = (command, phrase) => {
    return this.API.phrase().getByCommandAndName(command, phrase);
  };
}
