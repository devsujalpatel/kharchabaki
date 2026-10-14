import { Request, Response } from 'express';

import {
  createGivenLoan,
  createGivenLoanPayment,
  createTakenLoan,
  createTakenLoanPayment,
  deleteGivenLoan,
  deleteTakenLoan,
  getGivenLoans,
  getTakenLoans,
  updateGivenLoan,
  updateTakenLoan,
} from './loan.service.js';
import {
  createGivenLoanSchema,
  createLoanPaymentSchema,
  createTakenLoanSchema,
  updateGivenLoanSchema,
  updateTakenLoanSchema,
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

export const updateTakenLoanController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const data = updateTakenLoanSchema.parse(request.body);
  const loan = await updateTakenLoan(request.auth!.id, id, data);
  response.status(200).json({
    success: true,
    message: 'Taken loan updated successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
};

export const updateGivenLoanController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const data = updateGivenLoanSchema.parse(request.body);
  const loan = await updateGivenLoan(request.auth!.id, id, data);
  response.status(200).json({
    success: true,
    message: 'Given loan updated successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
};

export const deleteTakenLoanController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const loan = await deleteTakenLoan(request.auth!.id, id);
  response.status(200).json({
    success: true,
    message: 'Taken loan deleted successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
};

export const deleteGivenLoanController = async (
  request: Request,
  response: Response,
) => {
  const { id } = uuidParamSchema.parse(request.params);
  const loan = await deleteGivenLoan(request.auth!.id, id);
  response.status(200).json({
    success: true,
    message: 'Given loan deleted successfully',
    data: loan,
  } satisfies ApiResponse<typeof loan>);
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
