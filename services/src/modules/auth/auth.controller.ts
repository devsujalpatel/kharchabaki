import { Request, Response } from 'express';
import { ApiError } from '../../utils/api-error.js';
import { ApiResponse } from '../../types/common.types.js';

export const getUserSession = async (request: Request, response: Response) => {
  if (!request.auth || !request.session) {
    throw new ApiError(401, 'Unauthorized');
  }
  const session = { user: request.auth, session: request.session };

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
