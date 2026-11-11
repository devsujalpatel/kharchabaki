import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pause, Play, Plus, Trash2 } from "lucide-react-native";
import { usePreferences } from "@/lib/preferences";
import {
  getRecurring,
  saveRecurring,
  deleteRecurring,
  updateRecurring,
  getLabels,
  type RecurringTransaction,
} from "@/lib/finance-features";
import { expenseCategories, incomeSources, formatLabel, categoryIcon } from "@/lib/finance";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DateField } from "@/components/DateField";
import { KeyboardScreen } from "@/components/KeyboardScreen";

export default function RecurringScreen() {
  const client = useQueryClient();
  const { colors, formatMoney } = usePreferences();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("subscriptions");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState<RecurringTransaction["schedule"]>("monthly");
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const labels = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const query = useQuery({ queryKey: ["recurring"], queryFn: getRecurring });
  const options = [
    ...(type === "income" ? incomeSources : expenseCategories),
    ...(labels.data?.data ?? [])
      .filter((row) => row.active && row.kind === type)
      .map((row) => row.key),
  ];
  const refresh = () => {
    for (const key of ["recurring", "transactions", "balance", "dashboard-summary"])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveRecurring({
        type,
        amount: Number(amount),
        category,
        description,
        schedule,
        interval: 1,
        startAt: `${startAt}T00:00:00.000Z`,
        endAt: null,
        enabled: true,
      }),
    onSuccess: () => {
      setAmount("");
      setDescription("");
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: deleteRecurring, onSuccess: refresh });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateRecurring(id, { enabled }),
    onSuccess: refresh,
  });
  const rows = query.data?.data ?? [];
  const valid =
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number(amount) > 0 &&
    Number(amount) <= 999999999999.99 &&
    !!category;
  const error = save.error ?? query.error ?? remove.error ?? toggle.error;
  return (
    <KeyboardScreen>
      <Text className="text-3xl font-semibold text-app-text">Recurring</Text>
      <Text className="mt-2 text-sm text-app-subtle">
        Rent, bills, salary, and SIPs. Give regular payments a routine.
      </Text>
      <View className="mt-5 gap-4 rounded-3xl border border-app-border bg-app-card p-5">
        <View className="flex-row gap-2">
          {(["expense", "income"] as const).map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: type === value }}
              key={value}
              onPress={() => {
                setType(value);
                setCategory(value === "income" ? "salary" : "subscriptions");
              }}
              className={`min-h-12 flex-1 items-center justify-center rounded-xl ${type === value ? "bg-app-primary" : "bg-app-muted"}`}
            >
              <Text
                className={`text-sm font-medium ${type === value ? "text-app-on-primary" : "text-app-text"}`}
              >
                {formatLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs font-medium text-app-subtle">Amount</Text>
        <TextInput
          accessibilityLabel="Recurring amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.subtle}
          className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-xl text-app-text"
        />
        <CategoryPicker
          value={category}
          onChange={setCategory}
          options={options}
          label={type === "income" ? "Source" : "Category"}
        />
        <TextInput
          accessibilityLabel="Schedule name"
          value={description}
          onChangeText={setDescription}
          placeholder="Name or note (optional)"
          maxLength={1000}
          placeholderTextColor={colors.subtle}
          className="h-12 rounded-2xl border border-app-border bg-app-bg px-3 text-app-text"
        />
        <Text className="text-xs font-medium text-app-subtle">Frequency</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["daily", "weekly", "monthly", "yearly"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: schedule === value }}
              onPress={() => setSchedule(value)}
              className={`min-h-11 flex-1 items-center justify-center rounded-xl px-2 ${schedule === value ? "bg-app-primary" : "bg-app-muted"}`}
            >
              <Text
                className={`text-xs ${schedule === value ? "text-app-on-primary" : "text-app-text"}`}
              >
                {formatLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        <DateField value={startAt} onChange={setStartAt} label="First due date" />
        <Text className="text-xs leading-5 text-app-subtle">
          Due entries update your app balance while the app is open. Past dates catch up missed
          payments. Insufficient funds pause a schedule; resuming catches up from its next due date.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => save.mutate()}
          disabled={save.isPending || !valid}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-app-primary ${!valid || save.isPending ? "opacity-40" : ""}`}
        >
          <Plus size={18} color={colors.onPrimary} />
          <Text className="font-semibold text-app-on-primary">
            {save.isPending ? "Saving…" : "Add schedule"}
          </Text>
        </Pressable>
      </View>
      {error && (
        <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
          {error.message}
        </Text>
      )}
      {save.isSuccess && (
        <Text accessibilityRole="alert" className="mt-3 text-sm text-app-primary">
          Schedule saved.
        </Text>
      )}
      <Text className="mb-3 mt-6 text-base font-semibold text-app-text">Your schedules</Text>
      {query.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : !rows.length ? (
        <View className="items-center rounded-3xl border border-app-border bg-app-card p-8">
          <CalendarClock size={28} color={colors.subtle} />
          <Text className="mt-3 text-sm text-app-subtle">
            Your regular payments will appear here.
          </Text>
        </View>
      ) : (
        rows.map((row) => {
          const Icon = categoryIcon(row.category);
          return (
            <View
              key={row.id}
              className="mb-3 rounded-2xl border border-app-border bg-app-card p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="rounded-xl bg-app-muted p-3">
                  <Icon size={20} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-app-text">
                    {row.description || formatLabel(row.category)}
                  </Text>
                  <Text className="mt-1 text-sm text-app-primary">{formatMoney(row.amount)}</Text>
                </View>
              </View>
              <Text className="mt-3 text-xs text-app-subtle">
                {row.enabled ? `Next ${row.nextRunAt.slice(0, 10)}` : "Paused"} · Every{" "}
                {row.interval} {row.schedule}
              </Text>
              <View className="mt-3 flex-row justify-end gap-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={row.enabled ? "Pause schedule" : "Resume schedule"}
                  disabled={toggle.isPending}
                  onPress={() => toggle.mutate({ id: row.id, enabled: !row.enabled })}
                  className="min-h-11 flex-row items-center gap-2 rounded-xl bg-app-muted px-3"
                >
                  {row.enabled ? (
                    <Pause size={16} color={colors.foreground} />
                  ) : (
                    <Play size={16} color={colors.foreground} />
                  )}
                  <Text className="text-xs text-app-text">{row.enabled ? "Pause" : "Resume"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete schedule"
                  disabled={remove.isPending}
                  className="min-h-11 justify-center px-3"
                  onPress={() =>
                    Alert.alert(
                      "Delete schedule?",
                      "Existing transactions will stay in your history.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => remove.mutate(row.id),
                        },
                      ]
                    )
                  }
                >
                  <Trash2 size={18} color="#ef767a" />
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </KeyboardScreen>
  );
}
