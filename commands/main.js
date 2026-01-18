/**
 * main command
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  return command.reply(
    client.phrase.getByCommandAndName(command, "dice_default_message").join("\n")
  );
};
