import { Router } from 'express';
import { ApiResponse } from '../types/common.types.js';
import { SERVICE_NAME } from '../config/constans.js';

// Middlewares
import { checkAuth } from '../middleware/auth.middleware.js';
import { checkPremium } from '../middleware/premium.middleware.js';

// Routes
import { authRouter } from '../modules/auth/auth.route.js';
import { balanceRouter } from '../modules/balance/balance.route.js';
import { transactionRouter } from '../modules/transactions/transaction.route.js';
import { incomeRouter } from '../modules/income/income.route.js';
import { expenseRouter } from '../modules/expense/expense.route.js';
import { summaryRouter } from '../modules/summary/summary.route.js';
import { loanRouter } from '../modules/loan/loan.route.js';

import { preferencesRouter } from '../modules/preferences/preferences.route.js';

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

// Cloud finance data and preference sync are a premium entitlement. /me and
// Better Auth stay available to every account, including local-only users.
apiRouter.use(checkAuth, checkPremium);
apiRouter.use(balanceRouter);
apiRouter.use(transactionRouter);
apiRouter.use(incomeRouter);
apiRouter.use(expenseRouter);
apiRouter.use(summaryRouter);
apiRouter.use(loanRouter);
apiRouter.use(preferencesRouter);
