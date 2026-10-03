const env = require('./config/env');
const { createApp } = require('./app');

const server = createApp().listen(env.port, () => console.log(`[monolith] listening on ${env.port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
