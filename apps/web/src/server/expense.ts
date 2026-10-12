import type { ExpenseCategory } from "@/lib/finance";
import { api } from "@/lib/api";

export type Expense = {
  id: string;
  amount: string;
  category: ExpenseCategory;
  description: string | null;
  spentAt: string;
  createdAt: string;
};

export type ExpenseResponse = {
  success: boolean;
  message: string;
  data: Expense[];
};

export async function getExpense(): Promise<ExpenseResponse> {
  return api<ExpenseResponse>("/expense");
}
