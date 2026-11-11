import { useEffect } from "react";
import { AppState, Text } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecurring } from "@/lib/finance-features";

export function RecurringProcessor() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["recurring"],
    queryFn: getRecurring,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
  const { refetch } = query;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => listener.remove();
  }, [refetch]);
  useEffect(() => {
    if (query.dataUpdatedAt)
      for (const key of ["transactions", "balance", "dashboard-summary"])
        void client.invalidateQueries({ queryKey: [key] });
  }, [client, query.dataUpdatedAt]);
  return query.error ? (
    <Text
      accessibilityRole="alert"
      className="border-b border-app-border bg-app-card p-3 text-xs text-red-400"
    >
      Schedules could not be checked: {query.error.message}
    </Text>
  ) : null;
}
