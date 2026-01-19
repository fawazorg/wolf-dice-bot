import { Privilege } from "wolf.js";
/**
 * cancel command
 * @param {import('wolf.js').WOLF} api
 * @param {import('wolf.js').CommandContext} command
 * @param {import('../src/managers/GameManager.js').default} game
 * @returns {Promise<void>}
 */
export default async (api, command, game) => {
  const IsVolunteer = await api.utility.subscriber.privilege.has(
    command.sourceSubscriberId,
    Privilege.VOLUNTEER,
  );
  const Group = await api.channel.getById(command.targetChannelId);
  const IsGroupOwner = Group.owner.id === command.sourceSubscriberId;
  const okay = IsVolunteer || IsGroupOwner;
  if (!okay) {
    const phrase = api.phrase.getByCommandAndName(command, "dice_only_owner_message");

    return command.reply(phrase);
  }
  await game.remove(command);
};
