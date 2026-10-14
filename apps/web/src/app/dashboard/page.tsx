"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Wallet } from "lucide-react";
import { useAppSession } from "@/components/providers/session-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { dashboardSummaryQuery } from "@/server/summary";
import { currentMonth } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/month-picker";
import { TransactionComposer } from "@/components/transaction-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  const { data: session } = useAppSession();
  const { formatMoney } = usePreferences();
  const [month, setMonth] = useState(currentMonth);
  const [entryType, setEntryType] = useState<"income" | "expense" | null>(null);
  const {
    data: summary,
    isPending,
    error,
  } = useQuery({
    queryKey: ["dashboard-summary", month],
    queryFn: () => dashboardSummaryQuery(month),
  });

  return (
    <div className="space-y-6 pb-24">
      <div>
        <p
          className="truncate text-sm font-medium text-muted-foreground"
          title={session?.user.name}
        >
          {session?.localOnly
            ? "Saved on this device"
            : `Welcome back, ${session?.user.name.split(" ")[0] || "there"}`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Your money
        </h1>
      </div>
      <MonthPicker month={month} onChange={setMonth} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          title="Balance"
          value={formatMoney(summary?.data.balance ?? 0)}
          icon={Wallet}
          loading={isPending}
        />
        <SummaryCard
          title="Income"
          value={formatMoney(summary?.data.income ?? 0)}
          icon={ArrowUp}
          loading={isPending}
          type="income"
        />
        <SummaryCard
          title="Expenses"
          value={formatMoney(summary?.data.expense ?? 0)}
          icon={ArrowDown}
          loading={isPending}
          type="expense"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      <section
        aria-label="Add a transaction"
        className="grid grid-cols-2 gap-3"
      >
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-24 flex-col items-start gap-3 rounded-2xl border-expense/20 bg-expense/5 p-4 hover:bg-expense/10"
          aria-haspopup="dialog"
          onClick={() => setEntryType("expense")}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-expense/10 text-expense">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-semibold">Add expense</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-24 flex-col items-start gap-3 rounded-2xl border-income/20 bg-income/5 p-4 hover:bg-income/10"
          aria-haspopup="dialog"
          onClick={() => setEntryType("income")}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-income/10 text-income">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-semibold">Add income</span>
        </Button>
      </section>
      {entryType && (
        <TransactionComposer
          key={entryType}
          type={entryType}
          onClose={() => setEntryType(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  loading,
  type,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading: boolean;
  type?: "income" | "expense";
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl",
        !type && "col-span-2 border-primary/25 bg-primary/5 sm:col-span-1",
        type === "income" && "bg-income/5",
        type === "expense" && "bg-expense/5",
      )}
    >
      <CardContent className="flex items-center justify-between gap-2 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <p
              className="mt-1 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl"
              title={value}
            >
              {value}
            </p>
          )}
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
            type === "income" && "bg-income/10 text-income",
            type === "expense" && "bg-expense/10 text-expense",
          )}
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}
