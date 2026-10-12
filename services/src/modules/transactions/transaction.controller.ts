import { Request, Response } from 'express';
import { getTransactions } from './transaction.service.js';
import { parseInput, transactionFiltersSchema } from './transaction.schema.js';

export const getTransactionsController = async (
  request: Request,
  response: Response,
) => {
  const data = await getTransactions(
    request.auth!.id,
    parseInput(transactionFiltersSchema, request.query),
  );
  response.json({
    success: true,
    message: 'Transactions fetched successfully',
    data,
  });
};
