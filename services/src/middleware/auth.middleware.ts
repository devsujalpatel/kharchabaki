import { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/auth.js';
import { ApiError } from '../utils/api-error.js';
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { user } from '../database/schema.js';

export const checkAuth = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new ApiError(401, 'Unauthorized');
    }

    const expectedAccount = request.get('X-Account-ID');
    if (expectedAccount && expectedAccount !== session.user.id) {
      throw new ApiError(401, 'Account changed. Please sign in again.');
    }
    // Entitlement belongs to the authenticated database account, never a client
    // header/body or a potentially stale cached session claim.
    const [account] = await db
      .select({ isPremium: user.isPremium })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    if (!account) throw new ApiError(401, 'Unauthorized');
    request.auth = { ...session.user, isPremium: account.isPremium === true };
    request.session = session.session;

    next();
  } catch (error) {
    next(error);
  }
};
