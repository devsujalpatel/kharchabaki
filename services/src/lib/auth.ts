import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';

import { db } from '../database/client.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  // OAuth only
  // emailAndPassword is disabled by default.

  socialProviders: {
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    },
  },

  // Add your frontend origin if it is hosted separately.
  trustedOrigins: [process.env.FRONTEND_URL_WEB!, process.env.FRONTEND_URL_APP!],
});
