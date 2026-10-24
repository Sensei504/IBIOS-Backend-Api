import Fastify from 'fastify';
import { buildServer } from './server.js';

// Vercel detects this file as the application entrypoint and uses the exported
// Fastify instance to handle incoming requests. The CLI/local server still uses
// src/server.ts and its direct-execution listener.
const app = await buildServer();

export default app;

// Keep the framework import explicit for Vercel's framework detection.
void Fastify;
