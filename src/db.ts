import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from './config.js';
import { schema } from './db/schema.js';

const { Pool } = pg;
function createPool(connectionString: string, applicationName: string, max: number) {
  return new Pool({
    connectionString, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000, application_name: applicationName,
    enableChannelBinding: /[?&]channel_binding=require(?:&|$)/i.test(connectionString),
    ...(process.env.IBIOS_DATABASE_SSL === 'true' && !/[?&]sslmode=/i.test(connectionString) ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}
export const pool = createPool(config.databaseUrl, 'ibios-api', Number(process.env.IBIOS_DB_POOL_MAX ?? 10));
export const db = drizzle({ client: pool, schema });
export const migrationPool = config.migrationDatabaseUrl ? createPool(config.migrationDatabaseUrl, 'ibios-migrate', 1) : pool;
pool.on('error', (error) => console.error(JSON.stringify({ level: 'error', message: 'Unexpected idle PostgreSQL client error', error: error.message })));
if (migrationPool !== pool) migrationPool.on('error', (error) => console.error(JSON.stringify({ level: 'error', message: 'Unexpected idle migration PostgreSQL client error', error: error.message })));
export type DbClient = pg.PoolClient;
export async function inTransaction<T>(work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}
export async function closeDatabase(): Promise<void> { if (migrationPool !== pool) await migrationPool.end(); await pool.end(); }
