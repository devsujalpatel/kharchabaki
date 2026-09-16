import { Request, Response } from 'express';
import { ApiResponse } from '../../types/common.types.js';
import { getDashboardSummary } from './summary.service.js';

export const getDashboardSummaryController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const summary = await getDashboardSummary(userId);

  const body: ApiResponse<typeof summary> = {
    success: true,
    message: 'Dashboard summary fetched successfully',
    data: summary,
  };

  response.status(200).json(body);
};
