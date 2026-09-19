import { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../lib/auth.js';
import { ApiError } from '../../utils/api-error.js';
import { ApiResponse } from '../../types/common.types.js';

export const getUserSession = async (request: Request, response: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    throw new ApiError(401, 'Unauthorized');
  }

  const body: ApiResponse<{
    session: typeof session;
  }> = {
    success: true,
    message: 'Session fetched successfully',
    data: {
      session,
    },
  };

  return response.json(body);
};
