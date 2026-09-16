import { Router } from 'express';
import { ApiResponse } from '../types/common.types.js';
import { SERVICE_NAME } from '../config/constans.js';

// Middlewares
import { checkAuth } from '../middleware/auth.middleware.js';

// Routes
import { authRouter } from '../modules/auth/auth.route.js';
import { balanceRouter } from '../modules/balance/balance.route.js';
import { transactionRouter } from '../modules/transactions/transaction.route.js';
import { incomeRouter } from '../modules/income/income.route.js';
import { expenseRouter } from '../modules/expense/expense.route.js';
import { summaryRouter } from '../modules/summary/summary.route.js';

export const apiRouter = Router();


//health
apiRouter.get('/health', (_request, response) => {
  const body: ApiResponse<{
    service: string;
    status: 'healthy';
    timestamp: string;
  }> = {
    success: true,
    message: 'Service is healthy',
    data: {
      service: SERVICE_NAME,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  };
  response.status(200).json(body);
});


apiRouter.use(authRouter);
// protected routes
apiRouter.use(checkAuth, balanceRouter);
apiRouter.use(checkAuth, transactionRouter);
apiRouter.use(checkAuth, incomeRouter);
apiRouter.use(checkAuth, expenseRouter);
apiRouter.use(checkAuth, summaryRouter);
