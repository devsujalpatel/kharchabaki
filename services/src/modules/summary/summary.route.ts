import { Router } from 'express';
import { getDashboardSummaryController } from './summary.controller.js';

export const summaryRouter = Router();

summaryRouter.get('/summary', getDashboardSummaryController);
