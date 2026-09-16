import { api } from "@/lib/api";

export type Expense = {
  id: string;
  amount: string;
  category:
    | "food"
    | "travel"
    | "shopping"
    | "bills"
    | "rent"
    | "phone"
    | "beauty"
    | "clothing"
    | "fuel"
    | "gifts"
    | "electronics"
    | "snacks"
    | "vegetables"
    | "fruits"
    | "repairs"
    | "health"
    | "education"
    | "entertainment"
    | "other";
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
