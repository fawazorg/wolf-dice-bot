console.log("======================= add user =======================");

db = db.getSiblingDB(process.env["MONGO_DB_NAME"]);

db.createUser({
  user: process.env["MONGO_USER"],
  pwd: process.env["MONGO_PWD"],
  roles: [
    {
      role: 'readWrite',
      db: process.env["MONGO_DB_NAME"],
    },
  ],
});

console.log("======================= end add user =======================")
