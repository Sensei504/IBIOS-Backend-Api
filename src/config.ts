import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const localEnvPath = resolve(process.cwd(), '.env');
const exampleEnvPath = resolve(process.cwd(), '.env.example');
if (existsSync(localEnvPath)) dotenv.config({ path: localEnvPath });
else if (process.env.VERCEL !== '1' && existsSync(exampleEnvPath)) dotenv.config({ path: exampleEnvPath });

function parseStringArray(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed;
  } catch {
    // Comma-separated values are also supported.
  }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

function normalizeHostname(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const candidate = value.trim();
    return new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.origin === 'null' || url.username || url.password) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL);
const environment = isVercelRuntime ? 'production' : (process.env.IBIOS_ENVIRONMENT ?? 'development');
const isProduction = environment === 'production';
const secret = process.env.IBIOS_SECRET_KEY?.trim() ?? '';
const secretKeyConfigured = secret.length >= 48 && !/development|local-only|change-before-deploy|example/i.test(secret);
const startupConfigurationIssues: string[] = [];

if (isProduction && !secretKeyConfigured) {
  startupConfigurationIssues.push('IBIOS_SECRET_KEY must be a unique random secret of at least 48 characters; authentication will be disabled until configured.');
}

const accessTokenParsed = z.coerce.number().int().min(1).max(60).safeParse(process.env.IBIOS_ACCESS_TOKEN_MINUTES ?? '15');
const refreshTokenParsed = z.coerce.number().int().min(1).max(90).safeParse(process.env.IBIOS_REFRESH_TOKEN_DAYS ?? '14');
if (!accessTokenParsed.success) startupConfigurationIssues.push('IBIOS_ACCESS_TOKEN_MINUTES must be between 1 and 60; the default is being used.');
if (!refreshTokenParsed.success) startupConfigurationIssues.push('IBIOS_REFRESH_TOKEN_DAYS must be between 1 and 90; the default is being used.');

const portParsed = z.coerce.number().int().min(1).max(65535).safeParse(process.env.IBIOS_API_PORT ?? '8000');
const logLevelParsed = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).safeParse(process.env.IBIOS_LOG_LEVEL?.toLowerCase() ?? 'info');
const tokenMinutes = accessTokenParsed.success ? accessTokenParsed.data : 15;
const refreshDays = refreshTokenParsed.success ? refreshTokenParsed.data : 14;
const port = portParsed.success ? portParsed.data : 8000;
const logLevel = logLevelParsed.success ? logLevelParsed.data : 'info';
if (!portParsed.success) startupConfigurationIssues.push('IBIOS_API_PORT is invalid; the default port is being used.');
if (!logLevelParsed.success) startupConfigurationIssues.push('IBIOS_LOG_LEVEL is invalid; the info level is being used.');

const rawCorsOrigins = parseStringArray(
  process.env.IBIOS_CORS_ORIGINS,
  isProduction ? [] : ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:5173'],
);
const corsOrigins = rawCorsOrigins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin));
if (isProduction && (!process.env.IBIOS_CORS_ORIGINS?.trim() || corsOrigins.length !== rawCorsOrigins.length)) {
  startupConfigurationIssues.push('IBIOS_CORS_ORIGINS must contain the exact HTTPS frontend origin(s). Cross-origin browser requests will be denied until configured.');
}

