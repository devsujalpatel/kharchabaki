import { Router } from 'express';
import { getDashboardSummary } from './summary.service.js';

export const summaryRouter = Router();

summaryRouter.get('/summary', getDashboardSummary);
