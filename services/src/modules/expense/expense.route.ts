import { Router } from 'express';
import {
  createExpenseController,
  getExpenseController,
  updateExpenseController,
  deleteExpenseController,
} from './expense.controller.js';
export const expenseRouter = Router();
expenseRouter.get('/expense', getExpenseController);
expenseRouter.post('/expense', createExpenseController);
expenseRouter.patch('/expense/:id', updateExpenseController);
expenseRouter.delete('/expense/:id', deleteExpenseController);
