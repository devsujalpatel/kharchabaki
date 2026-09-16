import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { db } from '../../database/client.js';
import { expense, income, user } from '../../database/schema.js';

export const getDashboardSummary = async (userId: string) => {
  const now = new Date();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [userBalance, monthlyIncome, monthlyExpense] = await Promise.all([
    db
      .select({
        balance: user.balance,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),

    db
      .select({
        total: sql<string>`coalesce(sum(${income.amount}), 0)`,
      })
      .from(income)
      .where(
        and(
          eq(income.userId, userId),
          gte(income.receivedAt, startOfMonth),
          lt(income.receivedAt, startOfNextMonth),
        ),
      ),

    db
      .select({
        total: sql<string>`coalesce(sum(${expense.amount}), 0)`,
      })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          gte(expense.spentAt, startOfMonth),
          lt(expense.spentAt, startOfNextMonth),
        ),
      ),
  ]);

  if (!userBalance[0]) {
    throw new Error('User not found');
  }

  return {
    balance: userBalance[0].balance,
    income: monthlyIncome[0]?.total ?? '0.00',
    expense: monthlyExpense[0]?.total ?? '0.00',
  };
};
