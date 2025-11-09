import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 5438),
  user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
  database: process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? 'study_platform',
  max: 10,
  idleTimeoutMillis: 30_000,
});

export function getPool(): Pool {
  return pool;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}


