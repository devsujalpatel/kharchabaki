import { api } from "@/lib/api";
import type { ExpenseCategory, IncomeSource } from "@/lib/finance";
export type { ExpenseCategory, IncomeSource } from "@/lib/finance";
export type IncomeInput = {
  amount: number;
  source: IncomeSource;
  description?: string;
  occurredAt?: string;
};
export type ExpenseInput = {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  occurredAt?: string;
};
export type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: string;
  description: string | null;
  category: string | null;
  source: string | null;
  createdAt: string;
  occurredAt: string;
};
export type TransactionResponse = { success: boolean; message: string; data: Transaction[] };
export type TransactionFilters = {
  type: "all" | "income" | "expense";
  category: string;
  search: string;
  month?: string;
};
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await api(`/api/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Could not save transaction");
  }
  return response.json();
}
export function addIncome(data: IncomeInput) {
  return request("/income", { method: "POST", body: JSON.stringify(data) });
}
export function addExpense(data: ExpenseInput) {
  return request("/expense", { method: "POST", body: JSON.stringify(data) });
}
export function updateTransaction({
  transaction,
  data,
}: {
  transaction: Transaction;
  data: IncomeInput | ExpenseInput;
}) {
  return request(`/${transaction.type}/${transaction.id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export function deleteTransaction(transaction: Transaction) {
  return request(`/${transaction.type}/${transaction.id}`, { method: "DELETE" });
}
export function transactionsQuery(filters: TransactionFilters): Promise<TransactionResponse> {
  const params = new URLSearchParams();
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.month) params.set("month", filters.month);
  return request<TransactionResponse>(`/transactions?${params}`);
}

export type Income = {
  id: string;
  amount: string;
  source: IncomeSource;
  description: string | null;
  receivedAt: string;
  createdAt: string;
};
export type Expense = {
  id: string;
  amount: string;
  category: ExpenseCategory;
  description: string | null;
  spentAt: string;
  createdAt: string;
};
export type IncomeResponse = { success: boolean; message: string; data: Income[] };
export type ExpenseResponse = { success: boolean; message: string; data: Expense[] };
export function getIncome() {
  return request<IncomeResponse>("/income");
}
export function getExpense() {
  return request<ExpenseResponse>("/expense");
}
