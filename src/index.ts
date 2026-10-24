// Keep the alternate recognized Vercel entrypoint bound to the same initialized server.
// src/server.ts owns Fastify setup and exports the underlying Node HTTP server.
export { default } from './server.js';
