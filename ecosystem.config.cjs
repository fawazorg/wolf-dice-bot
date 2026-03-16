module.exports = {
  apps: [
    {
      name: "Dice Bot",
      script: "src/main.js",
      cwd: __dirname,
      kill_timeout: 5000,
      wait_ready: false,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      node_args: "--max-old-space-size=512",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
