"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transactionsQuery } from "@/server/transactions";

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

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  createdAt: string;
};
type FilterType = "all" | "income" | "expense";

export default function TransactionsPage() {
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

  const filteredTransactions = transactions.filter((transaction) => {
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

      const text = [
        transaction.description,
        transaction.category,
        transaction.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!text.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const hasFilters =
    type !== "all" || category !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    setType("all");
    setCategory("all");
    setSearch("");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transactions
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your income and expenses.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          <span>{transactions.length} transactions</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transactions..."
                className="pl-9"
              />
            </div>

            {/* Type */}
            <Select
              value={type}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "income" ||
                  value === "expense"
                ) {
                  setType(value);
                }
              }}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All transactions</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>

            {/* Category */}
            <Select
              value={category}
              onValueChange={(value) => setCategory(value ?? "all")}
            >
              <SelectTrigger className="w-full lg:w-48">
                <SlidersHorizontal className="mr-2 size-4 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>

                {expenseCategories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatLabel(item)}
                  </SelectItem>
                ))}

                {incomeSources.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFilters}
                aria-label="Clear filters"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="rounded-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Transaction history</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isPending ? (
            <TransactionSkeleton />
          ) : isError ? (
            <div className="flex min-h-48 items-center justify-center px-6">
              <p className="text-sm text-destructive">
                Failed to load transactions.
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          ) : (
            <div className="divide-y">
              {filteredTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === "income";

  const label =
    transaction.description ||
    transaction.source ||
    transaction.category ||
    "Transaction";

  const secondaryLabel = isIncome ? transaction.source : transaction.category;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Icon */}
        <div
          className={[
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isIncome
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-600",
          ].join(" ")}
        >
          {isIncome ? (
            <ArrowUp className="size-4" />
          ) : (
            <ArrowDown className="size-4" />
          )}
        </div>

        {/* Information */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatLabel(label)}</p>

          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {secondaryLabel && (
              <>
                <span>{formatLabel(secondaryLabel)}</span>
                <span>•</span>
              </>
            )}

            <span>{formatDate(transaction.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Amount */}
      <div
        className={[
          "shrink-0 text-sm font-semibold",
          isIncome ? "text-emerald-600" : "text-red-600",
        ].join(" ")}
      >
        {isIncome ? "+" : "-"}
        {formatMoney(transaction.amount)}
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
        <Wallet className="size-5 text-muted-foreground" />
      </div>

      <h3 className="mt-4 text-sm font-medium">
        {hasFilters ? "No matching transactions" : "No transactions yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try changing your search or filters."
          : "Your income and expenses will appear here once you add them."}
      </p>

      {hasFilters && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between px-4 py-4 sm:px-6"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-xl bg-muted" />

            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>

          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
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
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
