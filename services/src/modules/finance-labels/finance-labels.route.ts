import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../database/client.js';
import { financeLabel } from '../../database/schema.js';
import { parseInput } from '../transactions/transaction.schema.js';
import { ApiError } from '../../utils/api-error.js';

const kindSchema = z.enum(['expense', 'income']);
const keySchema = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9 _-]+$/);
const createSchema = z.object({
  kind: kindSchema,
  key: keySchema,
  name: z.string().trim().min(1).max(60),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.active !== undefined);
const idSchema = z.object({ id: z.uuid() });

export const financeLabelsRouter = Router();
financeLabelsRouter.get('/finance-labels', async (request, response) => {
  const data = await db
    .select()
    .from(financeLabel)
    .where(eq(financeLabel.userId, request.auth!.id))
    .orderBy(asc(financeLabel.kind), asc(financeLabel.name));
  response.json({ success: true, message: 'Finance labels fetched', data });
});
financeLabelsRouter.post('/finance-labels', async (request, response) => {
  const input = parseInput(createSchema, request.body);
  const [data] = await db
    .insert(financeLabel)
    .values({ ...input, id: (request.body as { id?: string }).id, userId: request.auth!.id })
    .onConflictDoNothing()
    .returning();
  if (!data) {
    const [existing] = await db.select().from(financeLabel).where(and(
      eq(financeLabel.id, String((request.body as { id?: string }).id ?? '')),
      eq(financeLabel.userId, request.auth!.id),
    )).limit(1);
    if (existing) return response.status(200).json({ success: true, message: 'Finance label already exists', data: existing });
    throw new ApiError(409, 'This category or source already exists');
  }
  response.status(201).json({ success: true, message: 'Finance label created', data });
});
financeLabelsRouter.patch('/finance-labels/:id', async (request, response) => {
  const { id } = parseInput(idSchema, request.params);
  const input = parseInput(updateSchema, request.body);
  const [data] = await db
    .update(financeLabel)
    .set(input)
    .where(and(eq(financeLabel.id, id), eq(financeLabel.userId, request.auth!.id)))
    .returning();
  if (!data) throw new ApiError(404, 'Finance label not found');
  response.json({ success: true, message: 'Finance label updated', data });
});
