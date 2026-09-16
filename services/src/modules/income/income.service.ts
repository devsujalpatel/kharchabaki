import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { income, user } from '../../database/schema.js';

type CreateIncomeInput = {
  amount: number;
  source:
    | 'salary'
    | 'pocket-money'
    | 'gift'
    | 'invesment'
    | 'bonues'
    | 'part-time'
    | 'other';
  description?: string;
};

export const createIncome = async (userId: string, data: CreateIncomeInput) => {
  return db.transaction(async (tx) => {
    const [createdIncome] = await tx
      .insert(income)
      .values({
        userId,
        amount: data.amount.toFixed(2),
        source: data.source,
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
  return db
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
    .orderBy(desc(income.createdAt));
};

