import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../lib/auth.js';
import { Request, Response } from 'express';

export const getUserSession = async (request: Request, response: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    return response.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    return response.status(500).json({
      message: 'Failed to get session',
    });
  }
};
