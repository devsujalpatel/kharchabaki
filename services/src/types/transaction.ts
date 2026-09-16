// types/transaction.ts

export type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: string;
  description: string | null;
  category: string | null;
  source: string | null;
  createdAt: Date;
};