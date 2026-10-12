import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { income, expense, user } from '../../database/schema.js';
import { ApiError } from '../../utils/api-error.js';
import {
  monthRange,
  type TransactionFilters,
  type IncomeInput,
  type ExpenseInput,
} from './transaction.schema.js';

export const getTransactions = async (
  userId: string,
  filters: TransactionFilters,
) => {
  const range = filters.month ? monthRange(filters.month) : undefined;
  const [incomes, expenses] = await Promise.all([
    filters.type === 'expense'
      ? []
      : db
          .select({
            id: income.id,
            amount: income.amount,
            description: income.description,
            source: income.source,
            createdAt: income.createdAt,
            occurredAt: income.receivedAt,
          })
          .from(income)
          .where(
            and(
              eq(income.userId, userId),
              range ? gte(income.receivedAt, range.start) : undefined,
              range ? lt(income.receivedAt, range.end) : undefined,
            ),
          )
          .orderBy(desc(income.receivedAt)),
    filters.type === 'income'
      ? []
      : db
          .select({
            id: expense.id,
            amount: expense.amount,
            description: expense.description,
            category: expense.category,
            createdAt: expense.createdAt,
            occurredAt: expense.spentAt,
          })
          .from(expense)
          .where(
            and(
              eq(expense.userId, userId),
              range ? gte(expense.spentAt, range.start) : undefined,
              range ? lt(expense.spentAt, range.end) : undefined,
            ),
          )
          .orderBy(desc(expense.spentAt)),
  ]);
  return [
    ...incomes.map((t) => ({
      ...t,
      type: 'income' as const,
      category: null,
      source:
        t.source === 'invesment'
          ? 'investment'
          : t.source === 'bonues'
            ? 'bonus'
            : t.source,
    })),
    ...expenses.map((t) => ({ ...t, type: 'expense' as const, source: null })),
  ]
    .filter(
      (t) =>
        (filters.category === 'all' ||
          t.category === filters.category ||
          t.source === filters.category) &&
        (!filters.search ||
          [t.description, t.category, t.source]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(filters.search.toLowerCase())),
    )
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
};

// Lock the owner first to serialize balance changes; ownership is also checked on the record.
export async function updateTransaction(
  userId: string,
  id: string,
  type: 'income' | 'expense',
  data: IncomeInput | ExpenseInput,
) {
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!owner) throw new ApiError(404, 'User not found');
    const table = type === 'income' ? income : expense;
    const condition = and(eq(table.id, id), eq(table.userId, userId));
    const [previous] = await tx
      .select()
      .from(table)
      .where(condition)
      .for('update');
    if (!previous) throw new ApiError(404, 'Transaction not found');
    const amount = data.amount.toFixed(2);
    const additionalCost =
      Math.round(data.amount * 100) - Math.round(Number(previous.amount) * 100);
    if (
      type === 'expense' &&
      additionalCost > 0 &&
      Math.round(Number(owner.balance) * 100) < additionalCost
    ) {
      throw new ApiError(400, 'Insufficient balance');
    }
    const common = { amount, description: data.description?.trim() || null };
    const [updated] =
      type === 'income'
        ? await tx
            .update(income)
            .set({
              ...common,
              source: (data as IncomeInput).source,
              ...(data.occurredAt
                ? { receivedAt: new Date(data.occurredAt) }
                : {}),
            })
            .where(and(eq(income.id, id), eq(income.userId, userId)))
            .returning()
        : await tx
            .update(expense)
            .set({
              ...common,
              category: (data as ExpenseInput).category,
              ...(data.occurredAt
                ? { spentAt: new Date(data.occurredAt) }
                : {}),
            })
            .where(and(eq(expense.id, id), eq(expense.userId, userId)))
            .returning();
    await tx
      .update(user)
      .set({
        balance:
          type === 'income'
            ? sql`${user.balance} + ${amount}::numeric - ${previous.amount}::numeric`
            : sql`${user.balance} - ${amount}::numeric + ${previous.amount}::numeric`,
      })
      .where(eq(user.id, userId));
    return updated;
  });
}
export async function deleteTransaction(
  userId: string,
  id: string,
  type: 'income' | 'expense',
) {
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!owner) throw new ApiError(404, 'User not found');
    const table = type === 'income' ? income : expense;
    const [deleted] = await tx
      .delete(table)
      .where(and(eq(table.id, id), eq(table.userId, userId)))
      .returning();
    if (!deleted) throw new ApiError(404, 'Transaction not found');
    await tx
      .update(user)
      .set({
        balance:
          type === 'income'
            ? sql`${user.balance} - ${deleted.amount}::numeric`
            : sql`${user.balance} + ${deleted.amount}::numeric`,
      })
      .where(eq(user.id, userId));
    return { id };
  });
}
