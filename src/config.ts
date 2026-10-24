import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
const localEnvPath = resolve(process.cwd(), '.env');
const exampleEnvPath = resolve(process.cwd(), '.env.example');
if (existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });
else if (process.env.IBIOS_ENVIRONMENT !== 'production' && existsSync(exampleEnvPath)) dotenv.config({ path: exampleEnvPath });
function parseStringArray(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed; } catch { /* comma-separated overrides */ }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}
const environment = process.env.IBIOS_ENVIRONMENT ?? 'development';
const secret = process.env.IBIOS_SECRET_KEY ?? '';
if (environment === 'production' && (secret.length < 48 || /development|local-only|change-before-deploy|example/i.test(secret))) throw new Error('IBIOS_SECRET_KEY must be a unique random secret of at least 48 characters in production.');
const portParsed = z.coerce.number().int().min(1).max(65535).default(8000).safeParse(process.env.IBIOS_API_PORT ?? '8000');
if (!portParsed.success) throw new Error('IBIOS_API_PORT must be a valid TCP port.');
const logLevelParsed = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info').safeParse(process.env.IBIOS_LOG_LEVEL?.toLowerCase() ?? 'info');
if (!logLevelParsed.success) throw new Error('IBIOS_LOG_LEVEL must be fatal, error, warn, trace, or silent.');
export const config = {
  environment, isProduction: environment === 'production', port: portParsed.data, host: process.env.IBIOS_API_HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL?.trim() || process.env.IBIOS_DATABASE_URL?.trim() || 'postgresql://ibios:ibios-local-dev-postgres-password@127.0.0.1:5432/ibios',
  migrationDatabaseUrl: process.env.MIGRATIONS_DATABASE_URL?.trim() || '',
  secretKey: secret || 'local-development-secret-not-for-production-000000000000000000000000',
  accessTokenMinutes: Number(process.env.IBIOS_ACCESS_TOKEN_MINUTES ?? 15), refreshTokenDays: Number(process.env.IBIOS_REFRESH_TOKEN_DAYS ?? 14),
  cookieSecure: (process.env.IBIOS_COOKIE_SECURE ?? (environment === 'production' ? 'true' : 'false')) === 'true',
  cookieSameSite: (process.env.IBIOS_COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  corsOrigins: parseStringArray(process.env.IBIOS_CORS_ORIGINS, ['http://localhost:8080', 'http://localhost:5173']),
  allowedHosts: parseStringArray(process.env.IBIOS_ALLOWED_HOSTS, ['localhost', '127.0.0.1', 'web', 'api']),
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL?.trim() ?? '', upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '',
  redisUrl: process.env.IBIOS_RATE_LIMIT_STORAGE_URI?.trim() || process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim() || '',
  trustProxy: (process.env.IBIOS_TRUST_PROXY_HEADERS ?? 'false') === 'true', logLevel: logLevelParsed.data, apiPrefix: '/api/v1', refreshCookieName: 'ibios_refresh',
  allowedRoles: ['student', 'faculty', 'staff', 'admin', 'super_admin'] as const, allowedStatuses: ['Open', 'Under Discussion', 'Resolved', 'Closed'] as const,
  allowedPriorities: ['Low', 'Medium', 'High', 'Critical'] as const,
  allowedCategories: ['Academics', 'Facilities', 'IT & Internet', 'Student Services', 'Enrollment & Registrar', 'Safety & Security', 'Finance', 'Other'] as const,
};
if (!Number.isFinite(config.accessTokenMinutes) || config.accessTokenMinutes < 1 || config.accessTokenMinutes > 60) throw new Error('IBIOS_ACCESS_TOKEN_MINUTES must be between 1 and 60.');
if (!Number.isFinite(config.refreshTokenDays) || config.refreshTokenDays < 1 || config.refreshTokenDays > 90) throw new Error('IBIOS_REFRESH_TOKEN_DAYS must be between 1 and 90.');
if (config.cookieSameSite === 'none' && !config.cookieSecure) throw new Error('SameSite=None requires IBIOS_COOKIE_SECURE=true.');
if (config.isProduction && !config.cookieSecure) throw new Error('Production requires IBIOS_COOKIE_SECURE=true.');
if (config.isProduction && config.allowedHosts.some((host) => ['localhost', '127.0.0.1'].includes(host))) throw new Error('Production IBIOS_ALLOWED_HOSTS must not contain local development hostnames.');
if (config.isProduction && config.corsOrigins.some((origin) => origin === '*' || origin.includes('localhost') || origin.includes('127.0.0.1'))) throw new Error('Production IBIOS_CORS_ORIGINS must use the deployed frontend origin and may not contain wildcards.');
if (config.isProduction && config.allowedHosts.includes('*')) throw new Error('Production IBIOS_ALLOWED_HOSTS may not contain wildcard hosts.');
if (!['lax', 'strict', 'none'].includes(config.cookieSameSite)) throw new Error('IBIOS_COOKIE_SAMESITE must be lax, strict, or none.');
const hasUpstashRest = Boolean(config.upstashRedisRestUrl && config.upstashRedisRestToken);
const hasNativeRedisUrl = /^rediss?:\/\//i.test(config.redisUrl);
if (Boolean(config.upstashRedisRestUrl) !== Boolean(config.upstashRedisRestToken)) throw new Error('Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or leave both unset.');
if (config.upstashRedisRestUrl) { try { if (new URL(config.upstashRedisRestUrl).protocol !== 'https:') throw new Error('not https'); } catch { throw new Error('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL.'); } }
if (config.isProduction && !hasNativeRedisUrl && !hasUpstashRest) throw new Error('Production requires Redis-backed rate limiting. Set REDIS_URL or both Upstash REST credentials.');
