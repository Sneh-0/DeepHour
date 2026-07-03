import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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
