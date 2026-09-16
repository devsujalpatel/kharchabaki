import { Router } from 'express';
import { ApiResponse } from '../types/common.types.js';
import { SERVICE_NAME } from '../config/constans.js';
import { authRouter } from '../modules/auth/auth.route.js';
import { checkAuth } from '../middleware/auth.middleware.js';
import { balanceRouter } from '../modules/balance/balance.route.js';

export const apiRouter = Router();

apiRouter.use(authRouter);

apiRouter.get('/health', (_request, response) => {
  const body: ApiResponse<{
    service: string;
    status: 'healthy';
    timestamp: string;
  }> = {
    success: true,
    message: 'Service is healthy',
    data: {
      service: SERVICE_NAME,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  };
  response.status(200).json(body);
});

// protected routes
apiRouter.use(checkAuth, balanceRouter);
