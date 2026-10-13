import { api } from "@/lib/api";
import type { DailyTotal } from "@/lib/finance";
export type DashboardSummary = {
  balance: string;
  income: string;
  expense: string;
  month: string;
  daily: DailyTotal[];
  monthly: DailyTotal[];
  expenseCategories: { category: string; total: string }[];
  incomeSources: { source: string; total: string }[];
};
export type DashboardSummaryResponse = {
  success: boolean;
  message: string;
  data: DashboardSummary;
};
export async function dashboardSummaryQuery(
  month?: string,
): Promise<DashboardSummaryResponse> {
  return api<DashboardSummaryResponse>(
    `/summary${month ? `?month=${month}` : ""}`,
  );
}
