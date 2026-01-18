import "dotenv/config";
import diceClient from "./diceClient.js";
import("./db.js");

const clients = new Map();
const accounts = process.env.ACCOUNTS.split("|");
const main = async () => {
  await accounts.reduce(async (previousValue, account) => {
    await previousValue;

    const client = new diceClient(account.split(":")[0], account.split(":")[1]);

    client.commandRegister();

    clients.set(account.split(":")[0], client);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, Promise.resolve());

  return Promise.resolve();
};

main()
  .then()
  .catch((e) => console.log(e));

export default clients;
