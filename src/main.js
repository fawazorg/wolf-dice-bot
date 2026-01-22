/**
 * @fileoverview Main entry point for the Wolf Dice Bot application.
 * Initializes multiple bot accounts and establishes database connection.
 * @module main
 */

import "dotenv/config";
import DiceClient from "./platform/DiceClient.js";
import("./storage/mongo/connection.js");

/**
 * Map of active bot clients, keyed by email address.
 * @type {Map<string, DiceClient>}
 */
const clients = new Map();

/**
 * Bot account credentials parsed from environment variable.
 * Format: "email1:password1:apikey1|email2:password2:apikey2"
 * @type {string[]}
 */
const accounts = process.env.ACCOUNTS.split("|");

/**
 * Initialize all bot accounts sequentially.
 * Creates a DiceClient for each account, registers commands,
 * and adds a 500ms delay between logins to prevent rate limiting.
 * @returns {Promise<void>}
 */
const main = async () => {
  await accounts.reduce(async (previousValue, account) => {
    await previousValue;

    const [email, password, apikey] = account.split(":");
    const client = new DiceClient(email, password, apikey);

    client.commandRegister();

    clients.set(email, client);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, Promise.resolve());

  return Promise.resolve();
};

main()
  .then()
  .catch((e) => console.log(e));

export default clients;
