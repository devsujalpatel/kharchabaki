import { Router } from 'express';
import { addBalance, getBalance } from './balance.controller.js';

export const balanceRouter = Router();

balanceRouter.get('/balance', getBalance);
balanceRouter.post('/balance', addBalance);
