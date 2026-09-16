import { api } from "@/lib/api";

export type DashboardSummary = {
  balance: string;
  income: string;
  expense: string;
};

export type DashboardSummaryResponse = {
  success: boolean;
  message: string;
  data: DashboardSummary;
};

export async function dashboardSummaryQuery(): Promise<DashboardSummaryResponse> {
  return api<DashboardSummaryResponse>("/summary");
}
