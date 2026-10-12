import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { DateField } from "@/components/DateField";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoryIcon,
  expenseCategories,
  incomeSources,
  formatLabel,
  type ExpenseCategory,
  type IncomeSource,
} from "@/lib/finance";
import { usePreferences } from "@/lib/preferences";
import { updateTransaction, type Transaction } from "@/services/transactions";

export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { colors } = usePreferences();
  const client = useQueryClient();
  const [amount, setAmount] = useState(transaction.amount);
  const [category, setCategory] = useState(transaction.source ?? transaction.category ?? "other");
  const [description, setDescription] = useState(transaction.description ?? "");
  const [date, setDate] = useState(transaction.occurredAt.slice(0, 10));
  const options = transaction.type === "income" ? incomeSources : expenseCategories;
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
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[90%] rounded-t-3xl bg-app-card p-5 pb-10">
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-5 text-xl font-semibold text-app-text">
              Edit {transaction.type}
            </Text>
            <Text className="mb-2 text-app-subtle">Amount</Text>
            <TextInput
              accessibilityLabel="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!mutation.isPending}
              className="h-12 rounded-xl border border-app-border px-3 text-app-text"
            />
            <Text className="mb-2 mt-5 text-app-subtle">
              {transaction.type === "income" ? "Source" : "Category"}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {options.map((option) => {
                const Icon = categoryIcon(option);
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    disabled={mutation.isPending}
                    onPress={() => setCategory(option)}
                    className={`flex-row items-center gap-2 rounded-xl border px-3 py-2 ${selected ? "border-app-primary bg-app-primary" : "border-app-border"}`}
                  >
                    <Icon size={14} color={selected ? colors.onPrimary : colors.subtle} />
                    <Text className={selected ? "text-app-on-primary" : "text-app-text"}>
                      {formatLabel(option)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <DateField value={date} onChange={setDate} disabled={mutation.isPending} />
            <Text className="mb-2 mt-5 text-app-subtle">Description</Text>
            <TextInput
              accessibilityLabel="Description"
              value={description}
              onChangeText={setDescription}
              editable={!mutation.isPending}
              multiline
              maxLength={1000}
              className="min-h-20 rounded-xl border border-app-border p-3 text-app-text"
            />
            {mutation.error && (
              <Text accessibilityRole="alert" className="mt-3 text-red-400">
                {mutation.error.message}
              </Text>
            )}
            <View className="mt-5 flex-row gap-3">
              <Pressable
                disabled={mutation.isPending}
                onPress={onClose}
                className="flex-1 items-center rounded-xl border border-app-border p-3"
              >
                <Text className="text-app-text">Cancel</Text>
              </Pressable>
              <Pressable
                disabled={!valid || mutation.isPending}
                onPress={() =>
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
                  })
                }
                className={`flex-1 items-center rounded-xl bg-app-primary p-3 ${!valid ? "opacity-40" : ""}`}
              >
                {mutation.isPending ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text className="font-semibold text-app-on-primary">Save changes</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
