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

export type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  createdAt: string;
};

export type TransactionResponse = {
  success: boolean;
  message: string;
  data: Transaction[];
};

export type TransactionFilters = {
  type: "all" | "income" | "expense";
  category: string;
  search: string;
};

export async function transactionsQuery(
  filters: TransactionFilters,
): Promise<TransactionResponse> {
  const params = new URLSearchParams();

  if (filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  const query = params.toString();

  return api<TransactionResponse>(`/transactions${query ? `?${query}` : ""}`);
}
