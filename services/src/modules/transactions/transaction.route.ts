import { Router } from 'express';
import { getTransactionsController } from './transaction.controller.js';

export const transactionRouter = Router();

transactionRouter.get('/transactions', getTransactionsController);
