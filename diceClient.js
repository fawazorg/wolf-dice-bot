import { scheduleJob } from "node-schedule";
import { Command, OnlineState, WOLF } from "wolf.js";
import * as Dice from "./src/commands/index.js";
import { deleteGroup, setLastActive } from "./src/dice/active.js";
import { admins } from "./src/dice/data.js";
import { GameManager } from "./src/index.js";
import { leaveInactiveGroups } from "./src/jobs/active.js";
import { createUpdateTimer } from "./src/jobs/group.js";

class diceClient {
  constructor(email, password) {
    this.client = new WOLF();
    this.game = new GameManager(this.client, {
      maxPlayers: 16,
      timeToJoin: 30000,
      timeToChoice: 15000,
      admins,
      debug: true
    });
    this.client.login(email, password, "", OnlineState.ONLINE);
    this.client.on("ready", async () => this._onReady());
    this.client.on("loginSuccess", async (subscriber) => this._onLoginSuccess(subscriber));
    this.client.on("joinedGroup", async (group) => this._onJoinedGroup(group));
    this.client.on("leftGroup", (group) => this._onLeftGroup(group));
  }

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
          both: (command) => Dice.topPlayers(this.client, command)
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

  async _onReady() {
    scheduleJob("0 * * * *", async () => leaveInactiveGroups(this.client, 5));

    const UpdateTimer = createUpdateTimer(this.game);
    await this.client.utility.timer.register({ UpdateTimer });
  }

  async channels() {
    return this.client.channel.list();
  }

  async _onJoinedGroup(channel) {
    await setLastActive(channel.id);
  }

  async _onLeftGroup(channel) {
    await deleteGroup(channel.id);
  }

  _onLoginSuccess(subscriber) {
    console.log(`[*] ${this.client.config.keyword} (${subscriber.id}) start.`);
  }
}

export default diceClient;