const vercelAllowedHosts = [...new Set([
  normalizeHostname(process.env.VERCEL_URL),
  normalizeHostname(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  normalizeHostname(process.env.VERCEL_BRANCH_URL),
].filter((host): host is string => Boolean(host)))];
const rawAllowedHosts = parseStringArray(
  process.env.IBIOS_ALLOWED_HOSTS,
  vercelAllowedHosts.length ? vercelAllowedHosts : (isProduction ? ['ibios-backend-api.vercel.app'] : ['localhost', '127.0.0.1', 'web', 'api']),
);
let allowedHosts = rawAllowedHosts
  .map((host) => normalizeHostname(host))
  .filter((host): host is string => Boolean(host));
if (isProduction) {
  const filteredHosts = allowedHosts.filter((host) => !['localhost', '127.0.0.1'].includes(host) && host !== '*');
  if (filteredHosts.length !== allowedHosts.length) startupConfigurationIssues.push('IBIOS_ALLOWED_HOSTS included a local or wildcard host, which has been removed.');
  allowedHosts = filteredHosts;
}
if (!allowedHosts.length) {
  allowedHosts = vercelAllowedHosts.length ? vercelAllowedHosts : (isProduction ? ['ibios-backend-api.vercel.app'] : ['localhost', '127.0.0.1']);
  startupConfigurationIssues.push('IBIOS_ALLOWED_HOSTS was empty or invalid; a safe fallback hostname allowlist is being used.');
}

const databaseUrlFromEnv = process.env.DATABASE_URL?.trim() || process.env.IBIOS_DATABASE_URL?.trim() || '';
if (isProduction && !databaseUrlFromEnv) startupConfigurationIssues.push('DATABASE_URL is not configured; database-backed API endpoints will return 503.');
// Keep the Pool constructor valid even when production DATABASE_URL is missing.\n// Database-backed routes are gated by databaseConfigured and readiness reports 503.\nconst databaseUrl = databaseUrlFromEnv || 'postgresql://ibios:ibios-local-dev-postgres-password@127.0.0.1:5432/ibios';
const migrationDatabaseUrl = process.env.MIGRATIONS_DATABASE_URL?.trim() || '';

const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? '';
const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '';
const redisUrl = process.env.IBIOS_RATE_LIMIT_STORAGE_URI?.trim() || process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim() || '';
const hasUpstashRest = Boolean(upstashRedisRestUrl && upstashRedisRestToken);
const hasNativeRedisUrl = /^rediss?:\/\//i.test(redisUrl);
if (Boolean(upstashRedisRestUrl) !== Boolean(upstashRedisRestToken)) {
  startupConfigurationIssues.push('Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither.');
}
if (upstashRedisRestUrl) {
  try {
    if (new URL(upstashRedisRestUrl).protocol !== 'https:') throw new Error('not https');
  } catch {
    startupConfigurationIssues.push('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL.');
  }
}
if (isProduction && !hasNativeRedisUrl && !hasUpstashRest) {
  startupConfigurationIssues.push('Production requires REDIS_URL or both Upstash REST credentials; rate-limited authentication endpoints will return 503.');
}

const cookieSameSiteValue = process.env.IBIOS_COOKIE_SAMESITE ?? 'lax';
const cookieSameSite = ['lax', 'strict', 'none'].includes(cookieSameSiteValue)
  ? cookieSameSiteValue as 'lax' | 'strict' | 'none'
  : 'lax';
if (!['lax', 'strict', 'none'].includes(cookieSameSiteValue)) startupConfigurationIssues.push('IBIOS_COOKIE_SAMESITE is invalid; lax is being used.');
const cookieSecure = isProduction || process.env.IBIOS_COOKIE_SECURE === 'true';
if (isProduction && process.env.IBIOS_COOKIE_SECURE === 'false') {
  startupConfigurationIssues.push('IBIOS_COOKIE_SECURE=false is ignored in production; secure cookies are enforced.');
}
if (cookieSameSite === 'none' && !cookieSecure) {
  startupConfigurationIssues.push('SameSite=None requires secure cookies; lax is being used.');
}

export const config = {
  environment,
  isProduction,
  isVercelRuntime,
  startupConfigurationIssues,
  secretKeyConfigured,
  databaseConfigured: Boolean(databaseUrlFromEnv),
  redisConfigured: hasNativeRedisUrl || hasUpstashRest,
  port,
  host: process.env.IBIOS_API_HOST ?? '0.0.0.0',
  databaseUrl,
  migrationDatabaseUrl,
  secretKey: secret || 'local-development-secret-not-for-production-000000000000000000000000',
  accessTokenMinutes: tokenMinutes,
  refreshTokenDays: refreshDays,
  cookieSecure,
  cookieSameSite: cookieSameSite === 'none' && !cookieSecure ? 'lax' as const : cookieSameSite,
  corsOrigins,
  allowedHosts,
  upstashRedisRestUrl,
  upstashRedisRestToken,
  redisUrl,
  trustProxy: (process.env.IBIOS_TRUST_PROXY_HEADERS ?? 'false') === 'true',
  logLevel,
  apiPrefix: '/api/v1',
  refreshCookieName: 'ibios_refresh',
  allowedRoles: ['student', 'faculty', 'staff', 'admin', 'super_admin'] as const,
  allowedStatuses: ['Open', 'Under Discussion', 'Resolved', 'Closed'] as const,
  allowedPriorities: ['Low', 'Medium', 'High', 'Critical'] as const,
  allowedCategories: ['Academics', 'Facilities', 'IT & Internet', 'Student Services', 'Enrollment & Registrar', 'Safety & Security', 'Finance', 'Other'] as const,
};
