import { Request, Response } from 'express';
import { createIncome, getIncome } from './income.service.js';
import {
  updateTransaction,
  deleteTransaction,
} from '../transactions/transaction.service.js';
import {
  incomeInputSchema,
  parseInput,
  parseId,
} from '../transactions/transaction.schema.js';

export const createIncomeController = async (
  request: Request,
  response: Response,
) => {
  const data = await createIncome(
    request.auth!.id,
    parseInput(incomeInputSchema, request.body),
  );
  response
    .status(201)
    .json({ success: true, message: 'Income added successfully', data });
};
export const getIncomeController = async (
  request: Request,
  response: Response,
) => {
  const data = await getIncome(request.auth!.id);
  response.json({
    success: true,
    message: 'Income fetched successfully',
    data,
  });
};
export const updateIncomeController = async (
  request: Request,
  response: Response,
) => {
  const data = await updateTransaction(
    request.auth!.id,
    parseId(request.params.id),
    'income',
    parseInput(incomeInputSchema, request.body),
  );
  response.json({
    success: true,
    message: 'Income updated successfully',
    data,
  });
};
export const deleteIncomeController = async (
  request: Request,
  response: Response,
) => {
  const data = await deleteTransaction(
    request.auth!.id,
    parseId(request.params.id),
    'income',
  );
  response.json({
    success: true,
    message: 'Income deleted successfully',
    data,
  });
};
