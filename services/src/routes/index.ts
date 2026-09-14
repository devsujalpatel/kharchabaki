import { response, Router } from 'express';
import { ApiResponse } from '../types/common.types.js';
import { SERVICE_NAME } from '../config/constans.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
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
  res.status(200).json(body);
});
