/**
 * @fileoverview Help command handler.
 * Handles the `!dice help` command to display comprehensive game instructions.
 * Provides localized help text with all available commands and game rules.
 * @module commands/help
 */

/**
 * Handle the help command.
 * Displays detailed help information including all available dice commands,
 * game rules, and usage instructions in the user's preferred language.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with help message
 */
export default async (client, command) => {
  return command.reply(client.phrase.getByCommandAndName(command, 'dice_help_message').join('\n'));
};
