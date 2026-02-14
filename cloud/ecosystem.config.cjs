// PM2 Configuration for N2 Cloud Server
module.exports = {
    apps: [{
        name: 'n2-cloud',
        script: 'server.js',
        env: {
            NODE_ENV: 'production',
            PORT: 3500,
        },
        watch: false,
        max_memory_restart: '200M',
        log_file: './logs/n2-cloud.log',
        error_file: './logs/n2-cloud-error.log',
        out_file: './logs/n2-cloud-out.log',
        autorestart: true,
        max_restarts: 10,
        restart_delay: 3000,
    }]
};
