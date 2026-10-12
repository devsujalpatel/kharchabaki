"use client";
import { useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  currentMonth,
  expenseCategories,
  incomeSources,
  categoryIcon,
  formatLabel,
} from "@/lib/finance";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  deleteTransaction,
  transactionsQuery,
  type Transaction,
  type TransactionFilters,
} from "@/server/transactions";
import { MonthPicker } from "@/components/month-picker";
import { TransactionEditor } from "@/components/transaction-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Transactions() {
  const { formatMoney } = usePreferences();
  const client = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState<TransactionFilters["type"]>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const query = useQuery({
    queryKey: ["transactions", month, type, category, search],
    queryFn: () =>
      transactionsQuery({ month: month || undefined, type, category, search }),
  });
  const deletion = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: async () => {
      await Promise.all(
        ["transactions", "dashboard-summary", "balance"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  const options =
    type === "income"
      ? incomeSources
      : type === "expense"
        ? expenseCategories
        : [...new Set([...expenseCategories, ...incomeSources])];
  const transactions = query.data?.data ?? [];
  return (
    <div className="space-y-6 pb-24 sm:mt-20">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse history and manage your income and expenses.
        </p>
      </div>
      <MonthPicker month={month} onChange={setMonth} allowAll />
      <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search transactions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transactions..."
            className="pl-9"
          />
        </div>
        <select
          aria-label="Transaction type"
          value={type}
          onChange={(event) => {
            setType(event.target.value as TransactionFilters["type"]);
            setCategory("all");
          }}
          className="rounded-lg border bg-card px-3 py-2"
        >
          {["all", "income", "expense"].map((option) => (
            <option value={option} key={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
        <select
          aria-label="Transaction category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="max-w-full rounded-lg border bg-card px-3 py-2"
        >
          <option value="all">All categories</option>
          {options.map((option) => (
            <option value={option} key={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
        {(search || category !== "all" || type !== "all") && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setType("all");
              setCategory("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">
          Transaction history · {transactions.length}
        </h2>
        {deletion.error && (
          <p role="alert" className="mb-4 text-destructive">
            {deletion.error.message}
          </p>
        )}
        {query.isPending ? (
          <p className="py-10 text-center text-muted-foreground">
            Loading transactions...
          </p>
        ) : query.error ? (
          <div>
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => query.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : !transactions.length ? (
          <p className="py-10 text-center text-muted-foreground">
            No transactions for this month or filter.
          </p>
        ) : (
          transactions.map((transaction) => {
            const Icon = categoryIcon(
              transaction.source ?? transaction.category,
            );
            const isIncome = transaction.type === "income";
            return (
              <div
                key={`${transaction.type}-${transaction.id}`}
                className="flex flex-wrap items-center gap-3 border-t py-4"
              >
                <div
                  className={`rounded-xl bg-muted p-3 ${isIncome ? "text-emerald-500" : "text-red-400"}`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-32 flex-1">
                  <p className="break-words font-medium">
                    {transaction.description ||
                      formatLabel(
                        transaction.source ?? transaction.category ?? "other",
                      )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatLabel(
                      transaction.source ?? transaction.category ?? "other",
                    )}{" "}
                    ·{" "}
                    {new Date(transaction.occurredAt).toLocaleDateString("en", {
                      timeZone: "UTC",
                    })}
                  </p>
                </div>
                <p
                  className={`font-semibold ${isIncome ? "text-emerald-500" : "text-red-400"}`}
                >
                  {isIncome ? "+" : "−"}
                  {formatMoney(transaction.amount)}
                </p>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${transaction.type}`}
                    disabled={deletion.isPending}
                    onClick={() => setEditing(transaction)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={`Delete ${transaction.type}`}
                    disabled={deletion.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete this ${transaction.type} of ${formatMoney(transaction.amount)}? Your balance will be updated.`,
                        )
                      )
                        deletion.mutate(transaction);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>
      {editing && (
        <TransactionEditor
          key={`${editing.type}-${editing.id}`}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
