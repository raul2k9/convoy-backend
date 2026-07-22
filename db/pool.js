import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

let pool;

if (process.env.DATABASE_URL) {
  const { Pool } = pg;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
  });
} else {
  const dbPath = process.env.PGLITE_PATH || './data.db';
  const db = new PGlite(dbPath, { initialMemory: 128 * 1024 * 1024 });
  pool = {
    query: (text, params) => db.query(text, params),
    on: () => {},
    end: () => db.close()
  };
}

export default pool;
