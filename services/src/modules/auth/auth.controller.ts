import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../lib/auth.js';
import { Request, Response } from 'express';
import { ApiResponse } from '../../types/common.types.js';

export const getUserSession = async (request: Request, response: Response) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    const body: ApiResponse<{
      session: typeof session;
    }> = {
      success: true,
      message: 'Session fetched successfuly',
      data: {
        session,
      },
    };

    return response.json(body);
  } catch (error) {
    console.error('Get session error:', error);
    return response.status(500).json({
      message: 'Failed to get session',
    });
  }
};
