import { buildServer } from './server.js';

// Vercel's Fastify adapter detects this file as the backend entrypoint.
// Calling listen() is required so Vercel can capture the server and route
// requests to it. Local development can continue using src/server.ts.
const app = await buildServer();
await app.listen({
  host: '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
});

export default app;
