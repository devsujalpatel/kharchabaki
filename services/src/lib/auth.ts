import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import 'dotenv/config';

import * as schema from '../database/schema.js';
import { db } from '../database/client.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
  basePath: '/api/auth',

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  plugins: [admin()],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  trustedOrigins: [env.webUrl, env.appUrl],
});
