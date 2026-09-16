import 'dotenv/config';

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 4000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a integer between 1 and 65535.');
  }
  return port;
};

export const env = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  googleClientId: process.env.GOOGLE_CLIENT_ID as string,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  webUrl: process.env.FRONTEND_URL_WEB as string,
  appUrl: process.env.FRONTEND_URL_APP as string,
  betterAuthUrl: process.env.BETTER_AUTH_URL as string,
} as const;
