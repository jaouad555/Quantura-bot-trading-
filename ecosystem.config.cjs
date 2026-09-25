module.exports = {
  apps: [
    {
      name: 'quantura-bot',
      script: 'server.ts',
      interpreter: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
