import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // give cold starts room to finish
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

// Retry the first connect if it lands mid cold-start
async function connectWithRetry(retries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

connectWithRetry().catch((err) =>
  console.error('Initial DB connection failed after retries', err)
);

export const db = drizzle(pool, { schema });