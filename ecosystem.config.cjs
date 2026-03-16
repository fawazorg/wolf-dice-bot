module.exports = {
  apps: [
    {
      name: "Dice Bot",
      script: "main.js",
      cwd: require("path").join(__dirname, "src"),
      kill_timeout: 5000,
      wait_ready: false,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: "../.env"
      }
    }
  ]
};
