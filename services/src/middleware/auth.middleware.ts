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
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new ApiError(401, 'Unauthorized');
    }

    request.auth = session.user;
    request.session = session.session;

    next();
  } catch (error) {
    next(error);
  }
};
