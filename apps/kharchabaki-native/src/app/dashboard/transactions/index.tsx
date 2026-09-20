import { type JSX, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, Wallet, X } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

const expenseCategories = [
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
] as const;

const incomeSources = [
  "salary",
  "pocket-money",
  "gift",
  "investment",
  "bonus",
  "part-time",
  "other",
] as const;

type TransactionType = "income" | "expense";

type FilterType = "all" | "income" | "expense";

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  createdAt: string;
};

type TransactionsResponse = {
  success: boolean;
  message: string;
  data: Transaction[];
};

async function transactionsQuery({
  type,
  category,
  search,
}: {
  type: FilterType;
  category: string;
  search: string;
}): Promise<TransactionsResponse> {
  const params = new URLSearchParams();

  if (type !== "all") {
    params.set("type", type);
  }

  if (category !== "all") {
    params.set("category", category);
  }

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();

  const response = await api(`/api/v1/transactions${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error("Failed to load transactions");
  }

  return response.json();
}

export default function Transactions(): JSX.Element {
  const [type, setType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data, isPending, isError } = useQuery({
    queryKey: ["transactions", type, category, search],
    queryFn: () =>
      transactionsQuery({
        type,
        category,
        search,
      }),
  });

  const transactions = data?.data ?? [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (type !== "all" && transaction.type !== type) {
        return false;
      }

      if (
        category !== "all" &&
        transaction.category !== category &&
        transaction.source !== category
      ) {
        return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();

        const text = [transaction.description, transaction.category, transaction.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, type, category, search]);

  const hasFilters = type !== "all" || category !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    setType("all");
    setCategory("all");
    setSearch("");
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-32 pt-6"
      >
        {/* Header */}

        <View className="mb-6">
          <Text className="text-3xl font-semibold tracking-tight text-white">Transactions</Text>

          <Text className="mt-1 text-sm text-zinc-500">
            View and manage your income and expenses.
          </Text>

          <View className="mt-4 flex-row items-center">
            <Wallet size={15} color="#71717a" />

            <Text className="ml-2 text-sm text-zinc-500">{transactions.length} transactions</Text>
          </View>
        </View>

        {/* Filters */}

        <View className="rounded-[22px] border border-zinc-900 bg-[#050604] p-4">
          {/* Search */}

          <View className="flex-row items-center rounded-xl border border-zinc-800 bg-[#0b0d09] px-3">
            <Search size={18} color="#71717a" />

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search transactions..."
              placeholderTextColor="#52525b"
              className="h-11 flex-1 px-3 text-white"
            />

            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <X size={17} color="#71717a" />
              </Pressable>
            )}
          </View>

          {/* Type */}

          <View className="mt-4">
            <Text className="mb-2 text-xs font-medium text-zinc-500">Type</Text>

            <View className="flex-row rounded-xl bg-zinc-900 p-1">
              <FilterButton label="All" active={type === "all"} onPress={() => setType("all")} />

              <FilterButton
                label="Income"
                active={type === "income"}
                onPress={() => setType("income")}
              />

              <FilterButton
                label="Expenses"
                active={type === "expense"}
                onPress={() => setType("expense")}
              />
            </View>
          </View>

          {/* Category */}

          <View className="mt-4">
            <View className="mb-2 flex-row items-center">
              <SlidersHorizontal size={14} color="#71717a" />

              <Text className="ml-2 text-xs font-medium text-zinc-500">Category</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <CategoryButton
                label="All"
                active={category === "all"}
                onPress={() => setCategory("all")}
              />

              {expenseCategories.map((item) => (
                <CategoryButton
                  key={item}
                  label={formatLabel(item)}
                  active={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}

              {incomeSources.map((item) => (
                <CategoryButton
                  key={`income-${item}`}
                  label={formatLabel(item)}
                  active={category === item}
                  onPress={() => setCategory(item)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Clear */}

          {hasFilters && (
            <Pressable
              onPress={clearFilters}
              className="mt-4 flex-row items-center justify-center rounded-xl border border-zinc-800 py-3"
            >
              <X size={16} color="#a1a1aa" />

              <Text className="ml-2 text-sm text-zinc-400">Clear filters</Text>
            </Pressable>
          )}
        </View>

        {/* History */}

        <View className="mt-6 overflow-hidden rounded-[22px] border border-zinc-900 bg-[#050604]">
          <View className="border-b border-zinc-900 p-5">
            <Text className="text-base font-medium text-white">Transaction history</Text>
          </View>

          {isPending ? (
            <TransactionLoading />
          ) : isError ? (
            <View className="items-center justify-center px-6 py-16">
              <Text className="text-sm text-red-400">Failed to load transactions.</Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          ) : (
            <View>
              {filteredTransactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === "income";

  const label =
    transaction.description || transaction.source || transaction.category || "Transaction";

  const secondaryLabel = isIncome ? transaction.source : transaction.category;

  return (
    <View className="flex-row items-start border-b border-zinc-900 px-4 py-4">
      {/* Icon */}

      <View
        className={`h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isIncome ? "bg-emerald-500/10" : "bg-red-500/10"
        }`}
      >
        {isIncome ? <ArrowUp size={18} color="#34d399" /> : <ArrowDown size={18} color="#f87171" />}
      </View>

      {/* Info */}

      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-white">
          {formatLabel(label)}
        </Text>

        <View className="mt-1 flex-row items-center">
          {secondaryLabel && (
            <>
              <Text numberOfLines={1} className="max-w-30 text-[10px] text-zinc-500">
                {formatLabel(secondaryLabel)}
              </Text>

              <Text className="mx-1 text-xs text-zinc-700">•</Text>
            </>
          )}

          <Text className="text-[10px] text-zinc-600">{formatDate(transaction.createdAt)}</Text>
        </View>
      </View>

      {/* Amount */}

      <Text
        className={`ml-3 text-sm font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}`}
      >
        {isIncome ? "+" : "-"}
        {formatMoney(transaction.amount)}
      </Text>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-2.5 ${active ? "bg-zinc-700" : ""}`}
    >
      <Text className={`text-sm ${active ? "font-medium text-white" : "text-zinc-500"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function CategoryButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-4 py-2 ${
        active ? "border-white bg-white" : "border-zinc-800 bg-zinc-950"
      }`}
    >
      <Text className={`text-xs ${active ? "font-medium text-black" : "text-zinc-500"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function TransactionLoading() {
  return (
    <View className="py-16">
      <ActivityIndicator size="small" color="#ffffff" />

      <Text className="mt-3 text-center text-sm text-zinc-500">Loading transactions...</Text>
    </View>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <View className="items-center justify-center px-6 py-16">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900">
        <Wallet size={20} color="#71717a" />
      </View>

      <Text className="mt-4 text-sm font-medium text-white">
        {hasFilters ? "No matching transactions" : "No transactions yet"}
      </Text>

      <Text className="mt-1 text-center text-sm text-zinc-500">
        {hasFilters
          ? "Try changing your search or filters."
          : "Your income and expenses will appear here once you add them."}
      </Text>

      {hasFilters && (
        <Pressable onPress={onClear} className="mt-4 rounded-xl border border-zinc-800 px-5 py-2.5">
          <Text className="text-sm text-zinc-300">Clear filters</Text>
        </Pressable>
      )}
    </View>
  );
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
