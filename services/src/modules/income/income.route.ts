import { Router } from 'express';

import { createIncomeController } from './income.controller.js';
import { getIncome } from './income.service.js';

export const incomeRouter = Router();

incomeRouter.get('/income', getIncome);
incomeRouter.post('/income', createIncomeController);
