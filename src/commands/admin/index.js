const Default = require("./default");
const Help = require("./help");
const Refresh = require("./refresh");
const join = require("./join");
const Count = require("./count");

const commands = [join, Help, Refresh, Count];

Default.children = commands;

module.exports = Default;
