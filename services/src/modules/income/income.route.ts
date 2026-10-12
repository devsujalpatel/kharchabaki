import { Router } from 'express';
import {
  createIncomeController,
  getIncomeController,
  updateIncomeController,
  deleteIncomeController,
} from './income.controller.js';
export const incomeRouter = Router();
incomeRouter.get('/income', getIncomeController);
incomeRouter.post('/income', createIncomeController);
incomeRouter.patch('/income/:id', updateIncomeController);
incomeRouter.delete('/income/:id', deleteIncomeController);
