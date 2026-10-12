import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { expense, user } from '../../database/schema.js';

import { type ExpenseInput as CreateExpenseInput } from '../transactions/transaction.schema.js';
import { ApiError } from '../../utils/api-error.js';

export const createExpense = async (
  userId: string,
  data: CreateExpenseInput,
) => {
  return db.transaction(async (tx) => {
    // Check that the user has enough balance
    const [currentUser] = await tx
      .select({
        balance: user.balance,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .for('update');

    if (!currentUser) {
      throw new Error('User not found');
    }

    if (data.id) {
      const [existing] = await tx
        .select()
        .from(expense)
        .where(eq(expense.id, data.id))
        .limit(1);
      if (existing) {
        if (existing.userId !== userId)
          throw new ApiError(409, 'Transaction ID is already in use');
        return existing;
      }
    }
    const currentBalance = Number(currentUser.balance);

    if (currentBalance < data.amount) {
      throw new ApiError(400, 'Insufficient balance');
    }

    // Create expense
    const [createdExpense] = await tx
      .insert(expense)
      .values({
        id: data.id,
        userId,
        amount: data.amount.toFixed(2),
        category: data.category,
        spentAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        description: data.description?.trim() || null,
      })
      .returning();

    if (!createdExpense) {
      throw new Error('Failed to create expense');
    }

    // Decrease balance
    await tx
      .update(user)
      .set({
        balance: sql`${user.balance} - ${data.amount.toFixed(2)}`,
      })
      .where(eq(user.id, userId));

    return createdExpense;
  });
};

export const getExpense = async (userId: string) => {
  return db
    .select({
      id: expense.id,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      spentAt: expense.spentAt,
      createdAt: expense.createdAt,
    })
    .from(expense)
    .where(eq(expense.userId, userId))
    .orderBy(desc(expense.spentAt));
};
