module.exports = {
  apps: [{
    name: 'chat-app',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Restart settings
    min_uptime: '60s',
    max_restarts: 10,
    autorestart: true,
    // Memory settings
    max_memory_restart: '1G',
    // Watch for changes in development
    watch: process.env.NODE_ENV === 'development',
    ignore_watch: ['node_modules', 'logs', 'data'],
  }]
};