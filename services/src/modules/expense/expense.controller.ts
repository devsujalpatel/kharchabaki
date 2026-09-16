import { Request, Response } from 'express';

import { createExpense, getExpense } from './expense.service.js';
import { ApiResponse } from '../../types/common.types.js';
import { ApiError } from '../../utils/api-error.js';

export const createExpenseController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const { amount, category, description } = request.body;

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new ApiError(400, 'Amount must be a valid number');
  }

  if (amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than 0');
  }

  if (!category) {
    throw new ApiError(400, 'Expense category is required');
  }

  const expense = await createExpense(userId, {
    amount,
    category,
    description,
  });

  const body: ApiResponse<typeof expense> = {
    success: true,
    message: 'Expense added successfully',
    data: expense,
  };

  response.status(201).json(body);
};

export const getExpenseController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const expenses = await getExpense(userId);

  const body: ApiResponse<typeof expenses> = {
    success: true,
    message: 'Expenses fetched successfully',
    data: expenses,
  };

  response.status(200).json(body);
};
