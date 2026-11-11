"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecurring } from "@/server/finance-features";

// Check on dashboard entry, focus, and each minute while the app is open.
export function RecurringProcessor() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["recurring"],
    queryFn: getRecurring,
    refetchInterval: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const key of ["transactions", "balance", "dashboard-summary"])
      void client.invalidateQueries({ queryKey: [key] });
  }, [client, query.dataUpdatedAt]);
  return query.error ? (
    <p
      role="status"
      className="mt-4 rounded-xl border border-destructive/30 bg-card p-3 text-sm text-destructive"
    >
      Scheduled entries could not be checked: {query.error.message}
    </p>
  ) : null;
}
