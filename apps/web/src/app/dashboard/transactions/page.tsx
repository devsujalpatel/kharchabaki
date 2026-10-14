"use client";

import { useState } from "react";
import {
  CloudUpload,
  Download,
  Upload,
  Loader2,
  Pencil,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  currentMonth,
  expenseCategories,
  incomeSources,
  categoryIcon,
  formatLabel,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  deleteTransaction,
  transactionsQuery,
  type Transaction,
  type TransactionFilters,
} from "@/server/transactions";
import { MonthPicker } from "@/components/month-picker";
import { CategoryPicker } from "@/components/category-picker";
import { TransactionEditor } from "@/components/transaction-editor";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLabels } from "@/server/finance-features";
import { downloadArchive, downloadCsv, importCsv, restoreArchive } from "./portability";

export default function Transactions() {
  const { formatMoney } = usePreferences();
  const client = useQueryClient();
  const labelQuery = useQuery({ queryKey: ["finance-labels"], queryFn: getLabels });
  const customLabels = (labelQuery.data?.data ?? []).filter((item) => item.active).map((item) => item.key);
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState<TransactionFilters["type"]>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [removing, setRemoving] = useState<Transaction | null>(null);
  const [importError, setImportError] = useState("");
  const allTransactions = useQuery({
    queryKey: ["transactions", "all-export"],
    queryFn: () => transactionsQuery({ type: "all", category: "all", search: "" }),
  });
  const query = useQuery({
    queryKey: ["transactions", month, type, category, search],
    queryFn: () =>
      transactionsQuery({ month: month || undefined, type, category, search }),
  });
  const deletion = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: async () => {
      setRemoving(null);
      await Promise.all(
        ["transactions", "dashboard-summary", "balance"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
  const options =
    type === "income"
      ? [...incomeSources, ...customLabels.filter((key) => labelQuery.data?.data.some((item) => item.kind === "income" && item.key === key))]
      : type === "expense"
        ? [...expenseCategories, ...customLabels.filter((key) => labelQuery.data?.data.some((item) => item.kind === "expense" && item.key === key))]
        : [...new Set([...expenseCategories, ...incomeSources, ...customLabels])];
  const transactions = [...(query.data?.data ?? [])].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const day = transaction.occurredAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), transaction]);
  }
  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold tracking-tight">Transactions</h1><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Export transactions CSV" title="Export CSV" onClick={() => downloadCsv(allTransactions.data?.data ?? [])}><Download className="size-4"/></Button><label className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border" aria-label="Import transactions CSV"><Upload className="size-4"/><input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file, setImportError, client); event.currentTarget.value = ""; }}/></label><Button variant="outline" size="icon" aria-label="Export finance backup" title="Export backup" onClick={() => downloadArchive()}><Download className="size-4"/></Button><label className="inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border" aria-label="Restore finance backup"><Upload className="size-4"/><input className="sr-only" type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreArchive(file, setImportError, client); event.currentTarget.value = ""; }}/></label></div></div>
      {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
      <MonthPicker month={month} onChange={setMonth} allowAll />
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Search transactions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="h-11 rounded-xl bg-card pl-9 pr-10"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-1 top-1.5"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "size-11 shrink-0 rounded-xl",
            category !== "all" && "border-primary bg-primary/10 text-primary",
          )}
          aria-label="Filter transactions"
          title="Filters"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>
      <div
        className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1"
        aria-label="Transaction type"
      >
        {(["all", "income", "expense"] as const).map((option) => (
          <Button
            key={option}
            variant={type === option ? "default" : "ghost"}
            aria-pressed={type === option}
            onClick={() => {
              setType(option);
              setCategory("all");
            }}
            className={cn(
              "h-10 rounded-xl text-xs",
              type === option &&
                "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            {option === "all"
              ? "All"
              : option === "income"
                ? "Income"
                : "Expenses"}
          </Button>
        ))}
      </div>
      {category !== "all" && (
        <button
          type="button"
          aria-label="Clear category filter"
          onClick={() => setCategory("all")}
          className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary"
        >
          {formatLabel(category)}
          <X className="size-3" />
        </button>
      )}
      <section
        aria-label="Transaction history"
        className="overflow-hidden rounded-2xl border bg-card"
      >
        {query.isPending ? (
          <div
            className="space-y-4 p-5"
            aria-label="Loading transactions"
            role="status"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="size-10 shrink-0 animate-pulse rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : query.error ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-destructive">
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
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
            <Receipt className="size-8 opacity-50" />
            <p className="text-sm">No transactions here yet</p>
          </div>
        ) : (
          [...groups].map(([day, entries]) => (
            <div key={day}>
              <div className="flex items-center justify-between border-y border-border/50 bg-muted/30 px-4 py-2.5 first:border-t-0">
                <h2 className="text-xs font-semibold text-muted-foreground">
                  {dayLabel(day)}
                </h2>
                <span
                  className="text-[11px] tabular-nums text-muted-foreground"
                  aria-label={`${entries.length} transactions`}
                >
                  {entries.length}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {entries.map((transaction) => {
                  const categoryName =
                    transaction.source ?? transaction.category ?? "other";
                  const Icon = categoryIcon(categoryName);
                  const isIncome = transaction.type === "income";
                  const title =
                    transaction.description || formatLabel(categoryName);
                  const money = `${isIncome ? "+" : "−"}${formatMoney(transaction.amount)}`;
                  return (
                    <article
                      key={`${transaction.type}-${transaction.id}`}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-2xl",
                          isIncome
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium"
                          title={title}
                        >
                          {title}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">
                            {formatLabel(categoryName)}
                          </span>
                          {transaction.pending && (
                            <CloudUpload
                              className="size-3 shrink-0 text-primary"
                              aria-label="Waiting to sync"
                            />
                          )}
                        </p>
                      </div>
                      <div className="min-w-0 max-w-[38vw] text-right">
                        <p
                          className={cn(
                            "truncate text-sm font-semibold tabular-nums",
                            isIncome ? "text-emerald-500" : "text-red-500",
                          )}
                          title={money}
                        >
                          {money}
                        </p>
                        <div className="mt-1 flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 rounded-xl text-muted-foreground"
                            aria-label={`Edit ${transaction.type}: ${title}`}
                            title="Edit"
                            disabled={deletion.isPending}
                            onClick={() => setEditing(transaction)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 rounded-xl text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${transaction.type}: ${title}`}
                            title="Delete"
                            disabled={deletion.isPending}
                            onClick={() => {
                              deletion.reset();
                              setRemoving(transaction);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
      {filtersOpen && (
        <FormDialog
          title="Filters"
          icon={SlidersHorizontal}
          onClose={() => setFiltersOpen(false)}
        >
          <div className="space-y-4">
            <CategoryPicker
              label="Category"
              options={["all", ...options]}
              value={category}
              onChange={setCategory}
            />
            <div className="flex gap-2">
              <Button
                className="h-11 flex-1 rounded-xl"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setType("all");
                  setCategory("all");
                }}
              >
                Reset
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl"
                onClick={() => setFiltersOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </FormDialog>
      )}
      {editing && (
        <TransactionEditor
          key={`${editing.type}-${editing.id}`}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <FormDialog
          title={`Delete ${removing.type}?`}
          icon={Trash2}
          onClose={() => setRemoving(null)}
          busy={deletion.isPending}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p
                className="truncate text-sm text-muted-foreground"
                title={removing.description ?? undefined}
              >
                {removing.description ||
                  formatLabel(removing.source ?? removing.category ?? "other")}
              </p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums">
                {formatMoney(removing.amount)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your balance will be updated.
            </p>
            {deletion.error && (
              <p role="alert" className="text-sm text-destructive">
                {deletion.error.message}
              </p>
            )}
            <Button
              variant="destructive"
              className="h-12 w-full rounded-xl"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate(removing)}
            >
              {deletion.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}{" "}
              Delete
            </Button>
          </div>
        </FormDialog>
      )}
    </div>
  );
}

function dayLabel(day: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
