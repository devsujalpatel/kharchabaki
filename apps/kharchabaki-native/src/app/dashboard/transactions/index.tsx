import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Pencil, Search, Trash2 } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  currentMonth,
  expenseCategories,
  incomeSources,
  categoryIcon,
  formatLabel,
} from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import {
  deleteTransaction,
  transactionsQuery,
  type Transaction,
  type TransactionFilters,
} from "@/services/transactions";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionEditor } from "@/components/TransactionEditor";

export default function Transactions() {
  const { colors, formatMoney } = usePreferences();
  const client = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState<TransactionFilters["type"]>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const query = useQuery({
    queryKey: ["transactions", month, type, category, search],
    queryFn: () => transactionsQuery({ month: month || undefined, type, category, search }),
  });
  const deletion = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: async () => {
      await Promise.all(
        ["transactions", "dashboard-summary", "balance"].map((key) =>
          client.invalidateQueries({ queryKey: [key] })
        )
      );
    },
  });
  const options =
    type === "income"
      ? incomeSources
      : type === "expense"
        ? expenseCategories
        : [...new Set([...expenseCategories, ...incomeSources])];
  const transactions = query.data?.data ?? [];
  return (
    <ScrollView
      className="flex-1 bg-app-bg"
      contentContainerClassName="px-5 pt-6 pb-8"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-3xl font-semibold text-app-text">Transactions</Text>
      <Text className="mt-2 text-sm text-app-subtle">
        Browse history and manage your income and expenses.
      </Text>
      <MonthPicker month={month} onChange={setMonth} allowAll />
      <View className="gap-4 rounded-2xl border border-app-border bg-app-card p-4">
        <View className="flex-row items-center gap-2">
          <Search size={18} color={colors.subtle} />
          <TextInput
            accessibilityLabel="Search transactions"
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor={colors.subtle}
            className="h-11 flex-1 text-app-text"
          />
        </View>
        <View className="flex-row gap-2">
          {(["all", "income", "expense"] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setType(option);
                setCategory("all");
              }}
              className={`flex-1 items-center rounded-xl p-3 ${type === option ? "bg-app-primary" : "bg-app-muted"}`}
            >
              <Text className={type === option ? "text-app-on-primary" : "text-app-text"}>
                {formatLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {["all", ...options].map((option) => {
              const Icon = categoryIcon(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => setCategory(option)}
                  className={`flex-row items-center gap-2 rounded-full border px-3 py-2 ${category === option ? "border-app-primary bg-app-primary" : "border-app-border"}`}
                >
                  {option !== "all" && (
                    <Icon
                      size={14}
                      color={category === option ? colors.onPrimary : colors.subtle}
                    />
                  )}
                  <Text className={category === option ? "text-app-on-primary" : "text-app-subtle"}>
                    {formatLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {(search || category !== "all" || type !== "all") && (
          <Pressable
            onPress={() => {
              setSearch("");
              setType("all");
              setCategory("all");
            }}
          >
            <Text className="text-sm text-app-subtle">Clear filters</Text>
          </Pressable>
        )}
      </View>
      <View className="mt-5 rounded-2xl border border-app-border bg-app-card p-4">
        <Text className="mb-3 font-semibold text-app-text">
          Transaction history · {transactions.length}
        </Text>
        {deletion.error && (
          <Text accessibilityRole="alert" className="mb-3 text-red-400">
            {deletion.error.message}
          </Text>
        )}
        {query.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : query.error ? (
          <View>
            <Text className="text-red-400">{query.error.message}</Text>
            <Pressable onPress={() => query.refetch()} className="mt-3">
              <Text className="text-app-text">Retry</Text>
            </Pressable>
          </View>
        ) : !transactions.length ? (
          <Text className="py-10 text-center text-app-subtle">
            No transactions for this month or filter.
          </Text>
        ) : (
          transactions.map((transaction) => {
            const Icon = categoryIcon(transaction.source ?? transaction.category);
            const isIncome = transaction.type === "income";
            return (
              <View
                key={`${transaction.type}-${transaction.id}`}
                className="border-t border-app-border py-4"
              >
                <View className="flex-row items-center gap-3">
                  <View className="rounded-xl bg-app-muted p-3">
                    <Icon size={20} color={isIncome ? "#10b981" : "#f87171"} />
                  </View>
                  <View className="flex-1">
                    <Text numberOfLines={2} className="font-medium text-app-text">
                      {transaction.description ||
                        formatLabel(transaction.source ?? transaction.category ?? "other")}
                    </Text>
                    <Text className="mt-1 text-xs text-app-subtle">
                      {formatLabel(transaction.source ?? transaction.category ?? "other")} ·{" "}
                      {new Date(transaction.occurredAt).toLocaleDateString("en", {
                        timeZone: "UTC",
                      })}
                    </Text>
                  </View>
                  <Text
                    className={`font-semibold ${isIncome ? "text-emerald-500" : "text-red-400"}`}
                  >
                    {isIncome ? "+" : "−"}
                    {formatMoney(transaction.amount)}
                  </Text>
                </View>
                <View className="mt-3 flex-row justify-end gap-5">
                  <Pressable
                    accessibilityLabel={`Edit ${transaction.type}`}
                    disabled={deletion.isPending}
                    onPress={() => setEditing(transaction)}
                    className="flex-row items-center gap-1 p-2"
                  >
                    <Pencil size={15} color={colors.subtle} />
                    <Text className="text-xs text-app-subtle">Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${transaction.type}`}
                    disabled={deletion.isPending}
                    onPress={() =>
                      Alert.alert(
                        `Delete ${transaction.type}?`,
                        `${formatMoney(transaction.amount)} will be removed and your balance updated.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deletion.mutate(transaction),
                          },
                        ]
                      )
                    }
                    className="flex-row items-center gap-1 p-2"
                  >
                    <Trash2 size={15} color="#f87171" />
                    <Text className="text-xs text-red-400">Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
      {editing && (
        <TransactionEditor
          key={`${editing.type}-${editing.id}`}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </ScrollView>
  );
}
