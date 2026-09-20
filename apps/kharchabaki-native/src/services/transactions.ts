import { api } from "@/lib/api";

export type IncomeSource =
  | "salary"
  | "pocket-money"
  | "gift"
  | "investment"
  | "bonus"
  | "part-time"
  | "other";

export type ExpenseCategory =
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

export type IncomeResponse = {
  success: boolean;
  message: string;
  data: Income[];
};

export type ExpenseResponse = {
  success: boolean;
  message: string;
  data: Expense[];
};

export type IncomeInput = {
  amount: number;
  source: IncomeSource;
  description?: string;
};

export type ExpenseInput = {
  amount: number;
  category: ExpenseCategory;
  description?: string;
};

export async function getIncome(): Promise<IncomeResponse> {
  const response = await api("/api/v1/income");

  if (!response.ok) {
    throw new Error("Failed to fetch income");
  }

  return response.json();
}

export async function getExpense(): Promise<ExpenseResponse> {
  const response = await api("/api/v1/expense");

  if (!response.ok) {
    throw new Error("Failed to fetch expenses");
  }

  return response.json();
}

export async function addIncome(data: IncomeInput) {
  const response = await api("/api/v1/income", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.message ?? "Failed to add income");
  }

  return response.json();
}

export async function addExpense(data: ExpenseInput) {
  const response = await api("/api/v1/expense", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.message ?? "Failed to add expense");
  }

  return response.json();
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

  const response = await api(
    `/api/v1/transactions${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }

  return response.json();
}