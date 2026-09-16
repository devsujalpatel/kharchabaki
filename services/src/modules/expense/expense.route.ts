import { Router } from 'express';

import { createExpenseController } from './expense.controller.js';
import { getExpense } from './expense.service.js';

export const expenseRouter = Router();


expenseRouter.get('/expense', getExpense);
expenseRouter.post('/expense', createExpenseController);
