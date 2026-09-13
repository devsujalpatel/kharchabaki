import * as schema from './schema.js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import {Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
