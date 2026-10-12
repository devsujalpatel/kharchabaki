import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { income, user } from '../../database/schema.js';

import { type IncomeInput as CreateIncomeInput } from '../transactions/transaction.schema.js';
import { ApiError } from '../../utils/api-error.js';

export const createIncome = async (userId: string, data: CreateIncomeInput) => {
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!owner) throw new ApiError(404, 'User not found');
    if (data.id) {
      const [existing] = await tx
        .select()
        .from(income)
        .where(eq(income.id, data.id))
        .limit(1);
      if (existing) {
        if (existing.userId !== userId)
          throw new ApiError(409, 'Transaction ID is already in use');
        return existing;
      }
    }
    const [createdIncome] = await tx
      .insert(income)
      .values({
        id: data.id,
        userId,
        amount: data.amount.toFixed(2),
        updatedAt: new Date(),
        source: data.source,
        receivedAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        description: data.description?.trim() || null,
      })
      .returning();

    if (!createdIncome) {
      throw new Error('Failed to create income');
    }

    await tx
      .update(user)
      .set({
        balance: sql`${user.balance} + ${data.amount.toFixed(2)}`,
      })
      .where(eq(user.id, userId));

    return createdIncome;
  });
};

export const getIncome = async (userId: string) => {
  const rows = await db
    .select({
      id: income.id,
      amount: income.amount,
      source: income.source,
      description: income.description,
      receivedAt: income.receivedAt,
      createdAt: income.createdAt,
    })
    .from(income)
    .where(eq(income.userId, userId))
    .orderBy(desc(income.receivedAt));
  return rows.map((row) => ({
    ...row,
    source:
      row.source === 'invesment'
        ? 'investment'
        : row.source === 'bonues'
          ? 'bonus'
          : row.source,
  }));
};
