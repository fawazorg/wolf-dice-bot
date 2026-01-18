import { Privilege } from "wolf.js";
/**
 * cancel command
 * @param {import('wolf.js').WOLF} api
 * @param {import('wolf.js').CommandContext} command
 * @param {import('../dice/game.js').default} game
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (api, command, game) => {
  const IsVolunteer = await api
    .utility()
    .subscriber()
    .privilege()
    .has(command.sourceSubscriberId, Privilege.VOLUNTEER);
  const Group = await api.group().getById(command.targetChannelId);
  const IsGroupOwner = Group.owner.id === command.sourceSubscriberId;
  const okay = IsVolunteer || IsGroupOwner;
  if (!okay) {
    const phrase = api.phrase().getByCommandAndName(command, "dice_message_cancel_no_permission");

    return command.reply(phrase);
  }
  await game.remove(command);
};
