import { desc, eq, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { expense, user } from '../../database/schema.js';

type CreateExpenseInput = {
  amount: number;
  category:
    | 'food'
    | 'travel'
    | 'shopping'
    | 'bills'
    | 'rent'
    | 'phone'
    | 'beauty'
    | 'clothing'
    | 'fuel'
    | 'gifts'
    | 'electronics'
    | 'snacks'
    | 'vegetables'
    | 'fruits'
    | 'repairs'
    | 'health'
    | 'education'
    | 'entertainment'
    | 'other';
  description?: string;
};

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
      .limit(1);

    if (!currentUser) {
      throw new Error('User not found');
    }

    const currentBalance = Number(currentUser.balance);

    if (currentBalance < data.amount) {
      throw new Error('Insufficient balance');
    }

    // Create expense
    const [createdExpense] = await tx
      .insert(expense)
      .values({
        userId,
        amount: data.amount.toFixed(2),
        category: data.category,
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
    .orderBy(desc(expense.createdAt));
};
