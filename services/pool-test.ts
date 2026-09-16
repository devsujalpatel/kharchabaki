// pool-test.ts
import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

pool.on('error', (error: unknown) => {
  console.error('POOL EVENT ERROR:', error);
});

try {
  console.log('Running pool query...');

  const result = await pool.query('SELECT NOW() AS now');

  console.log('POOL CONNECTED:', result.rows);
} catch (error) {
  console.error('POOL QUERY ERROR:', error);
} finally {
  await pool.end();
}
