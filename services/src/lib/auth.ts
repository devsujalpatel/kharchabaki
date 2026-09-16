import { betterAuth } from 'better-auth';
// import { admin } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import 'dotenv/config';

import * as schema from '../database/schema.js';
import { db } from '../database/client.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  advanced: {
    database: { joins: false },
  },
  baseURL: process.env.BETTER_AUTH_URL!,
  basePath: '/api/auth',

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  trustedOrigins: [env.webUrl, env.appUrl],
});
