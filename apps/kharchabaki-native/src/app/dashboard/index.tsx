import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Check, Wallet } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSession } from "@/lib/session-provider";
import { asObject } from "@/lib/offline-engine";
import {
  currentMonth,
  expenseCategories,
  incomeSources,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { addExpense, addIncome } from "@/services/transactions";
import { getLabels } from "@/lib/finance-features";
import { dashboardSummaryQuery } from "@/services/dashboard";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DateField } from "@/components/DateField";
import { FormSheet } from "@/components/FormSheet";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { MonthPicker } from "@/components/MonthPicker";

type EntryType = "income" | "expense";
const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const client = useQueryClient();
  const { data: session } = useAppSession();
  const { formatMoney, colors } = usePreferences();
  const [month, setMonth] = useState(currentMonth);
  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const [income, setIncome] = useState({ amount: "", source: "", description: "", date: today() });
  const [expense, setExpense] = useState({
    amount: "",
    category: "",
    description: "",
    date: today(),
  });
  const labels = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const summary = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });
  const refresh = () => {
    for (const key of ["balance", "dashboard-summary", "transactions"])
      void client.invalidateQueries({ queryKey: [key] });
  };
  function saved(result: unknown) {
    setFeedback(asObject(result).pending ? "Saved offline" : "Saved");
    setFormError("");
    setEntryType(null);
    refresh();
  }
  const incomeMutation = useMutation({
    mutationFn: addIncome,
    onSuccess: (result) => {
      setIncome({ amount: "", source: "", description: "", date: today() });
      saved(result);
    },
  });
  const expenseMutation = useMutation({
    mutationFn: addExpense,
    onSuccess: (result) => {
      setExpense({ amount: "", category: "", description: "", date: today() });
      saved(result);
    },
  });
  const isIncome = entryType === "income";
  const entry = isIncome ? income : expense;
  const mutation = isIncome ? incomeMutation : expenseMutation;
  const amount = Number(entry.amount);
  const selected = isIncome ? income.source : expense.category;
  const valid = Number.isFinite(amount) && amount >= 0.01 && !!selected;
  const balance = Number(summary.data?.data.balance ?? 0);
  const monthlyIncome = Number(summary.data?.data.income ?? 0);
  const monthlyExpense = Number(summary.data?.data.expense ?? 0);
  function open(type: EntryType) {
    incomeMutation.reset();
    expenseMutation.reset();
    setFormError("");
    setFeedback("");
    setEntryType(type);
  }
  function submit() {
    if (!valid) {
      setFormError("Enter an amount and choose a category.");
      return;
    }
    setFormError("");
    if (isIncome)
      incomeMutation.mutate({
        amount,
        source: income.source as IncomeSource,
        description: income.description.trim() || undefined,
        occurredAt: `${income.date}T00:00:00.000Z`,
      });
    else
      expenseMutation.mutate({
        amount,
        category: expense.category as ExpenseCategory,
        description: expense.description.trim() || undefined,
        occurredAt: `${expense.date}T00:00:00.000Z`,
      });
  }
  return (
    <KeyboardScreen>
      <View className="mb-2">
        <Text numberOfLines={1} className="text-sm text-app-subtle">
          {session?.localOnly
            ? "Saved on this device"
            : `Hi, ${session?.user.name.split(" ")[0] || "there"}`}
        </Text>
        <Text
          accessibilityRole="header"
          className="mt-1 text-3xl font-semibold tracking-tight text-app-text"
        >
          Your money
        </Text>
      </View>
      <MonthPicker month={month} onChange={setMonth} />
      <View className="rounded-3xl border border-app-primary/20 bg-app-primary/8 p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-app-subtle">Balance</Text>
          <Wallet size={20} color={colors.primary} />
        </View>
        {summary.isPending ? (
          <View className="mt-3 h-10 w-40 rounded-xl bg-app-muted" />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            className="mt-3 text-4xl font-semibold tracking-tight text-app-text"
          >
            {formatMoney(balance)}
          </Text>
        )}
      </View>
      <View className="mt-3 flex-row gap-3">
        <TotalCard
          label="Income"
          value={formatMoney(monthlyIncome)}
          loading={summary.isPending}
          type="income"
        />
        <TotalCard
          label="Expenses"
          value={formatMoney(monthlyExpense)}
          loading={summary.isPending}
          type="expense"
        />
      </View>
      {summary.error && (
        <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">
          {summary.error.message}
        </Text>
      )}
      {!summary.isPending && !summary.error && (
        <View className="mt-4 flex-row items-center justify-between px-1">
          <Text className="text-xs text-app-subtle">Monthly net</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className={`ml-4 min-w-0 text-sm font-semibold ${monthlyIncome >= monthlyExpense ? "text-emerald-500" : "text-red-400"}`}
          >
            {monthlyIncome >= monthlyExpense ? "+" : "−"}
            {formatMoney(Math.abs(monthlyIncome - monthlyExpense))}
          </Text>
        </View>
      )}
      <View className="mt-7 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={() => open("expense")}
          className="h-14 min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10"
        >
          <ArrowUpRight size={20} color="#f87171" />
          <Text numberOfLines={1} className="font-semibold text-app-text">
            Add expense
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add income"
          onPress={() => open("income")}
          className="h-14 min-w-0 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary"
        >
          <ArrowDownLeft size={20} color={colors.onPrimary} />
          <Text numberOfLines={1} className="font-semibold text-app-on-primary">
            Add income
          </Text>
        </Pressable>
      </View>
      {feedback && (
        <View accessibilityRole="alert" className="mt-4 flex-row items-center justify-center gap-2">
          <Check size={15} color={colors.primary} />
          <Text className="text-xs text-app-subtle">{feedback}</Text>
        </View>
      )}
      <FormSheet
        visible={entryType !== null}
        title={isIncome ? "Add income" : "Add expense"}
        onClose={() => setEntryType(null)}
        disabled={mutation.isPending}
        footer={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isIncome ? "Save income" : "Save expense"}
            disabled={!valid || mutation.isPending}
            onPress={submit}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!valid || mutation.isPending ? "opacity-40" : ""}`}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Check size={18} color={colors.onPrimary} />
                <Text className="font-semibold text-app-on-primary">Save</Text>
              </>
            )}
          </Pressable>
        }
      >
        <Text className="mb-2 text-xs font-medium text-app-subtle">Amount</Text>
        <TextInput
          accessibilityLabel="Amount"
          value={entry.amount}
          onChangeText={(value) =>
            isIncome
              ? setIncome((current) => ({ ...current, amount: value }))
              : setExpense((current) => ({ ...current, amount: value }))
          }
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.subtle}
          editable={!mutation.isPending}
          className="h-20 rounded-2xl border border-app-border bg-app-bg px-4 text-3xl font-semibold text-app-text"
        />
        <View className="mt-5 gap-2">
          <Text className="text-xs font-medium text-app-subtle">
            {isIncome ? "Source" : "Category"}
          </Text>
          <CategoryPicker
            label={isIncome ? "Source" : "Category"}
            value={selected}
            options={[...(isIncome ? incomeSources : expenseCategories), ...(labels.data?.data ?? []).filter((item) => item.kind === (isIncome ? "income" : "expense") && item.active).map((item) => item.key)]}
            disabled={mutation.isPending}
            onChange={(value) => {
              if (isIncome) setIncome((current) => ({ ...current, source: value }));
              else setExpense((current) => ({ ...current, category: value }));
              setFormError("");
            }}
          />
        </View>
        <DateField
          value={entry.date}
          onChange={(value) =>
            isIncome
              ? setIncome((current) => ({ ...current, date: value }))
              : setExpense((current) => ({ ...current, date: value }))
          }
          disabled={mutation.isPending}
        />
        <Text className="mb-2 mt-5 text-xs font-medium text-app-subtle">Note</Text>
        <TextInput
          accessibilityLabel="Note"
          value={entry.description}
          onChangeText={(value) =>
            isIncome
              ? setIncome((current) => ({ ...current, description: value }))
              : setExpense((current) => ({ ...current, description: value }))
          }
          placeholder="Optional"
          placeholderTextColor={colors.subtle}
          editable={!mutation.isPending}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          className="min-h-24 rounded-2xl border border-app-border bg-app-bg p-4 text-base text-app-text"
        />
        {(formError || mutation.error) && (
          <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">
            {formError || mutation.error?.message}
          </Text>
        )}
      </FormSheet>
    </KeyboardScreen>
  );
}
function TotalCard({
  label,
  value,
  type,
  loading,
}: {
  label: string;
  value: string;
  type: EntryType;
  loading: boolean;
}) {
  const Icon = type === "income" ? ArrowDownLeft : ArrowUpRight;
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-app-border bg-app-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={type === "income" ? "#10b981" : "#f87171"} />
        <Text numberOfLines={1} className="text-xs text-app-subtle">
          {label}
        </Text>
      </View>
      {loading ? (
        <View className="mt-3 h-6 w-20 rounded-md bg-app-muted" />
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          className="mt-3 text-xl font-semibold text-app-text"
        >
          {value}
        </Text>
      )}
    </View>
  );
}
