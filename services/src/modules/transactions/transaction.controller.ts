import { Request, Response } from 'express';

import { getTransactions } from './transaction.service.js';
import { ApiResponse } from '../../types/common.types.js';
import { Transaction } from '../../types/transaction.js';

export const getTransactionsController = async (
  request: Request,
  response: Response,
) => {
  const userId = request.auth!.id;

  const transactions = await getTransactions(userId);

  const body: ApiResponse<Transaction[]> = {
    success: true,
    message: 'Transactions fetched successfully',
    data: transactions,
  };
  response.status(200).json(body);
};
