const AdminJoin = require("./adminjoin");
const Default = require("./default");
const Balance = require("./balance");
const Show = require("./show");
const Create = require("./create");
const Join = require("./join");
const Help = require("./help");
const Rank = require("./rank");
const Top = require("./topPlayers");

const Commands = [Help, Balance, Show, Create, Join, Rank, Top, AdminJoin];

Default.children = Commands;

module.exports = Default;
