import mongoose from "mongoose";

mongoose.set({ strictQuery: false });

mongoose.connect(`mongodb://127.0.0.1:27018/${process.env.MONGO_DB_NAME}`, {
  user: process.env.MONGO_USER,
  pass: process.env.MONGO_PWD,
});

mongoose.Promise = global.Promise;

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("[*] Database is a live!");
});
