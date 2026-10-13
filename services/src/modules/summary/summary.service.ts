import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { expense, income, user } from '../../database/schema.js';
import { monthRange } from '../transactions/transaction.schema.js';
import { ApiError } from '../../utils/api-error.js';

export const getDashboardSummary = async (userId: string, month?: string) => {
  const range = monthRange(month);
  const trendStart = new Date(range.start);
  trendStart.setUTCMonth(trendStart.getUTCMonth() - 5);
  const [
    owner,
    incomes,
    expenses,
    expensesByCategory,
    incomesBySource,
    monthlyIncomes,
    monthlyExpenses,
  ] = await Promise.all([
      db
        .select({ balance: user.balance })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
      db
        .select({
          day: sql<string>`to_char(${income.receivedAt}, 'YYYY-MM-DD')`,
          total: sql<string>`sum(${income.amount})`,
        })
        .from(income)
        .where(
          and(
            eq(income.userId, userId),
            gte(income.receivedAt, range.start),
            lt(income.receivedAt, range.end),
          ),
        )
        .groupBy(sql`to_char(${income.receivedAt}, 'YYYY-MM-DD')`),
      db
        .select({
          day: sql<string>`to_char(${expense.spentAt}, 'YYYY-MM-DD')`,
          total: sql<string>`sum(${expense.amount})`,
        })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.spentAt, range.start),
            lt(expense.spentAt, range.end),
          ),
        )
        .groupBy(sql`to_char(${expense.spentAt}, 'YYYY-MM-DD')`),
      db
        .select({
          category: expense.category,
          total: sql<string>`sum(${expense.amount})`,
        })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.spentAt, range.start),
            lt(expense.spentAt, range.end),
          ),
        )
        .groupBy(expense.category),
      db
        .select({
          source: income.source,
          total: sql<string>`sum(${income.amount})`,
        })
        .from(income)
        .where(
          and(
            eq(income.userId, userId),
            gte(income.receivedAt, range.start),
            lt(income.receivedAt, range.end),
          ),
        )
        .groupBy(income.source),
      db
        .select({
          month: sql<string>`to_char(${income.receivedAt}, 'YYYY-MM')`,
          total: sql<string>`sum(${income.amount})`,
        })
        .from(income)
        .where(
          and(
            eq(income.userId, userId),
            gte(income.receivedAt, trendStart),
            lt(income.receivedAt, range.end),
          ),
        )
        .groupBy(sql`to_char(${income.receivedAt}, 'YYYY-MM')`),
      db
        .select({
          month: sql<string>`to_char(${expense.spentAt}, 'YYYY-MM')`,
          total: sql<string>`sum(${expense.amount})`,
        })
        .from(expense)
        .where(
          and(
            eq(expense.userId, userId),
            gte(expense.spentAt, trendStart),
            lt(expense.spentAt, range.end),
          ),
        )
        .groupBy(sql`to_char(${expense.spentAt}, 'YYYY-MM')`),
    ]);
  if (!owner[0]) throw new ApiError(404, 'User not found');
  const incomeByDay = new Map(incomes.map((row) => [row.day, row.total]));
  const expenseByDay = new Map(expenses.map((row) => [row.day, row.total]));
  const expenseCategories = expensesByCategory.map((row) => ({
    category: row.category,
    total: Number(row.total).toFixed(2),
  }));
  const sourceTotals = new Map<string, number>();
  incomesBySource.forEach((row) => {
    const source =
      row.source === 'invesment'
        ? 'investment'
        : row.source === 'bonues'
          ? 'bonus'
          : row.source;
    sourceTotals.set(
      source,
      (sourceTotals.get(source) ?? 0) + Math.round(Number(row.total) * 100),
    );
  });
  const incomeSources = Array.from(sourceTotals, ([source, total]) => ({
    source,
    total: (total / 100).toFixed(2),
  }));
  const daily = Array.from(
    { length: new Date(range.end.getTime() - 1).getUTCDate() },
    (_, index) => {
      const date = `${range.month}-${String(index + 1).padStart(2, '0')}`;
      return {
        date,
        income: incomeByDay.get(date) ?? '0.00',
        expense: expenseByDay.get(date) ?? '0.00',
      };
    },
  );
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(trendStart);
    date.setUTCMonth(date.getUTCMonth() + index);
    const month = date.toISOString().slice(0, 7);
    return {
      date: month,
      income:
        monthlyIncomes.find((row) => row.month === month)?.total ?? '0.00',
      expense:
        monthlyExpenses.find((row) => row.month === month)?.total ?? '0.00',
    };
  });
  return {
    monthly,
    expenseCategories,
    incomeSources,
    balance: owner[0].balance,
    month: range.month,
    daily,
    income: (
      incomes.reduce(
        (sum, row) => sum + Math.round(Number(row.total) * 100),
        0,
      ) / 100
    ).toFixed(2),
    expense: (
      expenses.reduce(
        (sum, row) => sum + Math.round(Number(row.total) * 100),
        0,
      ) / 100
    ).toFixed(2),
  };
};
