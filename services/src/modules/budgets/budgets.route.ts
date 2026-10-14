import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../database/client.js';
import { budget, expense } from '../../database/schema.js';
import { ApiError } from '../../utils/api-error.js';

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const input = z.object({
  month,
  category: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9 _-]+$/),
  amount: z.number().finite().positive().max(999999999999.99),
  alertThreshold: z.number().finite().min(1).max(100).default(80),
});
const id = z.string().uuid();
const query = z.object({ month: month.optional() });
const bounds = (value: string) => {
  const [year, monthIndex] = value.split('-').map(Number);
  return { start: new Date(Date.UTC(year!, monthIndex! - 1, 1)), end: new Date(Date.UTC(year!, monthIndex!, 1)) };
};
export const budgetsRouter = Router();
budgetsRouter.get('/budgets', async (request, response) => {
  const parsed = query.safeParse(request.query);
  if (!parsed.success) throw new ApiError(400, 'Choose a valid month');
  const selected = parsed.data.month ?? new Date().toISOString().slice(0, 7);
  const range = bounds(selected);
  const rows = await db
    .select({
      id: budget.id,
      month: budget.month,
      category: budget.category,
      amount: budget.amount,
      alertThreshold: budget.alertThreshold,
      spent: sql<string>`coalesce(sum(${expense.amount}), 0)`,
    })
    .from(budget)
    .leftJoin(expense, and(
      eq(expense.userId, budget.userId),
      eq(expense.category, budget.category),
      gte(expense.spentAt, range.start),
      lt(expense.spentAt, range.end),
    ))
    .where(and(eq(budget.userId, request.auth!.id), eq(budget.month, selected)))
    .groupBy(budget.id)
    .orderBy(asc(budget.category));
  response.json({ success: true, message: 'Budgets fetched', data: rows });
});
budgetsRouter.post('/budgets', async (request, response) => {
  const parsed = input.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid budget');
  const value = parsed.data;
  const [data] = await db.insert(budget).values({
    userId: request.auth!.id,
    ...value,
    amount: value.amount.toFixed(2),
    alertThreshold: value.alertThreshold.toFixed(2),
  }).onConflictDoUpdate({
    target: [budget.userId, budget.month, budget.category],
    set: { amount: value.amount.toFixed(2), alertThreshold: value.alertThreshold.toFixed(2), updatedAt: new Date() },
  }).returning();
  response.status(201).json({ success: true, message: 'Budget saved', data });
});
budgetsRouter.delete('/budgets/:id', async (request, response) => {
  const parsed = id.safeParse(request.params.id);
  if (!parsed.success) throw new ApiError(400, 'Invalid budget ID');
  const [data] = await db.delete(budget).where(and(eq(budget.id, parsed.data), eq(budget.userId, request.auth!.id))).returning({ id: budget.id });
  if (!data) throw new ApiError(404, 'Budget not found');
  response.json({ success: true, message: 'Budget deleted', data });
});
