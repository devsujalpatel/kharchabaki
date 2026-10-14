import { createHash } from 'node:crypto';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../database/client.js';
import { income, expense, recurringOccurrence, recurringTransaction, user } from '../../database/schema.js';
import { ApiError } from '../../utils/api-error.js';

const schema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['income', 'expense']),
  amount: z.number().finite().positive().max(999999999999.99),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  schedule: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(365).default(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  enabled: z.boolean().default(true),
});
const uuid = z.string().uuid();
const addInterval = (date: Date, schedule: string, interval: number, anchorDay = date.getUTCDate()) => {
  const next = new Date(date);
  if (schedule === 'daily') next.setUTCDate(next.getUTCDate() + interval);
  if (schedule === 'weekly') next.setUTCDate(next.getUTCDate() + 7 * interval);
  if (schedule === 'monthly') {
    const day = date.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + interval);
    const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, last));
  }
  if (schedule === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + interval);
  return next;
};
const createId = (templateId: string, due: Date) => {
  const hex = createHash('sha1')
    .update(`${templateId}:${due.toISOString().slice(0, 10)}`)
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20)}`;
};
async function generateDue(userId: string) {
  const now = new Date();
  const templates = await db.select().from(recurringTransaction).where(and(
    eq(recurringTransaction.userId, userId),
    eq(recurringTransaction.enabled, true),
    lte(recurringTransaction.nextRunAt, now),
  )).orderBy(asc(recurringTransaction.nextRunAt));
  for (const template of templates) {
    let next = new Date(template.nextRunAt);
    const anchorDay = Number(template.dayOfMonth) || new Date(template.startAt).getUTCDate();
    while (next <= now && (!template.endAt || next <= template.endAt)) {
      const scheduledFor = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
      const transactionId = createId(template.id, scheduledFor);
      await db.transaction(async (tx) => {
        const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
        if (!owner) throw new ApiError(404, 'User not found');
        const [existingOccurrence] = await tx.select().from(recurringOccurrence).where(and(
          eq(recurringOccurrence.recurringTransactionId, template.id),
          eq(recurringOccurrence.scheduledFor, scheduledFor),
        )).limit(1);
        if (!existingOccurrence) {
          const [ownerBalance] = await tx.select({ balance: user.balance }).from(user).where(eq(user.id, userId)).for('update');
          if (!ownerBalance) throw new ApiError(404, 'User not found');
          const change = Number(template.amount).toFixed(2);
          if (template.type === 'expense' && Number(ownerBalance.balance) < Number(change))
            throw new ApiError(400, 'Insufficient balance for recurring expense');
          if (template.type === 'income') {
            await tx.insert(income).values({ id: transactionId, userId, amount: change, source: template.category!, description: template.description, receivedAt: scheduledFor });
            await tx.update(user).set({ balance: sql`${user.balance} + ${change}::numeric` }).where(eq(user.id, userId));
          } else {
            await tx.insert(expense).values({ id: transactionId, userId, amount: change, category: template.category!, description: template.description, spentAt: scheduledFor });
            await tx.update(user).set({ balance: sql`${user.balance} - ${change}::numeric` }).where(eq(user.id, userId));
          }
          await tx.insert(recurringOccurrence).values({ userId, recurringTransactionId: template.id, scheduledFor, transactionId });
        }
      });
      next = addInterval(next, template.schedule, Number(template.interval), anchorDay);
    }
    const enabled = !template.endAt || next <= template.endAt;
    await db.update(recurringTransaction).set({ nextRunAt: next, enabled }).where(and(
      eq(recurringTransaction.id, template.id), eq(recurringTransaction.userId, userId),
    ));
  }
}
export const recurringRouter = Router();
recurringRouter.get('/recurring', async (request, response) => {
  await generateDue(request.auth!.id);
  const data = await db.select().from(recurringTransaction).where(eq(recurringTransaction.userId, request.auth!.id)).orderBy(asc(recurringTransaction.nextRunAt));
  response.json({ success: true, message: 'Recurring transactions fetched', data });
});
recurringRouter.post('/recurring/run', async (request, response) => {
  await generateDue(request.auth!.id);
  response.json({ success: true, message: 'Recurring transactions processed', data: { processed: true } });
});
recurringRouter.post('/recurring', async (request, response) => {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid recurring transaction');
  const value = parsed.data;
  const firstRun = value.startAt;
  const [data] = await db.insert(recurringTransaction).values({
    id: value.id,
    userId: request.auth!.id,
    type: value.type,
    amount: value.amount.toFixed(2),
    category: value.category,
    description: value.description || null,
    schedule: value.schedule,
    interval: String(value.interval),
    startAt: value.startAt,
    dayOfMonth: String(value.startAt.getUTCDate()),
    nextRunAt: firstRun,
    endAt: value.endAt ?? null,
    enabled: value.enabled,
  }).onConflictDoNothing().returning();
  const [result] = data ? [data] : await db.select().from(recurringTransaction).where(and(
    eq(recurringTransaction.id, value.id ?? ''),
    eq(recurringTransaction.userId, request.auth!.id),
  )).limit(1);
  if (!result) throw new ApiError(409, 'Recurring transaction ID is already in use');
  await generateDue(request.auth!.id);
  response.status(data ? 201 : 200).json({ success: true, message: data ? 'Recurring transaction created' : 'Recurring transaction already exists', data: result });
});
recurringRouter.patch('/recurring/:id', async (request, response) => {
  const parsedId = uuid.safeParse(request.params.id);
  const parsed = schema.partial().safeParse(request.body);
  if (!parsedId.success || !parsed.success) throw new ApiError(400, 'Invalid recurring transaction');
  const values = parsed.data;
  const [data] = await db.update(recurringTransaction).set({
    ...(values.startAt !== undefined ? { dayOfMonth: String(values.startAt.getUTCDate()) } : {}),
    ...(values.type !== undefined ? { type: values.type } : {}),
    ...(values.amount !== undefined ? { amount: values.amount.toFixed(2) } : {}),
    ...(values.category !== undefined ? { category: values.category } : {}),
    ...(values.schedule !== undefined ? { schedule: values.schedule } : {}),
    ...(values.interval !== undefined ? { interval: String(values.interval) } : {}),
    ...(values.startAt !== undefined ? { startAt: values.startAt } : {}),
    ...(values.endAt !== undefined ? { endAt: values.endAt } : {}),
    ...(values.enabled !== undefined ? { enabled: values.enabled } : {}),
    ...(values.description !== undefined ? { description: values.description || null } : {}),
  }).where(and(eq(recurringTransaction.id, parsedId.data), eq(recurringTransaction.userId, request.auth!.id))).returning();
  if (!data) throw new ApiError(404, 'Recurring transaction not found');
  response.json({ success: true, message: 'Recurring transaction updated', data });
});
recurringRouter.delete('/recurring/:id', async (request, response) => {
  const parsed = uuid.safeParse(request.params.id);
  if (!parsed.success) throw new ApiError(400, 'Invalid recurring transaction ID');
  const [data] = await db.delete(recurringTransaction).where(and(eq(recurringTransaction.id, parsed.data), eq(recurringTransaction.userId, request.auth!.id))).returning({ id: recurringTransaction.id });
  if (!data) throw new ApiError(404, 'Recurring transaction not found');
  response.json({ success: true, message: 'Recurring transaction deleted', data });
});
