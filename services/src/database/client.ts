import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';
import { env } from '../config/env.js';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: env.databaseUrl,
});

export const db = drizzle(pool, { schema });
