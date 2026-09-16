import { api } from "@/lib/api";

export type Income = {
  id: string;
  amount: string;
  source:
    | "salary"
    | "pocket-money"
    | "gift"
    | "invesment"
    | "bonues"
    | "part-time"
    | "other";
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
