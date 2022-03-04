const { Validator } = require("wolf.js");
class Game {
  #Groups = [];
  #API;

  /**
   *
   * @param {import("wolf.js").WOLFBot} api
   */
  constructor(api) {
    this.#API = api;
  }
  /**
   *
   * @param {Number} gid
   * @param {String} language
   * @param {String} options
   * @returns {Boolean|object}
   */
  create = async (gid, language, options, player) => {
    let g = this.find(gid);
    let defaultBalance = options || 2500;
    if (g) {
      await this.#replyAlreadyCreated(g);
      return false;
    }
    if (defaultBalance !== "" && !this.#checkNumber(defaultBalance)) {
      await this.#replyWrongCreate(gid, language);
      return false;
    }
    if (
      !(
        this.#getNumber(defaultBalance) <= 5000 &&
        this.#getNumber(defaultBalance) > 0 &&
        this.#getNumber(defaultBalance) % 500 === 0
      )
    ) {
      await this.#replyInvalidBalance(gid, language);
      return;
    }
    g = this.#setupGroup(gid, language, this.#getNumber(defaultBalance));
    this.#Groups.push(g);
    //g.players.push(this.#setupPlayer(player, g.defaultBalance));
    await this.#replyCreated(g);
    await this.#API.utility().timer().add(`game-${g.id}`, "UpdateTimer", g, 30000);
    g.players.push(this.#setupPlayer(player, g.defaultBalance));
  };
  /**
   *
   * @param {Number} gid
   * @param {object} player
   * @returns
   */
  join = async (command, player) => {
    let g = this.find(command.targetGroupId);
    if (!g) {
      await this.#replyNotExist(command);
      return;
    }
    if (!g.joinable) {
      return false;
    }
    if (g.players.length >= g.playersCount) {
      return false;
    }
    if (this.#getPlayer(g.id, player.id)) {
      await this.#replyAlreadyJoin(g, player);
      return false;
    }
    g.players.push(this.#setupPlayer(player, g.defaultBalance));
    await this.#replyJoin(g, player);
    if (g.players.length >= g.playersCount) {
      return await this.start(g);
    }
  };

  /**
   *
   * @param {*} command
   * @returns
   */
  show = async (command) => {
    let g = this.find(command.targetGroupId);
    if (!g) {
      await this.#replyNotExist(command);
      return;
    }
    this.#replyPlayers(g);
  };
  /**
   *
   * @param {*} command
   * @param {*} user
   * @returns
   */
  balance = async (command, user) => {
    let g = this.find(command.targetGroupId);
    if (!g) {
      await this.#replyNotExist(command);
      return;
    }
    let player = this.#getPlayer(g.id, user.id);
    if (!player) {
      await this.#replyPlayerNotFound(g, user);
      return;
    }
    await this.#replyPlayerBalance(g, player);
  };
  /**
   *
   * @param {Number} gid
   * @returns {Boolean}
   */
  find = (gid) => {
    return this.#Groups.find((g) => g.id === gid) ?? false;
  };
  /**
   *
   * @param {Number} g
   */
  start = async (g) => {
    g.joinable = 0;
    await this.#replyGameStart(g);
    while (this.#getRichestPlayers(g).length !== 1) {
      await this.#API.utility().delay(2000);
      await this.#askPlayerToMakeGuesses(g);
      if (this.#checkGuessIsOne(g)) {
        await this.finish(g);
        break;
      }
      let botDice = this.#rollDice(50);
      let clousePalyer = this.#closestGuesse(g, botDice);
      await this.#API.utility().delay(2000);
      await this.#replyPlayerTurn(g, clousePalyer, botDice);
      let playerPicked = await this.#askPlayerPick(g, clousePalyer);
      if (!playerPicked) {
        continue;
      }
      await this.#API.utility().delay(2000);
      let bet = await this.#AskPlayerBalance(g, clousePalyer);
      let result = true;
      while (result) {
        await this.#API.utility().delay(2000);
        let p1 = await this.#askPlayerRoll(g, clousePalyer);
        if (p1 == 0) {
          result = await this.#checkWhoWon(g, clousePalyer, playerPicked, p1, 6, bet);
          continue;
        }
        await this.#API.utility().delay(2000);
        let p2 = await this.#askPlayerRoll(g, playerPicked);
        await this.#API.utility().delay(2000);
        result = await this.#checkWhoWon(g, clousePalyer, playerPicked, p1, p2, bet);
      }
    }
    await this.#API.utility().delay(2000);
    if (this.find(g.id)) {
      await this.stop(g);
    }
    this.#Groups = this.#Groups.filter((gg) => gg.id !== g.id);
  };
  /**
   *
   * @param {Number} gid
   */
  finish = async (g) => {
    this.#Groups = this.#Groups.filter((gg) => gg.id !== g.id);
    await this.#replyGameFinish(g);
  };
  /**
   *
   * @param {Number} gid
   */
  stop = async (g) => {
    await this.#replyGameWinner(g, this.#getRichestPlayers(g)[0]);
    this.#Groups = this.#Groups.filter((gg) => gg.id !== g.id);
  };
  /**
   *
   * @param {*} gid
   * @param {*} language
   * @param {*} defaultBalance
   * @returns
   */
  #setupGroup = (gid, language, defaultBalance = 2500) => {
    return { id: gid, joinable: 1, language, defaultBalance, playersCount: 10, players: [] };
  };
  /**
   *
   * @param {*} player
   * @param {*} defaultBalance
   * @returns
   */
  #setupPlayer = (player, defaultBalance) => {
    return {
      id: player.id,
      nickname: player.nickname,
      balance: defaultBalance,
      courrntGuesse: null,
    };
  };
  /**
   *
   * @param {*} g
   */
  #askPlayerToMakeGuesses = async (g) => {
    this.#resetGusses(g);
    await this.#replyMakeAGuesse(g);
    let exit = true;
    setTimeout(function () {
      exit = false;
    }, 15000);
    while (exit) {
      let r = await this.#API
        .messaging()
        .subscribe()
        .nextMessage(
          (message) =>
            message.isGroup &&
            this.#checkNumber(message.body) &&
            message.targetGroupId === g.id &&
            this.#getRichestPlayers(g).some((p) => p.id === message.sourceSubscriberId),
          10000
        );
      if (r) {
        this.#setPlayerGuess(g, r.sourceSubscriberId, r.body);
      }
    }
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} guess
   */
  #setPlayerGuess = (g, player, guess) => {
    if (this.#checkGuess(guess)) {
      let n = this.#getNumber(guess);
      if (this.#getRichestPlayers(g).some((p) => p.courrntGuesse === n)) {
        n = 150;
      }
      this.#getPlayer(g.id, player).courrntGuesse = n;
    }
  };
  /**
   *
   * @param {*} g
   */
  #resetGusses = (g) => {
    g.players.forEach((p) => {
      p.courrntGuesse = null;
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
  #checkGuessIsOne = (g) => {
    return g.players.filter((p) => p.courrntGuesse !== null).length <= 1;
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
   * @param {*} player
   * @returns
   */
  #checkPlayerIsOut = async (g, player) => {
    if (this.#getPlayer(g.id, player.id).balance > 0) {
      return;
    }
    // remove the player
    g.players = g.players.filter((p) => p.id !== player.id);
    await this.#API.utility().delay(2000);
    await this.#replyPlayerIsOut(g, player);
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
    if (p1 > p2) {
      playerTow.balance -= bet;
      await this.#replyPVPWinner(g, playerTow, bet);
      await this.#checkPlayerIsOut(g, playerTow);
      return false;
    }
    if (p2 > p1) {
      playerOne.balance -= bet;
      await this.#replyPVPWinner(g, playerOne, bet);
      await this.#checkPlayerIsOut(g, playerOne);
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
  #closestGuesse = (g, botDice) => {
    let array = g.players;
    let w = array.sort(
      (a, b) => Math.abs(botDice - a.courrntGuesse) - Math.abs(botDice - b.courrntGuesse)
    )[0];
    return this.#getPlayer(g.id, w.id);
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
            this.#getRichestPlayers(g).findIndex((p) => p.id === player.id) &&
          this.#getRichestPlayers(g).length >= this.#getNumber(message.body),
        15000
      );
    if (r) {
      return this.#getRichestPlayers(g)[this.#getNumber(r.body) - 1];
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
          15000
        );
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
        15000
      );
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
   * @returns
   */
  #printPlayers = async (g) => {
    let results = "";
    let user = null;
    this.#getRichestPlayers(g).forEach(async (p, index, array) => {
      if (index === array.length - 1) {
        user = await this.#API.subscriber().getById(p.id);
        //results += `${index + 1} ـ ${p.nickname} (${p.id}) ـ ${this.#formatNumber(p.balance)}`;
        results += `${index + 1} ـ ${user.nickname} (${user.id}) ـ ${this.#formatNumber(
          p.balance
        )}`;
        //return results;
      }
      user = await this.#API.subscriber().getById(p.id);
      //results += `${index + 1} ـ ${p.nickname} (${p.id}) ـ ${this.#formatNumber(p.balance)}\n`;
      results += `${index + 1} ـ ${user.nickname} (${user.id}) ـ ${this.#formatNumber(
        p.balance
      )}\n`;
    });
    console.log(results);
    return results;
  };
  /**
   *
   * @param {*} g
   * @returns
   */
  #getRichestPlayers = (g) => {
    let gg = this.find(g.id);
    if (!gg) {
      return [];
    }
    return gg.players.filter((p) => p.balance >= 500);
  };
  /**
   *
   * @param {*} gid
   * @param {*} player
   * @returns
   */
  #getPlayer = (gid, player) => {
    let g = this.find(gid);
    if (g && g.players.length > 0) {
      return g.players.filter((p) => p.id === player)[0];
    }
    return false;
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
   * @param {*} gid
   * @param {*} language
   */
  #replyWrongCreate = async (gid, language) => {
    let DICE_GAME_Wrong_Create = `${this.#API.config.keyword}_game_wrong_creation`;
    let phrase = this.#getPhrase(language, DICE_GAME_Wrong_Create);
    await this.#API.messaging().sendGroupMessage(gid, phrase);
  };
  /**
   *
   * @param {*} gid
   * @param {*} language
   */
  #replyInvalidBalance = async (gid, language) => {
    let DICE_GAME_Invalid_Balance = `${this.#API.config.keyword}_game_invalid_balance`;
    let phrase = this.#getPhrase(language, DICE_GAME_Invalid_Balance);
    await this.#API.messaging().sendGroupMessage(gid, phrase);
  };
  /**
   *
   * @param {*} g
   */
  #replyAlreadyCreated = async (g) => {
    let DICE_GAME_Already_Created = `${this.#API.config.keyword}_game_already_created`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Already_Created);
    await this.#API.messaging().sendGroupMessage(g.id, phrase);
  };
  /**
   *
   * @param {*} command
   */
  #replyNotExist = async (command) => {
    let DICE_GAME_NotExist = `${this.#API.config.keyword}_game_notexist`;
    let phrase = this.#getPhrase(command.language, DICE_GAME_NotExist);
    await this.#API.messaging().sendGroupMessage(command.targetGroupId, phrase);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyJoin = async (g, player) => {
    let DICE_GAME_JOIN = `${this.#API.config.keyword}_game_join`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_JOIN);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyAlreadyJoin = async (g, player) => {
    let DICE_GAME_Already_Join = `${this.#API.config.keyword}_game_already_join`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Already_Join);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyGameStart = async (g) => {
    let DICE_GAME_Start = `${this.#API.config.keyword}_game_start`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Start);
    let list = await this.#printPlayers(g);
    console.log(list);
    let response = this.#API.utility().string().replace(phrase, { list: list });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyPlayers = async (g) => {
    let DICE_GAME_Players = `${this.#API.config.keyword}_game_players`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Players);
    let list = await this.#printPlayers(g);
    console.log(await this.#printPlayers(g));
    console.log(list);
    let response = this.#API.utility().string().replace(phrase, { list: list });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyPlayerBalance = async (g, player) => {
    let DICE_GAME_Player_Balance = `${this.#API.config.keyword}_game_player_balance`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Player_Balance);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, {
        id: player.id,
        nickname: player.nickname,
        balance: this.#formatNumber(player.balance),
      });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} user
   */
  #replyPlayerNotFound = async (g, user) => {
    let DICE_GAME_Player_NotFound = `${this.#API.config.keyword}_game_player_notfound`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Player_NotFound);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { id: user.id, nickname: user.nickname });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   */
  #replyMakeAGuesse = async (g) => {
    let DICE_Make_A_Guesse = `${this.#API.config.keyword}_game_make_a_guess`;
    let response = this.#getPhrase(g.language, DICE_Make_A_Guesse);
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} botdice
   */
  #replyPlayerTurn = async (g, player, botdice) => {
    let DICE_GAME_Player_Turn = `${this.#API.config.keyword}_game_player_turn`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Player_Turn);
    let list = await this.#printPlayers(g);
    let response = this.#API.utility().string().replace(phrase, {
      dice: botdice,
      nickname: player.nickname,
      id: player.id,
      list,
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
    let DICE_Balance_Notenough = `${this.#API.config.keyword}_game_player_balance_notenough_error`;
    let phrase = this.#getPhrase(g.language, DICE_Balance_Notenough);
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
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
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
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id, dice });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   * @param {*} bet
   */
  #replyPVPWinner = async (g, player, bet) => {
    let DICE_GAME_PVP_Winner = `${this.#API.config.keyword}_game_pvp_winner`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_PVP_Winner);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id, bet: this.#formatNumber(bet) });
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
  #replyPlayerIsOut = async (g, player) => {
    let DICE_GAME_Player_Out = `${this.#API.config.keyword}_game_player_out`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Player_Out);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
    await this.#API.messaging().sendGroupMessage(g.id, response);
  };
  /**
   *
   * @param {*} g
   * @param {*} player
   */
  #replyPlayerTimeIsUpRoll = async (g, player) => {
    let DICE_GAME_Time_Is_Up = `${this.#API.config.keyword}_game_time_is_up_roll`;
    let phrase = this.#getPhrase(g.language, DICE_GAME_Time_Is_Up);
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
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
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
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
    let response = this.#API
      .utility()
      .string()
      .replace(phrase, { nickname: player.nickname, id: player.id });
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
}

module.exports = Game;
