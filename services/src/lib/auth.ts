import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import 'dotenv/config';

import * as schema from '../database/schema.js';
import { db } from '../database/client.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
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

  trustedOrigins: [
    'https://kharchabaki.onrender.com',
    'https://kharchabaki.vercel.app',
    env.appUrl,
    env.webUrl,
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: env.nodeEnv === 'production',
      httpOnly: env.nodeEnv === 'production',
    },
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip"]
    }
  },
});
