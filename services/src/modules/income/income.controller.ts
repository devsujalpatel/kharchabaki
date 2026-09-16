import { Request, Response } from 'express';

import { createIncome, getIncome } from './income.service.js';
import { ApiResponse } from '../../types/common.types.js';
import { ApiError } from '../../utils/api-error.js';

export const createIncomeController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const { amount, source, description } = request.body;

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new ApiError(400, 'Amount must be a valid number');
  }

  if (amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than 0');
  }

  if (!source) {
    throw new ApiError(400, 'Income source is required');
  }

  const income = await createIncome(userId, {
    amount,
    source,
    description,
  });

  const body: ApiResponse<typeof income> = {
    success: true,
    message: 'Income added successfully',
    data: income,
  };

  response.status(201).json(body);
};

export const getIncomeController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const incomes = await getIncome(userId);

  const body: ApiResponse<typeof incomes> = {
    success: true,
    message: 'Income fetched successfully',
    data: incomes,
  };

  response.status(200).json(body);
};
