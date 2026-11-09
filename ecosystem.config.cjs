module.exports = {
  apps: [
    {
      name: "mediaflow-erp",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      ignore_watch: [
        "node_modules",
        "dist",
        "*.db",
        "*.db-wal",
        "*.db-shm",
        "mediaflow.db",
        "mediaflow.db-wal",
        "mediaflow.db-shm",
        ".git"
      ],
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
