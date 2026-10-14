import {
  createElement,
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleAlert,
  CloudUpload,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
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
import { CategoryPicker } from "@/components/CategoryPicker";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionEditor } from "@/components/TransactionEditor";

const transactionTypes = [
  { value: "all", label: "All", icon: Receipt },
  { value: "income", label: "Income", icon: ArrowDownLeft },
  { value: "expense", label: "Expense", icon: ArrowUpRight },
] as const;

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function HistorySkeleton() {
  return (
    <View
      accessibilityLabel="Loading transactions"
      accessibilityRole="progressbar"
      className="gap-3"
    >
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="flex-row items-center gap-3 rounded-2xl border border-app-border bg-app-card p-4"
        >
          <View className="h-11 w-11 rounded-2xl bg-app-muted" />
          <View className="flex-1 gap-3">
            <View className="h-3 w-3/4 rounded-full bg-app-muted" />
            <View className="h-2 w-1/2 rounded-full bg-app-muted" />
          </View>
          <View className="h-4 w-16 rounded-full bg-app-muted" />
        </View>
      ))}
    </View>
  );
}

export default function Transactions() {
  const { colors, formatMoney, theme } = usePreferences();
  const client = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState<TransactionFilters["type"]>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const list = useRef<SectionList<Transaction>>(null);
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ["transactions", month, type, category, deferredSearch],
    queryFn: () =>
      transactionsQuery({ month: month || undefined, type, category, search: deferredSearch }),
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
  const options = useMemo(
    () =>
      type === "income"
        ? incomeSources
        : type === "expense"
          ? expenseCategories
          : [...new Set([...expenseCategories, ...incomeSources])],
    [type]
  );
  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    const sorted = [...(query.data?.data ?? [])].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt)
    );
    for (const transaction of sorted) {
      const date = transaction.occurredAt.slice(0, 10);
      const group = byDate.get(date) ?? [];
      group.push(transaction);
      byDate.set(date, group);
    }
    return [...byDate.entries()].map(([date, data]) => ({ key: date, date, data }));
  }, [query.data?.data]);
  const hasFilters = !!search || category !== "all" || type !== "all";
  const lightTheme = theme === "light" || theme === "rose";
  const incomeColor = lightTheme ? "#047857" : "#6ee7b7";
  const expenseColor = lightTheme ? "#be123c" : "#fda4af";
  const remove = deletion.mutate;
  const confirmDelete = useCallback(
    (transaction: Transaction) =>
      Alert.alert(
        `Delete ${transaction.type}?`,
        `${formatMoney(transaction.amount)} will be removed and your balance updated.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => remove(transaction),
          },
        ]
      ),
    [formatMoney, remove]
  );

  const header = (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-3xl font-semibold text-app-text">
          Transactions
        </Text>
        {query.isFetching && !query.isPending ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Refreshing history" />
        ) : (
          <View className="rounded-full bg-app-muted px-3 py-1.5">
            <Text className="text-sm font-medium text-app-subtle">
              {query.data?.data.length ?? 0}
            </Text>
          </View>
        )}
      </View>
      <MonthPicker month={month} onChange={setMonth} allowAll />

      <View className="gap-3 rounded-2xl border border-app-border bg-app-card p-3">
        <View className="flex-row items-center gap-2 rounded-xl bg-app-bg pl-3">
          <Search size={18} color={colors.subtle} />
          <TextInput
            accessibilityLabel="Search transactions"
            value={search}
            onChangeText={setSearch}
            onFocus={() => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true })}
            placeholder="Search"
            placeholderTextColor={colors.subtle}
            returnKeyType="search"
            className="h-12 min-w-0 flex-1 text-app-text"
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={18} color={colors.subtle} />
            </Pressable>
          )}
        </View>
        <View accessibilityRole="tablist" className="flex-row gap-1 rounded-xl bg-app-muted p-1">
          {transactionTypes.map(({ value, label, icon: Icon }) => {
            const selected = type === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  setType(value);
                  setCategory("all");
                }}
                className={`h-11 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${selected ? "bg-app-primary" : ""}`}
              >
                <Icon size={15} color={selected ? colors.onPrimary : colors.subtle} />
                <Text
                  numberOfLines={1}
                  className={`text-xs font-semibold ${selected ? "text-app-on-primary" : "text-app-subtle"}`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row items-end gap-2">
          <View className="min-w-0 flex-1">
            <CategoryPicker
              value={category}
              onChange={setCategory}
              options={options}
              label={type === "income" ? "Source" : "Category"}
              includeAll
            />
          </View>
          {hasFilters && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset transaction filters"
              onPress={() => {
                setSearch("");
                setType("all");
                setCategory("all");
              }}
              className="h-12 w-12 items-center justify-center rounded-xl border border-app-border"
            >
              <RotateCcw size={18} color={colors.subtle} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
  const empty = (
    <View className="mt-5">
      {query.isPending ? (
        <HistorySkeleton />
      ) : query.error ? (
        <View
          accessibilityRole="alert"
          className="items-center gap-4 rounded-2xl border border-app-border bg-app-card px-6 py-8"
        >
          <CircleAlert size={28} color={colors.subtle} />
          <Text className="text-center text-sm text-app-subtle">{query.error.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading transactions"
            onPress={() => query.refetch()}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-app-primary px-5"
          >
            <RotateCcw size={16} color={colors.onPrimary} />
            <Text className="font-semibold text-app-on-primary">Retry</Text>
          </Pressable>
        </View>
      ) : !groups.length ? (
        <View className="items-center rounded-2xl border border-app-border bg-app-card px-6 py-10">
          <View className="mb-4 rounded-2xl bg-app-muted p-4">
            {hasFilters ? (
              <Search size={26} color={colors.subtle} />
            ) : (
              <Receipt size={26} color={colors.subtle} />
            )}
          </View>
          <Text className="font-semibold text-app-text">
            {hasFilters ? "No matches" : "No transactions yet"}
          </Text>
          <Text className="mt-2 text-center text-sm text-app-subtle">
            {hasFilters
              ? "Try another search or category."
              : "Your income and expenses appear here."}
          </Text>
          {hasFilters && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear transaction filters"
              onPress={() => {
                setSearch("");
                setType("all");
                setCategory("all");
              }}
              className="mt-4 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-app-muted px-4"
            >
              <RotateCcw size={16} color={colors.foreground} />
              <Text className="text-sm font-medium text-app-text">Reset filters</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: Transaction;
      index: number;
      section: { data: readonly Transaction[] };
    }) => (
      <TransactionRow
        transaction={item}
        first={index === 0}
        last={index === section.data.length - 1}
        incomeColor={incomeColor}
        expenseColor={expenseColor}
        formatMoney={formatMoney}
        subtle={colors.subtle}
        primary={colors.primary}
        busy={deletion.isPending}
        deleting={
          deletion.isPending &&
          deletion.variables?.id === item.id &&
          deletion.variables?.type === item.type
        }
        onEdit={setEditing}
        onDelete={confirmDelete}
      />
    ),
    [
      incomeColor,
      expenseColor,
      formatMoney,
      colors.subtle,
      colors.primary,
      deletion.isPending,
      deletion.variables,
      confirmDelete,
    ]
  );
  return (
    <View className="flex-1 bg-app-bg">
      <SectionList
        ref={list}
        sections={query.isPending || query.error ? [] : groups}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text className="mb-2 mt-5 px-1 text-xs font-semibold text-app-subtle">
            {dateLabel(section.date)}
          </Text>
        )}
        ListHeaderComponent={
          <View>
            {header}
            {deletion.error && (
              <View
                accessibilityRole="alert"
                className="mt-5 flex-row items-center gap-2 rounded-2xl border border-app-border bg-app-card p-4"
              >
                <CircleAlert size={18} color={expenseColor} />
                <Text className="min-w-0 flex-1 text-sm text-app-text">
                  {deletion.error.message}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss delete error"
                  onPress={() => deletion.reset()}
                  className="h-11 w-11 items-center justify-center"
                >
                  <X size={18} color={colors.subtle} />
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}
      />
      {editing && (
        <TransactionEditor
          key={`${editing.type}-${editing.id}`}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  first,
  last,
  incomeColor,
  expenseColor,
  formatMoney,
  subtle,
  primary,
  busy,
  deleting,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  first: boolean;
  last: boolean;
  incomeColor: string;
  expenseColor: string;
  formatMoney: (value: number | string) => string;
  subtle: string;
  primary: string;
  busy: boolean;
  deleting: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}) {
  const categoryLabel = formatLabel(transaction.source ?? transaction.category ?? "other");
  const title = transaction.description?.trim() || categoryLabel;
  const Icon = categoryIcon(transaction.source ?? transaction.category);
  const isIncome = transaction.type === "income";
  const tone = isIncome ? incomeColor : expenseColor;
  return (
    <View
      className={`flex-row items-center gap-3 border-x border-app-border bg-app-card px-3 py-2 ${first ? "rounded-t-2xl border-t" : "border-t"} ${last ? "rounded-b-2xl border-b" : ""}`}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${tone}18` }}
      >
        {createElement(Icon, { size: 21, color: tone })}
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        <Text numberOfLines={1} className="text-sm font-semibold text-app-text">
          {title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="min-w-0 shrink text-xs text-app-subtle">
            {transaction.description?.trim() ? categoryLabel : formatLabel(transaction.type)}
          </Text>
          {transaction.pending && (
            <View accessible accessibilityLabel="Waiting to sync">
              <CloudUpload size={13} color={primary} />
            </View>
          )}
        </View>
      </View>
      <View className="max-w-[45%] items-end">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{ color: tone, fontVariant: ["tabular-nums"] }}
          className="mt-2 text-sm font-semibold"
        >
          {isIncome ? "+" : "−"}
          {formatMoney(transaction.amount)}
        </Text>
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${transaction.type}: ${title}`}
            disabled={busy}
            onPress={() => onEdit(transaction)}
            className={`h-11 w-11 items-center justify-center ${busy ? "opacity-40" : ""}`}
          >
            <Pencil size={16} color={subtle} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${transaction.type}: ${title}`}
            disabled={busy}
            onPress={() => onDelete(transaction)}
            className={`h-11 w-11 items-center justify-center ${busy && !deleting ? "opacity-40" : ""}`}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={expenseColor} />
            ) : (
              <Trash2 size={16} color={expenseColor} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
});
