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
  const response = await api("/api/v1/summary");

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  return response.json();
}