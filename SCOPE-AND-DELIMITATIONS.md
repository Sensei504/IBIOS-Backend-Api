# IBIOS Backend — Scope and Delimitations

## Scope
The Fastify/TypeScript API provides login, refresh-session rotation, logout and password changes; Argon2id password hashing; role-enforced administration; issue reporting, issue status changes, proposals, arguments and votes; Campus Pulse threads, replies, reactions and moderation; private case conversations and notifications; dashboard summaries; account and issue CSV import/export; audit events; PostgreSQL persistence through Neon or compatible PostgreSQL; Redis rate limiting using native Redis or Upstash REST; Drizzle ORM schema and migration tooling.

## Roles
- `super_admin`: uniquely bootstrapped from a trusted operator shell when no super-admin exists; can create and manage multiple admin accounts and import account rosters.
- `admin`: manages ordinary accounts, issues, moderation, reports and exports; cannot create or promote admins.
- `faculty` / `staff`: handle issues and participate in authorized case work.
- `student`: submit and follow issues, take part in IBIS discussion and Campus Pulse.

## Delimitations
Public self-registration is available for student and faculty roles; faculty affiliation is self-selected and not independently verified in this release. No institutional SSO, WebSocket real-time chat, attachment storage, email/SMS delivery, SLA scheduler, or built-in identity verification service. REST polling powers conversations/notifications. Hosting, monitoring, backups, restore drills, privacy review, pen testing, and availability planning must be supplied and verified before institutional production use.

## Release gates
Run `npm install`, `npm run typecheck`, `npm test`, `npm run db:push` against a disposable development database, and `npm run build`. Review and commit generated Drizzle migrations for production; test with real PostgreSQL and Redis providers, restore a backup, verify role boundaries, rotate secrets, enable HTTPS, and complete load/security/privacy acceptance before handling real student data.
