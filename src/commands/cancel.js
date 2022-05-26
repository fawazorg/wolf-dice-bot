const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_cancel_command`;
const COMMAND_NOT_AUTHORIZES = `${api.config.keyword}_only_owner_message`;

Cancel = async (api, command) => {
  const IsVolunteer = await api
    .utility()
    .subscriber()
    .privilege()
    .has(command.sourceSubscriberId, WOLF.Constants.Privilege.VOLUNTEER);
  const Group = await api.group().getById(command.targetGroupId);
  const IsGroupOwner = Group.owner.id === command.sourceSubscriberId;
  const okay = IsVolunteer || IsGroupOwner;
  if (!okay) {
    let phrase = api.phrase().getByCommandAndName(command, COMMAND_NOT_AUTHORIZES);
    return await api.messaging().sendMessage(command, phrase);
  }
  await await game.remove(command, command.argument);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Cancel(api, command),
});
