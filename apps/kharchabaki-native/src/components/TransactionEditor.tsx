import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Check, CircleAlert } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DateField } from "@/components/DateField";
import { FormSheet } from "@/components/FormSheet";
import {
  expenseCategories,
  incomeSources,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { updateTransaction, type Transaction } from "@/services/transactions";
import { getLabels } from "@/lib/finance-features";

export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { colors, currency } = usePreferences();
  const client = useQueryClient();
  const [amount, setAmount] = useState(transaction.amount);
  const [category, setCategory] = useState(transaction.source ?? transaction.category ?? "other");
  const [description, setDescription] = useState(transaction.description ?? "");
  const [date, setDate] = useState(transaction.occurredAt.slice(0, 10));
  const labels = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const options = [...(transaction.type === "income" ? incomeSources : expenseCategories), ...(labels.data?.data ?? []).filter((item) => item.kind === transaction.type).map((item) => item.key), category];
  const mutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: async () => {
      await Promise.all(
        ["transactions", "dashboard-summary", "balance"].map((key) =>
          client.invalidateQueries({ queryKey: [key] })
        )
      );
      onClose();
    },
  });
  const valid =
    Number.isFinite(Number(amount)) &&
    Number(amount) >= 0.01 &&
    options.some((option) => option === category);
  const save = () =>
    mutation.mutate({
      transaction,
      data: {
        amount: Number(amount),
        description,
        occurredAt:
          date === transaction.occurredAt.slice(0, 10)
            ? transaction.occurredAt
            : `${date}T00:00:00.000Z`,
        ...(transaction.type === "income"
          ? { source: category as IncomeSource }
          : { category: category as ExpenseCategory }),
      },
    });

  return (
    <FormSheet
      visible
      title={`Edit ${transaction.type}`}
      onClose={onClose}
      disabled={mutation.isPending}
      footer={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save transaction"
          disabled={!valid || mutation.isPending}
          onPress={save}
          className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!valid || mutation.isPending ? "opacity-50" : ""}`}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Check size={20} color={colors.onPrimary} />
              <Text className="font-semibold text-app-on-primary">Save</Text>
            </>
          )}
        </Pressable>
      }
    >
      <Text className="mb-2 text-sm font-medium text-app-subtle">Amount</Text>
      <View className="mb-5 flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-bg px-4">
        <Text className="text-sm font-semibold text-app-subtle">{currency}</Text>
        <TextInput
          accessibilityLabel="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={!mutation.isPending}
          placeholder="0.00"
          placeholderTextColor={colors.subtle}
          className="h-16 min-w-0 flex-1 text-3xl font-semibold text-app-text"
        />
      </View>
      <CategoryPicker
        value={category}
        onChange={setCategory}
        options={options}
        label={transaction.type === "income" ? "Source" : "Category"}
        disabled={mutation.isPending}
      />
      <DateField value={date} onChange={setDate} disabled={mutation.isPending} />
      <Text className="mb-2 mt-5 text-sm font-medium text-app-subtle">Note</Text>
      <TextInput
        accessibilityLabel="Description"
        value={description}
        onChangeText={setDescription}
        editable={!mutation.isPending}
        placeholder="Optional"
        placeholderTextColor={colors.subtle}
        multiline
        maxLength={1000}
        textAlignVertical="top"
        className="min-h-24 rounded-2xl border border-app-border bg-app-bg p-4 text-app-text"
      />
      {mutation.error && (
        <View
          accessibilityRole="alert"
          className="mt-4 flex-row items-start gap-2 rounded-xl bg-app-muted p-3"
        >
          <CircleAlert size={18} color={colors.subtle} />
          <Text className="min-w-0 flex-1 text-sm text-app-text">{mutation.error.message}</Text>
        </View>
      )}
    </FormSheet>
  );
}
