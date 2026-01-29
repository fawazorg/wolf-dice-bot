module.exports = {
  apps: [
    {
      name: "Dice Bot",
      script: "pnpm run start",
      cwd: __dirname,
      kill_timeout: 5000,
      wait_ready: false,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
