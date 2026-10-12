import { useAppSession } from "@/lib/session-provider";
import { asObject } from "@/lib/offline-engine";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Wallet } from "lucide-react-native";

import {
  addExpense,
  addIncome,
  type ExpenseCategory,
  type IncomeSource,
} from "@/services/transactions";
import { expenseCategories, incomeSources, currentMonth, categoryIcon } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { MonthPicker } from "@/components/MonthPicker";
import { DateField } from "@/components/DateField";
import { MonthlyChart } from "@/components/MonthlyChart";
import { dashboardSummaryQuery } from "@/services/dashboard";

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: session } = useAppSession();
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [feedback, setFeedback] = useState("");
  const { formatMoney, colors } = usePreferences();
  const [month, setMonth] = useState(currentMonth);

  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState<IncomeSource | "">("");
  const [incomeDescription, setIncomeDescription] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | "">("");
  const [expenseDescription, setExpenseDescription] = useState("");

  const {
    data: summary,
    isPending: isSummaryLoading,
    isError: isSummaryError,
  } = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });

  const incomeMutation = useMutation({
    mutationFn: addIncome,

    onSuccess: (result) => {
      setFeedback(String(asObject(result).message ?? "Saved successfully"));
      setIncomeAmount("");
      setIncomeSource("");
      setIncomeDescription("");

      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary"],
      });

      queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
    },
  });

  const expenseMutation = useMutation({
    mutationFn: addExpense,

    onSuccess: (result) => {
      setFeedback(String(asObject(result).message ?? "Saved successfully"));
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseDescription("");

      queryClient.invalidateQueries({
        queryKey: ["balance"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary"],
      });

      queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
    },
  });

  const balance = Number(summary?.data.balance ?? 0);
  const income = Number(summary?.data.income ?? 0);
  const expense = Number(summary?.data.expense ?? 0);

  function handleAddIncome() {
    const amount = Number(incomeAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (!incomeSource) {
      return;
    }

    incomeMutation.mutate({
      amount,
      source: incomeSource,
      occurredAt: `${incomeDate}T00:00:00.000Z`,
      description: incomeDescription.trim() || undefined,
    });
  }

  function handleAddExpense() {
    const amount = Number(expenseAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (!expenseCategory) {
      return;
    }

    expenseMutation.mutate({
      amount,
      category: expenseCategory,
      occurredAt: `${expenseDate}T00:00:00.000Z`,
      description: expenseDescription.trim() || undefined,
    });
  }

  return (
    <ScrollView
      className="flex-1 bg-app-bg"
      contentContainerClassName="px-4 pt-6 pb-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-app-primary">
          Hello, {session?.user.name.split(" ")[0] || "there"}
        </Text>
        <Text className="text-3xl font-semibold tracking-tight text-app-text">
          Your money, in focus.
        </Text>

        <Text className="mt-1 text-sm text-app-subtle">
          Keep track of your money without the noise.
        </Text>
      </View>

      <MonthPicker month={month} onChange={setMonth} />
      {/* Summary */}
      <View className="gap-3">
        <SummaryCard
          title="Current Balance"
          value={formatMoney(balance)}
          icon={<Wallet size={19} color="#a1a1aa" />}
          loading={isSummaryLoading}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <SummaryCard
              title="Income"
              value={formatMoney(income)}
              icon={<ArrowUp size={19} color="#34d399" />}
              type="income"
              loading={isSummaryLoading}
            />
          </View>

          <View className="flex-1">
            <SummaryCard
              title="Expenses"
              value={formatMoney(expense)}
              icon={<ArrowDown size={19} color="#f87171" />}
              type="expense"
              loading={isSummaryLoading}
            />
          </View>
        </View>
      </View>

      {isSummaryError && (
        <View className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <Text className="text-sm text-red-400">Failed to load dashboard summary.</Text>
        </View>
      )}

      {!isSummaryLoading && !isSummaryError && (
        <MonthlyChart
          key={month}
          daily={summary?.data.daily ?? []}
          monthly={summary?.data.monthly ?? []}
        />
      )}
      {!isSummaryLoading && !isSummaryError && (
        <View className="my-2 rounded-2xl border border-app-border bg-app-card p-4">
          <Text className="text-sm text-app-subtle">Net for this month</Text>
          <Text
            className={`mt-1 text-xl font-semibold ${income >= expense ? "text-emerald-500" : "text-red-400"}`}
          >
            {income >= expense ? "+" : "−"}
            {formatMoney(Math.abs(income - expense))}
          </Text>
          <Text className="mt-1 text-xs text-app-subtle">
            Income minus expenses for your selected month.
          </Text>
        </View>
      )}
      <Text className="mt-6 text-lg font-semibold text-app-text">Quick entry</Text>
      <View className="mt-3 flex-row rounded-2xl bg-app-muted p-1">
        {(["expense", "income"] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setEntryType(type)}
            className={`flex-1 items-center rounded-xl py-3 ${entryType === type ? "bg-app-primary" : ""}`}
          >
            <Text
              className={
                entryType === type ? "font-semibold text-app-on-primary" : "text-app-subtle"
              }
            >
              {type === "expense" ? "Add expense" : "Add income"}
            </Text>
          </Pressable>
        ))}
      </View>
      {feedback && (
        <Text accessibilityRole="alert" className="mt-3 text-sm text-app-primary">
          {feedback}
        </Text>
      )}
      {/* Add income */}
      {entryType === "income" && (
        <View className="mt-4 rounded-2xl border border-app-border bg-app-card p-5">
          <View className="mb-5 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <ArrowUp size={18} color="#34d399" />
            </View>

            <View>
              <Text className="text-base font-semibold text-app-text">Add income</Text>

              <Text className="mt-0.5 text-sm text-app-subtle">Record money you received.</Text>
            </View>
          </View>

          {/* Amount */}
          <FieldLabel label="Amount" />

          <TextInput
            value={incomeAmount}
            onChangeText={setIncomeAmount}
            placeholder="5000"
            placeholderTextColor="#52525b"
            keyboardType="decimal-pad"
            editable={!incomeMutation.isPending}
            className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-app-text"
          />

          {/* Source */}
          <FieldLabel label="Source" />

          <View className="flex-row flex-wrap gap-2">
            {incomeSources.map((source) => {
              const selected = incomeSource === source;
              const Icon = categoryIcon(source);

              return (
                <Pressable
                  key={source}
                  onPress={() => setIncomeSource(source)}
                  disabled={incomeMutation.isPending}
                  className={`flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    selected ? "border-app-primary bg-app-primary" : "border-app-border bg-app-bg"
                  }`}
                >
                  <Icon size={15} color={selected ? colors.onPrimary : colors.subtle} />
                  <Text
                    className={`text-sm ${selected ? "font-medium text-app-on-primary" : "text-app-subtle"}`}
                  >
                    {formatLabel(source)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DateField
            value={incomeDate}
            onChange={setIncomeDate}
            disabled={incomeMutation.isPending}
          />
          {/* Description */}
          <FieldLabel label="Description" optional />

          <TextInput
            value={incomeDescription}
            onChangeText={setIncomeDescription}
            placeholder="Where did this money come from?"
            placeholderTextColor="#52525b"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!incomeMutation.isPending}
            className="min-h-22.5 rounded-xl border border-app-border bg-app-bg px-4 py-3 text-app-text"
          />

          {/* Submit */}
          <Pressable
            onPress={handleAddIncome}
            disabled={incomeMutation.isPending}
            className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${
              incomeMutation.isPending ? "bg-app-muted" : "bg-app-primary"
            }`}
          >
            {incomeMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus size={17} color={colors.onPrimary} />
                <Text className="ml-2 font-semibold text-app-on-primary">Add income</Text>
              </>
            )}
          </Pressable>

          {incomeMutation.isError && (
            <Text className="mt-3 text-sm text-red-400">{incomeMutation.error.message}</Text>
          )}
        </View>
      )}

      {/* Add expense */}
      {entryType === "expense" && (
        <View className="mt-4 rounded-2xl border border-app-border bg-app-card p-5">
          <View className="mb-5 flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <ArrowDown size={18} color="#f87171" />
            </View>

            <View>
              <Text className="text-base font-semibold text-app-text">Add expense</Text>

              <Text className="mt-0.5 text-sm text-app-subtle">Record money you spent.</Text>
            </View>
          </View>

          {/* Amount */}
          <FieldLabel label="Amount" />

          <TextInput
            value={expenseAmount}
            onChangeText={setExpenseAmount}
            placeholder="500"
            placeholderTextColor="#52525b"
            keyboardType="decimal-pad"
            editable={!expenseMutation.isPending}
            className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-app-text"
          />

          {/* Category */}
          <FieldLabel label="Category" />

          <View className="flex-row flex-wrap gap-2">
            {expenseCategories.map((category) => {
              const selected = expenseCategory === category;
              const Icon = categoryIcon(category);

              return (
                <Pressable
                  key={category}
                  onPress={() => setExpenseCategory(category)}
                  disabled={expenseMutation.isPending}
                  className={`flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    selected ? "border-app-primary bg-app-primary" : "border-app-border bg-app-bg"
                  }`}
                >
                  <Icon size={15} color={selected ? colors.onPrimary : colors.subtle} />
                  <Text
                    className={`text-sm ${selected ? "font-medium text-app-on-primary" : "text-app-subtle"}`}
                  >
                    {formatLabel(category)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <DateField
            value={expenseDate}
            onChange={setExpenseDate}
            disabled={expenseMutation.isPending}
          />
          {/* Description */}
          <FieldLabel label="Description" optional />

          <TextInput
            value={expenseDescription}
            onChangeText={setExpenseDescription}
            placeholder="What did you spend it on?"
            placeholderTextColor="#52525b"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!expenseMutation.isPending}
            className="min-h-22.5 rounded-xl border border-app-border bg-app-bg px-4 py-3 text-app-text"
          />

          {/* Submit */}
          <Pressable
            onPress={handleAddExpense}
            disabled={expenseMutation.isPending}
            className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${
              expenseMutation.isPending ? "bg-app-muted" : "bg-red-500"
            }`}
          >
            {expenseMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus size={17} color="#fff" />
                <Text className="ml-2 font-semibold text-app-text">Add expense</Text>
              </>
            )}
          </Pressable>

          {expenseMutation.isError && (
            <Text className="mt-3 text-sm text-red-400">{expenseMutation.error.message}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function FieldLabel({ label, optional = false }: { label: string; optional?: boolean }) {
  return (
    <View className="mb-2 mt-5 flex-row items-center">
      <Text className="text-sm font-medium text-app-text">{label}</Text>

      {optional && <Text className="ml-1 text-xs text-app-subtle">(optional)</Text>}
    </View>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  type,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  type?: "income" | "expense";
  loading: boolean;
}) {
  const background =
    type === "income"
      ? "bg-emerald-500/10"
      : type === "expense"
        ? "bg-red-500/10"
        : "bg-app-primary/8";

  return (
    <View className={`rounded-2xl border border-app-border p-5 ${background}`}>
      <View className={type ? "gap-2" : "flex-row items-center justify-between"}>
        <View className={type ? "min-w-0" : "min-w-0 flex-1"}>
          <Text className="text-sm text-app-subtle">{title}</Text>

          {loading ? (
            <View className={`mt-2 h-7 rounded-md bg-app-muted ${type ? "w-20" : "w-32"}`} />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              className={`mt-1 font-semibold tracking-tight text-app-text ${type ? "text-xl" : "text-3xl"}`}
            >
              {value}
            </Text>
          )}
        </View>

        {!type && (
          <View className="ml-3 h-10 w-10 items-center justify-center rounded-xl bg-app-muted">
            {icon}
          </View>
        )}
      </View>
    </View>
  );
}
