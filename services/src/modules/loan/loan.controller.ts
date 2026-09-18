import { Request, Response } from 'express';

import {
  createGivenLoan,
  createGivenLoanPayment,
  createTakenLoan,
  createTakenLoanPayment,
  getGivenLoans,
  getTakenLoans,
} from './loan.service.js';
import {
  createGivenLoanSchema,
  createLoanPaymentSchema,
  createTakenLoanSchema,
  uuidParamSchema,
} from './loan.schema.js';
import { ApiResponse } from '../../types/common.types.js';

export const createTakenLoanController = async (
  request: Request,
  response: Response,
) => {
  const data = createTakenLoanSchema.parse(request.body);
  const loan = await createTakenLoan(request.auth!.id, data);

  response.status(201).json({
    success: true,
    message: 'Taken loan created successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
};

export const createGivenLoanController = async (
  request: Request,
  response: Response,
) => {
  const data = createGivenLoanSchema.parse(request.body);
  const loan = await createGivenLoan(request.auth!.id, data);

  response.status(201).json({
    success: true,
    message: 'Given loan created successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
};

export const getTakenLoansController = async (
  request: Request,
  response: Response,
) => {
  const loans = await getTakenLoans(request.auth!.id);

  response.status(200).json({
    success: true,
    message: 'Taken loans fetched successfully',
    data: loans,
  } satisfies ApiResponse<typeof loans>);
};

export const getGivenLoansController = async (
  request: Request,
  response: Response,
) => {
  const loans = await getGivenLoans(request.auth!.id);

  response.status(200).json({
    success: true,
    message: 'Given loans fetched successfully',
    data: loans,
  } satisfies ApiResponse<typeof loans>);
};

export const createTakenLoanPaymentController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const data = createLoanPaymentSchema.parse(request.body);
  const payment = await createTakenLoanPayment(request.auth!.id, id, data);

  response.status(201).json({
    success: true,
    message: 'Taken loan payment recorded successfully',
    data: payment,
  } satisfies ApiResponse<typeof payment>);
};

export const createGivenLoanPaymentController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const data = createLoanPaymentSchema.parse(request.body);
  const payment = await createGivenLoanPayment(request.auth!.id, id, data);

  response.status(201).json({
    success: true,
    message: 'Given loan payment recorded successfully',
    data: payment,
  } satisfies ApiResponse<typeof payment>);
};
