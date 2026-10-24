# IBIOS MDC — Backend API

Fastify + TypeScript API for the Issue-Based Information Online System at Metro Dagupan Colleges. This repository contains **only the backend**. The React/Vite application is kept in a separate repository. No Python runtime is used.

## Requirements

- Node.js 24 LTS and npm
- PostgreSQL (Neon supported through `DATABASE_URL`)
- One shared rate-limit store for production: native Redis URL or Upstash Redis REST

## Configure environment

The backend automatically loads `.env` from the repository root; in non-production mode, it falls back to `.env.example` if `.env` is absent. These are local placeholders only. For production, provide real environment variables/secret-manager values and set `IBIOS_ENVIRONMENT=production`.

### PostgreSQL / Neon

Set the full PostgreSQL URL in `.env` or deployment environment. Use a pooled URL for the running API and (if needed) a direct URL for Drizzle schema operations.

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@YOUR-NEON-POOLER-HOST/DB?sslmode=require&channel_binding=require"
MIGRATIONS_DATABASE_URL="postgresql://USER:PASSWORD@YOUR-NEON-DIRECT-HOST/DB?sslmode=require&channel_binding=require"
```

Replace all placeholders with values from the provider console. URL-encode reserved characters in passwords. `MIGRATIONS_DATABASE_URL` is optional; Drizzle Kit prefers it when set.

### Redis / Upstash

Choose one supported mode:

```dotenv
REDIS_URL="rediss://default:YOUR_PASSWORD@YOUR-REDIS-HOST:6379"
UPSTASH_REDIS_REST_URL="https://YOUR-DATABASE.upstash.io"
UPSTASH_REDIS_REST_TOKEN="YOUR_REST_TOKEN"
```

Upstash REST mode takes precedence when both REST variables are set. Keep every credential server-side; never put these values in the frontend repository or any `VITE_*` variable. Production requires a shared Redis-compatible rate-limit store.

## Run the API directly with npm (no Docker required for the API)

```bash
npm install
npm run db:push
npm run bootstrap-super-admin:dev
npm start
```

- `npm run db:push` syncs the Drizzle schema to your configured development database.
- `npm run bootstrap-super-admin:dev` prompts for and creates the **one and only** initial super administrator. It is allowed only when no user account exists. Do not run it after provisioning.
- `npm start` runs the Fastify TypeScript server directly; Docker is not required for the API process.
- API base: `http://127.0.0.1:8000`; dev OpenAPI docs: `http://127.0.0.1:8000/docs`; liveness: `/health/live`; readiness: `/api/v1/health/ready`.

The backend can use locally installed services or managed providers. Docker is optional and can start only PostgreSQL + Redis:

```bash
docker compose -f docker-compose.dev-infra.yml up -d
```

## Accounts and authorization

Public registration is disabled. `POST /api/v1/auth/register` returns `403`. The bootstrap command is a one-time operation, guarded by a PostgreSQL partial unique index on the `super_admin` role. The super administrator can create multiple administrator accounts in the admin interface; ordinary admins can provision student, faculty, and staff accounts but cannot promote themselves or anyone else to admin.

## Drizzle commands

| Command | Purpose |
|---|---|
| `npm run db:push` | Fast development schema sync; use carefully on shared databases |
| `npm run db:generate` | Generate versioned SQL migrations from schema changes |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run typecheck` | Run TypeScript typecheck |
| `npm test` | Run unit and utility tests |
| `npm run build` | Compile the production server and CLI |

Use `db:push` primarily for development. For production, review and commit migrations, then use `db:migrate`. Do not mix the legacy `schema_migrations` history and Drizzle Kit migration history without a plan.

## Features

- Argon2id password hashing, short-lived access tokens, rotating refresh sessions and revocation
- Campus issue reporting, categories, priorities, status lifecycle, IBIS positions, pro/con arguments, voting and accepted solutions
- Campus Pulse threads, replies, reactions, reporting and moderation
- Private case conversations, admin-only internal notes and notifications
- Admin KPIs, people/access management, moderation queue and audit logs
- CSV import/export, JSON issue snapshots, formula-neutralized CSV output
- Fastify/Zod validation, access controls, security headers, rate limiting, health checks and development OpenAPI docs

See [Scope and Delimitations](./SCOPE-AND-DELIMITATIONS.md) and [Verification](./VERIFICATION.md). Production release gates include dependency-resolved typecheck/build, database/Redis integration tests, migrations and restore tests, security/privacy review, and load testing.
