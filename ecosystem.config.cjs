module.exports = {
  apps: [{
    name: 'muestreo-estadistico',
    cwd: '/home/deploy/muestreo-estadistico',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    error_file: '/home/deploy/logs/muestreo-estadistico-error.log',
    out_file: '/home/deploy/logs/muestreo-estadistico-out.log',
    time: true
  }]
};
