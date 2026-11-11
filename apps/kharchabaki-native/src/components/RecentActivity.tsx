import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { transactionsQuery, type Transaction } from "@/services/transactions";
import { categoryIcon, formatLabel } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { TransactionEditor } from "@/components/TransactionEditor";

export function RecentActivity({ month }: { month: string }) {
  const { colors, formatMoney } = usePreferences();
  const [draft, setDraft] = useState<Transaction | null>(null);
  const query = useQuery({
    queryKey: ["transactions", "home", month],
    queryFn: () => transactionsQuery({ month, type: "all", category: "all", search: "" }),
  });
  const rows = [...(query.data?.data ?? [])]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);
  return (
    <View className="mt-5 rounded-3xl border border-app-border bg-app-card p-5">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-app-text">Recent payments</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/dashboard/transactions")}
          className="min-h-11 justify-center px-2"
        >
          <Text className="text-xs text-app-primary">View all →</Text>
        </Pressable>
      </View>
      {query.error && (
        <Text accessibilityRole="alert" className="text-sm text-red-400">
          {query.error.message}
        </Text>
      )}
      {query.isPending ? (
        <Text className="py-4 text-sm text-app-subtle">Loading activity…</Text>
      ) : !rows.length ? (
        <Text className="py-4 text-sm text-app-subtle">
          No payments this month. Add an entry to get started.
        </Text>
      ) : (
        rows.map((row) => {
          const Icon = categoryIcon(row.category ?? row.source);
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => setDraft(row)}
              className="min-h-20 flex-row items-center gap-3 border-t border-app-border py-3"
            >
              <View className="rounded-xl bg-app-muted p-3">
                <Icon size={19} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm font-medium text-app-text">
                  {row.description || formatLabel(row.category ?? row.source ?? "other")}
                </Text>
                <Text className="mt-1 text-xs text-app-subtle">
                  {formatLabel(row.category ?? row.source ?? "other")} ·{" "}
                  {row.occurredAt.slice(0, 10)}
                </Text>
              </View>
              <Text
                className={`text-sm font-semibold ${row.type === "income" ? "text-app-primary" : "text-app-text"}`}
              >
                {row.type === "income" ? "+" : "−"}
                {formatMoney(row.amount)}
              </Text>
            </Pressable>
          );
        })
      )}
      {draft && (
        <TransactionEditor key={draft.id} transaction={draft} onClose={() => setDraft(null)} />
      )}
    </View>
  );
}
