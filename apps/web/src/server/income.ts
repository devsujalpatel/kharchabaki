import type { IncomeSource } from "@/lib/finance";
import { api } from "@/lib/api";

export type Income = {
  id: string;
  amount: string;
  source: IncomeSource;
  description: string | null;
  receivedAt: string;
  createdAt: string;
};

export type IncomeResponse = {
  success: boolean;
  message: string;
  data: Income[];
};

export async function getIncome(): Promise<IncomeResponse> {
  return api<IncomeResponse>("/income");
}
