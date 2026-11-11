import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, TrendingUp } from "lucide-react-native";
import { usePreferences } from "@/lib/preferences";
import { getRecurring, saveRecurring } from "@/lib/finance-features";
import { transactionsQuery, type Transaction } from "@/services/transactions";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { FormSheet } from "@/components/FormSheet";
import { DateField } from "@/components/DateField";
import { TransactionEditor } from "@/components/TransactionEditor";
import { formatLabel } from "@/lib/finance";

export default function InvestmentsScreen() {
  const { colors, formatMoney } = usePreferences();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Transaction | null>(null);
  const [sip, setSip] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const history = useQuery({
    queryKey: ["transactions", "investments"],
    queryFn: () => transactionsQuery({ type: "all", category: "all", search: "" }),
  });
  const recurring = useQuery({ queryKey: ["recurring"], queryFn: getRecurring });
  const rows = (history.data?.data ?? []).filter((row) =>
    row.type === "expense"
      ? row.category === "mutual-funds"
      : ["investment-profit", "investment-redemption"].includes(row.source ?? "")
  );
  const total = (key: string) =>
    rows
      .filter((row) => (row.category ?? row.source) === key)
      .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
  const sips = (recurring.data?.data ?? []).filter(
    (row) =>
      row.type === "expense" &&
      row.category === "mutual-funds" &&
      row.schedule === "monthly" &&
      Number(row.interval) === 1
  );
  const valid =
    /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number(amount) > 0 &&
    Number(amount) <= 999999999999.99 &&
    !!name.trim();
  const save = useMutation({
    mutationFn: () =>
      saveRecurring({
        type: "expense",
        category: "mutual-funds",
        amount: Number(amount),
        description: name.trim(),
        schedule: "monthly",
        interval: 1,
        startAt: `${date}T00:00:00.000Z`,
        endAt: null,
        enabled: true,
      }),
    onSuccess: () => {
      setSip(false);
      setName("");
      setAmount("");
      for (const key of ["recurring", "transactions", "dashboard-summary", "balance"])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  function open(category: string) {
    const now = new Date().toISOString();
    setDraft({
      id: "draft",
      type: category === "mutual-funds" ? "expense" : "income",
      amount: "",
      category: category === "mutual-funds" ? category : null,
      source: category === "mutual-funds" ? null : category,
      description: "",
      occurredAt: now,
      createdAt: now,
    });
  }
  return (
    <KeyboardScreen>
      <View className="flex-row items-center gap-2">
        <TrendingUp size={18} color={colors.primary} />
        <Text className="text-xs uppercase tracking-widest text-app-primary">
          Build your future
        </Text>
      </View>
      <Text className="mt-2 text-3xl font-semibold text-app-text">Investments</Text>
      <Text className="mt-2 text-sm text-app-subtle">
        Mutual funds, cash returns, and a little consistency.
      </Text>
      {history.error && (
        <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
          {history.error.message}
        </Text>
      )}
      <View className="mt-5 rounded-3xl border border-app-primary/20 bg-app-card p-5">
        <Text className="text-sm text-app-subtle">Total invested</Text>
        <Text className="mt-3 text-3xl font-semibold text-app-text">
          {history.isPending ? "…" : formatMoney(total("mutual-funds"))}
        </Text>
        <View className="mt-5 flex-row gap-3">
          {[
            ["Profit received", "investment-profit"],
            ["Capital returned", "investment-redemption"],
          ].map(([label, key]) => (
            <View key={key} className="flex-1 rounded-2xl bg-app-muted p-3">
              <Text className="text-xs text-app-subtle">{label}</Text>
              <Text className="mt-2 font-semibold text-app-text">{formatMoney(total(key))}</Text>
            </View>
          ))}
        </View>
        <Text className="mt-4 text-xs leading-5 text-app-subtle">
          Cash records only. Market value and unrealised returns are not included. Record returned
          principal and received profit separately.
        </Text>
      </View>
      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => open("mutual-funds")}
          className="min-h-14 flex-1 items-center justify-center rounded-2xl bg-app-primary"
        >
          <Text className="font-semibold text-app-on-primary">+ Invest</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => open("investment-profit")}
          className="min-h-14 flex-1 items-center justify-center rounded-2xl border border-app-border bg-app-card"
        >
          <Text className="font-semibold text-app-text">+ Earnings</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => open("investment-redemption")}
        className="min-h-12 items-center justify-center"
      >
        <Text className="text-sm text-app-primary">Record returned capital</Text>
      </Pressable>
      <View className="mt-3 rounded-3xl border border-app-border bg-app-card p-5">
        <View className="flex-row items-center gap-2">
          <CalendarClock size={20} color={colors.primary} />
          <Text className="text-base font-semibold text-app-text">Monthly SIPs</Text>
        </View>
        <Text className="mt-3 text-sm text-app-text">
          {sips.filter((row) => row.enabled).length} active ·{" "}
          {formatMoney(
            sips
              .filter((row) => row.enabled)
              .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100
          )}{" "}
          per month
        </Text>
        <Text className="mt-3 text-xs leading-5 text-app-subtle">
          Deducts from your tracked app balance when due entries are processed. No bank debit is
          made. Insufficient funds pause the rule.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            save.reset();
            setSip(true);
          }}
          className="mt-4 min-h-12 items-center justify-center rounded-2xl bg-app-primary"
        >
          <Text className="font-semibold text-app-on-primary">+ Set up monthly SIP</Text>
        </Pressable>
        {recurring.error && (
          <Text accessibilityRole="alert" className="mt-3 text-sm text-red-400">
            {recurring.error.message}
          </Text>
        )}
        {sips.map((row) => (
          <View key={row.id} className="mt-4 border-t border-app-border pt-3">
            <Text className="text-sm font-medium text-app-text">
              {row.description || "Mutual fund SIP"}
            </Text>
            <Text className="mt-1 text-xs text-app-subtle">
              {formatMoney(row.amount)} ·{" "}
              {row.enabled ? `Next ${row.nextRunAt.slice(0, 10)}` : "Paused"}
            </Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/dashboard/recurring")}
          className="mt-3 min-h-11 justify-center"
        >
          <Text className="text-sm text-app-primary">Manage schedules →</Text>
        </Pressable>
      </View>
      <Text className="mb-3 mt-6 text-base font-semibold text-app-text">Investment activity</Text>
      {history.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : !rows.length ? (
        <Text className="py-6 text-center text-sm text-app-subtle">
          Start with a contribution or set up your first SIP.
        </Text>
      ) : (
        rows.map((row) => (
          <Pressable
            accessibilityRole="button"
            key={row.id}
            onPress={() => setDraft(row)}
            className="mb-3 flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-card p-4"
          >
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-medium text-app-text">
                {row.description || formatLabel(row.category ?? row.source ?? "investment")}
              </Text>
              <Text className="mt-1 text-xs text-app-subtle">
                {formatLabel(row.category ?? row.source ?? "investment")} ·{" "}
                {row.occurredAt.slice(0, 10)}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-app-text">
              {row.type === "expense" ? "−" : "+"}
              {formatMoney(row.amount)}
            </Text>
          </Pressable>
        ))
      )}
      {draft && (
        <TransactionEditor
          key={draft.id + (draft.category ?? draft.source)}
          transaction={draft}
          create={draft.id === "draft"}
          onClose={() => setDraft(null)}
        />
      )}
      <FormSheet
        visible={sip}
        title="Monthly SIP"
        onClose={() => setSip(false)}
        disabled={save.isPending}
        footer={
          <Pressable
            accessibilityRole="button"
            disabled={!valid || save.isPending}
            onPress={() => save.mutate()}
            className={`min-h-14 items-center justify-center rounded-2xl bg-app-primary ${!valid || save.isPending ? "opacity-40" : ""}`}
          >
            <Text className="font-semibold text-app-on-primary">
              {save.isPending ? "Saving…" : "Set up SIP"}
            </Text>
          </Pressable>
        }
      >
        <Text className="mb-2 text-sm text-app-subtle">Fund name</Text>
        <TextInput
          accessibilityLabel="Fund name"
          value={name}
          onChangeText={setName}
          maxLength={1000}
          placeholder="e.g. My index fund"
          placeholderTextColor={colors.subtle}
          className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-app-text"
        />
        <Text className="mb-2 mt-4 text-sm text-app-subtle">Monthly amount</Text>
        <TextInput
          accessibilityLabel="Monthly SIP amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.subtle}
          className="h-14 rounded-2xl border border-app-border bg-app-bg px-4 text-xl text-app-text"
        />
        <DateField value={date} onChange={setDate} label="First deduction" />
        <Text className="mt-4 text-xs leading-5 text-app-subtle">
          Uses the same day each month, or the last day of a shorter month. Past dates catch up
          missed deductions. Resuming a paused SIP catches up from its next due date.
        </Text>
        {save.error && (
          <Text accessibilityRole="alert" className="mt-4 text-sm text-red-400">
            {save.error.message}
          </Text>
        )}
      </FormSheet>
    </KeyboardScreen>
  );
}
