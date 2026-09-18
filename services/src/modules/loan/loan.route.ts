import { Router } from 'express';

import {
  createGivenLoanController,
  createGivenLoanPaymentController,
  createTakenLoanController,
  createTakenLoanPaymentController,
  getGivenLoansController,
  getTakenLoansController,
} from './loan.controller.js';

export const loanRouter = Router();

loanRouter.get('/loans/taken', getTakenLoansController);
loanRouter.post('/loans/taken', createTakenLoanController);
loanRouter.post('/loans/taken/:id/payments', createTakenLoanPaymentController);

loanRouter.get('/loans/given', getGivenLoansController);
loanRouter.post('/loans/given', createGivenLoanController);
loanRouter.post('/loans/given/:id/payments', createGivenLoanPaymentController);
