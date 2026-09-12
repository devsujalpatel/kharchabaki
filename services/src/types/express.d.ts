declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId?: string;
        role: 'admin' | 'user';
        accountExists: boolean;
        isOnboarded: boolean;
      };
    }
  }
}

export {};
