/**
 * @fileoverview Admin join command handler.
 * Handles the `!dice admin join <channelId>` command to make the bot join a specific channel.
 * Validates the channel isn't already managed by another bot instance and logs the action.
 * @module commands/admin/join
 */

// ... imports
import { Validator } from "wolf.js";
import { isAuthorizedAdmin } from "../../utils/authorization.js";
import { getAdminChannelId } from "../../utils/config.js";
import accounts from "../../main.js";

/**
 * Find the bot account with the fewest channels.
 * @returns {Promise<Object>} The selected bot account
 */
const getLeastBusyAccount = async () => {
  const accountList = Array.from(accounts.values());
  let minChannelCount = Infinity;
  let selectedAccount = null;

  for (const account of accountList) {
    const channelCount = (await account.channels()).length;

    if (channelCount < minChannelCount) {
      selectedAccount = account;
      minChannelCount = channelCount;
    }
  }

  return selectedAccount;
};

/**
 * Validate the channel ID from command arguments.
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<boolean>}
 */
const validateChannelId = async (client, command) => {
  const channelId = client.utility.number.toEnglishNumbers(command.argument);

  if (Validator.isValidNumber(channelId, false)) {
    return Promise.resolve(true);
  } else {
    await command.reply(client.phrase.getByCommandAndName(command, "error_admin")[9]);
    return Promise.resolve(false);
  }
};

/**
 * Check if the channel is already joined by any bot instance.
 * @param {number} channelId
 * @returns {Promise<Object|undefined>} The existing channel object if found
 */
const isChannelJoined = async (channelId) => {
  const accountList = Array.from(accounts.values());
  const allChannels = [];

  for (const account of accountList) {
    allChannels.push(...(await account.channels()));
  }

  return allChannels.find((i) => i.id === channelId);
};

/**
 * Join command handler.
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  if (!isAuthorizedAdmin(client, command.sourceSubscriberId)) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_admin_unauthorized");
    return command.reply(phrase);
  }

  const isValidId = await validateChannelId(client, command);

  if (!isValidId) {
    return Promise.resolve();
  }

  const targetChannelId = parseInt(client.utility.number.toEnglishNumbers(command.argument));

  const existingChannel = await isChannelJoined(targetChannelId);

  const phrase = client.phrase.getByCommandAndName(command, "dice_message_admin_join");

  if (existingChannel !== undefined) {
    return command.reply(phrase.find((err) => err.code === 403 && err?.subCode === 110).msg);
  }

  const selectedAccount = await getLeastBusyAccount();
  const res = await selectedAccount.client.channel.joinById(targetChannelId);
  const text = phrase.find((err) => err.code === res.code && err?.subCode === res.headers?.subCode);

  if (!text) {
    return command.reply(
      `An error occurred: ${res.code}${res.headers?.subCode ? ` (SubCode: ${res.headers.subCode})` : ""}`
    );
  }

  await command.reply(text.msg);

  // log message
  if (res.code === 200) {
    const logPhrase = client.phrase.getByCommandAndName(command, "dice_message_admin_join_log");
    const adminUser = await client.subscriber.getById(command.sourceSubscriberId);
    const channel = await client.channel.getById(targetChannelId);

    const content = client.utility.string.replace(logPhrase, {
      adminNickname: adminUser.nickname,
      adminID: adminUser.id,
      channelName: channel.name,
      channelID: channel.id
    });

    const adminChannelId = getAdminChannelId(client);
    if (adminChannelId) {
      return selectedAccount.client.messaging.sendGroupMessage(adminChannelId, content);
    }
  }
};
