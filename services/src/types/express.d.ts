import type { Session, User } from 'better-auth/types';

declare global {
  namespace Express {
    interface Request {
      auth?: User & { isPremium: boolean };
      session?: Session;
    }
  }
}

export {};
