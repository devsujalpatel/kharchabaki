import { drizzle } from 'drizzle-orm/neon-http';
import { Pool, neonConfig, neon } from '@neondatabase/serverless';
import * as schema from './schema.js';
import ws from 'ws';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  allowExitOnIdle: false,
  max: 20, // Adjust based on your Neon plan
  idleTimeoutMillis: 30000,
});

// Handle pool errors
pool.on('error', (err: unknown) => {
  console.error('Unexpected pool error:', err);
});
