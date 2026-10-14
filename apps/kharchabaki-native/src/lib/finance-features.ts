import { api } from "@/lib/api";
export type Budget = { id: string; month: string; category: string; amount: string; alertThreshold: string; spent: string; remaining?: string; progress?: number };
export type FinanceLabel = { id: string; kind: "expense" | "income"; key: string; name: string; active: boolean };
export type RecurringTransaction = { id: string; type: "income" | "expense"; amount: string; category: string; description: string | null; schedule: "daily" | "weekly" | "monthly" | "yearly"; interval: string; startAt: string; nextRunAt: string; endAt: string | null; enabled: boolean };
export type Response<T> = { success: boolean; message: string; data: T };
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await api(`/api/v1${path}`, init);
  const value = await response.json();
  if (!response.ok) throw new Error(value.message ?? "Request failed");
  return value as T;
}
export const getBudgets = (month: string) => request<Response<Budget[]>>(`/budgets?month=${month}`);
export const saveBudget = (value: { month: string; category: string; amount: number; alertThreshold: number }) => request<Response<Budget>>("/budgets", { method: "POST", body: JSON.stringify(value) });
export const deleteBudget = (id: string) => request<Response<{ id: string }>>(`/budgets/${id}`, { method: "DELETE" });
export const getLabels = () => request<Response<FinanceLabel[]>>("/finance-labels");
export const saveLabel = (value: { kind: FinanceLabel["kind"]; key: string; name: string }) => request<Response<FinanceLabel>>("/finance-labels", { method: "POST", body: JSON.stringify(value) });
export const updateLabel = (id: string, value: { name?: string; active?: boolean }) => request<Response<FinanceLabel>>(`/finance-labels/${id}`, { method: "PATCH", body: JSON.stringify(value) });
export const getRecurring = () => request<Response<RecurringTransaction[]>>("/recurring");
export const saveRecurring = (value: { type: "expense" | "income"; amount: number; category: string; schedule: RecurringTransaction["schedule"]; interval: number; startAt: string; endAt: string | null; enabled: boolean; description: string | null }) => request<Response<RecurringTransaction>>("/recurring", { method: "POST", body: JSON.stringify(value) });
export const deleteRecurring = (id: string) => request<Response<{ id: string }>>(`/recurring/${id}`, { method: "DELETE" });
