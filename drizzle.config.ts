import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envFile = resolve(process.cwd(), '.env');
const exampleFile = resolve(process.cwd(), '.env.example');
if (existsSync(envFile)) dotenv.config({ path: envFile });
else if (process.env.IBIOS_ENVIRONMENT !== 'production' && existsSync(exampleFile)) dotenv.config({ path: exampleFile });

const databaseUrl = process.env.MIGRATIONS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || process.env.IBIOS_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('Set DATABASE_URL (or MIGRATIONS_DATABASE_URL) in backend/.env before running Drizzle Kit.');

export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle', dbCredentials: { url: databaseUrl }, verbose: true, strict: true });
