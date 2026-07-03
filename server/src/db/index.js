import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Return SQL DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date
// objects. A DATE has no time or timezone; letting pg promote it to a Date
// object shifts it by the server's timezone and serializes as a misleading
// timestamp (e.g. '2026-06-26T18:30:00.000Z' for 2026-06-27 in IST).
// 1082 is Postgres's internal OID for the DATE type.
pg.types.setTypeParser(1082, (value) => value);

const common = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

// Prefer DATABASE_URL (e.g. Supabase); fall back to discrete DB_* vars for local Postgres
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Supabase pooler requires SSL
      ...common,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'deep_work_tracker',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ...common,
    });

pool.on('error', (err) => {
  // Errors on idle clients (e.g. DB restart) — log, don't crash
  console.error('Unexpected error on idle Postgres client:', err.message);
});

// Single entry point for parameterized queries: query('SELECT ... WHERE id = $1', [id])
export const query = (text, params) => pool.query(text, params);

export default pool;
