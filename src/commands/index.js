const Default = require("./default");
const Balance = require("./balance");
const Show = require("./show");
const Create = require("./create");
const Join = require("./join");
const Help = require("./help");

const Commands = [Help, Balance, Show, Create, Join];

Default.children = Commands;

module.exports = Default;
