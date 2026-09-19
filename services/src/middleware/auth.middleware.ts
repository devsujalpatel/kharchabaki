import { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/auth.js';
import { ApiError } from '../utils/api-error.js';
import { fromNodeHeaders } from 'better-auth/node';

export const checkAuth = async (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  try {
    console.log('CHECK AUTH HIT');
    console.log('COOKIE:', request.headers.cookie);

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    console.log('SESSION:', session);

    if (!session) {
      throw new ApiError(401, 'Unauthorized');
    }

    request.auth = session.user;
    request.session = session.session;

    next();
  } catch (error) {
    console.error('CHECK AUTH ERROR:', error);
    next(error);
  }
};
