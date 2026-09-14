import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import 'dotenv/config';

import { db } from '../database/client.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
  basePath: '/api/auth',
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  // OAuth only
  // emailAndPassword is disabled by default.

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // Add your frontend origin if it is hosted separately.
  trustedOrigins: [env.webUrl, env.appUrl],
});
