import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';

export const checkPremium = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  if (!request.auth) return next(new ApiError(401, 'Unauthorized'));
  if (request.auth.isPremium !== true) {
    return next(new ApiError(403, 'Premium is required for cloud sync.'));
  }
  next();
};
