import { Router } from 'express';

import {
  createGivenLoanController,
  createGivenLoanPaymentController,
  createTakenLoanController,
  createTakenLoanPaymentController,
  deleteGivenLoanController,
  deleteTakenLoanController,
  getGivenLoansController,
  getTakenLoansController,
  updateGivenLoanController,
  updateTakenLoanController,
} from './loan.controller.js';

export const loanRouter = Router();

loanRouter.get('/loans/taken', getTakenLoansController);
loanRouter.post('/loans/taken', createTakenLoanController);
loanRouter.patch('/loans/taken/:id', updateTakenLoanController);
loanRouter.delete('/loans/taken/:id', deleteTakenLoanController);
loanRouter.post('/loans/taken/:id/payments', createTakenLoanPaymentController);

loanRouter.get('/loans/given', getGivenLoansController);
loanRouter.post('/loans/given', createGivenLoanController);
loanRouter.patch('/loans/given/:id', updateGivenLoanController);
loanRouter.delete('/loans/given/:id', deleteGivenLoanController);
loanRouter.post('/loans/given/:id/payments', createGivenLoanPaymentController);
