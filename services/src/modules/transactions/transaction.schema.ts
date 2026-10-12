import { z } from 'zod';
import {
  expenseCategoryEnum,
  incomeSourceEnum,
} from '../../database/schema.js';
import { ApiError } from '../../utils/api-error.js';

const amount = z
  .number()
  .finite()
  .min(0.01)
  .max(999999999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.001,
    'Use at most two decimal places',
  );
const common = {
  amount,
  description: z.string().trim().max(1000).optional(),
  occurredAt: z.iso.datetime().optional(),
};
export const incomeInputSchema = z.object({
  ...common,
  source: z.enum(incomeSourceEnum.enumValues),
});
export const expenseInputSchema = z.object({
  ...common,
  category: z.enum(expenseCategoryEnum.enumValues),
});
export type IncomeInput = z.infer<typeof incomeInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export const transactionFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((value) => Number(value.slice(0, 4)) >= 1900)
    .optional(),
  type: z.enum(['all', 'income', 'expense']).default('all'),
  category: z.string().max(100).default('all'),
  search: z.string().trim().max(200).default(''),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(400, result.error.issues[0]?.message ?? 'Invalid input');
  return result.data;
}
export function parseId(value: unknown) {
  return parseInput(z.uuid(), value);
}
export function monthRange(month?: string) {
  const selected = month ?? new Date().toISOString().slice(0, 7);
  const [year, index] = selected.split('-').map(Number);
  return {
    month: selected,
    start: new Date(Date.UTC(year!, index! - 1, 1)),
    end: new Date(Date.UTC(year!, index!, 1)),
  };
}
