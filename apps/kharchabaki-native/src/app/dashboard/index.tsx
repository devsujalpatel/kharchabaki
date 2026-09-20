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
import { dashboardSummaryQuery } from "@/services/dashboard";

const expenseCategories: ExpenseCategory[] = [
  "food",
  "travel",
  "shopping",
  "bills",
  "rent",
  "phone",
  "beauty",
  "clothing",
  "fuel",
  "gifts",
  "electronics",
  "snacks",
  "vegetables",
  "fruits",
  "repairs",
  "health",
  "education",
  "entertainment",
  "other",
];

const incomeSources: IncomeSource[] = [
  "salary",
  "pocket-money",
  "gift",
  "part-time",
  "investment",
  "bonus",
  "other",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Dashboard() {
  const queryClient = useQueryClient();

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
    queryKey: ["dashboard-summary"],
    queryFn: dashboardSummaryQuery,
  });

  const incomeMutation = useMutation({
    mutationFn: addIncome,

    onSuccess: () => {
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

    onSuccess: () => {
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

    if (!amount || amount <= 0) {
      return;
    }

    if (!incomeSource) {
      return;
    }

    incomeMutation.mutate({
      amount,
      source: incomeSource,
      description: incomeDescription.trim() || undefined,
    });
  }

  function handleAddExpense() {
    const amount = Number(expenseAmount);

    if (!amount || amount <= 0) {
      return;
    }

    if (!expenseCategory) {
      return;
    }

    expenseMutation.mutate({
      amount,
      category: expenseCategory,
      description: expenseDescription.trim() || undefined,
    });
  }

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerClassName="px-4 pt-6 pb-32"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-semibold text-white">Dashboard</Text>

        <Text className="mt-1 text-sm text-zinc-500">
          Keep track of your money without the noise.
        </Text>
      </View>

      {/* Summary */}
      <View className="gap-3">
        <SummaryCard
          title="Current Balance"
          value={formatMoney(balance)}
          icon={<Wallet size={19} color="#a1a1aa" />}
          loading={isSummaryLoading}
        />

        <SummaryCard
          title="Total Income"
          value={formatMoney(income)}
          icon={<ArrowUp size={19} color="#34d399" />}
          type="income"
          loading={isSummaryLoading}
        />

        <SummaryCard
          title="Total Expenses"
          value={formatMoney(expense)}
          icon={<ArrowDown size={19} color="#f87171" />}
          type="expense"
          loading={isSummaryLoading}
        />
      </View>

      {isSummaryError && (
        <View className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <Text className="text-sm text-red-400">Failed to load dashboard summary.</Text>
        </View>
      )}

      {/* Add income */}
      <View className="mt-6 rounded-2xl border border-zinc-800 bg-[#080808] p-5">
        <View className="mb-5 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <ArrowUp size={18} color="#34d399" />
          </View>

          <View>
            <Text className="text-base font-semibold text-white">Add income</Text>

            <Text className="mt-0.5 text-sm text-zinc-500">Record money you received.</Text>
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
          className="h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-white"
        />

        {/* Source */}
        <FieldLabel label="Source" />

        <View className="flex-row flex-wrap gap-2">
          {incomeSources.map((source) => {
            const selected = incomeSource === source;

            return (
              <Pressable
                key={source}
                onPress={() => setIncomeSource(source)}
                disabled={incomeMutation.isPending}
                className={`rounded-xl border px-3 py-2.5 ${
                  selected ? "border-white bg-white" : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <Text
                  className={`text-sm ${selected ? "font-medium text-black" : "text-zinc-400"}`}
                >
                  {formatLabel(source)}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
          className="min-h-[90px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
        />

        {/* Submit */}
        <Pressable
          onPress={handleAddIncome}
          disabled={incomeMutation.isPending}
          className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${
            incomeMutation.isPending ? "bg-zinc-700" : "bg-white"
          }`}
        >
          {incomeMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Plus size={17} color="#000" />
              <Text className="ml-2 font-semibold text-black">Add income</Text>
            </>
          )}
        </Pressable>

        {incomeMutation.isError && (
          <Text className="mt-3 text-sm text-red-400">{incomeMutation.error.message}</Text>
        )}
      </View>

      {/* Add expense */}
      <View className="mt-4 rounded-2xl border border-zinc-800 bg-[#080808] p-5">
        <View className="mb-5 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <ArrowDown size={18} color="#f87171" />
          </View>

          <View>
            <Text className="text-base font-semibold text-white">Add expense</Text>

            <Text className="mt-0.5 text-sm text-zinc-500">Record money you spent.</Text>
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
          className="h-12 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-white"
        />

        {/* Category */}
        <FieldLabel label="Category" />

        <View className="flex-row flex-wrap gap-2">
          {expenseCategories.map((category) => {
            const selected = expenseCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setExpenseCategory(category)}
                disabled={expenseMutation.isPending}
                className={`rounded-xl border px-3 py-2.5 ${
                  selected ? "border-white bg-white" : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <Text
                  className={`text-sm ${selected ? "font-medium text-black" : "text-zinc-400"}`}
                >
                  {formatLabel(category)}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
          className="min-h-22.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
        />

        {/* Submit */}
        <Pressable
          onPress={handleAddExpense}
          disabled={expenseMutation.isPending}
          className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${
            expenseMutation.isPending ? "bg-zinc-700" : "bg-red-500"
          }`}
        >
          {expenseMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Plus size={17} color="#fff" />
              <Text className="ml-2 font-semibold text-white">Add expense</Text>
            </>
          )}
        </Pressable>

        {expenseMutation.isError && (
          <Text className="mt-3 text-sm text-red-400">{expenseMutation.error.message}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function FieldLabel({ label, optional = false }: { label: string; optional?: boolean }) {
  return (
    <View className="mb-2 mt-5 flex-row items-center">
      <Text className="text-sm font-medium text-zinc-300">{label}</Text>

      {optional && <Text className="ml-1 text-xs text-zinc-600">(optional)</Text>}
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
    type === "income" ? "bg-emerald-500/10" : type === "expense" ? "bg-red-500/10" : "bg-[#080808]";

  return (
    <View className={`rounded-2xl border border-zinc-800 p-5 ${background}`}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-zinc-500">{title}</Text>

          {loading ? (
            <View className="mt-2 h-7 w-32 rounded-md bg-zinc-800" />
          ) : (
            <Text className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</Text>
          )}
        </View>

        <View className="h-10 w-10 items-center justify-center rounded-xl bg-zinc-900">{icon}</View>
      </View>
    </View>
  );
}
