import { useAppSession } from "@/lib/session-provider";
import { asObject } from "@/lib/offline-engine";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Wallet, X } from "lucide-react-native";

import { addExpense, addIncome, type ExpenseCategory, type IncomeSource } from "@/services/transactions";
import { expenseCategories, incomeSources, currentMonth, categoryIcon } from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { MonthPicker } from "@/components/MonthPicker";
import { DateField } from "@/components/DateField";
import { dashboardSummaryQuery } from "@/services/dashboard";

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type EntryType = "income" | "expense" | null;

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: session } = useAppSession();
  const { formatMoney, colors } = usePreferences();
  const [entryType, setEntryType] = useState<EntryType>(null);
  const [feedback, setFeedback] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [incomeDate, setIncomeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState<IncomeSource | "">("");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | "">("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [formError, setFormError] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });
  const refreshSummary = () => {
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };
  const incomeMutation = useMutation({
    mutationFn: addIncome,
    onSuccess: (result) => {
      setFeedback(String(asObject(result).message ?? "Saved successfully"));
      setIncomeAmount("");
      setIncomeSource("");
      setIncomeDescription("");
      setFormError("");
      setEntryType(null);
      refreshSummary();
    },
  });
  const expenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: (result) => {
      setFeedback(String(asObject(result).message ?? "Saved successfully"));
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseDescription("");
      setFormError("");
      setEntryType(null);
      refreshSummary();
    },
  });
  const balance = Number(summaryQuery.data?.data.balance ?? 0);
  const income = Number(summaryQuery.data?.data.income ?? 0);
  const expense = Number(summaryQuery.data?.data.expense ?? 0);

  function handleAddIncome() {
    const amount = Number(incomeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!incomeSource) {
      setFormError("Choose an income source.");
      return;
    }
    setFormError("");
    incomeMutation.mutate({ amount, source: incomeSource, occurredAt: `${incomeDate}T00:00:00.000Z`, description: incomeDescription.trim() || undefined });
  }
  function handleAddExpense() {
    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    if (!expenseCategory) {
      setFormError("Choose an expense category.");
      return;
    }
    setFormError("");
    expenseMutation.mutate({ amount, category: expenseCategory, occurredAt: `${expenseDate}T00:00:00.000Z`, description: expenseDescription.trim() || undefined });
  }
  function chooseEntry(type: Exclude<EntryType, null>) {
    setFeedback("");
    setFormError("");
    setEntryType((current) => current === type ? null : type);
  }

  return (
    <ScrollView className="flex-1 bg-app-bg" contentContainerClassName="px-4 pb-8 pt-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View className="mb-2">
        <Text className="text-sm font-medium text-app-subtle">Welcome back, {session?.user.name.split(" ")[0] || "there"}</Text>
        <Text className="mt-1 text-2xl font-semibold tracking-tight text-app-text">Your money</Text>
      </View>
      <MonthPicker month={month} onChange={setMonth} />
      <View className="gap-3">
        <SummaryCard title="Current balance" value={formatMoney(balance)} icon={<Wallet size={19} color={colors.subtle} />} loading={summaryQuery.isPending} />
        <View className="flex-row gap-3">
          <View className="flex-1"><SummaryCard title="Income" value={formatMoney(income)} icon={<ArrowUp size={17} color="#34d399" />} type="income" loading={summaryQuery.isPending} /></View>
          <View className="flex-1"><SummaryCard title="Expenses" value={formatMoney(expense)} icon={<ArrowDown size={17} color="#f87171" />} type="expense" loading={summaryQuery.isPending} /></View>
        </View>
      </View>
      {summaryQuery.error && <View accessibilityRole="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3"><Text className="text-sm text-red-400">{summaryQuery.error.message}</Text></View>}
      <View className="mt-6">
        <Text className="text-base font-semibold text-app-text">Quick actions</Text>
        <Text className="mt-1 text-sm text-app-subtle">Choose what you want to record.</Text>
        <View className="mt-3 flex-row gap-3">
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: entryType === "expense" }} onPress={() => chooseEntry("expense")} className={`h-12 flex-1 flex-row items-center justify-center rounded-xl border ${entryType === "expense" ? "border-red-500 bg-red-500" : "border-app-border bg-app-card"}`}>
            <Plus size={17} color={entryType === "expense" ? "#fff" : colors.foreground} /><Text className={`ml-2 font-semibold ${entryType === "expense" ? "text-white" : "text-app-text"}`}>Add expense</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: entryType === "income" }} onPress={() => chooseEntry("income")} className={`h-12 flex-1 flex-row items-center justify-center rounded-xl border ${entryType === "income" ? "border-app-primary bg-app-primary" : "border-app-border bg-app-card"}`}>
            <Plus size={17} color={entryType === "income" ? colors.onPrimary : colors.foreground} /><Text className={`ml-2 font-semibold ${entryType === "income" ? "text-app-on-primary" : "text-app-text"}`}>Add income</Text>
          </Pressable>
        </View>
      </View>
      {feedback && <Text accessibilityRole="alert" className="mt-3 text-sm text-app-primary">{feedback}</Text>}
      {entryType === "income" && (
        <View className="mt-4 rounded-2xl border border-app-border bg-app-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center"><View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10"><ArrowUp size={18} color="#34d399" /></View><View><Text className="text-base font-semibold text-app-text">Add income</Text><Text className="mt-0.5 text-sm text-app-subtle">Record money you received.</Text></View></View>
            <Pressable accessibilityLabel="Close income form" onPress={() => setEntryType(null)} className="h-11 w-11 items-center justify-center"><X size={18} color={colors.subtle} /></Pressable>
          </View>
          <FieldLabel label="Amount" /><TextInput value={incomeAmount} onChangeText={setIncomeAmount} placeholder="0.00" placeholderTextColor={colors.subtle} keyboardType="decimal-pad" editable={!incomeMutation.isPending} className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-base text-app-text" />
          <FieldLabel label="Source" />
          <View className="flex-row flex-wrap gap-2">{incomeSources.map((source) => { const selected = incomeSource === source; const Icon = categoryIcon(source); return <Pressable key={source} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setIncomeSource(source); setFormError(""); }} disabled={incomeMutation.isPending} className={`min-h-11 flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${selected ? "border-app-primary bg-app-primary" : "border-app-border bg-app-bg"}`}><Icon size={15} color={selected ? colors.onPrimary : colors.subtle} /><Text className={`text-sm ${selected ? "font-medium text-app-on-primary" : "text-app-subtle"}`}>{formatLabel(source)}</Text></Pressable>; })}</View>
          <DateField value={incomeDate} onChange={setIncomeDate} disabled={incomeMutation.isPending} />
          <FieldLabel label="Description" optional /><TextInput value={incomeDescription} onChangeText={setIncomeDescription} placeholder="Where did this money come from?" placeholderTextColor={colors.subtle} multiline numberOfLines={2} textAlignVertical="top" editable={!incomeMutation.isPending} className="min-h-20 rounded-xl border border-app-border bg-app-bg px-4 py-3 text-base text-app-text" />
          {formError && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">{formError}</Text>}
          {incomeMutation.isError && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">{incomeMutation.error.message}</Text>}
          <Pressable onPress={handleAddIncome} disabled={incomeMutation.isPending} className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${incomeMutation.isPending ? "bg-app-muted" : "bg-app-primary"}`}>{incomeMutation.isPending ? <><ActivityIndicator color={colors.onPrimary} /><Text className="ml-2 font-semibold text-app-on-primary">Adding income…</Text></> : <><Plus size={17} color={colors.onPrimary} /><Text className="ml-2 font-semibold text-app-on-primary">Add income</Text></>}</Pressable>
        </View>
      )}
      {entryType === "expense" && (
        <View className="mt-4 rounded-2xl border border-app-border bg-app-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center"><View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-red-500/10"><ArrowDown size={18} color="#f87171" /></View><View><Text className="text-base font-semibold text-app-text">Add expense</Text><Text className="mt-0.5 text-sm text-app-subtle">Record money you spent.</Text></View></View>
            <Pressable accessibilityLabel="Close expense form" onPress={() => setEntryType(null)} className="h-11 w-11 items-center justify-center"><X size={18} color={colors.subtle} /></Pressable>
          </View>
          <FieldLabel label="Amount" /><TextInput value={expenseAmount} onChangeText={setExpenseAmount} placeholder="0.00" placeholderTextColor={colors.subtle} keyboardType="decimal-pad" editable={!expenseMutation.isPending} className="h-12 rounded-xl border border-app-border bg-app-bg px-4 text-base text-app-text" />
          <FieldLabel label="Category" />
          <View className="flex-row flex-wrap gap-2">{expenseCategories.map((category) => { const selected = expenseCategory === category; const Icon = categoryIcon(category); return <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setExpenseCategory(category); setFormError(""); }} disabled={expenseMutation.isPending} className={`min-h-11 flex-row items-center gap-2 rounded-xl border px-3 py-2.5 ${selected ? "border-app-primary bg-app-primary" : "border-app-border bg-app-bg"}`}><Icon size={15} color={selected ? colors.onPrimary : colors.subtle} /><Text className={`text-sm ${selected ? "font-medium text-app-on-primary" : "text-app-subtle"}`}>{formatLabel(category)}</Text></Pressable>; })}</View>
          <DateField value={expenseDate} onChange={setExpenseDate} disabled={expenseMutation.isPending} />
          <FieldLabel label="Description" optional /><TextInput value={expenseDescription} onChangeText={setExpenseDescription} placeholder="What did you spend it on?" placeholderTextColor={colors.subtle} multiline numberOfLines={2} textAlignVertical="top" editable={!expenseMutation.isPending} className="min-h-20 rounded-xl border border-app-border bg-app-bg px-4 py-3 text-base text-app-text" />
          {formError && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">{formError}</Text>}
          {expenseMutation.isError && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">{expenseMutation.error.message}</Text>}
          <Pressable onPress={handleAddExpense} disabled={expenseMutation.isPending} className={`mt-5 h-12 flex-row items-center justify-center rounded-xl ${expenseMutation.isPending ? "bg-app-muted" : "bg-red-500"}`}>{expenseMutation.isPending ? <><ActivityIndicator color="#fff" /><Text className="ml-2 font-semibold text-white">Adding expense…</Text></> : <><Plus size={17} color="#fff" /><Text className="ml-2 font-semibold text-white">Add expense</Text></>}</Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function FieldLabel({ label, optional = false }: { label: string; optional?: boolean }) {
  return <View className="mb-2 mt-5 flex-row items-center"><Text className="text-sm font-medium text-app-text">{label}</Text>{optional && <Text className="ml-1 text-xs text-app-subtle">(optional)</Text>}</View>;
}

function SummaryCard({ title, value, icon, type, loading }: { title: string; value: string; icon: React.ReactNode; type?: "income" | "expense"; loading: boolean }) {
  const background = type === "income" ? "bg-emerald-500/10" : type === "expense" ? "bg-red-500/10" : "bg-app-primary/8";
  return <View className={`rounded-2xl border border-app-border p-4 ${background}`}><View className="flex-row items-center justify-between"><View className="min-w-0 flex-1"><Text className="text-sm text-app-subtle">{title}</Text>{loading ? <View className="mt-2 h-7 w-24 rounded-md bg-app-muted" /> : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="mt-1 text-xl font-semibold tracking-tight text-app-text">{value}</Text>}</View><View className="ml-2 h-10 w-10 items-center justify-center rounded-xl bg-app-muted">{icon}</View></View></View>;
}
