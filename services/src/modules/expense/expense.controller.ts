import { Request, Response } from 'express';
import { createExpense, getExpense } from './expense.service.js';
import {
  updateTransaction,
  deleteTransaction,
} from '../transactions/transaction.service.js';
import {
  expenseInputSchema,
  parseInput,
  parseId,
} from '../transactions/transaction.schema.js';

export const createExpenseController = async (
  request: Request,
  response: Response,
) => {
  const data = await createExpense(
    request.auth!.id,
    parseInput(expenseInputSchema, request.body),
  );
  response
    .status(201)
    .json({ success: true, message: 'Expense added successfully', data });
};
export const getExpenseController = async (
  request: Request,
  response: Response,
) => {
  const data = await getExpense(request.auth!.id);
  response.json({
    success: true,
    message: 'Expense fetched successfully',
    data,
  });
};
export const updateExpenseController = async (
  request: Request,
  response: Response,
) => {
  const data = await updateTransaction(
    request.auth!.id,
    parseId(request.params.id),
    'expense',
    parseInput(expenseInputSchema, request.body),
  );
  response.json({
    success: true,
    message: 'Expense updated successfully',
    data,
  });
};
export const deleteExpenseController = async (
  request: Request,
  response: Response,
) => {
  const data = await deleteTransaction(
    request.auth!.id,
    parseId(request.params.id),
    'expense',
  );
  response.json({
    success: true,
    message: 'Expense deleted successfully',
    data,
  });
};
