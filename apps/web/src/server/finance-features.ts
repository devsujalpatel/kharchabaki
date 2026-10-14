import { api } from "@/lib/api";

export type Budget = {
  id: string;
  month: string;
  category: string;
  amount: string;
  alertThreshold: string;
  spent: string;
  remaining?: string;
  progress?: number;
};
export type FinanceLabel = {
  id: string;
  kind: "expense" | "income";
  key: string;
  name: string;
  active: boolean;
};
export type RecurringTransaction = {
  id: string;
  type: "income" | "expense";
  amount: string;
  category: string;
  description: string | null;
  schedule: "daily" | "weekly" | "monthly" | "yearly";
  interval: string;
  startAt: string;
  nextRunAt: string;
  endAt: string | null;
  enabled: boolean;
};
type Response<T> = { success: boolean; message: string; data: T };
export const getBudgets = (month: string) => api<Response<Budget[]>>(`/budgets?month=${month}`);
export const saveBudget = (value: { month: string; category: string; amount: number; alertThreshold: number }) =>
  api<Response<Budget>>("/budgets", { method: "POST", body: JSON.stringify(value) });
export const deleteBudget = (id: string) =>
  api<Response<{ id: string }>>(`/budgets/${id}`, { method: "DELETE" });
export const getLabels = () => api<Response<FinanceLabel[]>>("/finance-labels");
export const saveLabel = (value: { kind: FinanceLabel["kind"]; key: string; name: string }) =>
  api<Response<FinanceLabel>>("/finance-labels", { method: "POST", body: JSON.stringify(value) });
export const updateLabel = (id: string, value: { name?: string; active?: boolean }) =>
  api<Response<FinanceLabel>>(`/finance-labels/${id}`, { method: "PATCH", body: JSON.stringify(value) });
export const getRecurring = () => api<Response<RecurringTransaction[]>>("/recurring");
export const saveRecurring = (value: Omit<RecurringTransaction, "id" | "nextRunAt" | "interval" | "amount"> & { interval: number; amount: number }) =>
  api<Response<RecurringTransaction>>("/recurring", { method: "POST", body: JSON.stringify(value) });
export const updateRecurring = (id: string, value: Partial<RecurringTransaction>) =>
  api<Response<RecurringTransaction>>(`/recurring/${id}`, { method: "PATCH", body: JSON.stringify(value) });
export const deleteRecurring = (id: string) =>
  api<Response<{ id: string }>>(`/recurring/${id}`, { method: "DELETE" });
