import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { PublicUser } from './security.js';
export async function audit(client: pg.Pool | pg.PoolClient, request: FastifyRequest, actor: PublicUser | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}): Promise<void> {
 await client.query(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [randomUUID(), actor?.id ?? null, action, entityType, entityId, JSON.stringify(details), request.ip?.slice(0, 64) ?? null, request.headers['user-agent']?.slice(0, 500) ?? null]);
}
