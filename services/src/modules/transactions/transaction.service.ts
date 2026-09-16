// services/transaction/get-transactions.service.ts

import { desc, eq } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { income, expense } from '../../database/schema.js';

export const getTransactions = async (userId: string) => {
  const [incomes, expenses] = await Promise.all([
    db
      .select({
        id: income.id,
        amount: income.amount,
        description: income.description,
        source: income.source,
        createdAt: income.createdAt,
      })
      .from(income)
      .where(eq(income.userId, userId))
      .orderBy(desc(income.createdAt)),

    db
      .select({
        id: expense.id,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        createdAt: expense.createdAt,
      })
      .from(expense)
      .where(eq(expense.userId, userId))
      .orderBy(desc(expense.createdAt)),
  ]);

  return [
    ...incomes.map((transaction) => ({
      ...transaction,
      type: 'income' as const,
      category: null,
    })),

    ...expenses.map((transaction) => ({
      ...transaction,
      type: 'expense' as const,
      source: null,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};
