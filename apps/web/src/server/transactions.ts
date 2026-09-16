import { api } from "@/lib/api";

type ExpenseInput = {
  amount: number;
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
  description?: string;
};

type IncomeInput = {
  amount: number;
  source:
    | "salary"
    | "pocket-money"
    | "gift"
    | "investment"
    | "bonus"
    | "part-time"
    | "other";
  description?: string;
};

export async function addIncome(data: IncomeInput) {
  return api("/income", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function addExpense(data: ExpenseInput) {
  return api("/expense", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
