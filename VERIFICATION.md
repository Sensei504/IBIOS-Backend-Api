# Backend Verification Status

This repository includes static source and unit/schema tests. The GitHub uploader creates a source tree commit; it does not run the application or contact the configured Neon/Upstash services.

## Required CI checks
- `npm install` (generate and commit `package-lock.json`, then prefer `npm ci` for reproducible releases)
- `npm run typecheck`
- `npm test`
- `npm run db:push` against a disposable PostgreSQL test database
- `npm run build`
- Registration schema checks ensure public sign-up accepts only student/faculty roles and rejects privileged or extra fields.

## Deployment acceptance still required
A successful production build, live PostgreSQL and Redis/Upstash integration, session refresh/revocation tests, admin/super-admin permission tests, migration/backup-restore rehearsal, vulnerability scanning, HTTPS configuration, audit log review, load testing, and institutional privacy/security approval. Do not treat static source review as a production certification.
