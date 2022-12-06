const Admin = require("./admin");
const Default = require("./default");
const Balance = require("./balance");
const Show = require("./show");
const Create = require("./create");
const Join = require("./join");
const Help = require("./help");
const Rank = require("./rank");
const Top = require("./topPlayers");
const Cancel = require("./cancel");
const Status = require("./status");

const Commands = [Help, Balance, Show, Create, Join, Rank, Top, Cancel, Status, Admin];

Default.children = Commands;

module.exports = Default;
