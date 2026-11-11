"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, CalendarClock } from "lucide-react";
import { transactionsQuery } from "@/server/transactions";
import { getRecurring, saveRecurring } from "@/server/finance-features";
import { usePreferences } from "@/components/providers/preferences-provider";
import { TransactionComposer } from "@/components/transaction-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLabel } from "@/lib/finance";

export default function InvestmentsPage() {
  const { formatMoney } = usePreferences();
  const client = useQueryClient();
  const [entry, setEntry] = useState<
    "mutual-funds" | "investment-profit" | "investment-redemption" | null
  >(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const history = useQuery({
    queryKey: ["transactions", "investments"],
    queryFn: () =>
      transactionsQuery({ type: "all", category: "all", search: "" }),
  });
  const recurring = useQuery({
    queryKey: ["recurring"],
    queryFn: getRecurring,
  });
  const rows = (history.data?.data ?? []).filter((row) =>
    row.type === "expense"
      ? row.category === "mutual-funds"
      : ["investment-profit", "investment-redemption"].includes(
          row.source ?? "",
        ),
  );
  const total = (key: string) =>
    rows
      .filter((row) => (row.category ?? row.source) === key)
      .reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) /
    100;
  const sips = (recurring.data?.data ?? []).filter(
    (row) =>
      row.type === "expense" &&
      row.category === "mutual-funds" &&
      row.schedule === "monthly",
  );
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
      setAmount("");
      setName("");
      for (const key of [
        "recurring",
        "transactions",
        "dashboard-summary",
        "balance",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  return (
    <div className="space-y-6 pb-28">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <TrendingUp className="size-4" /> Build your future
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Investments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your mutual fund contributions, cash earnings, and monthly SIPs.
        </p>
      </div>
      {history.error && (
        <p role="alert" className="text-destructive">
          {history.error.message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total invested", "mutual-funds"],
          ["Profit received", "investment-profit"],
          ["Capital returned", "investment-redemption"],
        ].map(([label, key]) => (
          <div key={key} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {history.isPending ? "…" : formatMoney(total(key))}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Cash records only. Market value and unrealised gains are not included.
        Record the principal portion of a withdrawal as returned capital and the
        profit separately.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setEntry("mutual-funds")}>+ Invest</Button>
        <Button variant="outline" onClick={() => setEntry("investment-profit")}>
          + Record earnings
        </Button>
        <Button
          variant="outline"
          onClick={() => setEntry("investment-redemption")}
        >
          Return capital
        </Button>
      </div>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Monthly SIP</h2>
        </div>
        <p className="my-3 text-sm text-muted-foreground">
          Records a deduction from your app balance when due entries are
          processed. No bank debit is made. Past dates catch up missed entries.
        </p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="space-y-2 text-sm">
            <span>Fund name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={1000}
              required
              placeholder="e.g. My index fund"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Monthly amount</span>
            <Input
              type="number"
              min="0.01"
              max="999999999999.99"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>First deduction</span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <Button className="self-end" disabled={save.isPending} type="submit">
            {save.isPending ? "Saving…" : "Set up SIP"}
          </Button>
        </form>
        {save.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {save.error.message}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="mt-3 text-sm text-primary">
            SIP saved.
          </p>
        )}
        {recurring.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {recurring.error.message}
          </p>
        )}
        <div className="mt-5 divide-y">
          {sips.map((sip) => (
            <div
              key={sip.id}
              className="flex flex-wrap justify-between gap-2 py-3 text-sm"
            >
              <span>{sip.description || "Mutual fund SIP"}</span>
              <span>
                {formatMoney(sip.amount)} ·{" "}
                {sip.enabled ? `Next ${sip.nextRunAt.slice(0, 10)}` : "Paused"}
              </span>
            </div>
          ))}
        </div>
        <Link
          className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
          href="/dashboard/recurring"
        >
          Manage SIPs and schedules →
        </Link>
      </section>
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between p-5">
          <h2 className="font-semibold">Investment activity</h2>
          <Link href="/dashboard/transactions" className="text-sm text-primary">
            Edit in history →
          </Link>
        </div>
        {history.isPending ? (
          <p className="p-5 text-sm text-muted-foreground">
            Loading investments…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Start with a contribution or your first SIP.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-4 border-t p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.description ||
                    formatLabel(row.category ?? row.source ?? "investment")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatLabel(row.category ?? row.source ?? "investment")} ·{" "}
                  {row.occurredAt.slice(0, 10)}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">
                {row.type === "expense" ? "−" : "+"}
                {formatMoney(row.amount)}
              </p>
            </div>
          ))
        )}
      </section>
      {entry && (
        <TransactionComposer
          key={entry}
          type={entry === "mutual-funds" ? "expense" : "income"}
          initialCategory={entry}
          onClose={() => setEntry(null)}
        />
      )}
    </div>
  );
}
