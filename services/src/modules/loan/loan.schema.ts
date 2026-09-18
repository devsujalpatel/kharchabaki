import { z } from 'zod';

const positiveAmount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
  .refine((value) => Number(value) > 0, {
    message: 'Amount must be greater than 0',
  });

const interest = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid interest')
  .refine((value) => Number(value) >= 0, {
    message: 'Interest cannot be negative',
  });

export const uuidParamSchema = z.object({
  id: z.uuid(),
});

export const createTakenLoanSchema = z.object({
  amount: positiveAmount,
  borrowedFrom: z.string().trim().min(1).max(100),
  dueDate: z.coerce.date(),
  interest: interest.default('0.00'),
});

export const createGivenLoanSchema = z.object({
  amount: positiveAmount,
  borrowerName: z.string().trim().min(1).max(100),
  dueDate: z.coerce.date(),
  interest: interest.default('0.00'),
});

export const createLoanPaymentSchema = z.object({
  amount: positiveAmount,
  paidAt: z.coerce.date().optional(),
});
