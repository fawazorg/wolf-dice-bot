/**
 * @fileoverview Default dice command handler.
 * Handles the base `!dice` command without subcommands.
 * @module commands/main
 */

/**
 * Handle the default dice command.
 * Displays the default help message when users type `!dice` without arguments.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with default message
 */
export default async (client, command) => {
  return command.reply(client.phrase.getByCommandAndName(command, "dice_default_message"));
};
