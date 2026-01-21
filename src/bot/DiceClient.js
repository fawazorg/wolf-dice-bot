/**
 * @fileoverview DiceClient manages a single bot account instance.
 * Handles WOLF platform connection, command registration, and event handling.
 * @module bot/DiceClient
 */

import { scheduleJob } from "node-schedule";
import { Command, OnlineState, WOLF } from "wolf.js";
import * as Dice from "../commands/index.js";
import { deleteChannel, setLastActive } from "../database/helpers/channel.js";
import { GameManager } from "../index.js";
import { leaveInactiveChannels } from "../jobs/active.js";
import { createUpdateTimer } from "../jobs/channel.js";
import logger from "../utils/logger.js";

/**
 * DiceClient wraps a WOLF client instance with dice game functionality.
 * Each instance represents one bot account on the WOLF platform.
 */
class DiceClient {
  /**
   * WOLF client instance for platform communication.
   * @type {import('wolf.js').WOLF}
   */
  client;

  /**
   * GameManager instance for handling dice game logic.
   * @type {GameManager}
   */
  game;

  /**
   * Create a new DiceClient instance.
   * @param {string} email - Account email for login
   * @param {string} password - Account password for login
   */
  constructor(email, password) {
    this.client = new WOLF();
    this.game = new GameManager(this.client, {
      maxPlayers: 16,
      timeToJoin: 30000,
      timeToChoice: 15000
    });
    this.client.login(email, password, "", OnlineState.ONLINE);
    this.client.on("ready", async () => this._onReady());
    this.client.on("loginSuccess", async (subscriber) => this._onLoginSuccess(subscriber));
    this.client.on("loginFailed", (error) => this._onLoginFailed(error));
    this.client.on("joinedChannel", async (channel) => this._onJoinedChannel(channel));
    this.client.on("leftChannel", async (channel) => this._onLeftChannel(channel));
  }

  /**
   * Register all bot commands with the WOLF command handler.
   * Sets up hierarchical command structure with main and admin subcommands.
   */
  commandRegister = () => {
    this.client.commandHandler.register([
      /* Main command */
      new Command("dice_default_command", { both: (command) => Dice.main(this.client, command) }, [
        /* Balance command */
        new Command("dice_balance_command", {
          channel: (command) => Dice.balance(command, this.game)
        }),
        /* cancel command */
        new Command("dice_cancel_command", {
          channel: (command) => Dice.cancel(this.client, command, this.game)
        }),
        /* create command */
        new Command("dice_create_command", {
          channel: (command) => Dice.create(command, this.game)
        }),
        /* Help command */
        new Command("dice_help_command", { both: (command) => Dice.help(this.client, command) }),
        /* Join command */
        new Command("dice_join_command", { channel: (command) => Dice.join(command, this.game) }),
        /* Rank command */
        new Command("dice_rank_command", { channel: (command) => Dice.rank(this.client, command) }),
        /* Show command */
        new Command("dice_show_command", { channel: (command) => Dice.show(command, this.game) }),
        /* Status command */
        new Command("dice_status_command", {
          both: (command) => Dice.status(this.client, command)
        }),
        /* Top players command */
        new Command("dice_top_command", {
          both: (command) => Dice.top(this.client, command)
        }),
        /* Admin command */
        new Command(
          "dice_default_admin_command",
          { both: (command) => Dice.admin.main(this.client, command) },
          [
            /* Admin count command */
            new Command("dice_admin_count_command", {
              channel: (command) => Dice.admin.count(this.client, command)
            }),
            /* Admin help command */
            new Command("dice_help_command", {
              channel: (command) => Dice.admin.help(this.client, command)
            }),
            /* Admin join command */
            new Command("dice_admin_join_command", {
              channel: (command) => Dice.admin.join(this.client, command)
            }),
            /* Admin refresh command */
            new Command("dice_admin_refresh_command", {
              channel: (command) => Dice.admin.refresh(this.client, command)
            }),
            /* Admin update command */
            new Command("dice_admin_update_command", {
              channel: (command) => Dice.admin.update(this.client, command)
            })
          ]
        )
      ])
    ]);
  };

  /**
   * Handle WOLF client ready event.
   * Schedules hourly job to leave inactive channels and registers game update timer.
   * @private
   * @returns {Promise<void>}
   */
  async _onReady() {
    scheduleJob("0 * * * *", async () => leaveInactiveChannels(this.client, 5));

    const UpdateTimer = createUpdateTimer(this.game);
    await this.client.utility.timer.register({ UpdateTimer });
  }

  /**
   * Get list of channels this bot account is a member of.
   * @returns {Promise<import('wolf.js').Response<Array<import('wolf.js').ChannelExtended>>>} List of channels
   */
  async channels() {
    return this.client.channel.list();
  }

  /**
   * Handle bot joining a channel event.
   * Records the channel's last active timestamp in the database.
   * @private
   * @param {import('wolf.js').ChannelExtended} channel - The channel that was joined
   * @returns {Promise<void>}
   */
  async _onJoinedChannel(channel) {
    await setLastActive(channel.id);
  }

  /**
   * Handle bot leaving a channel event.
   * Removes the channel from the active tracking database.
   * @private
   * @param {import('wolf.js').ChannelExtended} channel - The channel that was left
   * @returns {Promise<void>}
   */
  async _onLeftChannel(channel) {
    await deleteChannel(channel.id);
  }

  /**
   * Handle successful login event.
   * @private
   * @param {import('wolf.js').Subscriber} subscriber - The logged-in subscriber
   * @returns {void}
   */
  _onLoginSuccess(subscriber) {
    logger.info("Bot logged in successfully", {
      subscriberId: subscriber.id,
      nickname: subscriber.nickname
    });
  }

  /**
   * Handle failed login event.
   * @private
   * @param {Error} error - The login error
   * @returns {void}
   */
  _onLoginFailed(error) {
    logger.error("Bot login failed", {
      error: error.message
    });
  }
}

export default DiceClient;
